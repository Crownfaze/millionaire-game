import { useState, useEffect, useCallback, useRef } from 'react';
import StudioBackground from '../components/game/StudioBackground';
import { getSocket } from '../lib/socket';
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
  Copy,
  X,
  Save,
  Phone,
  HelpCircle,
  Scissors,
  Zap,
  Eye,
  EyeOff,
  ChevronUp,
  ChevronDown,
  Tag,
  GripVertical,
  Settings,
  StopCircle,
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
  category_id?: number | null;
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

const DEFAULT_PRIZE_LEVELS = [
  '100 ₽', '200 ₽', '300 ₽', '500 ₽', '1 000 ₽',
  '2 000 ₽', '5 000 ₽', '10 000 ₽', '50 000 ₽', '100 000 ₽',
  '250 000 ₽', '400 000 ₽', '500 000 ₽', '750 000 ₽', '1 000 000 ₽',
];

/* ─── Main Component ─── */
export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<'rooms' | 'control' | 'questions' | 'settings'>('control');

  // Room state
  const [roomName, setRoomName] = useState('');
  const [timerDuration, setTimerDuration] = useState(30);
  const [difficulty, setDifficulty] = useState('mixed');
  const [roomCategoryFilter, setRoomCategoryFilter] = useState<number | null>(null);
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

  // New category
  const [newCategoryName, setNewCategoryName] = useState('');

  // Game control state
  const [timerValue, setTimerValue] = useState(30);
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerPaused, setTimerPaused] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Current game state
  const [currentLevel, setCurrentLevel] = useState(0);
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [gameQuestions, setGameQuestions] = useState<QuestionDB[]>([]);
  const [showCorrectAnswer, setShowCorrectAnswer] = useState(true); // Always show

  // Prize ladder customization
  const [prizeLevels, setPrizeLevels] = useState<string[]>(DEFAULT_PRIZE_LEVELS);
  const [editingPrize, setEditingPrize] = useState(false);
  const [prizeDraft, setPrizeDraft] = useState<string[]>(DEFAULT_PRIZE_LEVELS);
  const [safeLevelIndexes, setSafeLevelIndexes] = useState<number[]>([4, 8, 9]); // 1000₽, 50000₽, 100000₽

  // Lifelines
  const [lifeline5050, setLifeline5050] = useState(true);
  const [lifelinePhone, setLifelinePhone] = useState(true);
  const [lifelineAudience, setLifelineAudience] = useState(true);
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
      let url = '/api/questions';
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
      const res = await fetch('/api/questions/categories/all');
      const data = await res.json();
      setCategories(data);
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    }
  }, []);

  const fetchRooms = useCallback(async () => {
    try {
      const res = await fetch('/api/rooms');
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

  /* ─── Socket listeners (timer sync from server) ─── */
  useEffect(() => {
    const socket = getSocket();

    socket.on('timer:sync', (data: { remaining: number; total: number }) => {
      setTimerValue(data.remaining);
      setTimerRunning(true);
      setTimerPaused(false);
    });

    socket.on('timer:paused', () => {
      setTimerRunning(false);
      setTimerPaused(true);
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    });

    socket.on('timer:resumed', () => {
      setTimerRunning(true);
      setTimerPaused(false);
    });

    socket.on('timer:expired', () => {
      setTimerValue(0);
      setTimerRunning(false);
      setTimerPaused(false);
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      showNotify('Время вышло!', 'error');
    });

    return () => {
      socket.off('timer:sync');
      socket.off('timer:paused');
      socket.off('timer:resumed');
      socket.off('timer:expired');
    };
  }, [showNotify]);

  /* ─── Local visual timer (just for admin display when no active room) ─── */
  const startLocalTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    setTimerRunning(true);
    setTimerPaused(false);

    timerRef.current = setInterval(() => {
      setTimerValue((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          timerRef.current = null;
          setTimerRunning(false);
          showNotify('Время вышло!', 'error');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [showNotify]);

  /* ─── Timer controls (emit socket events to sync with players) ─── */
  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    setTimerRunning(true);
    setTimerPaused(false);

    if (activeRoom) {
      const socket = getSocket();
      socket.emit('timer:resume', { roomCode: activeRoom.code });
    } else {
      startLocalTimer();
    }
  }, [activeRoom, startLocalTimer]);

  const pauseTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    setTimerPaused(true);
    setTimerRunning(false);

    if (activeRoom) {
      const socket = getSocket();
      socket.emit('timer:pause', { roomCode: activeRoom.code });
    }
    showNotify('Таймер на паузе', 'info');
  }, [activeRoom, showNotify]);

  const resumeTimer = useCallback(() => {
    if (!timerPaused) return;
    setTimerPaused(false);
    setTimerRunning(true);

    if (activeRoom) {
      const socket = getSocket();
      socket.emit('timer:resume', { roomCode: activeRoom.code });
    } else {
      startLocalTimer();
    }
    showNotify('Таймер возобновлён', 'info');
  }, [timerPaused, activeRoom, startLocalTimer, showNotify]);

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    const dur = activeRoom?.timerDuration || timerDuration;
    setTimerValue(dur);
    setTimerRunning(false);
    setTimerPaused(true); // reset = paused at initial value

    if (activeRoom) {
      const socket = getSocket();
      socket.emit('timer:reset', { roomCode: activeRoom.code, duration: dur });
    }
    showNotify('Таймер сброшен', 'info');
  }, [activeRoom, timerDuration, showNotify]);

  // Cleanup
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
      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: roomName, timerDuration, difficulty, categoryId: roomCategoryFilter }),
      });
      const data = await res.json();
      setActiveRoom(data);
      setTimerValue(timerDuration);
      setRoomName('');
      fetchRooms();

      const socket = getSocket();
      socket.emit('admin:join', { roomCode: data.code, hostId: data.hostId });

      // Load questions filtered by selected category
      let qUrl = '/api/questions';
      if (roomCategoryFilter) {
        const cat = categories.find(c => c.id === roomCategoryFilter);
        if (cat) qUrl += `?category=${encodeURIComponent(cat.name)}`;
      }
      const qRes = await fetch(qUrl);
      const allQ = await qRes.json();
      const shuffled = [...allQ].sort(() => Math.random() - 0.5).slice(0, 15);
      setGameQuestions(shuffled);
      setCurrentQuestionIdx(0);
      setCurrentLevel(0);
      setShowCorrectAnswer(true);

      showNotify(`Комната "${data.name}" создана! Код: ${data.code}`, 'success');
    } catch (error) {
      console.error('Failed to create room:', error);
      showNotify('Ошибка при создании комнаты', 'error');
    }
  }, [roomName, timerDuration, difficulty, roomCategoryFilter, categories, showNotify, fetchRooms]);

  const closeRoom = useCallback(async (code: string) => {
    try {
      await fetch(`/api/rooms/${code}/close`, { method: 'PATCH' });
      if (activeRoom?.code === code) setActiveRoom(null);
      fetchRooms();
      showNotify('Комната закрыта', 'info');
    } catch {
      showNotify('Ошибка при закрытии комнаты', 'error');
    }
  }, [activeRoom, fetchRooms, showNotify]);

  const deleteRoom = useCallback(async (code: string) => {
    try {
      await fetch(`/api/rooms/${code}`, { method: 'DELETE' });
      if (activeRoom?.code === code) setActiveRoom(null);
      fetchRooms();
      showNotify('Комната удалена', 'info');
    } catch {
      showNotify('Ошибка при удалении комнаты', 'error');
    }
  }, [activeRoom, fetchRooms, showNotify]);

  const copyRoomLink = useCallback((code: string) => {
    const link = `${window.location.origin}/room/${code}`;
    navigator.clipboard.writeText(link);
    setCopyFeedback(code);
    setTimeout(() => setCopyFeedback(''), 1500);
    showNotify('Ссылка скопирована!', 'success');
  }, [showNotify]);

  /* ─── Category management ─── */
  const createCategory = useCallback(async () => {
    if (!newCategoryName.trim()) {
      showNotify('Введите название категории', 'error');
      return;
    }
    try {
      const res = await fetch('/api/questions/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCategoryName.trim() }),
      });
      if (!res.ok) throw new Error();
      setNewCategoryName('');
      fetchCategories();
      showNotify(`Категория "${newCategoryName.trim()}" добавлена`, 'success');
    } catch {
      showNotify('Ошибка при создании категории', 'error');
    }
  }, [newCategoryName, fetchCategories, showNotify]);

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
        await fetch(`/api/questions/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        showNotify('Вопрос обновлён', 'success');
      } else {
        await fetch('/api/questions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        showNotify('Вопрос добавлен', 'success');
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
      await fetch(`/api/questions/${id}`, { method: 'DELETE' });
      showNotify('Вопрос удалён', 'info');
      fetchQuestions();
    } catch {
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

  /* ─── Game queue management ─── */
  const addToQueue = useCallback((q: QuestionDB) => {
    setGameQuestions(prev => {
      if (prev.find(gq => gq.id === q.id)) {
        showNotify('Вопрос уже в очереди', 'error');
        return prev;
      }
      showNotify(`Вопрос добавлен в очередь (${prev.length + 1})`, 'success');
      return [...prev, q];
    });
  }, [showNotify]);

  const removeFromQueue = useCallback((idx: number) => {
    setGameQuestions(prev => prev.filter((_, i) => i !== idx));
  }, []);

  const moveQueueItem = useCallback((idx: number, dir: -1 | 1) => {
    setGameQuestions(prev => {
      const next = [...prev];
      const target = idx + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  }, []);

  /* ─── Game Control ─── */
  const sendQuestionToPlayers = useCallback((q: QuestionDB, level: number) => {
    if (!activeRoom) return;
    const socket = getSocket();
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
      safeLevelIndexes,
    });
  }, [activeRoom, timerDuration, safeLevelIndexes]);

  const startGame = useCallback(() => {
    if (gameQuestions.length === 0 || !activeRoom) return;
    // game:question on server auto-starts the timer — no need to call startTimer separately
    sendQuestionToPlayers(gameQuestions[0], 0);
    const dur = activeRoom.timerDuration || timerDuration;
    setTimerValue(dur);
    setTimerRunning(true);
    setTimerPaused(false);
    showNotify('Игра началась! Вопрос отправлен.', 'success');
  }, [gameQuestions, activeRoom, sendQuestionToPlayers, timerDuration, showNotify]);

  const nextQuestion = useCallback(() => {
    if (currentQuestionIdx < gameQuestions.length - 1) {
      const nextIdx = currentQuestionIdx + 1;
      const nextLevel = Math.min(currentLevel + 1, prizeLevels.length - 1);
      setCurrentQuestionIdx(nextIdx);
      setCurrentLevel(nextLevel);
      setHiddenAnswers([]);
      setPhoneResult(null);
      setAudienceResult(null);

      // game:question server handler auto-starts timer — just reset admin display
      const dur = activeRoom?.timerDuration || timerDuration;
      setTimerValue(dur);
      setTimerRunning(true);
      setTimerPaused(false);
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;

      sendQuestionToPlayers(gameQuestions[nextIdx], nextLevel);
      showNotify(`Вопрос ${nextIdx + 1} / ${gameQuestions.length}`, 'info');
    } else {
      showNotify('Все вопросы пройдены!', 'success');
    }
  }, [currentQuestionIdx, currentLevel, gameQuestions, prizeLevels, showNotify, sendQuestionToPlayers, activeRoom, timerDuration]);

  const revealAnswer = useCallback(() => {
    if (activeRoom && gameQuestions[currentQuestionIdx]) {
      const socket = getSocket();
      socket.emit('game:reveal', {
        roomCode: activeRoom.code,
        correctIndex: gameQuestions[currentQuestionIdx].correct_index,
      });
      // Server pauses timer on game:reveal — sync local state
      setTimerPaused(true);
      setTimerRunning(false);
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      showNotify('Правильный ответ показан игрокам', 'info');
    }
  }, [showNotify, activeRoom, gameQuestions, currentQuestionIdx]);

  /* ─── Lifeline handlers ─── */
  const use5050 = useCallback(() => {
    if (!lifeline5050 || !gameQuestions[currentQuestionIdx]) return;
    setLifeline5050(false);
    const correct = gameQuestions[currentQuestionIdx].correct_index;
    const wrong = [0, 1, 2, 3].filter(i => i !== correct);
    const toHide = wrong.sort(() => Math.random() - 0.5).slice(0, 2);
    setHiddenAnswers(toHide);
    if (activeRoom) getSocket().emit('game:lifeline', { roomCode: activeRoom.code, type: '5050', hiddenAnswers: toHide });
    showNotify('50/50 — два неправильных ответа убраны', 'success');
  }, [lifeline5050, gameQuestions, currentQuestionIdx, showNotify, activeRoom]);

  const usePhone = useCallback(() => {
    if (!lifelinePhone || !gameQuestions[currentQuestionIdx]) return;
    setLifelinePhone(false);
    const q = gameQuestions[currentQuestionIdx];
    const correct = q.correct_index;
    const answersArr = [q.answer_a, q.answer_b, q.answer_c, q.answer_d];
    const ltrs = ['A', 'B', 'C', 'D'];
    const isCorrect = Math.random() < 0.8;
    const choice = isCorrect ? correct : [0, 1, 2, 3].filter(i => i !== correct)[Math.floor(Math.random() * 3)];
    const confidence = isCorrect ? Math.floor(70 + Math.random() * 25) : Math.floor(30 + Math.random() * 30);
    const result = `"Я думаю, что ответ ${ltrs[choice]}: ${answersArr[choice]}. Уверенность: ${confidence}%"`;
    setPhoneResult(result);
    if (activeRoom) getSocket().emit('game:lifeline', { roomCode: activeRoom.code, type: 'phone', phoneResult: result });
    showNotify('Звонок другу — ответ получен', 'success');
  }, [lifelinePhone, gameQuestions, currentQuestionIdx, showNotify, activeRoom]);

  const useAudience = useCallback(() => {
    if (!lifelineAudience || !gameQuestions[currentQuestionIdx]) return;
    setLifelineAudience(false);
    const correct = gameQuestions[currentQuestionIdx].correct_index;
    const pct = [0, 0, 0, 0];
    pct[correct] = 40 + Math.floor(Math.random() * 30);
    let rem = 100 - pct[correct];
    for (let i = 0; i < 4; i++) {
      if (i === correct) continue;
      const others = [0, 1, 2, 3].filter(x => x !== correct && pct[x] === 0);
      if (others.indexOf(i) === others.length - 1) { pct[i] = rem; }
      else { const share = Math.floor(Math.random() * rem * 0.6); pct[i] = share; rem -= share; }
    }
    setAudienceResult(pct);
    if (activeRoom) getSocket().emit('game:lifeline', { roomCode: activeRoom.code, type: 'audience', audienceResult: pct });
    showNotify('Помощь зала — результат получен', 'success');
  }, [lifelineAudience, gameQuestions, currentQuestionIdx, showNotify, activeRoom]);

  const resetLifelines = useCallback(() => {
    setLifeline5050(true);
    setLifelinePhone(true);
    setLifelineAudience(true);
    setHiddenAnswers([]);
    setPhoneResult(null);
    setAudienceResult(null);
    if (activeRoom) getSocket().emit('game:resetLifelines', { roomCode: activeRoom.code });
    showNotify('Подсказки восстановлены', 'info');
  }, [showNotify, activeRoom]);

  /* ─── Format time ─── */
  const formatTime = (s: number) => {
    const min = Math.floor(s / 60).toString().padStart(2, '0');
    const sec = (s % 60).toString().padStart(2, '0');
    return `${min}:${sec}`;
  };

  const currentQ = gameQuestions[currentQuestionIdx] || null;
  const answers = currentQ ? [currentQ.answer_a, currentQ.answer_b, currentQ.answer_c, currentQ.answer_d] : [];
  const letters = ['A', 'B', 'C', 'D'];
  const maxTime = activeRoom?.timerDuration || timerDuration;
  const timerPercent = Math.min(100, Math.max(0, (timerValue / (maxTime || 1)) * 100));

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
              { key: 'control' as const, label: 'Управление' },
              { key: 'rooms' as const, label: 'Комнаты' },
              { key: 'questions' as const, label: 'Вопросы' },
              { key: 'settings' as const, label: 'Настройки' },
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
          <a href="/" className="admin-back-btn">На игру</a>
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
                  <h2 className="admin-card-title">Таймер</h2>
                  <div className="control-timer">
                    {/* Ring timer */}
                    <div className="timer-ring-wrap">
                      <svg className="timer-ring-svg" viewBox="0 0 120 120">
                        <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
                        <g transform="rotate(-90 60 60)">
                          <circle
                            cx="60" cy="60" r="52"
                            fill="none"
                            stroke={timerValue <= 5 ? '#ff4444' : '#00d4ff'}
                            strokeWidth="6"
                            strokeLinecap="round"
                            strokeDasharray={`${2 * Math.PI * 52}`}
                            strokeDashoffset={`${2 * Math.PI * 52 * (1 - timerPercent / 100)}`}
                            style={{ transition: 'stroke-dashoffset 0.8s ease, stroke 0.3s' }}
                          />
                        </g>
                      </svg>
                      <div className="timer-ring-center">
                        <span className={`timer-value ${timerValue <= 5 && timerRunning ? 'timer-value--danger' : ''} ${timerPaused ? 'timer-value--paused' : ''}`}>
                          {formatTime(timerValue)}
                        </span>
                        <span className="timer-label">
                          {timerRunning ? 'идёт' : timerPaused ? 'пауза' : 'стоп'}
                        </span>
                      </div>
                    </div>
                    <div className="timer-controls">
                      {!timerRunning && !timerPaused && (
                        <button className="control-btn control-btn--play" onClick={startTimer}>
                          <Play size={16} /> Старт
                        </button>
                      )}
                      {timerRunning && (
                        <button className="control-btn control-btn--pause" onClick={pauseTimer}>
                          <Pause size={16} /> Пауза
                        </button>
                      )}
                      {timerPaused && (
                        <button className="control-btn control-btn--play" onClick={resumeTimer}>
                          <Play size={16} /> Продолжить
                        </button>
                      )}
                      <button className="control-btn control-btn--reset" onClick={resetTimer}>
                        <RotateCcw size={16} /> Сброс
                      </button>
                    </div>
                  </div>
                </div>

                {/* Lifelines Card */}
                <div className="admin-card">
                  <div className="admin-card-header">
                    <h2 className="admin-card-title">Подсказки</h2>
                    <button className="btn-reset-lifelines" onClick={resetLifelines}>
                      <RotateCcw size={13} /> Сбросить
                    </button>
                  </div>
                  <div className="lifeline-controls">
                    <button
                      className={`lifeline-ctrl lifeline-ctrl--5050 ${!lifeline5050 ? 'lifeline-ctrl--used' : ''}`}
                      onClick={use5050}
                      disabled={!lifeline5050}
                    >
                      <div className="lifeline-ctrl-icon"><Scissors size={22} /></div>
                      <div className="lifeline-ctrl-info">
                        <span className="lifeline-ctrl-name">50/50</span>
                        <span className="lifeline-ctrl-desc">Убрать 2 ответа</span>
                      </div>
                      <span className={`lifeline-ctrl-status ${lifeline5050 ? 'lifeline-ctrl-status--available' : 'lifeline-ctrl-status--used'}`}>
                        {lifeline5050 ? 'Доступна' : 'Исп.'}
                      </span>
                    </button>
                    <button
                      className={`lifeline-ctrl lifeline-ctrl--phone ${!lifelinePhone ? 'lifeline-ctrl--used' : ''}`}
                      onClick={usePhone}
                      disabled={!lifelinePhone}
                    >
                      <div className="lifeline-ctrl-icon"><Phone size={22} /></div>
                      <div className="lifeline-ctrl-info">
                        <span className="lifeline-ctrl-name">Звонок другу</span>
                        <span className="lifeline-ctrl-desc">Спросить эксперта</span>
                      </div>
                      <span className={`lifeline-ctrl-status ${lifelinePhone ? 'lifeline-ctrl-status--available' : 'lifeline-ctrl-status--used'}`}>
                        {lifelinePhone ? 'Доступна' : 'Исп.'}
                      </span>
                    </button>
                    <button
                      className={`lifeline-ctrl lifeline-ctrl--audience ${!lifelineAudience ? 'lifeline-ctrl--used' : ''}`}
                      onClick={useAudience}
                      disabled={!lifelineAudience}
                    >
                      <div className="lifeline-ctrl-icon"><Users size={22} /></div>
                      <div className="lifeline-ctrl-info">
                        <span className="lifeline-ctrl-name">Помощь зала</span>
                        <span className="lifeline-ctrl-desc">Голосование</span>
                      </div>
                      <span className={`lifeline-ctrl-status ${lifelineAudience ? 'lifeline-ctrl-status--available' : 'lifeline-ctrl-status--used'}`}>
                        {lifelineAudience ? 'Доступна' : 'Исп.'}
                      </span>
                    </button>
                  </div>
                  {phoneResult && (
                    <div className="lifeline-result lifeline-result--phone">
                      <Phone size={14} />
                      <span>{phoneResult}</span>
                    </div>
                  )}
                  {audienceResult && (
                    <div className="lifeline-result lifeline-result--audience">
                      <Users size={14} />
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
                    <h2 className="admin-card-title">
                      Текущий вопрос
                      {currentQ && (
                        <span className="cq-level-inline"> — {prizeLevels[currentLevel]}</span>
                      )}
                    </h2>
                    <div className="question-nav-btns">
                      {activeRoom && currentQ && (
                        <button className="control-btn control-btn--reveal" onClick={revealAnswer}>
                          <Eye size={14} /> Показать игрокам
                        </button>
                      )}
                      <button className="control-btn control-btn--next" onClick={nextQuestion} disabled={!activeRoom}>
                        <SkipForward size={14} /> Далее
                      </button>
                    </div>
                  </div>

                  {currentQ ? (
                    <div className="current-question-block">
                      <div className="cq-progress">
                        Вопрос {currentQuestionIdx + 1} / {gameQuestions.length}
                        {currentQ.category_name && <span className="cq-cat"> · {currentQ.category_name}</span>}
                      </div>
                      <div className="cq-text">{currentQ.text}</div>
                      <div className="cq-answers">
                        {answers.map((ans, i) => (
                          <div
                            key={i}
                            className={`cq-answer ${hiddenAnswers.includes(i) ? 'cq-answer--hidden' : ''} ${
                              i === currentQ.correct_index ? 'cq-answer--correct' : 'cq-answer--wrong-dim'
                            }`}
                          >
                            <span className="cq-answer-letter">{letters[i]}</span>
                            <span className="cq-answer-text">{ans}</span>
                            {i === currentQ.correct_index && (
                              <CheckCircle size={14} className="cq-answer-icon cq-answer-icon--correct" />
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="cq-empty">
                      <Zap size={36} />
                      <p>Создайте комнату и настройте очередь вопросов</p>
                    </div>
                  )}

                  {currentQ && activeRoom && currentQuestionIdx === 0 && (
                    <button className="btn-start-game" onClick={startGame} style={{ marginTop: '12px' }}>
                      <Play size={16} /> Начать игру
                    </button>
                  )}
                </div>

                {/* Game Queue */}
                <div className="admin-card">
                  <div className="admin-card-header">
                    <h2 className="admin-card-title">Очередь вопросов ({gameQuestions.length})</h2>
                  </div>
                  {gameQuestions.length === 0 ? (
                    <div className="cq-empty" style={{ padding: '20px' }}>
                      <p>Добавьте вопросы из вкладки «Вопросы»</p>
                    </div>
                  ) : (
                    <div className="game-queue">
                      {gameQuestions.map((q, idx) => (
                        <div key={`${q.id}-${idx}`} className={`queue-item ${idx === currentQuestionIdx ? 'queue-item--current' : ''} ${idx < currentQuestionIdx ? 'queue-item--done' : ''}`}>
                          <div className="queue-item-num">{idx + 1}</div>
                          <div className="queue-item-text">{q.text.length > 60 ? q.text.slice(0, 57) + '…' : q.text}</div>
                          <div className="queue-item-actions">
                            <button className="q-action-btn" onClick={() => moveQueueItem(idx, -1)} disabled={idx === 0} title="Вверх">
                              <ChevronUp size={12} />
                            </button>
                            <button className="q-action-btn" onClick={() => moveQueueItem(idx, 1)} disabled={idx === gameQuestions.length - 1} title="Вниз">
                              <ChevronDown size={12} />
                            </button>
                            <button className="q-action-btn q-action-btn--delete" onClick={() => removeFromQueue(idx)} title="Удалить из очереди">
                              <X size={12} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Prize Ladder Mini */}
                <div className="admin-card">
                  <h2 className="admin-card-title">Шкала выигрыша</h2>
                  <div className="prize-ladder-mini">
                    {[...prizeLevels].reverse().map((lvl, revIdx) => {
                      const idx = prizeLevels.length - 1 - revIdx;
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
                <h2 className="admin-card-title">Создать комнату</h2>
                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">Название комнаты</label>
                    <input
                      className="form-input"
                      placeholder="Например: Миллионер Стрим #1"
                      value={roomName}
                      onChange={(e) => setRoomName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && createRoom()}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Категория вопросов</label>
                    <select className="form-select" value={roomCategoryFilter ?? ''} onChange={(e) => setRoomCategoryFilter(e.target.value ? Number(e.target.value) : null)}>
                      <option value="">Все категории (случайные)</option>
                      {categories.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
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
                  <Plus size={16} /> Создать комнату
                </button>
              </div>

              {activeRoom && (
                <div className="admin-card active-room-card">
                  <h2 className="admin-card-title">Активная комната</h2>
                  <div className="active-room-info">
                    <div className="active-room-name">{activeRoom.name}</div>
                    <div className="active-room-code">
                      Код: <strong>{activeRoom.code}</strong>
                      <button className="btn-copy" onClick={() => copyRoomLink(activeRoom.code)}>
                        <Copy size={13} />
                        {copyFeedback === activeRoom.code ? 'Скопировано!' : 'Копировать ссылку'}
                      </button>
                    </div>
                    <div className="active-room-link">{window.location.origin}/room/{activeRoom.code}</div>
                  </div>
                </div>
              )}

              <div className="admin-card">
                <h2 className="admin-card-title">Все комнаты</h2>
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
                          <span className="room-players"><Users size={13} /> {room.participant_count || 0}</span>
                        </div>
                        <div className="room-item-actions">
                          <button className="btn-copy-sm" onClick={() => copyRoomLink(room.code)} title="Скопировать ссылку">
                            <Copy size={12} />
                          </button>
                          {room.status !== 'finished' && (
                            <button className="q-action-btn" onClick={() => closeRoom(room.code)} title="Закрыть комнату">
                              <StopCircle size={13} />
                            </button>
                          )}
                          <button className="q-action-btn q-action-btn--delete" onClick={() => deleteRoom(room.code)} title="Удалить комнату">
                            <Trash2 size={13} />
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
              {/* Category management */}
              <div className="admin-card">
                <h2 className="admin-card-title">Категории</h2>
                <div className="category-list">
                  {categories.map(c => (
                    <span key={c.id} className="category-tag"><Tag size={11} /> {c.name}</span>
                  ))}
                </div>
                <div className="new-category-form">
                  <input
                    className="form-input form-input--sm"
                    placeholder="Новая категория..."
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && createCategory()}
                  />
                  <button className="btn-add-category" onClick={createCategory}>
                    <Plus size={14} /> Добавить
                  </button>
                </div>
              </div>

              <div className="admin-card">
                <div className="admin-card-header">
                  <h2 className="admin-card-title">Вопросы ({questions.length})</h2>
                  <button className="btn-add-question" onClick={() => { setShowForm(true); setEditingId(null); setQuestionForm(emptyForm); }}>
                    <Plus size={14} /> Добавить вопрос
                  </button>
                </div>

                {/* Filters */}
                <div className="question-filters">
                  <select className="form-select form-select--sm" value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
                    <option value="">Все категории</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                  <select className="form-select form-select--sm" value={filterDifficulty} onChange={(e) => setFilterDifficulty(e.target.value)}>
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
                      <h3>{editingId ? 'Редактирование вопроса' : 'Новый вопрос'}</h3>
                      <button className="btn-close-form" onClick={() => { setShowForm(false); setEditingId(null); }}>
                        <X size={16} />
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
                              {questionForm.correctIndex === idx && <span className="correct-badge">Правильный</span>}
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
                        <Save size={14} /> {editingId ? 'Обновить' : 'Сохранить'}
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
                          <button className="q-action-btn" onClick={() => addToQueue(q)} title="В очередь">
                            <Plus size={13} />
                          </button>
                          <button className="q-action-btn" onClick={() => startEdit(q)} title="Редактировать">
                            <Edit3 size={13} />
                          </button>
                          <button className="q-action-btn q-action-btn--delete" onClick={() => deleteQuestion(q.id)} title="Удалить">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ═══════ SETTINGS TAB ═══════ */}
          {activeTab === 'settings' && (
            <div className="admin-section">
              <div className="admin-card">
                <div className="admin-card-header">
                  <h2 className="admin-card-title">Шкала выигрыша (15 уровней)</h2>
                  {!editingPrize ? (
                    <button className="control-btn control-btn--reveal" onClick={() => { setPrizeDraft([...prizeLevels]); setEditingPrize(true); }}>
                      <Edit3 size={14} /> Редактировать
                    </button>
                  ) : (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn-save" onClick={() => { setPrizeLevels([...prizeDraft]); setEditingPrize(false); showNotify('Шкала сохранена', 'success'); }}>
                        <Save size={14} /> Сохранить
                      </button>
                      <button className="btn-cancel" onClick={() => setEditingPrize(false)}>Отмена</button>
                    </div>
                  )}
                </div>
                <div className="prize-editor">
                  {(editingPrize ? prizeDraft : prizeLevels).map((lvl, idx) => {
                    const isSafe = safeLevelIndexes.includes(idx);
                    return (
                      <div key={idx} className={`prize-editor-row ${isSafe ? 'prize-editor-row--safe' : ''}`}>
                        <span className="prize-editor-num">{idx + 1}</span>
                        {editingPrize ? (
                          <input
                            className="form-input form-input--sm prize-editor-input"
                            value={prizeDraft[idx]}
                            onChange={(e) => {
                              const next = [...prizeDraft];
                              next[idx] = e.target.value;
                              setPrizeDraft(next);
                            }}
                          />
                        ) : (
                          <span className={`prize-editor-label ${idx === currentLevel ? 'prize-editor-label--current' : ''} ${isSafe ? 'prize-editor-label--safe' : ''}`}>{lvl}</span>
                        )}
                        <button
                          className={`prize-safe-btn ${isSafe ? 'prize-safe-btn--active' : ''}`}
                          title={isSafe ? 'Убрать несгораемую сумму' : 'Сделать несгораемой'}
                          onClick={() => setSafeLevelIndexes(prev =>
                            isSafe ? prev.filter(i => i !== idx) : [...prev, idx].sort((a, b) => a - b)
                          )}
                        >
                          {isSafe ? '★' : '☆'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
