import React, { useState } from 'react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
  hapticEnabled: boolean;
  onToggleHaptic: () => void;
  reducedMotion: boolean;
  onToggleReducedMotion: () => void;
  onLeaveMatch: () => void;
  triggerHaptic?: (type?: 'light' | 'medium' | 'success') => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  soundEnabled,
  onToggleSound,
  hapticEnabled,
  onToggleHaptic,
  reducedMotion,
  onToggleReducedMotion,
  onLeaveMatch,
  triggerHaptic,
}) => {
  const [confirmLeave, setConfirmLeave] = useState(false);

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-label="Game Settings">
      <div className="modal-card settings-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-group">
            <span className="modal-badge-eyebrow">PREFERENCES</span>
            <h3 className="modal-title">Table Settings</h3>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close settings"
          >
            ✕
          </button>
        </div>

        <div className="modal-body settings-modal-body">
          {/* Setting 1: Sound Effects */}
          <div className="setting-row">
            <div className="setting-info">
              <span className="setting-label">🔊 Sound Effects</span>
              <span className="setting-desc">Tactile audio for rolls, hops, and captures</span>
            </div>
            <button
              type="button"
              className={`toggle-switch ${soundEnabled ? 'active' : ''}`}
              onClick={() => {
                triggerHaptic?.('light');
                onToggleSound();
              }}
              role="switch"
              aria-checked={soundEnabled}
            >
              <span className="toggle-thumb" />
            </button>
          </div>

          {/* Setting 2: Haptic Feedback */}
          <div className="setting-row">
            <div className="setting-info">
              <span className="setting-label">📳 Haptic Feedback</span>
              <span className="setting-desc">Vibrations on turns, rolls, and legal pawn moves</span>
            </div>
            <button
              type="button"
              className={`toggle-switch ${hapticEnabled ? 'active' : ''}`}
              onClick={() => {
                triggerHaptic?.('light');
                onToggleHaptic();
              }}
              role="switch"
              aria-checked={hapticEnabled}
            >
              <span className="toggle-thumb" />
            </button>
          </div>

          {/* Setting 3: Reduced Motion */}
          <div className="setting-row">
            <div className="setting-info">
              <span className="setting-label">🏃 Reduced Motion</span>
              <span className="setting-desc">Skip hopping animations for faster, instant token placement</span>
            </div>
            <button
              type="button"
              className={`toggle-switch ${reducedMotion ? 'active' : ''}`}
              onClick={() => {
                triggerHaptic?.('light');
                onToggleReducedMotion();
              }}
              role="switch"
              aria-checked={reducedMotion}
            >
              <span className="toggle-thumb" />
            </button>
          </div>

          {/* Setting 4: Leave Match Table */}
          <div className="settings-danger-zone">
            {!confirmLeave ? (
              <button
                type="button"
                className="btn-danger-outline"
                onClick={() => {
                  triggerHaptic?.('medium');
                  setConfirmLeave(true);
                }}
              >
                🚪 Leave Match Table
              </button>
            ) : (
              <div className="leave-confirmation-card">
                <span className="leave-confirm-text">
                  Forfeit your seat and return to lobby?
                </span>
                <div className="leave-confirm-actions">
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setConfirmLeave(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn-danger-solid"
                    onClick={() => {
                      triggerHaptic?.('success');
                      onLeaveMatch();
                    }}
                  >
                    Yes, Leave
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
