import React from 'react';

/**
 * Inline chrome icons for the app frame (header, dock, exit).
 *
 * The board, pawns and crown are custom SVG, but the surrounding controls used
 * platform emoji, which change shape and colour on every OS. These draw with
 * `currentColor` so each control keeps its own tint and renders identically
 * everywhere.
 */
type IconProps = {
  className?: string;
  size?: number;
};

const Icon: React.FC<IconProps & { children: React.ReactNode }> = ({
  className,
  size = 18,
  children,
}) => (
  <svg
    className={className}
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.8}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    {children}
  </svg>
);

/** Speaker with waves, or a crossed-out speaker when muted. */
export const SpeakerIcon: React.FC<IconProps & { muted?: boolean }> = ({ muted, ...rest }) => (
  <Icon {...rest}>
    <path d="M4 9.5h3.1L12 5.4v13.2l-4.9-4.1H4z" />
    {muted ? (
      <path d="M15.8 9.6l5 4.8M20.8 9.6l-5 4.8" />
    ) : (
      <>
        <path d="M15.2 9.2a4.2 4.2 0 0 1 0 5.6" />
        <path d="M18.1 6.6a7.8 7.8 0 0 1 0 10.8" />
      </>
    )}
  </Icon>
);

/** Cog: hub, rim and eight teeth. */
export const GearIcon: React.FC<IconProps> = (props) => (
  <Icon {...props}>
    <circle cx="12" cy="12" r="3.1" />
    <circle cx="12" cy="12" r="6.6" />
    <path d="M12 2.6v2.2M12 19.2v2.2M2.6 12h2.2M19.2 12h2.2M5.4 5.4l1.6 1.6M17 17l1.6 1.6M18.6 5.4L17 7M7 17l-1.6 1.6" />
  </Icon>
);

/** Two interlocking links. */
export const LinkIcon: React.FC<IconProps> = (props) => (
  <Icon {...props}>
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
  </Icon>
);

/** Match activity log: a note with event lines. */
export const FeedIcon: React.FC<IconProps> = (props) => (
  <Icon {...props}>
    <rect x="4.6" y="3.6" width="14.8" height="16.8" rx="3" />
    <path d="M8.4 8.6h7.2M8.4 12h7.2M8.4 15.4h4.2" />
  </Icon>
);

/** Close / exit cross. */
export const CloseIcon: React.FC<IconProps> = (props) => (
  <Icon strokeWidth={2.1} {...props}>
    <path d="M6.6 6.6l10.8 10.8M17.4 6.6L6.6 17.4" />
  </Icon>
);

/** Speech bubble for the chat entry point. */
export const ChatIcon: React.FC<IconProps> = (props) => (
  <Icon {...props}>
    <path d="M20.4 11.9c0 3.8-3.8 6.9-8.4 6.9-1 0-1.9-.14-2.8-.4L4.8 20.4l1.5-3.4a6.5 6.5 0 0 1-1.8-5.1c0-3.8 3.8-6.9 8.5-6.9s7.4 3.1 7.4 6.9z" />
    <circle cx="8.9" cy="11.9" r=".9" fill="currentColor" stroke="none" />
    <circle cx="12" cy="11.9" r=".9" fill="currentColor" stroke="none" />
    <circle cx="15.1" cy="11.9" r=".9" fill="currentColor" stroke="none" />
  </Icon>
);

/** House for the homepage nav. */
export const HomeIcon: React.FC<IconProps> = (props) => (
  <Icon {...props}>
    <path d="M4 10.4 12 4l8 6.4V20a.9.9 0 0 1-.9.9h-5.3v-6.1H10.2v6.1H4.9A.9.9 0 0 1 4 20z" />
  </Icon>
);

/** Gamepad for the Play entry. */
export const GamepadIcon: React.FC<IconProps> = (props) => (
  <Icon {...props}>
    <path d="M7.2 7.6h9.6a4.4 4.4 0 0 1 4.3 3.6l.6 4.2a2.6 2.6 0 0 1-4.6 2.1L15.4 16H8.6l-1.7 1.5a2.6 2.6 0 0 1-4.6-2.1l.6-4.2a4.4 4.4 0 0 1 4.3-3.6z" />
    <path d="M8 11.4v2.6M6.7 12.7h2.6" />
    <circle cx="16" cy="11.9" r=".9" fill="currentColor" stroke="none" />
    <circle cx="18.1" cy="13.9" r=".9" fill="currentColor" stroke="none" />
  </Icon>
);

