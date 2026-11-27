import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { acquireScrollLock } from './scrollLock';

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
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Prevent background scrolling while modal is open & restore cleanly when closed.
  // onClose lives in a ref so parent re-renders (e.g. turn countdown ticks) never
  // cycle the scroll lock mid-modal.
  useEffect(() => {
    if (!isOpen) return;

    const releaseLock = acquireScrollLock();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCloseRef.current();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      releaseLock();
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

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
