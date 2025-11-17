/**
 * Утилиты для форматирования числовых значений
 * Поддержка русской локализации с запятой как десятичным разделителем
 */

/**
 * Нормализует числовое значение, заменяя запятую на точку
 * Используется для поддержки русского формата ввода чисел (1,5 вместо 1.5)
 *
 * @param value - строка или число для нормализации
 * @returns нормализованное число или undefined
 *
 * @example
 * normalizeNumber("1,5") // => 1.5
 * normalizeNumber("10,25") // => 10.25
 * normalizeNumber("100") // => 100
 * normalizeNumber(50) // => 50
 */
export const normalizeNumber = (value: string | number | null | undefined): number | undefined => {
  if (value === null || value === undefined || value === '') {
    return undefined;
  }

  // Если уже число, возвращаем как есть
  if (typeof value === 'number') {
    return value;
  }

  // Заменяем запятую на точку
  const normalized = value.toString().replace(',', '.');
  const parsed = parseFloat(normalized);

  return isNaN(parsed) ? undefined : parsed;
};

/**
 * Парсер для Ant Design InputNumber
 * Преобразует русский формат (запятая или точка) в формат для JS
 * Вызывается когда пользователь вводит значение
 *
 * @param value - строковое значение из поля ввода (может содержать запятую или точку)
 * @returns число для внутреннего использования
 *
 * @example
 * <InputNumber parser={parseNumberInput} formatter={formatNumberInput} />
 * // Пользователь вводит "1,5" или "1.5" → parser преобразует в 1.5
 */
export const parseNumberInput = (value: string | undefined): number => {
  if (!value || value.trim() === '') return 0;
  // Заменяем и запятую, и точку на точку для корректного парсинга JavaScript
  // Сначала заменяем все запятые на точки
  let normalized = value.replace(/,/g, '.');
  // Если несколько точек, оставляем только последнюю как десятичный разделитель
  const parts = normalized.split('.');
  if (parts.length > 2) {
    // Объединяем все части кроме последней, последнюю добавляем с точкой
    normalized = parts.slice(0, -1).join('') + '.' + parts[parts.length - 1];
  }
  const parsed = parseFloat(normalized);
  return isNaN(parsed) ? 0 : parsed;
};

/**
 * Форматтер для Ant Design InputNumber
 * Преобразует число в русский формат (с запятой)
 * Вызывается когда значение отображается в поле
 *
 * @param value - числовое значение
 * @returns строка с запятой вместо точки
 *
 * @example
 * <InputNumber parser={parseNumberInput} formatter={formatNumberInput} />
 * // Значение 1.5 → formatter отображает как "1,5"
 */
export const formatNumberInput = (value: number | undefined): string => {
  if (value === undefined || value === null) return '';
  // Заменяем точку на запятую для русской локализации
  return value.toString().replace('.', ',');
};

/**
 * Парсер для InputNumber с разделителями тысяч
 * Убирает пробелы и заменяет запятую/точку на десятичный разделитель
 *
 * @param value - строка из поля ввода (может содержать пробелы, запятые и точки)
 * @returns число для внутреннего использования
 *
 * @example
 * <InputNumber parser={parseNumberWithSpaces} formatter={formatNumberWithSpaces} />
 * // "1 000,5" или "1 000.5" → 1000.5
 */
export const parseNumberWithSpaces = (value: string | undefined): number => {
  if (!value || value.trim() === '') return 0;
  // Убираем все пробелы
  let normalized = value.replace(/\s/g, '');
  // Заменяем запятые на точки
  normalized = normalized.replace(/,/g, '.');
  // Если несколько точек, оставляем только последнюю как десятичный разделитель
  const parts = normalized.split('.');
  if (parts.length > 2) {
    normalized = parts.slice(0, -1).join('') + '.' + parts[parts.length - 1];
  }
  const parsed = parseFloat(normalized);
  return isNaN(parsed) ? 0 : parsed;
};

/**
 * Форматтер для InputNumber с разделителями тысяч
 * Добавляет пробелы между тысячами и заменяет точку на запятую
 *
 * @param value - числовое значение
 * @returns строка с пробелами и запятой
 *
 * @example
 * <InputNumber parser={parseNumberWithSpaces} formatter={formatNumberWithSpaces} />
 * // 1000.5 → "1 000,5"
 */
export const formatNumberWithSpaces = (value: number | undefined): string => {
  if (value === undefined || value === null) return '';
  // Разделяем целую и дробную части
  const parts = value.toString().split('.');
  // Добавляем пробелы между тысячами
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  // Заменяем точку на запятую для дробной части
  return parts.join(',');
};
