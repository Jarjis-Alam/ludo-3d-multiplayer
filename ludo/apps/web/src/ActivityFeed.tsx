import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

export interface ActivityItem {
  id: string;
  time: number;
  type: 'dice' | 'deploy' | 'move' | 'capture' | 'bonus' | 'home' | 'finish' | 'timeout' | 'disconnect' | 'reconnect';
  icon: string;
  message: string;
  seat?: number;
  color?: string;
}

interface ActivityFeedProps {
  items: ActivityItem[];
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
}

function formatRelativeTime(timestamp: number): string {
  const diffSec = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (diffSec < 3) return 'just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  return `${diffMin}m ago`;
}

export const ActivityFeed: React.FC<ActivityFeedProps> = ({
  items,
  isOpen,
  onToggle,
  onClose,
}) => {
  const [, setTick] = useState(0);

  // Update relative timestamps every 4 seconds when open
  useEffect(() => {
    if (!isOpen) return;
    const interval = setInterval(() => setTick((t) => t + 1), 4000);
    return () => clearInterval(interval);
  }, [isOpen]);

  // Prevent background scrolling while open on mobile & listen to Escape
  useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  const latestItems = [...items].slice(-25).reverse();

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
                  <span className="feed-header-title">Match Activity</span>
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
                {latestItems.length === 0 ? (
                  <div className="feed-empty-state">
                    <span className="empty-dice-icon">🎲</span>
                    <p>Match events will appear here as pawns move, capture, and roll!</p>
                  </div>
                ) : (
                  latestItems.map((item) => (
                    <div key={item.id} className={`feed-item feed-item-${item.type}`}>
                      <span className="feed-item-icon">{item.icon}</span>
                      <div className="feed-item-content">
                        <span className="feed-item-msg">{item.message}</span>
                        <span className="feed-item-time">{formatRelativeTime(item.time)}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
};
