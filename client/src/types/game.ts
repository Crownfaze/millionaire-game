/* ── Game Types ── */

export interface Question {
  id: string;
  text: string;
  answers: Answer[];
  correctIndex: number;
  category?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
}

export interface Answer {
  label: string;
  text: string;
}

export type AnswerState = 'default' | 'selected' | 'correct' | 'wrong' | 'dimmed';

export interface LifelineState {
  fiftyFifty: boolean;
  phoneAFriend: boolean;
  askAudience: boolean;
}

export const PRIZE_LADDER = [
  100,
  200,
  300_000,
  400_000,
  500_000,
  1_000,
  2_000,
  5_000,
  10_000,
  50_000,
  100_000,
  250_000,
  500_000,
  750_000,
  1_000_000,
] as const;

export const PRIZE_LEVELS = [
  { amount: 100, label: '100 ₽' },
  { amount: 200, label: '200 ₽' },
  { amount: 300, label: '300 ₽' },
  { amount: 500, label: '500 ₽' },
  { amount: 1_000, label: '1 000 ₽' },
  { amount: 2_000, label: '2 000 ₽' },
  { amount: 5_000, label: '5 000 ₽' },
  { amount: 10_000, label: '10 000 ₽' },
  { amount: 50_000, label: '50 000 ₽' },
  { amount: 100_000, label: '100 000 ₽' },
  { amount: 250_000, label: '250 000 ₽' },
  { amount: 400_000, label: '400 000 ₽' },
  { amount: 500_000, label: '500 000 ₽' },
  { amount: 750_000, label: '750 000 ₽' },
  { amount: 1_000_000, label: '1 000 000 ₽' },
] as const;

export const SAFE_LEVELS = [1_000, 50_000, 100_000];

export interface GameState {
  status: 'waiting' | 'playing' | 'paused' | 'result' | 'finished';
  currentQuestion: Question | null;
  currentLevel: number;
  selectedAnswer: number | null;
  answerStates: AnswerState[];
  lifelines: LifelineState;
  timerSeconds: number;
  totalRounds: number;
  currentRound: number;
  winnings: number;
}

export interface Room {
  code: string;
  name: string;
  status: 'waiting' | 'playing' | 'finished';
  hostId: string;
  timerDuration: number;
  difficulty: 'easy' | 'medium' | 'hard' | 'mixed';
  participantCount: number;
  createdAt: string;
}

export interface Participant {
  id: string;
  name: string;
  status: 'active' | 'answered' | 'error' | 'eliminated';
  score: number;
  currentAnswer?: number;
  answerTime?: number;
}
