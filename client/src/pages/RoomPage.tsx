import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import StudioBackground from '../components/game/StudioBackground';
import { getSocket } from '../lib/socket';
import '../styles/room.css';

const PRIZE_LEVELS = [
  '100 ₽', '200 ₽', '300 ₽', '500 ₽', '1 000 ₽',
  '2 000 ₽', '5 000 ₽', '10 000 ₽', '50 000 ₽', '100 000 ₽',
  '250 000 ₽', '400 000 ₽', '500 000 ₽', '750 000 ₽', '1 000 000 ₽',
];

interface AnswerOption {
  label: string;
  text: string;
}

type RoomStatus = 'connecting' | 'joining' | 'waiting' | 'playing' | 'finished';

export default function RoomPage() {
  const { code } = useParams<{ code: string }>();
  const socketRef = useRef(getSocket());

  // Connection state
  const [status, setStatus] = useState<RoomStatus>('connecting');
  const [playerName, setPlayerName] = useState('');
  const [roomName, setRoomName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);

  // Game state from server
  const [question, setQuestion] = useState<{ text: string; answers: AnswerOption[] } | null>(null);
  const [currentLevel, setCurrentLevel] = useState(0);
  const [timerValue, setTimerValue] = useState(30);
  const [timerTotal, setTimerTotal] = useState(30);
  const [timerPaused, setTimerPaused] = useState(false);

  // Answer state
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [correctAnswer, setCorrectAnswer] = useState<number | null>(null);
  const [adminSelectedAnswer, setAdminSelectedAnswer] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);

  // Lifeline state
  const [hiddenAnswers, setHiddenAnswers] = useState<number[]>([]);
  const [lifelines, setLifelines] = useState({ fiftyFifty: true, phoneAFriend: true, askAudience: true });
  const [phoneResult, setPhoneResult] = useState<string | null>(null);
  const [audienceResult, setAudienceResult] = useState<number[] | null>(null);

  // Game over
  const [gameOverMessage, setGameOverMessage] = useState<string | null>(null);

  // Setup socket listeners
  useEffect(() => {
    const socket = socketRef.current;

    socket.on('connect', () => {
      setConnected(true);
      setError(null);
      if (status === 'connecting') {
        setStatus('joining');
      }
    });

    socket.on('disconnect', () => {
      setConnected(false);
    });

    socket.on('connect_error', () => {
      setError('Не удалось подключиться к серверу');
    });

    socket.on('error', (data: { message: string }) => {
      setError(data.message);
    });

    socket.on('room:joined', (data: { roomCode: string; playerName: string; roomName: string; status: string; gameState: unknown }) => {
      setRoomName(data.roomName || data.roomCode);
      if (data.status === 'playing') {
        setStatus('playing');
      } else {
        setStatus('waiting');
      }
    });

    socket.on('game:question', (data: {
      question: { text: string; answers: AnswerOption[] };
      level: number;
      timerDuration: number;
    }) => {
      setQuestion(data.question);
      setCurrentLevel(data.level);
      setTimerTotal(data.timerDuration);
      setTimerValue(data.timerDuration);
      setSelectedAnswer(null);
      setCorrectAnswer(null);
      setAdminSelectedAnswer(null);
      setSubmitted(false);
      setHiddenAnswers([]);
      setPhoneResult(null);
      setAudienceResult(null);
      setTimerPaused(false);
      setStatus('playing');
    });

    socket.on('game:reveal', (data: { correctIndex: number }) => {
      setCorrectAnswer(data.correctIndex);
    });

    socket.on('game:selectAnswer', (data: { answerIndex: number }) => {
      setAdminSelectedAnswer(data.answerIndex);
    });

    socket.on('game:lifeline', (data: {
      type: '5050' | 'phone' | 'audience';
      hiddenAnswers?: number[];
      phoneResult?: string;
      audienceResult?: number[];
    }) => {
      if (data.type === '5050' && data.hiddenAnswers) {
        setHiddenAnswers(data.hiddenAnswers);
        setLifelines(prev => ({ ...prev, fiftyFifty: false }));
      }
      if (data.type === 'phone') {
        setLifelines(prev => ({ ...prev, phoneAFriend: false }));
        if (data.phoneResult) setPhoneResult(data.phoneResult);
      }
      if (data.type === 'audience') {
        setLifelines(prev => ({ ...prev, askAudience: false }));
        if (data.audienceResult) setAudienceResult(data.audienceResult);
      }
    });

    socket.on('game:resetLifelines', () => {
      setLifelines({ fiftyFifty: true, phoneAFriend: true, askAudience: true });
      setHiddenAnswers([]);
      setPhoneResult(null);
      setAudienceResult(null);
    });

    socket.on('timer:sync', (data: { remaining: number; total: number }) => {
      setTimerValue(data.remaining);
      setTimerTotal(data.total);
    });

    socket.on('timer:paused', () => setTimerPaused(true));
    socket.on('timer:resumed', () => setTimerPaused(false));
    socket.on('timer:expired', () => setTimerValue(0));

    socket.on('timer:reset', (data: { duration: number }) => {
      setTimerValue(data.duration);
      setTimerTotal(data.duration);
      setTimerPaused(false);
    });

    socket.on('game:end', (data: { message: string }) => {
      setStatus('finished');
      setGameOverMessage(data.message);
    });

    // Initial connection check
    if (socket.connected) {
      setConnected(true);
      setStatus('joining');
    }

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('connect_error');
      socket.off('error');
      socket.off('room:joined');
      socket.off('game:question');
      socket.off('game:reveal');
      socket.off('game:selectAnswer');
      socket.off('game:lifeline');
      socket.off('game:resetLifelines');
      socket.off('timer:sync');
      socket.off('timer:paused');
      socket.off('timer:resumed');
      socket.off('timer:expired');
      socket.off('timer:reset');
      socket.off('game:end');
    };
  }, []);

  // Join room
  const joinRoom = useCallback(() => {
    if (!playerName.trim() || !code) return;
    const socket = socketRef.current;
    socket.emit('room:join', { roomCode: code, playerName: playerName.trim() });
  }, [playerName, code]);

  // Submit answer
  const submitAnswer = useCallback((idx: number) => {
    if (submitted || !code) return;
    setSelectedAnswer(idx);
    setSubmitted(true);
    socketRef.current.emit('answer:submit', { roomCode: code, answerIndex: idx });
  }, [submitted, code]);

  const formatTime = (s: number) => {
    const min = Math.floor(s / 60).toString().padStart(2, '0');
    const sec = (s % 60).toString().padStart(2, '0');
    return `${min}:${sec}`;
  };

  const timerPercent = timerTotal > 0 ? (timerValue / timerTotal) * 100 : 0;
  const letters = ['A', 'B', 'C', 'D'];

  return (
    <>
      <StudioBackground />
      <div className="room-page" id="room-page">

        {/* ── CONNECTING / JOIN SCREEN ── */}
        {(status === 'connecting' || status === 'joining') && (
          <div className="room-waiting">
            <div className="room-logo">
              <div className="logo-badge logo-badge--large"><span>M</span></div>
            </div>
            <h1 className="room-title">Комната: {code}</h1>

            {error && <div className="room-error">{error}</div>}

            {!connected && status === 'connecting' && (
              <div className="room-connecting">
                <div className="spinner" />
                <p>Подключение к серверу...</p>
              </div>
            )}

            {connected && (
              <>
                <p className="room-subtitle">Введите имя для входа</p>
                <div className="room-name-form">
                  <input
                    className="form-input room-name-input"
                    placeholder="Ваше имя"
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && joinRoom()}
                  />
                  <button className="btn-join-room" onClick={joinRoom} disabled={!playerName.trim()}>
                    Присоединиться
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── WAITING SCREEN ── */}
        {status === 'waiting' && (
          <div className="room-waiting">
            <div className="room-logo">
              <div className="logo-badge logo-badge--large"><span>M</span></div>
            </div>
            <h1 className="room-title">{roomName}</h1>
            <p className="room-subtitle">Добро пожаловать, <strong>{playerName}</strong>!</p>
            <div className="room-status-badge">
              <div className="pulse-dot" />
              Ожидание начала игры...
            </div>
          </div>
        )}

        {/* ── GAME SCREEN ── */}
        {status === 'playing' && question && (
          <div className="room-game">
            {/* Header with timer and prize */}
            <div className="room-game-header">
              <div className="room-game-info">
                <span className="room-game-player">{playerName}</span>
                <span className="room-game-level">{PRIZE_LEVELS[currentLevel]}</span>
              </div>
              <div className={`room-timer ${timerValue <= 5 ? 'room-timer--danger' : ''} ${timerPaused ? 'room-timer--paused' : ''}`}>
                <svg className="room-timer-ring" viewBox="0 0 60 60">
                  <circle cx="30" cy="30" r="26" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="4" />
                  <circle
                    cx="30" cy="30" r="26"
                    fill="none"
                    stroke={timerValue <= 5 ? '#ff4444' : '#00d4ff'}
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 26}`}
                    strokeDashoffset={`${2 * Math.PI * 26 * (1 - timerPercent / 100)}`}
                    style={{ transition: 'stroke-dashoffset 0.5s ease, stroke 0.3s' }}
                    transform="rotate(-90 30 30)"
                  />
                </svg>
                <span className="room-timer-text">{formatTime(timerValue)}</span>
              </div>
            </div>

            {/* Lifeline indicators */}
            <div className="room-lifelines">
              <div className={`room-lifeline ${!lifelines.fiftyFifty ? 'room-lifeline--used' : ''}`}>
                50/50
              </div>
              <div className={`room-lifeline ${!lifelines.phoneAFriend ? 'room-lifeline--used' : ''}`}>
                📞
              </div>
              <div className={`room-lifeline ${!lifelines.askAudience ? 'room-lifeline--used' : ''}`}>
                👥
              </div>
            </div>

            {/* Phone result */}
            {phoneResult && (
              <div className="room-lifeline-result">
                📞 {phoneResult}
              </div>
            )}

            {/* Audience result */}
            {audienceResult && (
              <div className="room-lifeline-result room-audience-result">
                <div className="room-audience-bars">
                  {audienceResult.map((pct, i) => (
                    <div key={i} className="room-audience-bar">
                      <span className="room-audience-label">{letters[i]}</span>
                      <div className="room-audience-track">
                        <div className="room-audience-fill" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="room-audience-pct">{pct}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Question */}
            <div className="room-question">
              <div className="room-question-text">{question.text}</div>
            </div>

            {/* Answers */}
            <div className="room-answers">
              {question.answers.map((ans, i) => {
                let stateClass = '';
                if (hiddenAnswers.includes(i)) stateClass = 'room-answer--hidden';
                else if (correctAnswer !== null && i === correctAnswer) stateClass = 'room-answer--correct';
                else if (correctAnswer !== null && selectedAnswer === i && i !== correctAnswer) stateClass = 'room-answer--wrong';
                else if (correctAnswer !== null) stateClass = 'room-answer--dimmed';
                else if (adminSelectedAnswer === i) stateClass = 'room-answer--admin-selected';
                else if (selectedAnswer === i) stateClass = 'room-answer--selected';

                return (
                  <button
                    key={i}
                    className={`room-answer ${stateClass}`}
                    onClick={() => submitAnswer(i)}
                    disabled={submitted || hiddenAnswers.includes(i) || correctAnswer !== null}
                  >
                    <span className="room-answer-letter">{ans.label}:</span>
                    <span className="room-answer-text">{ans.text}</span>
                  </button>
                );
              })}
            </div>

            {submitted && correctAnswer === null && (
              <div className="room-submitted-badge">
                ✅ Ответ отправлен! Ожидание результата...
              </div>
            )}

            {correctAnswer !== null && (
              <div className={`room-result-badge ${selectedAnswer === correctAnswer ? 'room-result-badge--correct' : 'room-result-badge--wrong'}`}>
                {selectedAnswer === correctAnswer
                  ? '🎉 Правильно!'
                  : selectedAnswer !== null
                    ? '❌ Неправильно!'
                    : `✅ Правильный ответ: ${letters[correctAnswer]}`}
              </div>
            )}
          </div>
        )}

        {/* ── GAME OVER ── */}
        {status === 'finished' && (
          <div className="room-waiting">
            <div className="room-logo">
              <div className="logo-badge logo-badge--large"><span>M</span></div>
            </div>
            <h1 className="room-title">Игра завершена!</h1>
            <p className="room-subtitle">{gameOverMessage || 'Спасибо за участие!'}</p>
            <a href="/" className="btn-join-room" style={{ textDecoration: 'none' }}>На главную</a>
          </div>
        )}
      </div>
    </>
  );
}