/** Trophy for leaderboards. */
export const TrophyIcon: React.FC<IconProps> = (props) => (
  <Icon {...props}>
    <path d="M7.6 4.4h8.8v3.4a4.4 4.4 0 0 1-8.8 0z" />
    <path d="M7.6 5.6H5a2 2 0 0 0 2 2h.6M16.4 5.6H19a2 2 0 0 1-2 2h-.6" />
    <path d="M12 12.2v3.4M8.8 19.6h6.4M10 19.6l.4-4" />
  </Icon>
);

/** Open book for the rules entry. */
export const BookIcon: React.FC<IconProps> = (props) => (
  <Icon {...props}>
    <path d="M12 6.4C10.2 5 7.9 4.5 4.6 4.6v13c3.3-.1 5.6.4 7.4 1.8 1.8-1.4 4.1-1.9 7.4-1.8v-13c-3.3-.1-5.6.4-7.4 1.8z" />
    <path d="M12 6.4v13" />
  </Icon>
);

/** Bell used for the header notification slot. */
export const BellIcon: React.FC<IconProps> = (props) => (
  <Icon {...props}>
    <path d="M18 16.4H6l1.1-2.2V10a4.9 4.9 0 0 1 9.8 0v4.2z" />
    <path d="M10.3 19.2a1.9 1.9 0 0 0 3.4 0" />
  </Icon>
);

/** Chevron for the profile menu. */
export const ChevronDownIcon: React.FC<IconProps> = (props) => (
  <Icon {...props}>
    <path d="M6.8 9.8 12 15l5.2-5.2" />
  </Icon>
);

/** Lightning for the feature strip. */
export const BoltIcon: React.FC<IconProps> = (props) => (
  <Icon {...props}>
    <path d="M13.4 2.8 5.6 13.4h4.9l-1.1 7.8 8-10.8h-4.9z" />
  </Icon>
);

/** Shield for private rooms. */
export const ShieldIcon: React.FC<IconProps> = (props) => (
  <Icon {...props}>
    <path d="M12 3.2l7 2.6v5.5c0 4.3-2.8 7.7-7 9.5-4.2-1.8-7-5.2-7-9.5V5.8z" />
    <path d="M9.3 12.1l1.9 1.9 3.5-3.7" />
  </Icon>
);

/** Plus for the create-table card. */
export const PlusIcon: React.FC<IconProps> = (props) => (
  <Icon {...props}>
    <path d="M12 5.4v13.2M5.4 12h13.2" />
  </Icon>
);

/** Four-cell grid for the join-with-code card. */
export const GridIcon: React.FC<IconProps> = (props) => (
  <Icon {...props}>
    <rect x="4.2" y="4.2" width="6.4" height="6.4" rx="1.8" />
    <rect x="13.4" y="4.2" width="6.4" height="6.4" rx="1.8" />
    <rect x="4.2" y="13.4" width="6.4" height="6.4" rx="1.8" />
    <rect x="13.4" y="13.4" width="6.4" height="6.4" rx="1.8" />
  </Icon>
);

/** Stacked layers for the zero-download stat. */
export const LayersIcon: React.FC<IconProps> = (props) => (
  <Icon {...props}>
    <path d="M12 3.6l8.4 4.2-8.4 4.2L3.6 7.8z" />
    <path d="M3.6 12.6 12 16.8l8.4-4.2M3.6 16.8 12 21l8.4-4.2" />
  </Icon>
);

/** Solid play triangle for the primary CTA. */
export const PlayTriangleIcon: React.FC<IconProps> = ({ className, size = 18 }) => (
  <svg
    className={className}
    width={size}
    height={size}
    viewBox="0 0 24 24"
    aria-hidden="true"
    focusable="false"
  >
    <path d="M8.2 4.9 19 12 8.2 19.1z" fill="currentColor" />
  </svg>
);

/** Two players for the seats/share entry point. */
export const PlayersIcon: React.FC<IconProps> = (props) => (
  <Icon {...props}>
    <circle cx="9.3" cy="8.4" r="3.1" />
    <path d="M3.6 19.3c0-3.1 2.6-5.3 5.7-5.3s5.7 2.2 5.7 5.3" />
    <path d="M15.6 6a3.1 3.1 0 0 1 0 5.9" />
    <path d="M17.2 14.2c2 .5 3.4 2.3 3.4 4.6" />
  </Icon>
);
