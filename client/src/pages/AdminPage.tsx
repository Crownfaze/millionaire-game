import { useState, useEffect, useCallback, useRef } from 'react';
import StudioBackground from '../components/game/StudioBackground';
import { getSocket } from '../lib/socket';
import { API_BASE } from '../lib/api';
import {
  Plus,
  Play,
  Pause,
  SkipForward,
  RotateCcw,
  Users,
  Trash2,
  Edit3,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Copy,
  X,
  Save,
  Phone,
  HelpCircle,
  Scissors,
  ChevronDown,
  ChevronUp,
  Zap,
  Eye,
  EyeOff,
} from 'lucide-react';
import '../styles/admin.css';

/* ─── Types ─── */
interface QuestionDB {
  id: number;
  text: string;
  answer_a: string;
  answer_b: string;
  answer_c: string;
  answer_d: string;
  correct_index: number;
  category_id: number | null;
  category_name: string | null;
  difficulty: string;
}

interface Category {
  id: number;
  name: string;
}

interface RoomData {
  code: string;
  name: string;
  hostId: string;
  status: string;
  timerDuration: number;
  difficulty: string;
}

interface QuestionForm {
  text: string;
  answerA: string;
  answerB: string;
  answerC: string;
  answerD: string;
  correctIndex: number;
  categoryId: number | null;
  difficulty: string;
}

const emptyForm: QuestionForm = {
  text: '',
  answerA: '',
  answerB: '',
  answerC: '',
  answerD: '',
  correctIndex: 0,
  categoryId: null,
  difficulty: 'medium',
};

const PRIZE_LEVELS = [
  '100 ₽', '200 ₽', '300 ₽', '500 ₽', '1 000 ₽',
  '2 000 ₽', '5 000 ₽', '10 000 ₽', '50 000 ₽', '100 000 ₽',
  '250 000 ₽', '400 000 ₽', '500 000 ₽', '750 000 ₽', '1 000 000 ₽',
];

