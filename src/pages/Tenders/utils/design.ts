// Утилиты для визуализации тендеров в новом дизайне

export const formatArea = (area: number | null): string => {
  if (!area) return '-';
  return area.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export const getStatusDotColor = (statusName: string | undefined): string => {
  if (statusName === 'В работе') return '#34d399';
  if (statusName === 'Ожидаем тендерный пакет') return '#fbbf24';
  if (statusName === 'Проиграли') return '#ef4444';
  if (statusName === 'Выиграли') return '#0ea5e9';
  return '#64748b';
};

export const getStatusBadge = (statusName: string | undefined) => {
  if (statusName === 'В работе') {
    return { bg: 'rgba(52,211,153,0.08)', text: '#34d399', border: 'rgba(52,211,153,0.2)' };
  }
  if (statusName === 'Ожидаем тендерный пакет') {
    return { bg: 'rgba(251,191,36,0.08)', text: '#fbbf24', border: 'rgba(251,191,36,0.2)' };
  }
  return { bg: 'rgba(148,163,184,0.08)', text: '#94a3b8', border: 'rgba(148,163,184,0.2)' };
};

export const getStatusLabel = (statusName: string | undefined): string => {
  if (statusName === 'В работе') return 'В работе';
  if (statusName === 'Ожидаем тендерный пакет') return 'В ожидании';
  if (statusName === 'Проиграли' || statusName === 'Выиграли') return statusName;
  return 'Неизвестно';
};

export const getProgressColor = (progress: number): string => {
  if (progress >= 90) return '#34d399';
  if (progress >= 60) return '#38bdf8';
  if (progress >= 30) return '#818cf8';
  if (progress > 0) return '#fb923c';
  return 'rgba(255,255,255,0.12)';
};

export const getFileTypeColor = (type: string): string => {
  const colors: Record<string, string> = {
    pdf: '#ef4444',
    xlsx: '#22c55e',
    xls: '#22c55e',
    docx: '#3b82f6',
    doc: '#3b82f6',
    dwg: '#f59e0b',
  };
  return colors[type.toLowerCase()] || '#94a3b8';
};
