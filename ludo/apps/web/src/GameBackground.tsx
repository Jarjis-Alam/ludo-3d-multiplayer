import React from 'react';

/**
 * Reusable 3D Isometric Floating Ivory Dice Illustration
 * Perfectly matching the floating dice along the edges in the master design reference.
 */
export const FloatingDiceSVG: React.FC<{
  size?: number;
  rotation?: number;
  className?: string;
  style?: React.CSSProperties;
}> = ({ size = 64, rotation = 15, className = '', style = {} }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={`floating-dice-svg ${className}`}
      style={{
        transform: `rotate(${rotation}deg)`,
        filter: 'drop-shadow(0 14px 28px rgba(0, 0, 0, 0.65))',
        ...style,
      }}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="diceTopFace" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFFBF2" />
          <stop offset="100%" stopColor="#FFF0D9" />
        </linearGradient>
        <linearGradient id="diceLeftFace" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#F5DFBD" />
          <stop offset="100%" stopColor="#E6C89C" />
        </linearGradient>
        <linearGradient id="diceRightFace" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#EAD0AA" />
          <stop offset="100%" stopColor="#D4B07D" />
        </linearGradient>
      </defs>

      {/* Isometric Cube Faces with Rounded Appearance */}
      {/* Top Face */}
      <polygon
        points="50,12 85,32 50,52 15,32"
        fill="url(#diceTopFace)"
        stroke="#E6C89C"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {/* Left Face */}
      <polygon
        points="15,32 50,52 50,90 15,70"
        fill="url(#diceLeftFace)"
        stroke="#D4B07D"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {/* Right Face */}
      <polygon
        points="50,52 85,32 85,70 50,90"
        fill="url(#diceRightFace)"
        stroke="#BFA070"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />

      {/* Pips on Top Face (Value 3) */}
      <circle cx="34" cy="27" r="3.2" fill="#201B3B" />
      <circle cx="50" cy="32" r="3.2" fill="#201B3B" />
      <circle cx="66" cy="37" r="3.2" fill="#201B3B" />

      {/* Pips on Left Face (Value 2) */}
      <circle cx="28" cy="50" r="3.5" fill="#201B3B" />
      <circle cx="38" cy="74" r="3.5" fill="#201B3B" />

      {/* Pips on Right Face (Value 5) */}
      <circle cx="62" cy="58" r="3.5" fill="#201B3B" />
      <circle cx="74" cy="50" r="3.5" fill="#201B3B" />
      <circle cx="68" cy="70" r="3.5" fill="#201B3B" />
      <circle cx="62" cy="82" r="3.5" fill="#201B3B" />
      <circle cx="74" cy="74" r="3.5" fill="#201B3B" />
    </svg>
  );
};

/**
 * Master Game Background with Atmospheric Lighting, Cropped Violet/Orange Geometric Shapes,
 * and Floating 3D Dice - shared across Homepage, Lobby, Match, and Victory screens.
 */
export const GameBackground: React.FC<{ children?: React.ReactNode; dimmed?: boolean }> = ({
  children,
  dimmed = false,
}) => {
  return (
    <div className={`game-master-backdrop ${dimmed ? 'gameplay-dimmed' : ''}`}>
      {/* Ambient Lighting Cones */}
      <div className="ambient-glow ambient-glow-top" aria-hidden="true" />
      <div className="ambient-glow ambient-glow-center" aria-hidden="true" />
      <div className="ambient-glow ambient-glow-bottom" aria-hidden="true" />

      {/* Atmospheric Cropped Geometric Shapes */}
      {/* Top-Right Curved Coral/Orange Shape */}
      <div className="bg-geom-shape shape-coral-tr" aria-hidden="true" />

      {/* Mid-Left Electric Violet Floating Shape */}
      <div className="bg-geom-shape shape-violet-ml" aria-hidden="true" />

      {/* Mid-Right Electric Purple Shape */}
      <div className="bg-geom-shape shape-purple-mr" aria-hidden="true" />

      {/* Bottom-Left Warm Orange Shape */}
      <div className="bg-geom-shape shape-amber-bl" aria-hidden="true" />

      {/* Edge-Cropped Floating 3D Ivory Dice */}
      {/* Mid-Left Floating Dice (isometric tilted) */}
      <div className="bg-floating-dice dice-edge-left" aria-hidden="true">
        <FloatingDiceSVG size={78} rotation={-22} />
      </div>

      {/* Bottom-Right Floating Dice */}
      <div className="bg-floating-dice dice-edge-right" aria-hidden="true">
        <FloatingDiceSVG size={88} rotation={28} />
      </div>

      {/* Content Injection */}
      <div className="game-master-content">{children}</div>
    </div>
  );
};
