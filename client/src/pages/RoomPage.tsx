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

  const [status, setStatus] = useState<RoomStatus>('connecting');
  const [playerName, setPlayerName] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [roomName, setRoomName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);

  const [question, setQuestion] = useState<{ text: string; answers: AnswerOption[] } | null>(null);
  const [currentLevel, setCurrentLevel] = useState(0);
  const [timerValue, setTimerValue] = useState(30);
  const [timerTotal, setTimerTotal] = useState(30);
  const [timerPaused, setTimerPaused] = useState(false);

  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [correctAnswer, setCorrectAnswer] = useState<number | null>(null);
  const [adminSelectedAnswer, setAdminSelectedAnswer] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const [hiddenAnswers, setHiddenAnswers] = useState<number[]>([]);
  const [lifelines, setLifelines] = useState({ fiftyFifty: true, phoneAFriend: true, askAudience: true });
  const [phoneResult, setPhoneResult] = useState<string | null>(null);
  const [audienceResult, setAudienceResult] = useState<number[] | null>(null);
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
    socket.on('connect_error', () => setError('Не удалось подключиться к серверу'));
    socket.on('error', (data: { message: string }) => setError(data.message));

    socket.on('room:joined', (data: {
      roomCode: string;
      playerName: string;
      roomName: string;
      status: string;
      timerState?: { remaining: number; total: number; isPaused: boolean } | null;
    }) => {
      setRoomName(data.roomName || data.roomCode);
      setStatus(data.status === 'playing' ? 'playing' : 'waiting');
      if (data.timerState) {
        setTimerValue(data.timerState.remaining);
        setTimerTotal(data.timerState.total);
        setTimerPaused(data.timerState.isPaused);
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
      setTimerPaused(true);
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
    socket.on('timer:expired', () => { setTimerValue(0); setTimerPaused(false); });
    socket.on('timer:reset', (data: { duration: number }) => {
      setTimerValue(data.duration);
      setTimerTotal(data.duration);
      setTimerPaused(true);
    });

    socket.on('game:end', (data: { message: string }) => {
      setStatus('finished');
      setGameOverMessage(data.message);
    });

    if (socket.connected) { setConnected(true); setStatus('joining'); }

    return () => {
      socket.off('connect'); socket.off('disconnect'); socket.off('connect_error');
      socket.off('error'); socket.off('room:joined'); socket.off('game:question');
      socket.off('game:reveal'); socket.off('game:selectAnswer'); socket.off('game:lifeline');
      socket.off('game:resetLifelines'); socket.off('timer:sync'); socket.off('timer:paused');
      socket.off('timer:resumed'); socket.off('timer:expired'); socket.off('timer:reset');
      socket.off('game:end');
    };
  }, []); // eslint-disable-line

  const joinRoom = useCallback(() => {
    if (!nameInput.trim() || !code) return;
    const name = nameInput.trim();
    setPlayerName(name);
    socketRef.current.emit('room:join', { roomCode: code, playerName: name });
  }, [nameInput, code]);

  const submitAnswer = useCallback((idx: number) => {
    if (submitted || !code || correctAnswer !== null || hiddenAnswers.includes(idx)) return;
    setSelectedAnswer(idx);
    setSubmitted(true);
    socketRef.current.emit('answer:submit', { roomCode: code, answerIndex: idx });
  }, [submitted, code, correctAnswer, hiddenAnswers]);

  const timerPercent = timerTotal > 0 ? Math.min(100, Math.max(0, (timerValue / timerTotal) * 100)) : 0;
  const letters = ['A', 'B', 'C', 'D'];
  const prizeLevelLabel = PRIZE_LEVELS[Math.min(currentLevel, PRIZE_LEVELS.length - 1)]?.label ?? '';

  const getAnswerClass = (i: number): string => {
    if (hiddenAnswers.includes(i)) return 'answer-btn--dimmed';
    if (correctAnswer !== null) {
      if (i === correctAnswer) return 'answer-btn--correct';
      if (selectedAnswer === i) return 'answer-btn--wrong';
      return 'answer-btn--dimmed';
    }
    if (adminSelectedAnswer === i) return 'answer-btn--selected';
    if (selectedAnswer === i) return 'answer-btn--selected';
    return 'answer-btn--default';
  };

  /* ── Shared Header ── */
  const PageHeader = ({ right }: { right?: React.ReactNode }) => (
    <header className="game-header" id="game-header">
      <div className="header-logo">
        <div className="logo-badge"><span>M</span></div>
        <span className="logo-text">МИЛЛИОНЕР</span>
      </div>
      <nav className="header-nav" id="main-nav">
        <a href="/" className="nav-btn nav-btn--primary">ИГРАТЬ</a>
        <a href="/rules" className="nav-btn nav-btn--secondary">ПРАВИЛА</a>
      </nav>
      {right ?? (
        <div className="header-account">
          <div className="account-info">
            <div className="account-name">Комната</div>
            <div className="account-balance">{code}</div>
          </div>
          <div className="account-avatar">
            <span style={{ fontSize: 22 }}>M</span>
          </div>
        </div>
      )}
    </header>
  );

  /* ── Shared Prize Sidebar (static) ── */
  const StaticPrizeSidebar = () => (
    <aside className="prize-sidebar" id="prize-sidebar">
      <div className="prize-header">
        <div className="prize-header-label">Выигрыш</div>
        <div className="prize-header-amount">1 000 000 ₽</div>
      </div>
      <div className="prize-ladder">
        <div className="prize-bar-container">
          <div className="prize-bar-track">
            <div className="prize-bar-fill" style={{ height: '0%' }} />
          </div>
        </div>
        <div className="prize-levels">
          {[...PRIZE_LEVELS].reverse().map((level) => (
            <div key={level.amount} className="prize-level">
              <span className="prize-level-dot" />
              <span>{level.label}</span>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );

  /* ── JOIN SCREEN ── */
  if (status === 'connecting' || status === 'joining') {
    return (
      <>
        <StudioBackground />
        <div className="game-page" id="room-page">
          <PageHeader />
          <div className="game-content">
            <div className="game-main">
              <div className="room-join-area">
                <div className="room-code-hero">
                  <span className="room-code-label">Код комнаты</span>
                  <span className="room-code-value">{code}</span>
                </div>

                {error && <div className="room-error">{error}</div>}

                {!connected ? (
                  <div className="room-connecting">
                    <div className="room-spinner" />
                    <span>Подключение к серверу...</span>
                  </div>
                ) : (
                  <div className="room-join-form">
                    <p className="room-join-hint">Введите имя для участия в игре</p>
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
                )}
              </div>
            </div>
            <StaticPrizeSidebar />
          </div>
        </div>
      </>
    );
  }

  /* ── WAITING SCREEN ── */
  if (status === 'waiting') {
    return (
      <>
        <StudioBackground />
        <div className="game-page" id="room-page">
          <PageHeader />
          <div className="game-content">
            <div className="game-main">
              <div className="room-join-area">
                <div className="room-code-hero">
                  <span className="room-code-label">Добро пожаловать</span>
                  <span className="room-code-value room-player-name-display">{playerName}</span>
                </div>
                <div className="room-room-title">{roomName}</div>
                <div className="room-waiting-badge">
                  <div className="room-pulse-dot" />
                  Ожидание начала игры...
                </div>
                <p className="room-join-hint" style={{ marginTop: 8, fontSize: '0.85rem', opacity: 0.6 }}>
                  Ведущий начнёт игру с пульта управления
                </p>
              </div>
            </div>
            <StaticPrizeSidebar />
          </div>
        </div>
      </>
    );
  }

  /* ── PLAYING SCREEN ── */
  if (status === 'playing' && question) {
    return (
      <>
        <StudioBackground />
        <div className="game-page" id="room-page">
          {/* Header with lifelines + timer */}
          <PageHeader right={
            <div className="room-header-right">
              {/* Lifelines */}
              <div className="room-lifelines-header">
                <div className={`room-ll-badge room-ll-badge--5050 ${!lifelines.fiftyFifty ? 'room-ll-badge--used' : ''}`}>50/50</div>
                <div className={`room-ll-badge room-ll-badge--phone ${!lifelines.phoneAFriend ? 'room-ll-badge--used' : ''}`}>Звонок</div>
                <div className={`room-ll-badge room-ll-badge--audience ${!lifelines.askAudience ? 'room-ll-badge--used' : ''}`}>Зал</div>
              </div>
              {/* Player name */}
              <div className="room-player-tag">{playerName}</div>
              {/* Timer */}
              <div className={`room-timer-wrap ${timerValue <= 5 ? 'room-timer--danger' : ''} ${timerPaused ? 'room-timer--paused' : ''}`}>
                <svg className="room-timer-svg" viewBox="0 0 60 60">
                  <circle cx="30" cy="30" r="26" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="4" />
                  <g transform="rotate(-90 30 30)">
                    <circle
                      cx="30" cy="30" r="26"
                      fill="none"
                      stroke={timerValue <= 5 ? '#ff4444' : timerPaused ? '#ffd700' : '#00d4ff'}
                      strokeWidth="4"
                      strokeLinecap="round"
                      strokeDasharray={`${2 * Math.PI * 26}`}
                      strokeDashoffset={`${2 * Math.PI * 26 * (1 - timerPercent / 100)}`}
                      style={{ transition: timerPaused ? 'none' : 'stroke-dashoffset 0.8s ease, stroke 0.3s' }}
                    />
                  </g>
                </svg>
                <span className="room-timer-text">{timerValue}</span>
              </div>
            </div>
          } />

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

              {/* Question */}
              <div className="question-card" id="question-card">
                <div className="question-diamond question-diamond--tl" />
                <div className="question-diamond question-diamond--tr" />
                <div className="question-diamond question-diamond--bl" />
                <div className="question-diamond question-diamond--br" />
                <h2 className="question-text">{question.text}</h2>
              </div>

              {/* Answers */}
              <div className="answer-grid" id="answer-grid">
                {question.answers.map((ans, i) => {
                  const btnClass = getAnswerClass(i);
                  const isCorrect = btnClass === 'answer-btn--correct';
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
                      {isCorrect && <span className="answer-check" style={{ display: 'flex' }}>✓</span>}
                    </button>
                  );
                })}
              </div>

              {/* Status */}
              {submitted && correctAnswer === null && (
                <div className="room-status-msg room-status-msg--submitted">
                  Ответ отправлен. Ожидание результата...
                </div>
              )}
              {!submitted && correctAnswer === null && (
                <div className="room-status-msg room-status-msg--hint">
                  {timerPaused ? 'Таймер на паузе' : 'Выберите ответ'}
                </div>
              )}
              {correctAnswer !== null && (
                <div className={`room-status-msg ${selectedAnswer === correctAnswer ? 'room-status-msg--correct' : 'room-status-msg--wrong'}`}>
                  {selectedAnswer === correctAnswer
                    ? 'Правильно!'
                    : selectedAnswer !== null
                      ? `Неправильно. Правильный ответ: ${letters[correctAnswer]}`
                      : `Правильный ответ: ${letters[correctAnswer]}`}
                </div>
              )}
            </div>

            {/* Live prize ladder */}
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
      </>
    );
  }

  /* ── FINISHED SCREEN ── */
  return (
    <>
      <StudioBackground />
      <div className="game-page" id="room-page">
        <PageHeader />
        <div className="game-content">
          <div className="game-main">
            <div className="room-join-area">
              <div className="room-code-hero">
                <span className="room-code-label">Игра завершена</span>
                <span className="room-code-value" style={{ fontSize: '1.6rem' }}>
                  {playerName || 'Участник'}
                </span>
              </div>
              <div className="room-room-title">{gameOverMessage || 'Спасибо за участие!'}</div>
              <a href="/" className="footer-action-btn" style={{ display: 'inline-block', textDecoration: 'none', marginTop: 8 }}>
                На главную
              </a>
            </div>
          </div>
          <StaticPrizeSidebar />
        </div>
      </div>
    </>
  );
}
