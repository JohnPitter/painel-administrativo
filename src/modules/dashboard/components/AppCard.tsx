import type { ReactNode, CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';

import styles from './AppCard.module.css';

interface AppCardProps {
  title: string;
  description: string;
  path: string;
  accentColor?: string;
  icon?: ReactNode;
}

const AppCard = ({ title, description, path, accentColor, icon }: AppCardProps) => {
  const navigate = useNavigate();

  const styleOverride = accentColor
    ? ({ '--card-accent': accentColor } as CSSProperties)
    : undefined;

  return (
    <button type="button" className={styles.card} onClick={() => navigate(path)} style={styleOverride}>
      <div className={styles.cardHeader}>
        <div className={styles.icon}>{icon ?? title[0]}</div>
        <div className={styles.meta}>
          <h3>{title}</h3>
          <p>{description}</p>
        </div>
      </div>
      <div className={styles.cardFooter}>
        <span className={styles.cta}>Abrir aplicativo</span>
      </div>
    </button>
  );
};

export { AppCard };
