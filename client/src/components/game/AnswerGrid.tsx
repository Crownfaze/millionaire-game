import { Check } from 'lucide-react';
import type { Answer, AnswerState } from '../../types/game';

interface AnswerGridProps {
  answers: Answer[];
  states: AnswerState[];
  onSelect: (index: number) => void;
  disabled: boolean;
}

export default function AnswerGrid({ answers, states, onSelect, disabled }: AnswerGridProps) {
  return (
    <div className="answer-grid" id="answer-grid">
      {answers.map((answer, index) => (
        <button
          key={index}
          className={`answer-btn answer-btn--${states[index]}`}
          onClick={() => !disabled && onSelect(index)}
          disabled={disabled && states[index] === 'default'}
          id={`answer-${answer.label.toLowerCase()}`}
        >
          <span className="answer-label">{answer.label}:</span>
          <span className="answer-text">{answer.text}</span>
          <span className="answer-check">
            <Check size={14} strokeWidth={3} />
          </span>
        </button>
      ))}
    </div>
  );
}
