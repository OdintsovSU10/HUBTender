import React, { CSSProperties, useState } from 'react';

interface ActionButtonProps {
  onClick: (e: React.MouseEvent) => void;
  children: React.ReactNode;
  color?: string;
  disabled?: boolean;
  title?: string;
}

export const ActionButton: React.FC<ActionButtonProps> = ({
  onClick,
  children,
  color,
  disabled = false,
  title,
}) => {
  const [isHovered, setIsHovered] = useState(false);

  const baseStyle: CSSProperties = {
    width: 28,
    height: 28,
    borderRadius: 6,
    background: color ? `${color}15` : 'rgba(255,255,255,0.04)',
    border: color ? `1px solid ${color}30` : '1px solid rgba(255,255,255,0.06)',
    color: color || 'rgba(255,255,255,0.4)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.15s',
    opacity: disabled ? 0.4 : 1,
  };

  const hoveredStyle: CSSProperties = !disabled
    ? {
        background: color ? `${color}25` : 'rgba(255,255,255,0.08)',
      }
    : {};

  const handleClick = (e: React.MouseEvent) => {
    if (!disabled) {
      e.stopPropagation();
      onClick(e);
    }
  };

  return (
    <button
      onClick={handleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{ ...baseStyle, ...(isHovered ? hoveredStyle : {}) }}
      title={title}
      disabled={disabled}
    >
      {children}
    </button>
  );
};
