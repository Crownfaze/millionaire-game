import type { Server, Socket } from 'socket.io';
import type Database from 'better-sqlite3';

interface RoomTimer {
  intervalId: NodeJS.Timeout | null;
  remaining: number;
  duration: number;
  isPaused: boolean;
}

// In-memory game state per room
interface RoomGameState {
  hostSocketId: string | null;
  hostId: string;
  currentQuestion: {
    text: string;
    answers: Array<{ label: string; text: string }>;
    correctIndex: number;
  } | null;
  currentLevel: number;
  lifelines: { fiftyFifty: boolean; phoneAFriend: boolean; askAudience: boolean };
  hiddenAnswers: number[];
  showCorrectAnswer: boolean;
  selectedAnswer: number | null;
  status: 'waiting' | 'playing' | 'finished';
}

const roomTimers = new Map<string, RoomTimer>();
const roomStates = new Map<string, RoomGameState>();

export function setupSocketHandlers(io: Server, db: Database.Database) {
  io.on('connection', (socket: Socket) => {
    console.log(`🔌 Client connected: ${socket.id}`);

    // ── Admin joins room as host ──
    socket.on('admin:join', (data: { roomCode: string; hostId: string }) => {
      const { roomCode, hostId } = data;

      const room = db.prepare('SELECT * FROM rooms WHERE code = ?').get(roomCode) as Record<string, unknown> | undefined;
      if (!room) {
        socket.emit('error', { message: 'Комната не найдена' });
        return;
      }

      socket.join(roomCode);

      // Initialize or update game state
      if (!roomStates.has(roomCode)) {
        roomStates.set(roomCode, {
          hostSocketId: socket.id,
          hostId,
          currentQuestion: null,
          currentLevel: 0,
          lifelines: { fiftyFifty: true, phoneAFriend: true, askAudience: true },
          hiddenAnswers: [],
          showCorrectAnswer: false,
          selectedAnswer: null,
          status: 'waiting',
        });
      } else {
        const state = roomStates.get(roomCode)!;
        state.hostSocketId = socket.id;
      }

      socket.emit('admin:joined', { roomCode });
      console.log(`👑 Admin joined room ${roomCode}`);
    });

    // ── Player joins room ──
    socket.on('room:join', (data: { roomCode: string; playerName: string }) => {
      const { roomCode, playerName } = data;

      const room = db.prepare('SELECT * FROM rooms WHERE code = ?').get(roomCode) as Record<string, unknown> | undefined;
      if (!room) {
        socket.emit('error', { message: 'Комната не найдена' });
        return;
      }

      socket.join(roomCode);

      // Check for existing participant with same name (reconnect)
      const existing = db.prepare('SELECT * FROM participants WHERE room_code = ? AND name = ?').get(roomCode, playerName) as Record<string, unknown> | undefined;
      if (existing) {
        db.prepare('UPDATE participants SET socket_id = ? WHERE id = ?').run(socket.id, existing.id);
      } else {
        db.prepare('INSERT INTO participants (room_code, socket_id, name) VALUES (?, ?, ?)').run(roomCode, socket.id, playerName);
      }

      const participants = db.prepare('SELECT * FROM participants WHERE room_code = ?').all(roomCode);

      // Send current game state to the player
      const gameState = roomStates.get(roomCode);
      socket.emit('room:joined', {
        roomCode,
        playerName,
        roomName: room.name as string,
        status: room.status as string,
        gameState: gameState ? {
          currentQuestion: gameState.currentQuestion ? {
            text: gameState.currentQuestion.text,
            answers: gameState.currentQuestion.answers,
            // Don't send correct index to players
          } : null,
          currentLevel: gameState.currentLevel,
          lifelines: gameState.lifelines,
          hiddenAnswers: gameState.hiddenAnswers,
          showCorrectAnswer: gameState.showCorrectAnswer,
          selectedAnswer: gameState.selectedAnswer,
          status: gameState.status,
        } : null,
      });

      // Notify everyone in room
      io.to(roomCode).emit('room:update', { participants });
      console.log(`👤 ${playerName} joined room ${roomCode}`);
    });

    // ── Admin sends new question ──
    socket.on('game:question', (data: {
      roomCode: string;
      question: {
        text: string;
        answers: Array<{ label: string; text: string }>;
        correctIndex: number;
      };
      level: number;
      timerDuration: number;
    }) => {
      const { roomCode, question, level, timerDuration } = data;
      const state = roomStates.get(roomCode);
      if (!state) return;

      state.currentQuestion = question;
      state.currentLevel = level;
      state.showCorrectAnswer = false;
      state.selectedAnswer = null;
      state.hiddenAnswers = [];
      state.status = 'playing';

      // Update room status in DB
      db.prepare("UPDATE rooms SET status = 'playing' WHERE code = ?").run(roomCode);
      db.prepare("UPDATE participants SET status = 'active' WHERE room_code = ?").run(roomCode);

      // Start timer
      startTimer(io, roomCode, timerDuration);

      // Send to all players (without correct index!)
      io.to(roomCode).emit('game:question', {
        question: {
          text: question.text,
          answers: question.answers,
        },
        level,
        timerDuration,
      });

      console.log(`📝 Question sent to room ${roomCode}: ${question.text.substring(0, 30)}...`);
    });

    // ── Admin reveals answer ──
    socket.on('game:reveal', (data: { roomCode: string; correctIndex: number }) => {
      const { roomCode, correctIndex } = data;
      const state = roomStates.get(roomCode);
      if (!state) return;

      state.showCorrectAnswer = true;
      stopTimer(roomCode);

      io.to(roomCode).emit('game:reveal', { correctIndex });
    });

    // ── Admin selects an answer (visual) ──
    socket.on('game:selectAnswer', (data: { roomCode: string; answerIndex: number }) => {
      const { roomCode, answerIndex } = data;
      const state = roomStates.get(roomCode);
      if (!state) return;

      state.selectedAnswer = answerIndex;
      io.to(roomCode).emit('game:selectAnswer', { answerIndex });
    });

    // ── Admin uses lifeline ──
    socket.on('game:lifeline', (data: {
      roomCode: string;
      type: '5050' | 'phone' | 'audience';
      hiddenAnswers?: number[];
      phoneResult?: string;
      audienceResult?: number[];
    }) => {
      const { roomCode, type, hiddenAnswers, phoneResult, audienceResult } = data;
      const state = roomStates.get(roomCode);
      if (!state) return;

      if (type === '5050') {
        state.lifelines.fiftyFifty = false;
        if (hiddenAnswers) state.hiddenAnswers = hiddenAnswers;
      }
      if (type === 'phone') state.lifelines.phoneAFriend = false;
      if (type === 'audience') state.lifelines.askAudience = false;

      io.to(roomCode).emit('game:lifeline', { type, hiddenAnswers, phoneResult, audienceResult });
    });

    // ── Admin resets lifelines ──
    socket.on('game:resetLifelines', (data: { roomCode: string }) => {
      const state = roomStates.get(data.roomCode);
      if (!state) return;

      state.lifelines = { fiftyFifty: true, phoneAFriend: true, askAudience: true };
      state.hiddenAnswers = [];

      io.to(data.roomCode).emit('game:resetLifelines');
    });

    // ── Timer controls from admin ──
    socket.on('timer:pause', (data: { roomCode: string }) => {
      pauseTimer(data.roomCode);
      io.to(data.roomCode).emit('timer:paused');
    });

    socket.on('timer:resume', (data: { roomCode: string }) => {
      resumeTimer(io, data.roomCode);
      io.to(data.roomCode).emit('timer:resumed');
    });

    socket.on('timer:reset', (data: { roomCode: string; duration: number }) => {
      stopTimer(data.roomCode);
      startTimer(io, data.roomCode, data.duration);
      io.to(data.roomCode).emit('timer:reset', { duration: data.duration });
    });

    // ── Player submits answer ──
    socket.on('answer:submit', (data: {
      roomCode: string;
      answerIndex: number;
    }) => {
      const { roomCode, answerIndex } = data;

      db.prepare("UPDATE participants SET status = 'answered' WHERE room_code = ? AND socket_id = ?")
        .run(roomCode, socket.id);

      const participant = db.prepare('SELECT name FROM participants WHERE socket_id = ?').get(socket.id) as { name: string } | undefined;

      // Notify admin
      io.to(roomCode).emit('answer:received', {
        socketId: socket.id,
        playerName: participant?.name || 'Unknown',
        answerIndex,
      });

      // Send updated participants
      const participants = db.prepare('SELECT * FROM participants WHERE room_code = ?').all(roomCode);
      io.to(roomCode).emit('room:update', { participants });
    });

    // ── End game ──
    socket.on('game:end', (data: { roomCode: string }) => {
      const { roomCode } = data;
      stopTimer(roomCode);
      db.prepare("UPDATE rooms SET status = 'finished' WHERE code = ?").run(roomCode);
      roomStates.delete(roomCode);
      io.to(roomCode).emit('game:end', { message: 'Игра завершена!' });
    });

    // ── Disconnect ──
    socket.on('disconnect', () => {
      db.prepare('DELETE FROM participants WHERE socket_id = ?').run(socket.id);

      // Update participant lists in all rooms this socket was in
      // (Socket.IO already removed them from rooms)
      console.log(`🔌 Client disconnected: ${socket.id}`);
    });
  });
}

function startTimer(io: Server, roomCode: string, duration: number) {
  stopTimer(roomCode);

  const timer: RoomTimer = {
    remaining: duration,
    duration,
    isPaused: false,
    intervalId: null,
  };

  timer.intervalId = setInterval(() => {
    if (timer.isPaused) return;

    timer.remaining--;
    io.to(roomCode).emit('timer:sync', { remaining: timer.remaining, total: timer.duration });

    if (timer.remaining <= 0) {
      stopTimer(roomCode);
      io.to(roomCode).emit('timer:expired');
    }
  }, 1000);

  roomTimers.set(roomCode, timer);
}

function stopTimer(roomCode: string) {
  const timer = roomTimers.get(roomCode);
  if (timer?.intervalId) {
    clearInterval(timer.intervalId);
    timer.intervalId = null;
  }
  roomTimers.delete(roomCode);
}

function pauseTimer(roomCode: string) {
  const timer = roomTimers.get(roomCode);
  if (timer) {
    timer.isPaused = true;
  }
}

function resumeTimer(io: Server, roomCode: string) {
  const timer = roomTimers.get(roomCode);
  if (timer) {
    timer.isPaused = false;
  }
}