/* ─── Main Component ─── */
export default function AdminPage() {
  // Tabs
  const [activeTab, setActiveTab] = useState<'rooms' | 'control' | 'questions'>('control');

  // Room state
  const [roomName, setRoomName] = useState('');
  const [timerDuration, setTimerDuration] = useState(30);
  const [difficulty, setDifficulty] = useState('mixed');
  const [rooms, setRooms] = useState<RoomData[]>([]);
  const [activeRoom, setActiveRoom] = useState<RoomData | null>(null);
  const [copyFeedback, setCopyFeedback] = useState('');

  // Questions state
  const [questions, setQuestions] = useState<QuestionDB[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [questionForm, setQuestionForm] = useState<QuestionForm>(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [filterCategory, setFilterCategory] = useState('');
  const [filterDifficulty, setFilterDifficulty] = useState('');

  // Game control state
  const [timerValue, setTimerValue] = useState(30);
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerPaused, setTimerPaused] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Current game state
  const [currentLevel, setCurrentLevel] = useState(0);
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [gameQuestions, setGameQuestions] = useState<QuestionDB[]>([]);
  const [showCorrectAnswer, setShowCorrectAnswer] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);

  // Lifelines
  const [lifeline5050, setLifeline5050] = useState(true);
  const [lifelinePhone, setLifelinePhone] = useState(true);
  const [lifelineAudience, setLifelineAudience] = useState(true);
  const [lifeline5050Anim, setLifeline5050Anim] = useState(false);
  const [lifelinePhoneAnim, setLifelinePhoneAnim] = useState(false);
  const [lifelineAudienceAnim, setLifelineAudienceAnim] = useState(false);
  const [hiddenAnswers, setHiddenAnswers] = useState<number[]>([]);
  const [phoneResult, setPhoneResult] = useState<string | null>(null);
  const [audienceResult, setAudienceResult] = useState<number[] | null>(null);

  // Notification
  const [notification, setNotification] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  /* ─── Notification helper ─── */
  const showNotify = useCallback((text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setNotification({ text, type });
    setTimeout(() => setNotification(null), 3000);
  }, []);

  /* ─── Fetch data ─── */
  const fetchQuestions = useCallback(async () => {
    try {
      let url = `${API_BASE}/api/questions`;
      const params = new URLSearchParams();
      if (filterCategory) params.set('category', filterCategory);
      if (filterDifficulty) params.set('difficulty', filterDifficulty);
      if (params.toString()) url += '?' + params.toString();

      const res = await fetch(url);
      const data = await res.json();
      setQuestions(data);
    } catch (error) {
      console.error('Failed to fetch questions:', error);
    }
  }, [filterCategory, filterDifficulty]);

  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/questions/categories/all`);
      const data = await res.json();
      setCategories(data);
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    }
  }, []);

  const fetchRooms = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/rooms`);
      const data = await res.json();
      setRooms(data);
    } catch (error) {
      console.error('Failed to fetch rooms:', error);
    }
  }, []);

  useEffect(() => {
    fetchQuestions();
    fetchCategories();
    fetchRooms();
  }, [fetchQuestions, fetchCategories, fetchRooms]);

  /* ─── Timer logic ─── */
  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    setTimerRunning(true);
    setTimerPaused(false);

    timerRef.current = setInterval(() => {
      setTimerValue((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          setTimerRunning(false);
          showNotify('⏰ Время вышло!', 'error');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [showNotify]);

  const pauseTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    setTimerPaused(true);
    setTimerRunning(false);
    showNotify('⏸️ Таймер на паузе', 'info');
  }, [showNotify]);

  const resumeTimer = useCallback(() => {
    if (timerPaused) {
      startTimer();
      showNotify('▶️ Таймер возобновлён', 'info');
    }
  }, [timerPaused, startTimer, showNotify]);

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    setTimerValue(activeRoom?.timerDuration || timerDuration);
    setTimerRunning(false);
    setTimerPaused(false);
    showNotify('🔄 Таймер сброшен', 'info');
  }, [activeRoom, timerDuration, showNotify]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  /* ─── Room management ─── */
  const createRoom = useCallback(async () => {
    if (!roomName.trim()) {
      showNotify('Введите название комнаты', 'error');
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: roomName, timerDuration, difficulty }),
      });
      const data = await res.json();
      setActiveRoom(data);
      setTimerValue(timerDuration);
      setRoomName('');
      fetchRooms();

      // Join room via socket as admin
      const socket = getSocket();
      socket.emit('admin:join', { roomCode: data.code, hostId: data.hostId });

      // Load questions for the game
      const qRes = await fetch(`${API_BASE}/api/questions`);
      const allQ = await qRes.json();
      // Shuffle and pick 15
      const shuffled = [...allQ].sort(() => Math.random() - 0.5).slice(0, 15);
      setGameQuestions(shuffled);
      setCurrentQuestionIdx(0);
      setCurrentLevel(0);

      showNotify(`✅ Комната "${data.name}" создана! Код: ${data.code}`, 'success');
    } catch (error) {
      console.error('Failed to create room:', error);
      showNotify('Ошибка при создании комнаты', 'error');
    }
  }, [roomName, timerDuration, difficulty, showNotify, fetchRooms]);

  const copyRoomLink = useCallback((code: string) => {
    const link = `${window.location.origin}/room/${code}`;
    navigator.clipboard.writeText(link);
    setCopyFeedback(code);
    setTimeout(() => setCopyFeedback(''), 1500);
    showNotify('📋 Ссылка скопирована!', 'success');
  }, [showNotify]);

  /* ─── Question CRUD ─── */
  const saveQuestion = useCallback(async () => {
    const { text, answerA, answerB, answerC, answerD, correctIndex, categoryId, difficulty: diff } = questionForm;
    if (!text.trim() || !answerA.trim() || !answerB.trim() || !answerC.trim() || !answerD.trim()) {
      showNotify('Заполните все поля', 'error');
      return;
    }

    try {
      const body = { text, answerA, answerB, answerC, answerD, correctIndex, categoryId, difficulty: diff };

      if (editingId) {
        await fetch(`${API_BASE}/api/questions/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        showNotify('✅ Вопрос обновлён', 'success');
      } else {
        await fetch(`${API_BASE}/api/questions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        showNotify('✅ Вопрос добавлен', 'success');
      }

      setQuestionForm(emptyForm);
      setShowForm(false);
      setEditingId(null);
      fetchQuestions();
    } catch (error) {
      console.error('Failed to save question:', error);
      showNotify('Ошибка при сохранении', 'error');
    }
  }, [questionForm, editingId, showNotify, fetchQuestions]);

  const deleteQuestion = useCallback(async (id: number) => {
    try {
      await fetch(`${API_BASE}/api/questions/${id}`, { method: 'DELETE' });
      showNotify('🗑️ Вопрос удалён', 'info');
      fetchQuestions();
    } catch (error) {
      console.error('Failed to delete question:', error);
      showNotify('Ошибка при удалении', 'error');
    }
  }, [showNotify, fetchQuestions]);

  const startEdit = useCallback((q: QuestionDB) => {
    setQuestionForm({
      text: q.text,
      answerA: q.answer_a,
      answerB: q.answer_b,
      answerC: q.answer_c,
      answerD: q.answer_d,
      correctIndex: q.correct_index,
      categoryId: q.category_id,
      difficulty: q.difficulty,
    });
    setEditingId(q.id);
    setShowForm(true);
  }, []);

  /* ─── Game Control ─── */
  const sendQuestionToPlayers = useCallback((q: QuestionDB, level: number) => {
    if (!activeRoom) return;
    const socket = getSocket();
    const letters = ['A', 'B', 'C', 'D'];
    socket.emit('game:question', {
      roomCode: activeRoom.code,
      question: {
        text: q.text,
        answers: [
          { label: 'A', text: q.answer_a },
          { label: 'B', text: q.answer_b },
          { label: 'C', text: q.answer_c },
          { label: 'D', text: q.answer_d },
        ],
        correctIndex: q.correct_index,
      },
      level,
      timerDuration: activeRoom.timerDuration || timerDuration,
    });
  }, [activeRoom, timerDuration]);

  const nextQuestion = useCallback(() => {
    if (currentQuestionIdx < gameQuestions.length - 1) {
      const nextIdx = currentQuestionIdx + 1;
      const nextLevel = Math.min(currentLevel + 1, 14);
      setCurrentQuestionIdx(nextIdx);
      setCurrentLevel(nextLevel);
      setShowCorrectAnswer(false);
      setSelectedAnswer(null);
      setHiddenAnswers([]);
      setPhoneResult(null);
      setAudienceResult(null);
      resetTimer();
      startTimer();

      // Broadcast to players
      sendQuestionToPlayers(gameQuestions[nextIdx], nextLevel);

      showNotify(`📝 Вопрос ${nextIdx + 1} / ${gameQuestions.length}`, 'info');
    } else {
      showNotify('🎉 Все вопросы пройдены!', 'success');
    }
  }, [currentQuestionIdx, currentLevel, gameQuestions, resetTimer, startTimer, showNotify, sendQuestionToPlayers]);

  // Send first question to players
  const startGame = useCallback(() => {
    if (gameQuestions.length === 0 || !activeRoom) return;
    sendQuestionToPlayers(gameQuestions[0], 0);
    startTimer();
    showNotify('🎮 Игра началась! Вопрос отправлен.', 'success');
  }, [gameQuestions, activeRoom, sendQuestionToPlayers, startTimer, showNotify]);

  const revealAnswer = useCallback(() => {
    setShowCorrectAnswer(true);
    pauseTimer();
    if (activeRoom && gameQuestions[currentQuestionIdx]) {
      const socket = getSocket();
      socket.emit('game:reveal', {
        roomCode: activeRoom.code,
        correctIndex: gameQuestions[currentQuestionIdx].correct_index,
      });
    }
    showNotify('👁️ Правильный ответ показан', 'info');
  }, [pauseTimer, showNotify, activeRoom, gameQuestions, currentQuestionIdx]);

  const selectAnswer = useCallback((idx: number) => {
    setSelectedAnswer(idx);
    if (activeRoom) {
      const socket = getSocket();
      socket.emit('game:selectAnswer', { roomCode: activeRoom.code, answerIndex: idx });
    }
  }, [activeRoom]);

  /* ─── Lifeline handlers ─── */
  const use5050 = useCallback(() => {
    if (!lifeline5050 || !gameQuestions[currentQuestionIdx]) return;
    setLifeline5050(false);
    setLifeline5050Anim(true);
    setTimeout(() => setLifeline5050Anim(false), 1500);

    const correct = gameQuestions[currentQuestionIdx].correct_index;
    const wrong = [0, 1, 2, 3].filter((i) => i !== correct);
    const toHide = wrong.sort(() => Math.random() - 0.5).slice(0, 2);
    setHiddenAnswers(toHide);

    if (activeRoom) {
      getSocket().emit('game:lifeline', { roomCode: activeRoom.code, type: '5050', hiddenAnswers: toHide });
    }
    showNotify('✂️ 50/50 — два неправильных ответа убраны!', 'success');
  }, [lifeline5050, gameQuestions, currentQuestionIdx, showNotify, activeRoom]);

  const usePhone = useCallback(() => {
    if (!lifelinePhone || !gameQuestions[currentQuestionIdx]) return;
    setLifelinePhone(false);
    setLifelinePhoneAnim(true);
    setTimeout(() => setLifelinePhoneAnim(false), 2000);

    const q = gameQuestions[currentQuestionIdx];
    const correct = q.correct_index;
    const answersArr = [q.answer_a, q.answer_b, q.answer_c, q.answer_d];
    const ltrs = ['A', 'B', 'C', 'D'];
    const isCorrect = Math.random() < 0.8;
    const choice = isCorrect ? correct : [0, 1, 2, 3].filter((i) => i !== correct)[Math.floor(Math.random() * 2)];
    const confidence = isCorrect ? Math.floor(70 + Math.random() * 25) : Math.floor(30 + Math.random() * 30);

    const result = `"Я думаю, что ответ ${ltrs[choice]}: ${answersArr[choice]}. Уверенность: ${confidence}%"`;
    setPhoneResult(result);

    if (activeRoom) {
      getSocket().emit('game:lifeline', { roomCode: activeRoom.code, type: 'phone', phoneResult: result });
    }
    showNotify('📞 Звонок другу — ответ получен!', 'success');
  }, [lifelinePhone, gameQuestions, currentQuestionIdx, showNotify, activeRoom]);

  const useAudience = useCallback(() => {
    if (!lifelineAudience || !gameQuestions[currentQuestionIdx]) return;
    setLifelineAudience(false);
    setLifelineAudienceAnim(true);
    setTimeout(() => setLifelineAudienceAnim(false), 2000);

    const correct = gameQuestions[currentQuestionIdx].correct_index;
    const percentages = [0, 0, 0, 0];
    percentages[correct] = 40 + Math.floor(Math.random() * 30);
    let remaining = 100 - percentages[correct];
    for (let i = 0; i < 4; i++) {
      if (i === correct) continue;
      if (i === 3 || (i === 2 && [0, 1, 2].filter((x) => x !== correct).indexOf(i) === 1)) {
        percentages[i] = remaining;
      } else {
        const share = Math.floor(Math.random() * remaining * 0.6);
        percentages[i] = share;
        remaining -= share;
      }
    }
    setAudienceResult(percentages);

    if (activeRoom) {
      getSocket().emit('game:lifeline', { roomCode: activeRoom.code, type: 'audience', audienceResult: percentages });
    }
    showNotify('👥 Помощь зала — результат получен!', 'success');
  }, [lifelineAudience, gameQuestions, currentQuestionIdx, showNotify, activeRoom]);

  const resetLifelines = useCallback(() => {
    setLifeline5050(true);
    setLifelinePhone(true);
    setLifelineAudience(true);
    setHiddenAnswers([]);
    setPhoneResult(null);
    setAudienceResult(null);
    if (activeRoom) {
      getSocket().emit('game:resetLifelines', { roomCode: activeRoom.code });
    }
    showNotify('🔄 Подсказки восстановлены', 'info');
  }, [showNotify, activeRoom]);

  /* ─── Format time ─── */
  const formatTime = (s: number) => {
    const min = Math.floor(s / 60).toString().padStart(2, '0');
    const sec = (s % 60).toString().padStart(2, '0');
    return `${min}:${sec}`;
  };

  const currentQ = gameQuestions[currentQuestionIdx] || null;
  const answers = currentQ
    ? [currentQ.answer_a, currentQ.answer_b, currentQ.answer_c, currentQ.answer_d]
    : [];
  const letters = ['A', 'B', 'C', 'D'];

  return (
    <>
      <StudioBackground />

      {/* Notification toast */}
      {notification && (
        <div className={`admin-toast admin-toast--${notification.type}`}>
          {notification.text}
        </div>
      )}

      <div className="admin-page" id="admin-page">
        {/* HEADER */}
        <header className="admin-header">
          <div className="header-logo">
            <div className="logo-badge"><span>M</span></div>
            <span className="logo-text">ПУЛЬТ УПРАВЛЕНИЯ</span>
          </div>
          <nav className="admin-tabs">
            {([
              { key: 'control' as const, label: '🎮 Управление', icon: <Zap size={16} /> },
              { key: 'rooms' as const, label: '🏠 Комнаты', icon: <Users size={16} /> },
              { key: 'questions' as const, label: '📝 Вопросы', icon: <HelpCircle size={16} /> },
            ]).map((tab) => (
              <button
                key={tab.key}
                className={`admin-tab ${activeTab === tab.key ? 'admin-tab--active' : ''}`}
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </nav>
          <a href="/" className="admin-back-btn">← На игру</a>
        </header>

        {/* CONTENT */}
        <div className="admin-content">

          {/* ═══════ GAME CONTROL TAB ═══════ */}
          {activeTab === 'control' && (
            <div className="admin-section admin-section--control">
              {/* Left Column */}
              <div className="control-left">
                {/* Timer Card */}
                <div className="admin-card control-card">
                  <h2 className="admin-card-title">⏱️ Таймер</h2>
                  <div className="control-timer">
                    <div className="timer-display">
                      <span className={`timer-value ${timerValue <= 5 && timerRunning ? 'timer-value--danger' : ''} ${timerPaused ? 'timer-value--paused' : ''}`}>
                        {formatTime(timerValue)}
                      </span>
                      <span className="timer-label">
                        {timerRunning ? 'идёт отсчёт' : timerPaused ? '⏸ на паузе' : 'остановлен'}
                      </span>
                    </div>
                    <div className="timer-controls">
                      {!timerRunning && !timerPaused && (
                        <button className="control-btn control-btn--play" onClick={startTimer}>
                          <Play size={18} /> Старт
                        </button>
                      )}
                      {timerRunning && (
                        <button className="control-btn control-btn--pause" onClick={pauseTimer}>
                          <Pause size={18} /> Пауза
                        </button>
                      )}
                      {timerPaused && (
                        <button className="control-btn control-btn--play" onClick={resumeTimer}>
                          <Play size={18} /> Продолжить
                        </button>
                      )}
                      <button className="control-btn control-btn--reset" onClick={resetTimer}>
                        <RotateCcw size={18} /> Сброс
                      </button>
                    </div>
                  </div>
                </div>

                {/* Lifelines Card */}
                <div className="admin-card">
                  <div className="admin-card-header">
                    <h2 className="admin-card-title">💡 Подсказки</h2>
                    <button className="btn-reset-lifelines" onClick={resetLifelines}>
                      <RotateCcw size={14} /> Сбросить
                    </button>
                  </div>
                  <div className="lifeline-controls">
                    {/* 50/50 */}
                    <button
                      className={`lifeline-ctrl lifeline-ctrl--5050 ${!lifeline5050 ? 'lifeline-ctrl--used' : ''} ${lifeline5050Anim ? 'lifeline-ctrl--animating' : ''}`}
                      onClick={use5050}
                      disabled={!lifeline5050}
                    >
                      <div className="lifeline-ctrl-icon">
                        <Scissors size={24} />
                      </div>
                      <div className="lifeline-ctrl-info">
                        <span className="lifeline-ctrl-name">50/50</span>
                        <span className="lifeline-ctrl-desc">Убрать 2 ответа</span>
                      </div>
                      <span className={`lifeline-ctrl-status ${lifeline5050 ? 'lifeline-ctrl-status--available' : 'lifeline-ctrl-status--used'}`}>
                        {lifeline5050 ? 'Доступна' : 'Использована'}
                      </span>
                    </button>

                    {/* Звонок другу */}
                    <button
                      className={`lifeline-ctrl lifeline-ctrl--phone ${!lifelinePhone ? 'lifeline-ctrl--used' : ''} ${lifelinePhoneAnim ? 'lifeline-ctrl--animating' : ''}`}
                      onClick={usePhone}
                      disabled={!lifelinePhone}
                    >
                      <div className="lifeline-ctrl-icon">
                        <Phone size={24} />
                      </div>
                      <div className="lifeline-ctrl-info">
                        <span className="lifeline-ctrl-name">Звонок другу</span>
                        <span className="lifeline-ctrl-desc">Спросить эксперта</span>
                      </div>
                      <span className={`lifeline-ctrl-status ${lifelinePhone ? 'lifeline-ctrl-status--available' : 'lifeline-ctrl-status--used'}`}>
                        {lifelinePhone ? 'Доступна' : 'Использована'}
                      </span>
                    </button>

                    {/* Помощь зала */}
                    <button
                      className={`lifeline-ctrl lifeline-ctrl--audience ${!lifelineAudience ? 'lifeline-ctrl--used' : ''} ${lifelineAudienceAnim ? 'lifeline-ctrl--animating' : ''}`}
                      onClick={useAudience}
                      disabled={!lifelineAudience}
                    >
                      <div className="lifeline-ctrl-icon">
                        <Users size={24} />
                      </div>
                      <div className="lifeline-ctrl-info">
                        <span className="lifeline-ctrl-name">Помощь зала</span>
                        <span className="lifeline-ctrl-desc">Голосование аудитории</span>
                      </div>
                      <span className={`lifeline-ctrl-status ${lifelineAudience ? 'lifeline-ctrl-status--available' : 'lifeline-ctrl-status--used'}`}>
                        {lifelineAudience ? 'Доступна' : 'Использована'}
                      </span>
                    </button>
                  </div>

                  {/* Lifeline results */}
                  {phoneResult && (
                    <div className="lifeline-result lifeline-result--phone">
                      <Phone size={16} />
                      <span>{phoneResult}</span>
                    </div>
                  )}
                  {audienceResult && (
                    <div className="lifeline-result lifeline-result--audience">
                      <Users size={16} />
                      <div className="audience-bars">
                        {audienceResult.map((pct, i) => (
                          <div key={i} className="audience-bar-item">
                            <span className="audience-bar-label">{letters[i]}</span>
                            <div className="audience-bar-track">
                              <div
                                className={`audience-bar-fill ${i === currentQ?.correct_index ? 'audience-bar-fill--correct' : ''}`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="audience-bar-pct">{pct}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column */}
              <div className="control-right">
                {/* Current Question */}
                <div className="admin-card">
                  <div className="admin-card-header">
                    <h2 className="admin-card-title">📋 Текущий вопрос</h2>
                    <div className="question-nav-btns">
                      <button className="control-btn control-btn--reveal" onClick={revealAnswer}>
                        {showCorrectAnswer ? <EyeOff size={16} /> : <Eye size={16} />}
                        {showCorrectAnswer ? 'Скрыть' : 'Показать ответ'}
                      </button>
                      <button className="control-btn control-btn--next" onClick={nextQuestion}>
                        <SkipForward size={16} /> Далее
                      </button>
                    </div>
                  </div>

                  {currentQ ? (
                    <div className="current-question-block">
                      <div className="cq-level-badge">
                        Вопрос {currentQuestionIdx + 1} / {gameQuestions.length} • {PRIZE_LEVELS[currentLevel]}
                      </div>
                      <div className="cq-text">{currentQ.text}</div>
                      <div className="cq-answers">
                        {answers.map((ans, i) => (
                          <button
                            key={i}
                            className={`cq-answer ${hiddenAnswers.includes(i) ? 'cq-answer--hidden' : ''} ${
                              showCorrectAnswer && i === currentQ.correct_index ? 'cq-answer--correct' : ''
                            } ${
                              showCorrectAnswer && selectedAnswer === i && i !== currentQ.correct_index ? 'cq-answer--wrong' : ''
                            } ${
                              selectedAnswer === i && !showCorrectAnswer ? 'cq-answer--selected' : ''
                            }`}
                            onClick={() => selectAnswer(i)}
                            disabled={hiddenAnswers.includes(i)}
                          >
                            <span className="cq-answer-letter">{letters[i]}</span>
                            <span className="cq-answer-text">{ans}</span>
                            {showCorrectAnswer && i === currentQ.correct_index && (
                              <CheckCircle size={16} className="cq-answer-icon cq-answer-icon--correct" />
                            )}
                            {showCorrectAnswer && selectedAnswer === i && i !== currentQ.correct_index && (
                              <XCircle size={16} className="cq-answer-icon cq-answer-icon--wrong" />
                            )}
                          </button>
                        ))}
                      </div>
                      {currentQ.category_name && (
                        <div className="cq-meta">
                          Категория: <strong>{currentQ.category_name}</strong> • Сложность: <strong>{currentQ.difficulty}</strong>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="cq-empty">
                      <Zap size={40} />
                      <p>Создайте комнату во вкладке «Комнаты» для начала игры</p>
                    </div>
                  )}

                  {currentQ && !activeRoom && (
                    <div style={{ marginTop: '12px' }}>
                      <div className="cq-empty" style={{ padding: '16px' }}>
                        <p style={{ fontSize: '13px' }}>⚠️ Создайте комнату чтобы игроки увидели вопросы</p>
                      </div>
                    </div>
                  )}

                  {currentQ && activeRoom && currentQuestionIdx === 0 && !showCorrectAnswer && (
                    <button className="btn-start-game" onClick={startGame} style={{ marginTop: '12px', width: '100%', padding: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', background: 'linear-gradient(135deg, rgba(0,255,136,0.15), rgba(0,255,136,0.05))', border: '1px solid rgba(0,255,136,0.3)', borderRadius: '10px', color: '#00ff88', fontWeight: 700, fontSize: '14px', transition: 'all 0.2s' }}>
                      <Play size={18} /> Начать игру — отправить 1-й вопрос
                    </button>
                  )}
                </div>

                {/* Prize Ladder Mini */}
                <div className="admin-card">
                  <h2 className="admin-card-title">🏆 Шкала выигрыша</h2>
                  <div className="prize-ladder-mini">
                    {[...PRIZE_LEVELS].reverse().map((lvl, revIdx) => {
                      const idx = PRIZE_LEVELS.length - 1 - revIdx;
                      return (
                        <div
                          key={idx}
                          className={`plm-item ${idx === currentLevel ? 'plm-item--current' : ''} ${idx < currentLevel ? 'plm-item--passed' : ''}`}
                          onClick={() => setCurrentLevel(idx)}
                        >
                          <span className="plm-num">{idx + 1}</span>
                          <span className="plm-amount">{lvl}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ═══════ ROOMS TAB ═══════ */}
          {activeTab === 'rooms' && (
            <div className="admin-section">
              <div className="admin-card">
                <h2 className="admin-card-title">🏠 Создать комнату</h2>
                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">Название комнаты</label>
                    <input
                      className="form-input"
                      placeholder="Например: Миллионер Стрим #1"
                      value={roomName}
                      onChange={(e) => setRoomName(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Сложность</label>
                    <select className="form-select" value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
                      <option value="mixed">Смешанная</option>
                      <option value="easy">Лёгкая</option>
                      <option value="medium">Средняя</option>
                      <option value="hard">Тяжёлая</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Таймер (сек.)</label>
                    <input
                      className="form-input"
                      type="number"
                      min={10}
                      max={120}
                      value={timerDuration}
                      onChange={(e) => setTimerDuration(Number(e.target.value))}
                    />
                  </div>
                </div>
                <button className="btn-create-room" onClick={createRoom}>
                  <Plus size={18} /> Создать комнату
                </button>
              </div>

              {activeRoom && (
                <div className="admin-card active-room-card">
                  <h2 className="admin-card-title">🟢 Активная комната</h2>
                  <div className="active-room-info">
                    <div className="active-room-name">{activeRoom.name}</div>
                    <div className="active-room-code">
                      Код: <strong>{activeRoom.code}</strong>
                      <button className="btn-copy" onClick={() => copyRoomLink(activeRoom.code)}>
                        <Copy size={14} />
                        {copyFeedback === activeRoom.code ? 'Скопировано!' : 'Копировать ссылку'}
                      </button>
                    </div>
                    <div className="active-room-link">
                      {window.location.origin}/room/{activeRoom.code}
                    </div>
                  </div>
                </div>
              )}

              <div className="admin-card">
                <h2 className="admin-card-title">📋 Все комнаты</h2>
                {rooms.length === 0 ? (
                  <div className="empty-state">Комнат пока нет. Создайте первую!</div>
                ) : (
                  <div className="room-list">
                    {rooms.map((room: any) => (
                      <div key={room.code} className="room-item">
                        <div className="room-item-info">
                          <span className="room-name">{room.name}</span>
                          <span className="room-code">Код: {room.code}</span>
                        </div>
                        <div className="room-item-meta">
                          <span className={`room-status room-status--${room.status}`}>
                            {room.status === 'waiting' ? 'Ожидание' : room.status === 'playing' ? 'Идёт' : 'Завершена'}
                          </span>
                          <span className="room-players"><Users size={14} /> {room.participant_count || 0}</span>
                          <button className="btn-copy-sm" onClick={() => copyRoomLink(room.code)}>
                            <Copy size={12} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ═══════ QUESTIONS TAB ═══════ */}
          {activeTab === 'questions' && (
            <div className="admin-section">
              <div className="admin-card">
                <div className="admin-card-header">
                  <h2 className="admin-card-title">📝 Вопросы ({questions.length})</h2>
                  <button
                    className="btn-add-question"
                    onClick={() => { setShowForm(true); setEditingId(null); setQuestionForm(emptyForm); }}
                  >
                    <Plus size={16} /> Добавить вопрос
                  </button>
                </div>

                {/* Filters */}
                <div className="question-filters">
                  <select
                    className="form-select form-select--sm"
                    value={filterCategory}
                    onChange={(e) => setFilterCategory(e.target.value)}
                  >
                    <option value="">Все категории</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                  <select
                    className="form-select form-select--sm"
                    value={filterDifficulty}
                    onChange={(e) => setFilterDifficulty(e.target.value)}
                  >
                    <option value="">Все сложности</option>
                    <option value="easy">Лёгкий</option>
                    <option value="medium">Средний</option>
                    <option value="hard">Сложный</option>
                  </select>
                </div>

                {/* Question Form */}
                {showForm && (
                  <div className="question-form">
                    <div className="question-form-header">
                      <h3>{editingId ? '✏️ Редактирование вопроса' : '➕ Новый вопрос'}</h3>
                      <button className="btn-close-form" onClick={() => { setShowForm(false); setEditingId(null); }}>
                        <X size={18} />
                      </button>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Текст вопроса</label>
                      <textarea
                        className="form-textarea"
                        rows={3}
                        value={questionForm.text}
                        onChange={(e) => setQuestionForm({ ...questionForm, text: e.target.value })}
                        placeholder="Введите текст вопроса..."
                      />
                    </div>
                    <div className="form-grid form-grid--answers">
                      {['A', 'B', 'C', 'D'].map((letter, idx) => {
                        const keys: Array<keyof QuestionForm> = ['answerA', 'answerB', 'answerC', 'answerD'];
                        return (
                          <div key={letter} className="form-group">
                            <label className="form-label">
                              Ответ {letter}
                              {questionForm.correctIndex === idx && <span className="correct-badge">✓ Правильный</span>}
                            </label>
                            <div className="answer-input-wrap">
                              <input
                                className="form-input"
                                placeholder={`Вариант ${letter}`}
                                value={questionForm[keys[idx]] as string}
                                onChange={(e) => setQuestionForm({ ...questionForm, [keys[idx]]: e.target.value })}
                              />
                              <button
                                className={`correct-toggle ${questionForm.correctIndex === idx ? 'correct-toggle--active' : ''}`}
                                onClick={() => setQuestionForm({ ...questionForm, correctIndex: idx })}
                                title="Отметить как правильный"
                              >
                                ✓
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label className="form-label">Категория</label>
                        <select
                          className="form-select"
                          value={questionForm.categoryId || ''}
                          onChange={(e) => setQuestionForm({ ...questionForm, categoryId: e.target.value ? Number(e.target.value) : null })}
                        >
                          <option value="">Без категории</option>
                          {categories.map((c) => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="form-group">
                        <label className="form-label">Сложность</label>
                        <select
                          className="form-select"
                          value={questionForm.difficulty}
                          onChange={(e) => setQuestionForm({ ...questionForm, difficulty: e.target.value })}
                        >
                          <option value="easy">Лёгкий</option>
                          <option value="medium">Средний</option>
                          <option value="hard">Сложный</option>
                        </select>
                      </div>
                    </div>
                    <div className="form-actions">
                      <button className="btn-save" onClick={saveQuestion}>
                        <Save size={16} /> {editingId ? 'Обновить' : 'Сохранить'}
                      </button>
                      <button className="btn-cancel" onClick={() => { setShowForm(false); setEditingId(null); }}>
                        Отмена
                      </button>
                    </div>
                  </div>
                )}

                {/* Question List */}
                <div className="question-list">
                  {questions.length === 0 ? (
                    <div className="empty-state">Вопросов не найдено</div>
                  ) : (
                    questions.map((q) => (
                      <div key={q.id} className="question-item">
                        <div className="question-item-main">
                          <div className="question-item-text">{q.text}</div>
                          <div className="question-item-answers">
                            {[q.answer_a, q.answer_b, q.answer_c, q.answer_d].map((a, i) => (
                              <span key={i} className={`qi-answer ${i === q.correct_index ? 'qi-answer--correct' : ''}`}>
                                {letters[i]}: {a}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div className="question-item-meta">
                          {q.category_name && <span className="question-category">{q.category_name}</span>}
                          <span className={`question-difficulty question-difficulty--${q.difficulty}`}>
                            {q.difficulty === 'easy' ? 'Лёгкий' : q.difficulty === 'medium' ? 'Средний' : 'Сложный'}
                          </span>
                        </div>
                        <div className="question-item-actions">
                          <button className="q-action-btn" onClick={() => startEdit(q)} title="Редактировать">
                            <Edit3 size={14} />
                          </button>
                          <button className="q-action-btn q-action-btn--delete" onClick={() => deleteQuestion(q.id)} title="Удалить">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
