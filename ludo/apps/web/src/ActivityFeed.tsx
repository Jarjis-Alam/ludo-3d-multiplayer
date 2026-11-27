import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { SeatGlyph } from './SeatGlyph';
import { acquireScrollLock } from './scrollLock';

export interface ActivityItem {
  id: string;
  time: number;
  type: 'dice' | 'deploy' | 'move' | 'capture' | 'bonus' | 'home' | 'finish' | 'timeout' | 'disconnect' | 'reconnect';
  icon: string;
  message: string;
  seat?: number;
  color?: string;
  playerName?: string;
  /** Groups every event belonging to the same roll/turn into one timeline block. */
  turnId?: number;
  dice?: number;
}

interface ActivityFeedProps {
  items: ActivityItem[];
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
}

interface TurnGroup {
  key: string;
  turnId?: number;
  seat?: number;
  playerName?: string;
  dice?: number;
  time: number;
  items: ActivityItem[];
}

function formatRelativeTime(timestamp: number): string {
  const diffSec = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (diffSec < 3) return 'just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  return `${diffMin}m ago`;
}

function groupTimeline(items: ActivityItem[]): TurnGroup[] {
  const groups: TurnGroup[] = [];
  for (const item of items) {
    const previous = groups[groups.length - 1];
    if (item.turnId !== undefined && previous && previous.turnId === item.turnId) {
      previous.items.push(item);
      continue;
    }
    groups.push({
      key: item.id,
      turnId: item.turnId,
      seat: item.seat,
      playerName: item.playerName,
      dice: item.dice,
      time: item.time,
      items: [item],
    });
  }
  return groups;
}

export const ActivityFeed: React.FC<ActivityFeedProps> = ({
  items,
  isOpen,
  onToggle,
  onClose,
}) => {
  const [, setTick] = useState(0);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Update relative timestamps every 4 seconds when open
  useEffect(() => {
    if (!isOpen) return;
    const interval = setInterval(() => setTick((t) => t + 1), 4000);
    return () => clearInterval(interval);
  }, [isOpen]);

  // Prevent background scrolling while open & listen to Escape via ref so
  // parent re-renders never churn the shared scroll lock.
  useEffect(() => {
    if (!isOpen) return;

    const releaseLock = acquireScrollLock();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      releaseLock();
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const timeline = groupTimeline([...items].slice(-30).reverse());

  return (
    <>
      {/* Floating Toggle Pill (Header or bottom bar trigger) */}
      <button
        type="button"
        className={`activity-feed-toggle-btn ${isOpen ? 'active' : ''} ${items.length > 0 ? 'has-events' : ''}`}
        onClick={onToggle}
        aria-label="Toggle Match Activity Feed"
        title="Recent Match Events"
      >
        <span className="feed-toggle-icon">📜</span>
        <span className="feed-toggle-text">Feed</span>
        {items.length > 0 && <span className="feed-count-badge">{items.length}</span>}
      </button>

      {/* Slide-out / Centered Feed Drawer rendered in React Portal */}
      {isOpen &&
        createPortal(
          <div
            className="activity-feed-overlay"
            onClick={onClose}
            role="dialog"
            aria-modal="true"
            aria-label="Match Activity Feed"
          >
            <div
              className="activity-feed-drawer"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="feed-header">
                <div className="feed-header-left">
                  <span className="feed-header-icon">📜</span>
                  <span className="feed-header-title">Match Timeline</span>
                  <span className="feed-total-pill">{items.length} events</span>
                </div>
                <button
                  type="button"
                  className="feed-close-btn"
                  onClick={onClose}
                  aria-label="Close activity log"
                >
                  ✕
                </button>
              </div>

              <div className="feed-list-scroll">
                {timeline.length === 0 ? (
                  <div className="feed-empty-state">
                    <span className="empty-dice-icon">🎲</span>
                    <p>Match events will appear here as pawns move, capture, and roll!</p>
                  </div>
                ) : (
                  timeline.map((group) => {
                    if (group.turnId === undefined) {
                      const item = group.items[0];
                      return (
                        <div key={group.key} className={`feed-item feed-item-${item.type}`}>
                          {typeof item.seat === 'number' ? (
                            <SeatGlyph seat={item.seat} size={13} tone="cream" className="feed-item-seat" />
                          ) : (
                            <span className="feed-item-icon">{item.icon}</span>
                          )}
                          <div className="feed-item-content">
                            <span className="feed-item-msg">{item.message}</span>
                            <span className="feed-item-time">{formatRelativeTime(item.time)}</span>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div key={group.key} className="feed-turn-group">
                        <div className="feed-turn-head">
                          {typeof group.seat === 'number' && (
                            <SeatGlyph seat={group.seat} size={14} tone="gold" />
                          )}
                          <span className="feed-turn-name">{group.playerName || 'Player'}</span>
                          {group.dice ? (
                            <span className="feed-turn-dice">rolled {group.dice}</span>
                          ) : null}
                          <span className="feed-turn-time">{formatRelativeTime(group.time)}</span>
                        </div>
                        <div className="feed-turn-events">
                          {group.items.map((item) => (
                            <div key={item.id} className={`feed-item feed-item-${item.type}`}>
                              <span className="feed-item-icon">{item.icon}</span>
                              <div className="feed-item-content">
                                <span className="feed-item-msg">{item.message}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
};
