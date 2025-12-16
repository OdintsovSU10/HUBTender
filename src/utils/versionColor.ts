/**
 * Утилита для расчёта цвета версии тендера
 * Первая версия - зелёная, последняя - красная
 * Промежуточные версии - градация от зелёного к красному
 */

interface TenderWithVersion {
  title: string;
  version?: number | null;
}

/**
 * Получить максимальную версию для тендера по его названию
 */
export const getMaxVersionForTitle = (
  title: string,
  tenders: TenderWithVersion[]
): number => {
  const versions = tenders
    .filter(t => t.title === title)
    .map(t => t.version || 1);
  return Math.max(...versions, 1);
};

/**
 * Интерполяция цвета от брендового зелёного к мягкому красному
 * @param ratio - значение от 0 (зелёный) до 1 (красный)
 */
const interpolateColor = (ratio: number): string => {
  // Брендовый зелёный: #10b981 = rgb(16, 185, 129)
  // Мягкий жёлтый: rgb(200, 180, 80)
  // Мягкий красный: rgb(200, 100, 100)

  if (ratio <= 0) return '#10b981'; // Брендовый зелёный
  if (ratio >= 1) return 'rgb(200, 100, 100)'; // Мягкий красный

  // Градиент через жёлтый
  if (ratio <= 0.5) {
    // От зелёного к жёлтому (0 -> 0.5)
    const t = ratio * 2;
    const r = Math.round(16 + (200 - 16) * t);
    const g = Math.round(185 + (180 - 185) * t);
    const b = Math.round(129 + (80 - 129) * t);
    return `rgb(${r}, ${g}, ${b})`;
  } else {
    // От жёлтого к красному (0.5 -> 1)
    const t = (ratio - 0.5) * 2;
    const r = Math.round(200);
    const g = Math.round(180 + (100 - 180) * t);
    const b = Math.round(80 + (100 - 80) * t);
    return `rgb(${r}, ${g}, ${b})`;
  }
};

/**
 * Получить цвет для версии тендера
 * @param version - текущая версия
 * @param maxVersion - максимальная версия для данного тендера
 */
export const getVersionColor = (
  version: number,
  maxVersion: number
): string => {
  if (maxVersion <= 1) return '#10b981'; // Единственная версия - брендовый зелёный

  // ratio: 0 для версии 1, 1 для максимальной версии
  const ratio = (version - 1) / (maxVersion - 1);
  return interpolateColor(ratio);
};

/**
 * Получить цвет для версии тендера по названию
 * Автоматически вычисляет максимальную версию
 */
export const getVersionColorByTitle = (
  version: number | null | undefined,
  title: string,
  tenders: TenderWithVersion[]
): string => {
  const currentVersion = version || 1;
  const maxVersion = getMaxVersionForTitle(title, tenders);
  return getVersionColor(currentVersion, maxVersion);
};
