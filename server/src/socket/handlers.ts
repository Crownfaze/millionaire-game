import type { Server, Socket } from 'socket.io';
import type Database from 'better-sqlite3';

interface RoomTimer {
  intervalId: NodeJS.Timeout | null;
  remaining: number;
  duration: number;
  isPaused: boolean;
}

interface GameQuestion {
  id: number;
  text: string;
  answer_a: string;
  answer_b: string;
  answer_c: string;
  answer_d: string;
  correct_index: number;
}

interface RoomGameState {
  hostSocketId: string | null;
  hostId: string;
  currentQuestion: {
    text: string;
    answers: Array<{ label: string; text: string }>;
    correctIndex: number;
  } | null;
  currentLevel: number;
  currentQuestionIdx: number;
  gameQueue: GameQuestion[];          // persisted question order
  lifelines: { fiftyFifty: boolean; phoneAFriend: boolean; askAudience: boolean };
  lifelineResults: {
    phoneResult: string | null;
    audienceResult: number[] | null;
    hiddenAnswers: number[];
  };
  hiddenAnswers: number[];
  showCorrectAnswer: boolean;
  selectedAnswer: number | null;
  status: 'waiting' | 'playing' | 'finished';
  safeLevelIndexes: number[];
}

const roomTimers = new Map<string, RoomTimer>();
const roomStates = new Map<string, RoomGameState>();
// Grace period: socketId → timeout handle (30s before removing participant)
const disconnectTimers = new Map<string, NodeJS.Timeout>();

function safeRun<T>(fn: () => T): T | undefined {
  try {
    return fn();
  } catch (err) {
    console.error('[socket handler error]', err);
    return undefined;
  }
}

