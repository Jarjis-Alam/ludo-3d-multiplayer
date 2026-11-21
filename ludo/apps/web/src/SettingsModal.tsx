import React, { useState } from 'react';
import { Modal } from './Modal';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
  sfxVolume: number;
  onVolumeChange: (volume: number) => void;
  captureHints: boolean;
  onToggleCaptureHints: () => void;
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
  sfxVolume,
  onVolumeChange,
  captureHints,
  onToggleCaptureHints,
  hapticEnabled,
  onToggleHaptic,
  reducedMotion,
  onToggleReducedMotion,
  onLeaveMatch,
  triggerHaptic,
}) => {
  const [confirmLeave, setConfirmLeave] = useState(false);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      eyebrow="PREFERENCES"
      title="Table Settings"
      ariaLabel="Game Settings"
      maxWidth={460}
      className="settings-modal-card"
    >
      <div className="settings-modal-body">
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
            aria-label="Toggle sound effects"
          >
            <span className="toggle-thumb" />
          </button>
        </div>

        {/* Setting 2: SFX Volume */}
        <div className="setting-row setting-row-stacked">
          <div className="setting-info">
            <span className="setting-label">🎚 Sound Volume</span>
            <span className="setting-desc">Room volume for the board sounds</span>
          </div>
          <div className="setting-slider-row">
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={Math.round(sfxVolume * 100)}
              onChange={(e) => onVolumeChange(Number(e.target.value) / 100)}
              disabled={!soundEnabled}
              aria-label="Sound effect volume"
              className="volume-slider"
            />
            <span className="volume-value">{Math.round(sfxVolume * 100)}%</span>
          </div>
        </div>

        {/* Setting 3: Capture threat hints */}
        <div className="setting-row">
          <div className="setting-info">
            <span className="setting-label">🛡 Capture Threat Hints</span>
            <span className="setting-desc">Mark your pawns an opponent could capture next roll</span>
          </div>
          <button
            type="button"
            className={`toggle-switch ${captureHints ? 'active' : ''}`}
            onClick={() => {
              triggerHaptic?.('light');
              onToggleCaptureHints();
            }}
            role="switch"
            aria-checked={captureHints}
            aria-label="Toggle capture threat hints"
          >
            <span className="toggle-thumb" />
          </button>
        </div>

        {/* Setting 4: Haptic Feedback */}
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
            aria-label="Toggle haptic feedback"
          >
            <span className="toggle-thumb" />
          </button>
        </div>

        {/* Setting 5: Reduced Motion */}
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
            aria-label="Toggle reduced motion"
          >
            <span className="toggle-thumb" />
          </button>
        </div>

        {/* Setting 6: Leave Match Table */}
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
    </Modal>
  );
};
