import type { LifelineState } from '../../types/game';

interface LifelinesProps {
  lifelines: LifelineState;
  onUse: (type: keyof LifelineState) => void;
}

export default function Lifelines({ lifelines, onUse }: LifelinesProps) {
  return (
    <div className="lifelines" id="lifelines">
      {/* 50/50 */}
      <button
        className={`lifeline lifeline--5050 ${lifelines.fiftyFifty ? '' : 'lifeline--used'}`}
        onClick={() => onUse('fiftyFifty')}
        disabled={!lifelines.fiftyFifty}
        id="lifeline-5050"
      >
        <svg className="lifeline-ring" viewBox="0 0 92 92">
          <circle className="ring-track" cx="46" cy="46" r="43" />
          <circle
            className="ring-progress"
            cx="46"
            cy="46"
            r="43"
            style={{ strokeDashoffset: lifelines.fiftyFifty ? 0 : 270 }}
          />
        </svg>
        <div className="lifeline-inner">50/50</div>
      </button>

      {/* Звонок другу */}
      <button
        className={`lifeline lifeline--phone ${lifelines.phoneAFriend ? '' : 'lifeline--used'}`}
        onClick={() => onUse('phoneAFriend')}
        disabled={!lifelines.phoneAFriend}
        id="lifeline-phone"
      >
        <svg className="lifeline-ring" viewBox="0 0 92 92">
          <circle className="ring-track" cx="46" cy="46" r="43" />
          <circle
            className="ring-progress"
            cx="46"
            cy="46"
            r="43"
            style={{ strokeDashoffset: lifelines.phoneAFriend ? 0 : 270 }}
          />
        </svg>
        <div className="lifeline-inner">
          ЗВОНОК
          <br />
          ДРУГУ
        </div>
      </button>

      {/* Помощь зала */}
      <button
        className={`lifeline lifeline--audience ${lifelines.askAudience ? '' : 'lifeline--used'}`}
        onClick={() => onUse('askAudience')}
        disabled={!lifelines.askAudience}
        id="lifeline-audience"
      >
        <svg className="lifeline-ring" viewBox="0 0 92 92">
          <circle className="ring-track" cx="46" cy="46" r="43" />
          <circle
            className="ring-progress"
            cx="46"
            cy="46"
            r="43"
            style={{ strokeDashoffset: lifelines.askAudience ? 0 : 270 }}
          />
        </svg>
        <div className="lifeline-inner">
          ПОМОЩЬ
          <br />
          ЗАЛА
        </div>
      </button>
    </div>
  );
}