export function setupSocketHandlers(io: Server, db: Database.Database) {
  io.on('connection', (socket: Socket) => {
    console.log(`Client connected: ${socket.id}`);

    // Cancel any pending grace-period disconnect for this socket if it's reconnecting
    if (disconnectTimers.has(socket.id)) {
      clearTimeout(disconnectTimers.get(socket.id)!);
      disconnectTimers.delete(socket.id);
    }

    // ── Admin joins room as host ──
    socket.on('admin:join', (data: { roomCode: string; hostId: string }) => safeRun(() => {
      const { roomCode, hostId } = data;
      const room = db.prepare('SELECT * FROM rooms WHERE code = ?').get(roomCode) as Record<string, unknown> | undefined;
      if (!room) { socket.emit('error', { message: 'Комната не найдена' }); return; }

      socket.join(roomCode);

      if (!roomStates.has(roomCode)) {
        roomStates.set(roomCode, {
          hostSocketId: socket.id,
          hostId,
          currentQuestion: null,
          currentLevel: 0,
          currentQuestionIdx: 0,
          gameQueue: [],
          lifelines: { fiftyFifty: true, phoneAFriend: true, askAudience: true },
          lifelineResults: { phoneResult: null, audienceResult: null, hiddenAnswers: [] },
          hiddenAnswers: [],
          showCorrectAnswer: false,
          selectedAnswer: null,
          status: 'waiting',
          safeLevelIndexes: [4, 8, 9],
        });
      } else {
        // Admin reconnect — restore host socket id
        roomStates.get(roomCode)!.hostSocketId = socket.id;
      }

      const state = roomStates.get(roomCode)!;

      // Return full state to admin so they can restore UI on reconnect
      socket.emit('admin:joined', {
        roomCode,
        gameQueue: state.gameQueue,
        currentQuestionIdx: state.currentQuestionIdx,
        currentLevel: state.currentLevel,
        lifelines: state.lifelines,
        lifelineResults: state.lifelineResults,
        safeLevelIndexes: state.safeLevelIndexes,
        status: state.status,
      });
      console.log(`Admin joined room ${roomCode}`);
    }));

    // ── Admin saves question queue (called whenever admin reorders) ──
    socket.on('game:setQueue', (data: { roomCode: string; questions: GameQuestion[]; currentIdx?: number }) => safeRun(() => {
      const { roomCode, questions, currentIdx } = data;
      const state = roomStates.get(roomCode);
      if (!state) return;
      state.gameQueue = questions;
      if (currentIdx !== undefined) state.currentQuestionIdx = currentIdx;
      socket.emit('game:queueSaved', { ok: true });
    }));

    // ── Player joins room ──
    socket.on('room:join', (data: { roomCode: string; playerName: string }) => safeRun(() => {
      const { roomCode, playerName } = data;
      const room = db.prepare('SELECT * FROM rooms WHERE code = ?').get(roomCode) as Record<string, unknown> | undefined;
      if (!room) { socket.emit('error', { message: 'Комната не найдена' }); return; }

      socket.join(roomCode);

      const existing = db.prepare('SELECT * FROM participants WHERE room_code = ? AND name = ?').get(roomCode, playerName) as Record<string, unknown> | undefined;
      if (existing) {
        db.prepare('UPDATE participants SET socket_id = ?, status = ? WHERE id = ?').run(socket.id, 'active', existing.id);
      } else {
        db.prepare('INSERT INTO participants (room_code, socket_id, name) VALUES (?, ?, ?)').run(roomCode, socket.id, playerName);
      }

      const participants = db.prepare('SELECT * FROM participants WHERE room_code = ?').all(roomCode);
      const gameState = roomStates.get(roomCode);
      const timer = roomTimers.get(roomCode);

      socket.emit('room:joined', {
        roomCode,
        playerName,
        roomName: room.name as string,
        status: room.status as string,
        timerState: timer ? {
          remaining: timer.remaining,
          total: timer.duration,
          isPaused: timer.isPaused,
        } : null,
        gameState: gameState ? {
          currentQuestion: gameState.currentQuestion ? {
            text: gameState.currentQuestion.text,
            answers: gameState.currentQuestion.answers,
          } : null,
          currentLevel: gameState.currentLevel,
          lifelines: gameState.lifelines,
          lifelineResults: gameState.lifelineResults,
          hiddenAnswers: gameState.hiddenAnswers,
          status: gameState.status,
        } : null,
      });

      io.to(roomCode).emit('room:update', { participants });
      console.log(`${playerName} joined room ${roomCode}`);
    }));

    // ── Admin sends new question ──
    socket.on('game:question', (data: {
      roomCode: string;
      question: { text: string; answers: Array<{ label: string; text: string }>; correctIndex: number };
      level: number;
      timerDuration: number;
      safeLevelIndexes?: number[];
      questionIdx?: number;
    }) => safeRun(() => {
      const { roomCode, question, level, timerDuration, safeLevelIndexes, questionIdx } = data;
      const state = roomStates.get(roomCode);
      if (!state) return;

      state.currentQuestion = question;
      state.currentLevel = level;
      if (questionIdx !== undefined) state.currentQuestionIdx = questionIdx;
      state.showCorrectAnswer = false;
      state.selectedAnswer = null;
      state.hiddenAnswers = [];
      state.lifelineResults = { phoneResult: null, audienceResult: null, hiddenAnswers: [] };
      state.status = 'playing';
      if (safeLevelIndexes) state.safeLevelIndexes = safeLevelIndexes;

      db.prepare("UPDATE rooms SET status = 'playing' WHERE code = ?").run(roomCode);
      db.prepare("UPDATE participants SET status = 'active' WHERE room_code = ?").run(roomCode);

      startTimer(io, roomCode, timerDuration);

      io.to(roomCode).emit('game:question', {
        question: { text: question.text, answers: question.answers },
        level,
        timerDuration,
        safeLevelIndexes: state.safeLevelIndexes,
      });

      console.log(`Question sent to room ${roomCode}: ${question.text.substring(0, 30)}...`);
    }));

    // ── Admin reveals answer ──
    socket.on('game:reveal', (data: { roomCode: string; correctIndex: number }) => safeRun(() => {
      const { roomCode, correctIndex } = data;
      const state = roomStates.get(roomCode);
      if (!state) return;
      state.showCorrectAnswer = true;
      pauseTimer(roomCode);
      io.to(roomCode).emit('timer:paused');
      io.to(roomCode).emit('game:reveal', { correctIndex });
    }));

    // ── Admin selects an answer (visual highlight) ──
    socket.on('game:selectAnswer', (data: { roomCode: string; answerIndex: number }) => safeRun(() => {
      const { roomCode, answerIndex } = data;
      const state = roomStates.get(roomCode);
      if (!state) return;
      state.selectedAnswer = answerIndex;
      io.to(roomCode).emit('game:selectAnswer', { answerIndex });
    }));

    // ── Admin uses lifeline ──
    socket.on('game:lifeline', (data: {
      roomCode: string;
      type: '5050' | 'phone' | 'audience';
      hiddenAnswers?: number[];
      phoneResult?: string;
      audienceResult?: number[];
    }) => safeRun(() => {
      const { roomCode, type, hiddenAnswers, phoneResult, audienceResult } = data;
      const state = roomStates.get(roomCode);
      if (!state) return;

      if (type === '5050') {
        state.lifelines.fiftyFifty = false;
        if (hiddenAnswers) {
          state.hiddenAnswers = hiddenAnswers;
          state.lifelineResults.hiddenAnswers = hiddenAnswers;
        }
      }
      if (type === 'phone') {
        state.lifelines.phoneAFriend = false;
        if (phoneResult) state.lifelineResults.phoneResult = phoneResult;
      }
      if (type === 'audience') {
        state.lifelines.askAudience = false;
        if (audienceResult) state.lifelineResults.audienceResult = audienceResult;
      }

      io.to(roomCode).emit('game:lifeline', { type, hiddenAnswers, phoneResult, audienceResult });
    }));

    // ── Admin resets lifelines ──
    socket.on('game:resetLifelines', (data: { roomCode: string }) => safeRun(() => {
      const state = roomStates.get(data.roomCode);
      if (!state) return;
      state.lifelines = { fiftyFifty: true, phoneAFriend: true, askAudience: true };
      state.hiddenAnswers = [];
      state.lifelineResults = { phoneResult: null, audienceResult: null, hiddenAnswers: [] };
      io.to(data.roomCode).emit('game:resetLifelines');
    }));

    // ── Timer controls ──
    socket.on('timer:pause', (data: { roomCode: string }) => safeRun(() => {
      pauseTimer(data.roomCode);
      io.to(data.roomCode).emit('timer:paused');
    }));

    socket.on('timer:resume', (data: { roomCode: string }) => safeRun(() => {
      resumeTimer(io, data.roomCode);
      io.to(data.roomCode).emit('timer:resumed');
    }));

    socket.on('timer:reset', (data: { roomCode: string; duration: number }) => safeRun(() => {
      stopTimer(data.roomCode);
      const timer: RoomTimer = {
        remaining: data.duration,
        duration: data.duration,
        isPaused: true,
        intervalId: null,
      };
      roomTimers.set(data.roomCode, timer);
      io.to(data.roomCode).emit('timer:sync', { remaining: data.duration, total: data.duration });
      io.to(data.roomCode).emit('timer:paused');
    }));

    // ── Player submits answer ──
    socket.on('answer:submit', (data: { roomCode: string; answerIndex: number }) => safeRun(() => {
      const { roomCode, answerIndex } = data;
      db.prepare("UPDATE participants SET status = 'answered' WHERE room_code = ? AND socket_id = ?").run(roomCode, socket.id);
      const participant = db.prepare('SELECT name FROM participants WHERE socket_id = ?').get(socket.id) as { name: string } | undefined;
      io.to(roomCode).emit('answer:received', {
        socketId: socket.id,
        playerName: participant?.name || 'Unknown',
        answerIndex,
      });
      const participants = db.prepare('SELECT * FROM participants WHERE room_code = ?').all(roomCode);
      io.to(roomCode).emit('room:update', { participants });
    }));

    // ── End game ──
    socket.on('game:end', (data: { roomCode: string }) => safeRun(() => {
      stopTimer(data.roomCode);
      db.prepare("UPDATE rooms SET status = 'finished' WHERE code = ?").run(data.roomCode);
      const state = roomStates.get(data.roomCode);
      if (state) state.status = 'finished';
      io.to(data.roomCode).emit('game:end', { message: 'Игра завершена!' });
    }));

    // ── Disconnect: grace period 30s before removing participant ──
    socket.on('disconnect', () => {
      console.log(`Client disconnected: ${socket.id}`);

      // Delay participant removal to allow quick reconnects (VPN drops, mobile switches, etc.)
      const timeout = setTimeout(() => {
        safeRun(() => {
          db.prepare('DELETE FROM participants WHERE socket_id = ?').run(socket.id);
          disconnectTimers.delete(socket.id);
          console.log(`Participant removed after grace period: ${socket.id}`);
        });
      }, 30000); // 30 second grace period

      disconnectTimers.set(socket.id, timeout);
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
  if (!timer) return;
  if (timer.intervalId) {
    clearInterval(timer.intervalId);
    timer.intervalId = null;
  }
  timer.isPaused = true;
}

function resumeTimer(io: Server, roomCode: string) {
  const timer = roomTimers.get(roomCode);
  if (!timer) return;
  timer.isPaused = false;
  if (timer.intervalId) return;

  timer.intervalId = setInterval(() => {
    timer.remaining--;
    io.to(roomCode).emit('timer:sync', { remaining: timer.remaining, total: timer.duration });
    if (timer.remaining <= 0) {
      stopTimer(roomCode);
      io.to(roomCode).emit('timer:expired');
    }
  }, 1000);
}
