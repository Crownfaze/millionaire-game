import { PRIZE_LEVELS, SAFE_LEVELS } from '../../types/game';

interface PrizeProgressProps {
  currentLevel: number;
  winnings: number;
}

export default function PrizeProgress({ currentLevel, winnings }: PrizeProgressProps) {
  const fillPercent = ((currentLevel + 1) / PRIZE_LEVELS.length) * 100;

  const formatWinnings = (amount: number) => {
    return amount.toLocaleString('ru-RU') + ' ₽';
  };

  return (
    <aside className="prize-sidebar" id="prize-sidebar">
      <div className="prize-header">
        <div className="prize-header-label">Выигрыш:</div>
        <div className="prize-header-amount">{formatWinnings(winnings)}</div>
      </div>

      <div className="prize-ladder">
        <div className="prize-bar-container">
          <div className="prize-bar-track">
            <div className="prize-bar-fill" style={{ height: `${fillPercent}%` }} />
          </div>
        </div>

        <div className="prize-levels">
          {[...PRIZE_LEVELS].reverse().map((level, revIndex) => {
            const index = PRIZE_LEVELS.length - 1 - revIndex;
            const isCurrent = index === currentLevel;
            const isPassed = index < currentLevel;
            const isSafe = SAFE_LEVELS.includes(level.amount);

            let className = 'prize-level';
            if (isCurrent) className += ' prize-level--current';
            else if (isPassed) className += ' prize-level--passed';
            if (isSafe && !isCurrent) className += ' prize-level--safe';

            return (
              <div key={level.amount} className={className}>
                <span className="prize-level-dot" />
                <span>{level.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="prize-current-badge">
        <div className="prize-current-badge-label">ВЫИГРЫШ:</div>
        <div className="prize-current-badge-amount">{formatWinnings(winnings)}</div>
      </div>
    </aside>
  );
}
