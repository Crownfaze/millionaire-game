import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import StudioBackground from '../components/game/StudioBackground';
import { getSocket } from '../lib/socket';
import { PRIZE_LEVELS } from '../types/game';
import '../styles/game.css';
import '../styles/room.css';

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
  const [nameInput, setNameInput] = useState('');
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

  /* ─── Socket listeners ─── */
  useEffect(() => {
    const socket = socketRef.current;

    socket.on('connect', () => {
      setConnected(true);
      setError(null);
      if (status === 'connecting') setStatus('joining');
    });

    socket.on('disconnect', () => setConnected(false));

    socket.on('connect_error', () => {
      setError('Не удалось подключиться к серверу');
    });

    socket.on('error', (data: { message: string }) => {
      setError(data.message);
    });

    socket.on('room:joined', (data: { roomCode: string; playerName: string; roomName: string; status: string }) => {
      setRoomName(data.roomName || data.roomCode);
      setStatus(data.status === 'playing' ? 'playing' : 'waiting');
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

    // Timer sync — server controls the timer, client just displays
    socket.on('timer:sync', (data: { remaining: number; total: number }) => {
      setTimerValue(data.remaining);
      setTimerTotal(data.total);
      setTimerPaused(false);
    });

    socket.on('timer:paused', () => setTimerPaused(true));
    socket.on('timer:resumed', () => setTimerPaused(false));
    socket.on('timer:expired', () => {
      setTimerValue(0);
      setTimerPaused(false);
    });

    socket.on('timer:reset', (data: { duration: number }) => {
      setTimerValue(data.duration);
      setTimerTotal(data.duration);
      setTimerPaused(false);
    });

    socket.on('game:end', (data: { message: string }) => {
      setStatus('finished');
      setGameOverMessage(data.message);
    });

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
  }, []); // eslint-disable-line

  /* ─── Join room ─── */
  const joinRoom = useCallback(() => {
    if (!nameInput.trim() || !code) return;
    const name = nameInput.trim();
    setPlayerName(name);
    socketRef.current.emit('room:join', { roomCode: code, playerName: name });
  }, [nameInput, code]);

  /* ─── Submit answer ─── */
  const submitAnswer = useCallback((idx: number) => {
    if (submitted || !code || correctAnswer !== null || hiddenAnswers.includes(idx)) return;
    setSelectedAnswer(idx);
    setSubmitted(true);
    socketRef.current.emit('answer:submit', { roomCode: code, answerIndex: idx });
  }, [submitted, code, correctAnswer, hiddenAnswers]);

  /* ─── Timer helpers ─── */
  const timerPercent = timerTotal > 0 ? (timerValue / timerTotal) * 100 : 0;
  const letters = ['A', 'B', 'C', 'D'];
  const prizeLevelLabel = PRIZE_LEVELS[Math.min(currentLevel, PRIZE_LEVELS.length - 1)]?.label ?? '';

  /* ─── Answer class ─── */
  const getAnswerClass = (i: number): string => {
    if (hiddenAnswers.includes(i)) return 'room-answer--hidden';
    if (correctAnswer !== null) {
      if (i === correctAnswer) return 'room-answer--correct';
      if (selectedAnswer === i) return 'room-answer--wrong';
      return 'room-answer--dimmed';
    }
    if (adminSelectedAnswer === i) return 'room-answer--admin-selected';
    if (selectedAnswer === i) return 'room-answer--selected';
    return '';
  };

  return (
    <>
      <StudioBackground />

      {/* ── JOIN SCREEN ── */}
      {(status === 'connecting' || status === 'joining') && (
        <div className="game-page" id="room-page">
          <div className="room-center-screen">
            <div className="room-logo-wrap">
              <div className="logo-badge logo-badge--xl"><span>M</span></div>
              <h1 className="room-brand">МИЛЛИОНЕР</h1>
            </div>

            <div className="room-join-card">
              <div className="room-code-display">
                Комната: <strong>{code}</strong>
              </div>

              {error && <div className="room-error">{error}</div>}

              {!connected && (
                <div className="room-connecting">
                  <div className="room-spinner" />
                  <span>Подключение...</span>
                </div>
              )}

              {connected && (
                <>
                  <p className="room-join-hint">Введите имя для участия</p>
                  <div className="room-name-form">
                    <input
                      className="form-input room-name-input"
                      placeholder="Ваше имя"
                      value={nameInput}
                      onChange={(e) => setNameInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && joinRoom()}
                      autoFocus
                    />
                    <button
                      className="footer-action-btn room-join-btn"
                      onClick={joinRoom}
                      disabled={!nameInput.trim()}
                    >
                      Войти в игру
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── WAITING SCREEN ── */}
      {status === 'waiting' && (
        <div className="game-page" id="room-page">
          <div className="room-center-screen">
            <div className="room-logo-wrap">
              <div className="logo-badge logo-badge--xl"><span>M</span></div>
              <h1 className="room-brand">МИЛЛИОНЕР</h1>
            </div>
            <div className="room-join-card">
              <h2 className="room-room-name">{roomName}</h2>
              <p className="room-join-hint">Добро пожаловать, <strong className="room-player-name-hi">{playerName}</strong>!</p>
              <div className="room-waiting-badge">
                <div className="room-pulse-dot" />
                Ожидание начала игры...
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── GAME SCREEN ── */}
      {status === 'playing' && question && (
        <div className="game-page" id="room-page">
          {/* Header */}
          <header className="game-header">
            <div className="header-logo">
              <div className="logo-badge"><span>M</span></div>
              <span className="logo-text">МИЛЛИОНЕР</span>
            </div>

            {/* Lifeline status badges */}
            <div className="room-lifelines-header">
              <div className={`room-ll-badge room-ll-badge--5050 ${!lifelines.fiftyFifty ? 'room-ll-badge--used' : ''}`}>50/50</div>
              <div className={`room-ll-badge room-ll-badge--phone ${!lifelines.phoneAFriend ? 'room-ll-badge--used' : ''}`}>Звонок</div>
              <div className={`room-ll-badge room-ll-badge--audience ${!lifelines.askAudience ? 'room-ll-badge--used' : ''}`}>Зал</div>
            </div>

            {/* Timer + player name */}
            <div className="room-header-right">
              <div className="room-player-tag">{playerName}</div>
              <div className={`room-timer-wrap ${timerValue <= 5 ? 'room-timer--danger' : ''} ${timerPaused ? 'room-timer--paused' : ''}`}>
                <svg className="room-timer-svg" viewBox="0 0 60 60">
                  <circle cx="30" cy="30" r="26" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="4" />
                  <circle
                    cx="30" cy="30" r="26"
                    fill="none"
                    stroke={timerValue <= 5 ? '#ff4444' : '#00d4ff'}
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 26}`}
                    strokeDashoffset={`${2 * Math.PI * 26 * (1 - timerPercent / 100)}`}
                    style={{ transition: 'stroke-dashoffset 0.8s ease, stroke 0.3s', transformOrigin: 'center', transform: 'rotate(-90deg)' }}
                  />
                </svg>
                <span className="room-timer-text">{timerValue}</span>
                {timerPaused && <span className="room-timer-pause-icon">⏸</span>}
              </div>
            </div>
          </header>

          {/* Main content */}
          <div className="game-content">
            <div className="game-main">
              {/* Lifeline result popups */}
              {phoneResult && (
                <div className="room-lifeline-popup room-lifeline-popup--phone">
                  Звонок другу: {phoneResult}
                </div>
              )}
              {audienceResult && (
                <div className="room-lifeline-popup room-lifeline-popup--audience">
                  <strong>Помощь зала:</strong>
                  <div className="room-audience-bars">
                    {audienceResult.map((pct, i) => (
                      <div key={i} className="room-audience-bar">
                        <span className="room-audience-label">{letters[i]}</span>
                        <div className="room-audience-track">
                          <div className={`room-audience-fill ${correctAnswer === i ? 'room-audience-fill--correct' : ''}`} style={{ width: `${pct}%` }} />
                        </div>
                        <span className="room-audience-pct">{pct}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Question card — reuse game styles */}
              <div className="question-card" id="question-card">
                <div className="question-diamond question-diamond--tl" />
                <div className="question-diamond question-diamond--tr" />
                <div className="question-diamond question-diamond--bl" />
                <div className="question-diamond question-diamond--br" />
                <h2 className="question-text">{question.text}</h2>
              </div>

              {/* Answer grid — reuse game styles */}
              <div className="answer-grid" id="answer-grid">
                {question.answers.map((ans, i) => {
                  const stateClass = getAnswerClass(i);
                  // Map room classes to game answer-btn states
                  const btnClass =
                    stateClass === 'room-answer--correct' ? 'answer-btn--correct' :
                    stateClass === 'room-answer--wrong' ? 'answer-btn--wrong' :
                    stateClass === 'room-answer--dimmed' ? 'answer-btn--dimmed' :
                    stateClass === 'room-answer--selected' ? 'answer-btn--selected' :
                    stateClass === 'room-answer--admin-selected' ? 'answer-btn--selected' :
                    stateClass === 'room-answer--hidden' ? 'answer-btn--dimmed' :
                    'answer-btn--default';

                  return (
                    <button
                      key={i}
                      className={`answer-btn ${btnClass}`}
                      onClick={() => submitAnswer(i)}
                      disabled={submitted || hiddenAnswers.includes(i) || correctAnswer !== null}
                      id={`answer-${ans.label.toLowerCase()}`}
                    >
                      <span className="answer-label">{ans.label}:</span>
                      <span className="answer-text">{ans.text}</span>
                      {stateClass === 'room-answer--correct' && (
                        <span className="answer-check" style={{ display: 'flex' }}>✓</span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Status messages */}
              {submitted && correctAnswer === null && (
                <div className="room-status-msg room-status-msg--submitted">
                  Ответ отправлен! Ожидание результата...
                </div>
              )}
              {!submitted && !correctAnswer && (
                <div className="room-status-msg room-status-msg--hint">
                  Выберите ответ
                </div>
              )}
              {correctAnswer !== null && (
                <div className={`room-status-msg ${selectedAnswer === correctAnswer ? 'room-status-msg--correct' : 'room-status-msg--wrong'}`}>
                  {selectedAnswer === correctAnswer
                    ? '🎉 Правильно!'
                    : selectedAnswer !== null
                      ? `Неправильно. Правильный ответ: ${letters[correctAnswer]}`
                      : `Правильный ответ: ${letters[correctAnswer]}`}
                </div>
              )}
            </div>

            {/* Prize sidebar — reuse game styles */}
            <aside className="prize-sidebar" id="prize-sidebar">
              <div className="prize-header">
                <div className="prize-header-label">Уровень</div>
                <div className="prize-header-amount">{prizeLevelLabel}</div>
              </div>
              <div className="prize-ladder">
                <div className="prize-bar-container">
                  <div className="prize-bar-track">
                    <div className="prize-bar-fill" style={{ height: `${((currentLevel + 1) / PRIZE_LEVELS.length) * 100}%` }} />
                  </div>
                </div>
                <div className="prize-levels">
                  {[...PRIZE_LEVELS].reverse().map((level, revIndex) => {
                    const index = PRIZE_LEVELS.length - 1 - revIndex;
                    const isCurrent = index === currentLevel;
                    const isPassed = index < currentLevel;
                    let className = 'prize-level';
                    if (isCurrent) className += ' prize-level--current';
                    else if (isPassed) className += ' prize-level--passed';
                    return (
                      <div key={level.amount} className={className}>
                        <span className="prize-level-dot" />
                        <span>{level.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </aside>
          </div>
        </div>
      )}

      {/* ── GAME OVER ── */}
      {status === 'finished' && (
        <div className="game-page" id="room-page">
          <div className="room-center-screen">
            <div className="room-logo-wrap">
              <div className="logo-badge logo-badge--xl"><span>M</span></div>
              <h1 className="room-brand">МИЛЛИОНЕР</h1>
            </div>
            <div className="room-join-card">
              <h2 className="room-room-name">Игра завершена!</h2>
              <p className="room-join-hint">{gameOverMessage || 'Спасибо за участие!'}</p>
              <a href="/" className="footer-action-btn" style={{ display: 'inline-block', textDecoration: 'none', marginTop: '16px' }}>
                На главную
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
