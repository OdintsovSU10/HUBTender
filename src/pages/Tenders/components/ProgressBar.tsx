import React from 'react';
import { getProgressColor } from '../utils/design';

interface ProgressBarProps {
  value: number; // 0-100
  width?: number; // default 80px
}

export const ProgressBar: React.FC<ProgressBarProps> = ({ value, width = 80 }) => {
  const color = getProgressColor(value);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div
        style={{
          width,
          height: 5,
          borderRadius: 3,
          background: 'rgba(255,255,255,0.06)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            borderRadius: 3,
            width: `${Math.max(value, 2)}%`,
            background: color,
            boxShadow: `0 0 6px ${color}50`,
            transition: 'width 0.6s ease',
          }}
        />
      </div>
      <span
        style={{
          fontSize: 12,
          fontWeight: 600,
          color,
          fontFamily: "'DM Mono', monospace",
          minWidth: 30,
          textAlign: 'right',
        }}
      >
        {value}%
      </span>
    </div>
  );
};
