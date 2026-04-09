import { useState, useCallback, useEffect } from 'react';
import StudioBackground from '../components/game/StudioBackground';
import GameHeader from '../components/game/GameHeader';
import Lifelines from '../components/game/Lifelines';
import QuestionCard from '../components/game/QuestionCard';
import AnswerGrid from '../components/game/AnswerGrid';
import PrizeProgress from '../components/game/PrizeProgress';
import GameFooter from '../components/game/GameFooter';
import type { GameState, AnswerState, LifelineState } from '../types/game';
import { PRIZE_LEVELS } from '../types/game';
import '../styles/game.css';

const DEMO_QUESTIONS = [
  {
    id: '1',
    text: 'В каком году Юрий Гагарин совершил первый полёт в космос?',
    answers: [
      { label: 'A', text: '1957' },
      { label: 'B', text: '1961' },
      { label: 'C', text: '1965' },
      { label: 'D', text: '1970' },
    ],
    correctIndex: 1,
    category: 'История',
  },
  {
    id: '2',
    text: 'Какой элемент обозначается символом "Au" в периодической таблице?',
    answers: [
      { label: 'A', text: 'Серебро' },
      { label: 'B', text: 'Алюминий' },
      { label: 'C', text: 'Золото' },
      { label: 'D', text: 'Аргон' },
    ],
    correctIndex: 2,
    category: 'Наука',
  },
  {
    id: '3',
    text: 'Какая планета Солнечной системы самая большая?',
    answers: [
      { label: 'A', text: 'Сатурн' },
      { label: 'B', text: 'Нептун' },
      { label: 'C', text: 'Уран' },
      { label: 'D', text: 'Юпитер' },
    ],
    correctIndex: 3,
    category: 'Астрономия',
  },
];

export default function GamePage() {
  const [gameState, setGameState] = useState<GameState>({
    status: 'playing',
    currentQuestion: DEMO_QUESTIONS[0],
    currentLevel: 9, // 100,000 ₽
    selectedAnswer: null,
    answerStates: ['default', 'default', 'default', 'default'],
    lifelines: { fiftyFifty: true, phoneAFriend: true, askAudience: true },
    timerSeconds: 30,
    totalRounds: 12,
    currentRound: 10,
    winnings: 100_000,
  });

  // Timer countdown
  useEffect(() => {
    if (gameState.status !== 'playing' || gameState.timerSeconds <= 0) return;

    const timer = setInterval(() => {
      setGameState((prev) => ({
        ...prev,
        timerSeconds: prev.timerSeconds - 1,
      }));
    }, 1000);

    return () => clearInterval(timer);
  }, [gameState.status, gameState.timerSeconds]);

  const handleSelectAnswer = useCallback(
    (index: number) => {
      if (gameState.selectedAnswer !== null || gameState.status !== 'playing') return;

      const newStates: AnswerState[] = ['dimmed', 'dimmed', 'dimmed', 'dimmed'];
      newStates[index] = 'selected';

      setGameState((prev) => ({
        ...prev,
        selectedAnswer: index,
        answerStates: newStates,
        status: 'result',
      }));

      // Reveal correct answer after delay
      setTimeout(() => {
        const correctIndex = gameState.currentQuestion!.correctIndex;
        const finalStates: AnswerState[] = ['dimmed', 'dimmed', 'dimmed', 'dimmed'];

        if (index === correctIndex) {
          finalStates[index] = 'correct';
        } else {
          finalStates[index] = 'wrong';
          finalStates[correctIndex] = 'correct';
        }

        setGameState((prev) => ({
          ...prev,
          answerStates: finalStates,
        }));
      }, 2000);
    },
    [gameState.selectedAnswer, gameState.status, gameState.currentQuestion]
  );

  const handleUseLifeline = useCallback(
    (type: keyof LifelineState) => {
      if (!gameState.lifelines[type]) return;

      setGameState((prev) => ({
        ...prev,
        lifelines: { ...prev.lifelines, [type]: false },
      }));

      if (type === 'fiftyFifty' && gameState.currentQuestion) {
        const correctIdx = gameState.currentQuestion.correctIndex;
        const wrongIndices = [0, 1, 2, 3].filter((i) => i !== correctIdx);
        const toRemove = wrongIndices.sort(() => Math.random() - 0.5).slice(0, 2);

        const newStates = [...gameState.answerStates] as AnswerState[];
        for (const idx of toRemove) {
          newStates[idx] = 'dimmed';
        }

        setGameState((prev) => ({
          ...prev,
          answerStates: newStates,
        }));
      }
    },
    [gameState.lifelines, gameState.currentQuestion, gameState.answerStates]
  );

  const handleTakeWinnings = useCallback(() => {
    setGameState((prev) => ({
      ...prev,
      status: 'finished',
    }));
  }, []);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
      .toString()
      .padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const nextPrize =
    gameState.currentLevel < PRIZE_LEVELS.length - 1
      ? PRIZE_LEVELS[gameState.currentLevel + 1].label
      : PRIZE_LEVELS[PRIZE_LEVELS.length - 1].label;

  return (
    <>
      <StudioBackground />
      <div className="game-page" id="game-page">
        <GameHeader />

        <div className="game-content">
          <div className="game-main">
            <Lifelines lifelines={gameState.lifelines} onUse={handleUseLifeline} />

            {gameState.currentQuestion && (
              <>
                <QuestionCard text={gameState.currentQuestion.text} />
                <AnswerGrid
                  answers={gameState.currentQuestion.answers}
                  states={gameState.answerStates}
                  onSelect={handleSelectAnswer}
                  disabled={gameState.selectedAnswer !== null}
                />
              </>
            )}
          </div>

          <PrizeProgress currentLevel={gameState.currentLevel} winnings={gameState.winnings} />
        </div>

        <GameFooter
          currentRound={gameState.currentRound}
          totalRounds={gameState.totalRounds}
          nextPrize={nextPrize}
          timeLeft={formatTime(gameState.timerSeconds)}
          onTakeWinnings={handleTakeWinnings}
        />
      </div>
    </>
  );
}
