import clsx from 'clsx';
import type { ReactNode } from 'react';

import styles from './MetricCard.module.css';

interface MetricCardProps {
  label: string;
  value: string;
  trend?: 'positive' | 'negative' | 'neutral';
  icon?: ReactNode;
  footnote?: string;
}

const MetricCard = ({ label, value, trend = 'neutral', icon, footnote }: MetricCardProps) => {
  return (
    <article className={clsx(styles.card, styles[trend])}>
      {icon && <div className={styles.icon}>{icon}</div>}
      <div className={styles.meta}>
        <span className={styles.label}>{label}</span>
        <strong className={styles.value}>{value}</strong>
        {footnote && <span className={styles.footnote}>{footnote}</span>}
      </div>
    </article>
  );
};

export { MetricCard };
