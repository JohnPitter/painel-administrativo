import { createPortal } from 'react-dom';
import type { ReactNode } from 'react';

import styles from './Modal.module.css';

interface ModalProps {
  isOpen: boolean;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
}

const Modal = ({ isOpen, title, children, footer, onClose }: ModalProps) => {
  if (!isOpen) {
    return null;
  }

  return createPortal(
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div className={styles.modal}>
        <header className={styles.header}>
          {title && (
            <h2 id="modal-title" className={styles.title}>
              {title}
            </h2>
          )}
          <button type="button" className={styles.closeButton} onClick={onClose} aria-label="Fechar modal">
            ×
          </button>
        </header>
        <div className={styles.content}>{children}</div>
        {footer && <footer className={styles.footer}>{footer}</footer>}
      </div>
    </div>,
    document.body
  );
};

export { Modal };
