import React from 'react';

export interface EliminationEvent {
  id: number;
  attackerColor: string;
  victimColor: string;
  victimName?: string;
}

interface EliminationOverlayProps {
  event: EliminationEvent;
  reducedMotion?: boolean;
}

const STAR_PATH =
  'M50 2 58 34 84 18 70 44 98 50 70 56 84 82 58 66 50 98 42 66 16 82 30 56 2 50 30 44 16 18 42 34Z';

/**
 * Full-screen capture celebration: the attacking pawn slams into the victim,
 * the victim cracks and is knocked away, and an "ELIMINATED!" ribbon lands.
 * The overlay never blocks input and unmounts itself shortly after.
 */
export const EliminationOverlay: React.FC<EliminationOverlayProps> = ({ event, reducedMotion = false }) => (
  <div
    className={`elim-overlay ${reducedMotion ? 'elim-reduced' : ''}`}
    role="status"
    aria-live="assertive"
    aria-label={
      event.victimName ? `${event.victimName}'s pawn eliminated` : 'A pawn has been eliminated'
    }
  >
    <div className="elim-vignette" aria-hidden="true" />

    <div className="elim-scene">
      <div className={`elim-disc elim-attacker disc-${event.attackerColor}`} aria-hidden="true" />

      <div className={`elim-disc elim-victim disc-${event.victimColor}`} aria-hidden="true">
        <svg className="elim-cracks" viewBox="0 0 100 52" preserveAspectRatio="none">
          <path d="M50 6 43 21l9 8-7 15" />
          <path d="M59 10 57 25l10 9" />
          <path d="M36 12 39 30 33 38" />
          <path d="M68 16 64 28" />
        </svg>
      </div>

      <div className="elim-burst" aria-hidden="true">
        <svg viewBox="0 0 100 100">
          <path d={STAR_PATH} fill="#ffe08a" stroke="#ff9f1c" strokeWidth="2.5" strokeLinejoin="round" />
          <path d={STAR_PATH} fill="#fff7d6" transform="translate(50 50) scale(0.55) translate(-50 -50)" />
        </svg>
      </div>

      <span className="elim-dash elim-dash-left" aria-hidden="true" />
      <span className="elim-dash elim-dash-right" aria-hidden="true" />

      {/* Ribbon and caption share one column so the caption always clears the ribbon,
          whatever the ribbon's height works out to at this viewport. */}
      <div className="elim-caption">
        <div className="elim-banner">
          <span className="elim-banner-text">ELIMINATED!</span>
        </div>

        <p className="elim-sub">
          {event.victimName
            ? `${event.victimName}'s pawn was sent back to base`
            : 'A pawn has been sent back to base'}
        </p>
      </div>
    </div>
  </div>
);

export default EliminationOverlay;
