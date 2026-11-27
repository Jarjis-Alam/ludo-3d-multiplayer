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

/** Two players for the seats/share entry point. */
export const PlayersIcon: React.FC<IconProps> = (props) => (
  <Icon {...props}>
    <circle cx="9.3" cy="8.4" r="3.1" />
    <path d="M3.6 19.3c0-3.1 2.6-5.3 5.7-5.3s5.7 2.2 5.7 5.3" />
    <path d="M15.6 6a3.1 3.1 0 0 1 0 5.9" />
    <path d="M17.2 14.2c2 .5 3.4 2.3 3.4 4.6" />
  </Icon>
);
