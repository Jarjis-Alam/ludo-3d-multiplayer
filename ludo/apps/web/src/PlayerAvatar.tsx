import React from 'react';

export interface PlayerAvatarProps {
  seat: number;
  name?: string;
  isHost?: boolean;
  size?: number;
  className?: string;
  showCrown?: boolean;
}

const SEAT_COLORS = ['#ED3945', '#08A66A', '#FFAA13', '#3978F6'];
const SEAT_BG_COLORS = ['#3D1E2A', '#1E382B', '#3D311A', '#1A294A'];

/**
 * Illustrated Player Avatar component recreating the character portraits
 * from the master design reference with matching color rings and host crown.
 */
export const PlayerAvatar: React.FC<PlayerAvatarProps> = ({
  seat = 0,
  name = 'Player',
  isHost = false,
  size = 42,
  className = '',
  showCrown = true,
}) => {
  const ringColor = SEAT_COLORS[seat % 4] || '#ED3945';
  const bgColor = SEAT_BG_COLORS[seat % 4] || '#3D1E2A';

  // SVG character portraits based on seat index
  return (
    <div
      className={`player-avatar-wrapper relative inline-flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
      title={`${name}${isHost ? ' (Host)' : ''}`}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 48 48"
        className="rounded-full overflow-visible"
        style={{
          border: `2.5px solid ${ringColor}`,
          borderRadius: '50%',
          backgroundColor: bgColor,
          boxShadow: `0 2px 8px rgba(0, 0, 0, 0.4), 0 0 10px ${ringColor}40`,
        }}
        aria-hidden="true"
      >
        <defs>
          <clipPath id={`avatarClip-${seat}`}>
            <circle cx="24" cy="24" r="22" />
          </clipPath>
        </defs>

        <g clipPath={`url(#avatarClip-${seat})`}>
          {/* Seat 0 (Red - Jarvis style: Curly hair, warm skin) */}
          {seat === 0 && (
            <g>
              <rect width="48" height="48" fill="#FBBF24" opacity="0.15" />
              {/* Shoulders / Shirt */}
              <circle cx="24" cy="46" r="15" fill="#3B82F6" />
              {/* Head */}
              <circle cx="24" cy="24" r="10.5" fill="#E0A96D" />
              {/* Curly Hair */}
              <path
                d="M13,20 C13,13 18,10 24,10 C30,10 35,13 35,20 C35,21 33,23 31,23 C29,20 27,18 24,18 C21,18 19,20 17,23 C15,23 13,21 13,20 Z"
                fill="#261C14"
              />
              <circle cx="15" cy="18" r="4.5" fill="#261C14" />
              <circle cx="24" cy="13" r="5" fill="#261C14" />
              <circle cx="33" cy="18" r="4.5" fill="#261C14" />
              {/* Eyes */}
              <circle cx="20.5" cy="23.5" r="1.3" fill="#1E293B" />
              <circle cx="27.5" cy="23.5" r="1.3" fill="#1E293B" />
              {/* Smile */}
              <path d="M21,27.5 Q24,30.5 27,27.5" fill="none" stroke="#8C4E24" strokeWidth="1.2" strokeLinecap="round" />
            </g>
          )}

          {/* Seat 1 (Green - Odonil style: Red baseball cap, friendly expression) */}
          {seat === 1 && (
            <g>
              <rect width="48" height="48" fill="#10B981" opacity="0.15" />
              {/* Shoulders */}
              <circle cx="24" cy="46" r="15" fill="#059669" />
              {/* Head */}
              <circle cx="24" cy="25" r="10.5" fill="#F3C59E" />
              {/* Hair under cap */}
              <path d="M14,24 C14,21 16,19 18,19 C18,25 14,25 14,24 Z" fill="#451A03" />
              <path d="M34,24 C34,21 32,19 30,19 C30,25 34,25 34,24 Z" fill="#451A03" />
              {/* Red Baseball Cap */}
              <path d="M14,20 C14,14 18,12 24,12 C30,12 34,14 34,20 Z" fill="#EF4444" />
              <path d="M20,19 L37,17 C39,17 38,20 35,21 L20,21 Z" fill="#DC2626" />
              {/* Eyes */}
              <circle cx="20.5" cy="25" r="1.3" fill="#1E293B" />
              <circle cx="27.5" cy="25" r="1.3" fill="#1E293B" />
              {/* Smile */}
              <path d="M21,29 Q24,32 27,29" fill="none" stroke="#A16207" strokeWidth="1.2" strokeLinecap="round" />
            </g>
          )}

          {/* Seat 2 (Yellow - Jaggu style: Classic brown styled hair) */}
          {seat === 2 && (
            <g>
              <rect width="48" height="48" fill="#F59E0B" opacity="0.15" />
              {/* Shoulders */}
              <circle cx="24" cy="46" r="15" fill="#D97706" />
              {/* Head */}
              <circle cx="24" cy="24" r="10.5" fill="#F7D3A6" />
              {/* Hair */}
              <path
                d="M14,21 C14,13 18,11 25,11 C31,11 34,13 34,18 C34,20 32,22 30,20 C27,17 22,17 19,20 C16,21 14,23 14,21 Z"
                fill="#5C3A21"
              />
              <path d="M14,19 Q19,13 27,13 Q34,13 34,19 Q30,15 24,16 Q18,16 14,19 Z" fill="#452712" />
              {/* Eyes */}
              <circle cx="21" cy="24" r="1.3" fill="#1E293B" />
              <circle cx="28" cy="24" r="1.3" fill="#1E293B" />
              {/* Smile */}
              <path d="M21.5,28 Q24.5,31 27.5,28" fill="none" stroke="#A16207" strokeWidth="1.2" strokeLinecap="round" />
            </g>
          )}

          {/* Seat 3 (Blue - Player 4: Cool beanie/headband style) */}
          {seat === 3 && (
            <g>
              <rect width="48" height="48" fill="#3B82F6" opacity="0.15" />
              {/* Shoulders */}
              <circle cx="24" cy="46" r="15" fill="#2563EB" />
              {/* Head */}
              <circle cx="24" cy="24" r="10.5" fill="#E6B89C" />
              {/* Short Dark Hair & Beanie */}
              <path d="M15,19 C15,13 18,11 24,11 C30,11 33,13 33,19 Z" fill="#1E3A8A" />
              <rect x="14" y="17" width="20" height="4" rx="2" fill="#3B82F6" />
              {/* Eyes */}
              <circle cx="20.5" cy="24" r="1.3" fill="#1E293B" />
              <circle cx="27.5" cy="24" r="1.3" fill="#1E293B" />
              {/* Smile */}
              <path d="M21,28 Q24,31 27,28" fill="none" stroke="#9A3412" strokeWidth="1.2" strokeLinecap="round" />
            </g>
          )}
        </g>
      </svg>

      {/* Host Golden Crown Badge */}
      {isHost && showCrown && (
        <div
          className="host-crown-badge absolute -bottom-1 -right-1 flex items-center justify-center rounded-full"
          style={{
            width: size * 0.42,
            height: size * 0.42,
            backgroundColor: '#FFC83D',
            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.6)',
            border: '1.5px solid #111329',
          }}
          title="Room Host"
          aria-label="Room Host"
        >
          <span style={{ fontSize: size * 0.24, lineHeight: 1 }}>👑</span>
        </div>
      )}
    </div>
  );
};
