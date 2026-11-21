import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  eyebrow?: string;
  ariaLabel?: string;
  maxWidth?: number;
  className?: string;
  children: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  eyebrow,
  ariaLabel,
  maxWidth = 480,
  className = '',
  children,
}) => {
  // Prevent background scrolling while modal is open & restore cleanly when closed
  useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className="modal-backdrop modal-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel || title}
    >
      <div
        className={`modal-card ${className}`}
        style={{ maxWidth: `${maxWidth}px` }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div className="modal-title-group">
            {eyebrow && <span className="modal-badge-eyebrow">{eyebrow}</span>}
            <h3 className="modal-title">{title}</h3>
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

        <div className="modal-body">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
};
