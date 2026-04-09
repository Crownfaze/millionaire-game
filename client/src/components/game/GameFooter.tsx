import { Menu, Volume2, Settings } from 'lucide-react';

interface GameFooterProps {
  currentRound: number;
  totalRounds: number;
  nextPrize: string;
  timeLeft: string;
  onTakeWinnings: () => void;
}

export default function GameFooter({
  currentRound,
  totalRounds,
  nextPrize,
  timeLeft,
  onTakeWinnings,
}: GameFooterProps) {
  return (
    <footer className="game-footer" id="game-footer">
      <div className="footer-controls">
        <button className="footer-icon-btn" id="btn-menu" title="Меню">
          <Menu size={18} />
        </button>
        <button className="footer-icon-btn" id="btn-sound" title="Звук">
          <Volume2 size={18} />
        </button>
        <button className="footer-icon-btn" id="btn-settings" title="Настройки">
          <Settings size={18} />
        </button>
      </div>

      <div className="footer-info">
        <div className="footer-info-item">
          <span className="footer-info-label">РАУНД:</span>
          <span className="footer-info-value">
            {currentRound}/{totalRounds}
          </span>
        </div>
        <div className="footer-info-item">
          <span className="footer-info-label">СЛЕДУЮЩИЙ ВОПРОС:</span>
          <span className="footer-info-value footer-info-value--gold">{nextPrize}</span>
        </div>
        <div className="footer-info-item">
          <span className="footer-info-label">ВРЕМЯ:</span>
          <span className="footer-info-value">{timeLeft}</span>
        </div>
      </div>

      <button className="footer-action-btn" id="btn-take-winnings" onClick={onTakeWinnings}>
        ЗАБРАТЬ ВЫИГРЫШ
      </button>
    </footer>
  );
}
