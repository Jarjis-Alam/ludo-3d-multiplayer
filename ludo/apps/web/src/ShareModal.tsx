import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';

interface ShareModalProps {
  roomCode: string;
  isOpen: boolean;
  onClose: () => void;
  triggerHaptic?: (type?: 'light' | 'medium' | 'success') => void;
}

export const ShareModal: React.FC<ShareModalProps> = ({
  roomCode,
  isOpen,
  onClose,
  triggerHaptic,
}) => {
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [qrSvg, setQrSvg] = useState<string>('');
  const [shareError, setShareError] = useState<string>('');

  const inviteUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/?room=${roomCode}`
    : `/?room=${roomCode}`;

  const hasNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  useEffect(() => {
    if (!isOpen) return;

    // Generate crisp QR code SVG
    QRCode.toString(inviteUrl, {
      type: 'svg',
      margin: 1,
      color: {
        dark: '#0c1b38',
        light: '#ffffff',
      },
    })
      .then((svg) => setQrSvg(svg))
      .catch((err) => console.error('Failed to generate QR code', err));
  }, [isOpen, inviteUrl]);

  if (!isOpen) return null;

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(roomCode);
      setCopiedCode(true);
      triggerHaptic?.('light');
      setTimeout(() => setCopiedCode(false), 2200);
    } catch {
      setShareError('Failed to copy to clipboard');
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopiedLink(true);
      triggerHaptic?.('light');
      setTimeout(() => setCopiedLink(false), 2200);
    } catch {
      setShareError('Failed to copy to clipboard');
    }
  };

  const handleNativeShare = async () => {
    if (!hasNativeShare) return;
    try {
      triggerHaptic?.('medium');
      await navigator.share({
        title: 'Join My Royal Ludo Salon',
        text: `Play Ludo with me! Join Private Room #${roomCode}:`,
        url: inviteUrl,
      });
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        // Fallback to copying link
        handleCopyLink();
      }
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-label="Invite Friends">
      <div className="modal-card share-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-group">
            <span className="modal-badge-eyebrow">PRIVATE SALON</span>
            <h3 className="modal-title">Invite Players</h3>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close dialog"
          >
            ✕
          </button>
        </div>

        <div className="modal-body share-modal-body">
          {/* 1. Large Room Code Pill */}
          <div className="share-code-box">
            <span className="share-label">ROOM CODE</span>
            <div className="share-code-display">
              <span className="share-code-text">#{roomCode}</span>
              <button
                type="button"
                className={`share-action-btn ${copiedCode ? 'btn-copied' : ''}`}
                onClick={handleCopyCode}
              >
                {copiedCode ? '✓ COPIED' : '📋 COPY CODE'}
              </button>
            </div>
          </div>

          {/* 2. QR Code Scannable Card */}
          <div className="share-qr-section">
            <span className="share-label">SCAN TO JOIN INSTANTLY</span>
            <div className="share-qr-wrapper">
              {qrSvg ? (
                <div
                  className="share-qr-svg-container"
                  dangerouslySetInnerHTML={{ __html: qrSvg }}
                  aria-label={`QR Code to join room ${roomCode}`}
                />
              ) : (
                <div className="share-qr-placeholder">Generating QR…</div>
              )}
            </div>
            <p className="share-qr-hint">Point phone camera to open salon automatically</p>
          </div>

          {/* 3. Direct Share Link & Native Share Button */}
          <div className="share-link-group">
            <button
              type="button"
              className={`btn-secondary share-copy-link-btn ${copiedLink ? 'btn-copied' : ''}`}
              onClick={handleCopyLink}
            >
              {copiedLink ? '✓ LINK COPIED!' : '🔗 COPY INVITATION LINK'}
            </button>

            {hasNativeShare && (
              <button
                type="button"
                className="btn-primary share-native-btn"
                onClick={handleNativeShare}
              >
                📤 SHARE VIA APPS (WhatsApp, Messages, etc.)
              </button>
            )}
          </div>

          {shareError && <div className="share-error-toast">{shareError}</div>}
        </div>
      </div>
    </div>
  );
};
