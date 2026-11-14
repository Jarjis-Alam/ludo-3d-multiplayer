import React, { useEffect, useState } from 'react';

export const LandingBoard2D: React.FC = () => {
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % 4);
    }, 1800);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="landing-board-wrapper">
      <div className="landing-board-card">
        <div className="landing-board-header">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
            <span className="text-[11px] font-bold text-amber-200 tracking-wider">LIVE 2D SALON</span>
          </div>
          <span className="text-[10px] text-amber-300 font-mono">15×15 MEENAKARI GRID</span>
        </div>

        <div className="landing-board-preview">
          {/* Mini 15x15 preview illustration */}
          <div className="landing-mini-grid">
            {/* Red Base */}
            <div className="mini-base mini-red">
              <div className="mini-pawn-dot red-dot" />
              <div className="mini-pawn-dot red-dot" />
            </div>

            {/* Top Track */}
            <div className="mini-arm">
              <span className="mini-star">★</span>
            </div>

            {/* Green Base */}
            <div className="mini-base mini-green">
              <div className="mini-pawn-dot green-dot" />
              <div className="mini-pawn-dot green-dot" />
            </div>

            {/* Left Track */}
            <div className="mini-arm">
              <div className={`mini-hopping-pawn hop-step-${activeStep}`} />
            </div>

            {/* Center Goal */}
            <div className="mini-goal">
              <span className="mini-crown">♔</span>
            </div>

            {/* Right Track */}
            <div className="mini-arm">
              <span className="mini-star">★</span>
            </div>

            {/* Blue Base */}
            <div className="mini-base mini-blue">
              <div className="mini-pawn-dot blue-dot" />
              <div className="mini-pawn-dot blue-dot" />
            </div>

            {/* Bottom Track */}
            <div className="mini-arm">
              <span className="mini-star">★</span>
            </div>

            {/* Yellow Base */}
            <div className="mini-base mini-yellow">
              <div className="mini-pawn-dot yellow-dot" />
              <div className="mini-pawn-dot yellow-dot" />
            </div>
          </div>
        </div>

        <div className="landing-board-footer">
          <div className="mini-legend">
            <span className="dot red" /> <span>Ruby</span>
            <span className="dot green" /> <span>Emerald</span>
            <span className="dot yellow" /> <span>Topaz</span>
            <span className="dot blue" /> <span>Sapphire</span>
          </div>
          <span className="text-[10px] text-amber-400 font-medium">Server Synchronized</span>
        </div>
      </div>
    </div>
  );
};

export default LandingBoard2D;
