import { useState } from 'react';
import * as XLSX from 'xlsx';
import { message } from 'antd';
import { supabase } from '../../../lib/supabase';

// ===========================
// ТИПЫ И ИНТЕРФЕЙСЫ
// ===========================

interface ParsedBoqItem {
  rowIndex: number;

  // Идентификация позиции
  positionNumber: string;
  matchedPositionId?: string;

  // Основные поля
  boq_item_type: 'раб' | 'суб-раб' | 'раб-комп.' | 'мат' | 'суб-мат' | 'мат-комп.';
  material_type?: 'основн.' | 'вспомогат.';

  // Наименование (для поиска в номенклатуре)
  nameText: string;
  unit_code: string;

  // Найденные ID из номенклатуры
  work_name_id?: string;
  material_name_id?: string;

  // Привязка к работе
  bindToWork: boolean;
  parent_work_item_id?: string;
  tempId?: string;

  // Количество и коэффициенты
  base_quantity?: number;
  quantity?: number;
  conversion_coefficient?: number;
  consumption_coefficient?: number;

  // Финансовые поля
  currency_type: 'RUB' | 'USD' | 'EUR' | 'CNY';
  delivery_price_type?: 'в цене' | 'не в цене' | 'суммой';
  delivery_amount?: number;
  unit_rate?: number;

  // Затрата на строительство
  costCategoryText: string;
  detail_cost_category_id?: string;

  // Дополнительно
  quote_link?: string;
  description?: string;

  // Сортировка
  sort_number: number;
}

// Данные для обновления позиции заказчика
interface PositionUpdateData {
  positionNumber: string;
  positionId?: string;
  manualVolume?: number;
  manualNote?: string;
  itemsCount: number;
}

interface ValidationError {
  rowIndex: number;
  type: 'missing_nomenclature' | 'unit_mismatch' | 'missing_cost' | 'invalid_type' | 'missing_field' | 'binding_error' | 'position_not_found';
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

interface MissingNomenclatureGroup {
  name: string;
  unit: string;
  rows: number[];
}

interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
  missingNomenclature: {
    works: MissingNomenclatureGroup[];
    materials: MissingNomenclatureGroup[];
  };
  unknownCosts: Array<{ text: string; rows: number[] }>;
  unmatchedPositions: Array<{ positionNumber: string; rows: number[] }>;
}

interface ClientPosition {
  id: string;
  position_number: number;
  work_name: string;
}

// ===========================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ===========================

const isWork = (type: string): boolean => {
  return ['раб', 'суб-раб', 'раб-комп.'].includes(type);
};

const isMaterial = (type: string): boolean => {
  return ['мат', 'суб-мат', 'мат-комп.'].includes(type);
};

const normalizeString = (str: string): string => {
  return str.trim().replace(/\s+/g, ' ');
};

const parseNumber = (value: any): number | undefined => {
  if (value === null || value === undefined || value === '') return undefined;
  const num = typeof value === 'string' ? parseFloat(value.replace(',', '.')) : Number(value);
  return isNaN(num) ? undefined : num;
};

const parseBoolean = (value: any): boolean => {
  if (!value) return false;
  const str = String(value).toLowerCase().trim();
  return str === 'да' || str === 'yes' || str === 'true' || str === '1';
};

// Нормализация номера позиции для сравнения
const normalizePositionNumber = (value: any): string => {
  if (value === null || value === undefined || value === '') return '';

  // Приводим к строке и убираем пробелы
  let str = String(value).trim();

  // Парсим как число и обратно в строку для нормализации (5.0 -> 5, 5.10 -> 5.1)
  const num = parseFloat(str);
  if (!isNaN(num)) {
    // Если это целое число, возвращаем без дробной части
    if (Number.isInteger(num)) {
      return String(Math.floor(num));
    }
    // Иначе убираем лишние нули в конце
    return String(num);
  }

  return str;
};

// Нормализация типа материала
const normalizeMaterialType = (value: string | undefined): 'основн.' | 'вспомогат.' | undefined => {
  if (!value) return undefined;

  const original = String(value).trim();
  const normalized = original.toLowerCase().replace(/\s+/g, '').replace(/\.$/, '');

  if (normalized === 'основной' || normalized === 'основн' || normalized === 'осн') {
    return 'основн.';
  }
  if (normalized === 'вспомогательный' || normalized === 'вспомогат' || normalized === 'вспом') {
    return 'вспомогат.';
  }
  if (original === 'основн.' || original === 'вспомогат.') {
    return original as 'основн.' | 'вспомогат.';
  }

  return undefined;
};

// Нормализация типа доставки
const normalizeDeliveryPriceType = (value: string | undefined): 'в цене' | 'не в цене' | 'суммой' | undefined => {
  if (!value) return undefined;

  const original = String(value).trim();
  const normalized = original.toLowerCase().replace(/\s+/g, ' ');

  if (normalized === 'в цене' || normalized === 'вцене' || normalized === 'входит') {
    return 'в цене';
  }
  if (normalized === 'не в цене' || normalized === 'невцене' || normalized === 'не входит' || normalized === 'невходит') {
    return 'не в цене';
  }
  if (normalized === 'суммой' || normalized === 'доп. стоимость' || normalized === 'доп стоимость' || normalized === 'дополнительно') {
    return 'суммой';
  }
  if (original === 'в цене' || original === 'не в цене' || original === 'суммой') {
    return original as 'в цене' | 'не в цене' | 'суммой';
  }

  return undefined;
};

// Парсинг затраты на строительство
const parseCostCategory = (text: string): { category?: string; detail?: string; location?: string } => {
  if (!text) return {};

  const parts = text.split(' / ').map(p => p.trim());

  if (parts.length === 1) {
    return { category: parts[0] };
  } else if (parts.length === 2) {
    return { category: parts[0], detail: parts[1] };
  } else {
    const category = parts[0];
    const location = parts[parts.length - 1];
    const detail = parts.slice(1, parts.length - 1).join(' / ');
    return {
      category: category || undefined,
      detail: detail || undefined,
      location: location || undefined,
    };
  }
};

// ===========================
// ОСНОВНОЙ ХУК
// ===========================

export const useMassBoqImport = () => {
  const [parsedData, setParsedData] = useState<ParsedBoqItem[]>([]);
  const [positionUpdates, setPositionUpdates] = useState<Map<string, PositionUpdateData>>(new Map());
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Справочники
  const [workNamesMap, setWorkNamesMap] = useState<Map<string, string>>(new Map());
  const [materialNamesMap, setMaterialNamesMap] = useState<Map<string, string>>(new Map());
  const [costCategoriesMap, setCostCategoriesMap] = useState<Map<string, string>>(new Map());
  const [clientPositionsMap, setClientPositionsMap] = useState<Map<string, ClientPosition>>(new Map());

  // Курсы валют
  const [currencyRates, setCurrencyRates] = useState({ usd: 1, eur: 1, cny: 1 });

  // ===========================
  // ЗАГРУЗКА СПРАВОЧНИКОВ
  // ===========================

  const loadNomenclature = async (tenderId: string) => {
    try {
      // Параллельная загрузка всех справочников
      const [worksResult, materialsResult, costsResult, positionsResult] = await Promise.all([
        supabase.from('work_names').select('id, name, unit').order('name'),
        supabase.from('material_names').select('id, name, unit').order('name'),
        supabase.from('detail_cost_categories').select(`
          id, name, location,
          cost_categories!inner(name)
        `).order('name'),
        supabase.from('client_positions')
          .select('id, position_number, work_name')
          .eq('tender_id', tenderId)
          .order('position_number'),
      ]);

      if (worksResult.error) throw worksResult.error;
      if (materialsResult.error) throw materialsResult.error;
      if (costsResult.error) throw costsResult.error;
      if (positionsResult.error) throw positionsResult.error;

      // Создание Map для работ
      const worksMap = new Map<string, string>();
      worksResult.data?.forEach((w: any) => {
        const key = `${normalizeString(w.name)}|${w.unit}`;
        worksMap.set(key, w.id);
      });

      // Создание Map для материалов
      const materialsMap = new Map<string, string>();
      materialsResult.data?.forEach((m: any) => {
        const key = `${normalizeString(m.name)}|${m.unit}`;
        materialsMap.set(key, m.id);
      });

      // Создание Map для затрат
      const costsMap = new Map<string, string>();
      costsResult.data?.forEach((c: any) => {
        const costCategoryName = c.cost_categories?.name || '';
        const key = `${normalizeString(costCategoryName)}|${normalizeString(c.name)}|${normalizeString(c.location)}`;
        costsMap.set(key, c.id);
      });

      // Создание Map для позиций заказчика (ключ - нормализованный номер позиции)
      const positionsMap = new Map<string, ClientPosition>();
      positionsResult.data?.forEach((p: any) => {
        const normalizedNum = normalizePositionNumber(p.position_number);
        positionsMap.set(normalizedNum, {
          id: p.id,
          position_number: p.position_number,
          work_name: p.work_name,
        });
      });

      // Логирование позиций для отладки
      console.log('[MassBoqImport] Первые 20 позиций в БД:',
        Array.from(positionsMap.entries()).slice(0, 20).map(([key, val]) =>
          `${key} (raw: ${val.position_number})`
        )
      );

      setWorkNamesMap(worksMap);
      setMaterialNamesMap(materialsMap);
      setCostCategoriesMap(costsMap);
      setClientPositionsMap(positionsMap);

      console.log('[MassBoqImport] Загружено справочников:', {
        works: worksMap.size,
        materials: materialsMap.size,
        costs: costsMap.size,
        positions: positionsMap.size,
      });

      return true;
    } catch (error) {
      console.error('Ошибка загрузки справочников:', error);
      return false;
    }
  };

  // ===========================
  // ПАРСИНГ EXCEL
  // ===========================

  const parseExcelFile = async (file: File): Promise<boolean> => {
    return new Promise((resolve) => {
      const reader = new FileReader();

      reader.onload = async (e) => {
        try {
          const data = e.target?.result;
          const workbook = XLSX.read(data, { type: 'binary' });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json<unknown[]>(firstSheet, { header: 1 });

          // Пропускаем заголовок
          const rows = jsonData.slice(1);

          const parsed: ParsedBoqItem[] = [];
          const posUpdates = new Map<string, PositionUpdateData>();

          // Допустимые типы BOQ элементов
          const validBoqTypes = ['раб', 'суб-раб', 'раб-комп.', 'мат', 'суб-мат', 'мат-комп.'];

          // Текущий номер позиции (наследуется от родительской строки)
          let currentPositionNumber = '';

          rows.forEach((row: unknown, index: number) => {
            if (!Array.isArray(row)) return;

            const hasData = row.some(cell => cell !== undefined && cell !== null && cell !== '');
            if (!hasData) return;

            const cells = row as any[];
            const rowNum = index + 2;

            // Номер позиции из колонки 1 (вторая колонка в Excel)
            const rowPositionNumber = normalizePositionNumber(cells[1]);

            // Тип элемента BOQ из колонки 4
            const boqType = cells[4] ? String(cells[4]).trim() : '';
            const isValidBoqType = validBoqTypes.includes(boqType);

            // Если есть номер позиции - это строка заголовка позиции
            // Запоминаем номер позиции для последующих строк BOQ
            if (rowPositionNumber) {
              currentPositionNumber = rowPositionNumber;

              // Создаем/обновляем данные позиции
              const existing = posUpdates.get(currentPositionNumber) || {
                positionNumber: currentPositionNumber,
                itemsCount: 0,
              };

              // Количество ГП из колонки 8 (индекс 8)
              const manualVolume = parseNumber(cells[8]);
              if (manualVolume !== undefined) {
                existing.manualVolume = manualVolume;
              }

              // Примечание ГП из колонки 19 (индекс 19)
              const manualNote = cells[19] ? String(cells[19]).trim() : undefined;
              if (manualNote) {
                existing.manualNote = manualNote;
              }

              posUpdates.set(currentPositionNumber, existing);

              // Если это строка-заголовок без типа BOQ - пропускаем её как элемент BOQ
              if (!isValidBoqType) {
                return;
              }
            }

            // Пропускаем строки без валидного типа BOQ
            if (!isValidBoqType) {
              return;
            }

            // Используем унаследованный номер позиции
            const effectivePositionNumber = rowPositionNumber || currentPositionNumber;

            if (!effectivePositionNumber) {
              console.warn(`[MassBoqImport] Строка ${rowNum}: пропущена - нет номера позиции`);
              return;
            }

            // Парсинг элемента BOQ
            const item: ParsedBoqItem = {
              rowIndex: rowNum,
              positionNumber: effectivePositionNumber,

              boq_item_type: boqType as any,
              material_type: normalizeMaterialType(cells[5]),
              nameText: cells[6] ? normalizeString(String(cells[6])) : '',
              unit_code: cells[7] ? String(cells[7]).trim() : '',

              bindToWork: parseBoolean(cells[3]),

              conversion_coefficient: parseNumber(cells[9]),
              consumption_coefficient: parseNumber(cells[10]),
              base_quantity: parseNumber(cells[11]),
              quantity: parseNumber(cells[11]),

              currency_type: cells[12] ? String(cells[12]).trim() as any : 'RUB',
              delivery_price_type: normalizeDeliveryPriceType(cells[13]),
              delivery_amount: parseNumber(cells[14]),
              unit_rate: parseNumber(cells[15]),

              costCategoryText: cells[2] ? String(cells[2]).trim() : '',

              quote_link: cells[17] ? String(cells[17]).trim() : undefined,
              description: cells[19] ? String(cells[19]).trim() : undefined,

              sort_number: index,
            };

            parsed.push(item);

            // Обновляем счетчик элементов для позиции
            const existing = posUpdates.get(effectivePositionNumber) || {
              positionNumber: effectivePositionNumber,
              itemsCount: 0,
            };
            existing.itemsCount++;
            posUpdates.set(effectivePositionNumber, existing);
          });

          setParsedData(parsed);
          setPositionUpdates(posUpdates);

          console.log('=== ПАРСИНГ EXCEL (МАССОВЫЙ) ЗАВЕРШЁН ===');
          console.log(`Всего элементов BOQ: ${parsed.length}`);
          console.log(`Уникальных позиций: ${posUpdates.size}`);

          // Логирование первых 10 строк для отладки
          console.log('[MassBoqImport] Первые 10 строк из Excel:');
          rows.slice(0, 10).forEach((row: any, idx: number) => {
            const cells = row as any[];
            console.log(`  Строка ${idx + 2}: col1="${cells[1]}", col4="${cells[4]}", col6="${cells[6]?.toString().substring(0, 30)}..."`);
          });

          // Группировка по позициям для отладки
          const byPosition = new Map<string, number>();
          parsed.forEach(item => {
            const count = byPosition.get(item.positionNumber) || 0;
            byPosition.set(item.positionNumber, count + 1);
          });
          console.log('Элементов по позициям:', Object.fromEntries(byPosition));

          message.success(`Файл обработан: ${parsed.length} элементов BOQ в ${posUpdates.size} позициях`);
          resolve(true);
        } catch (error) {
          console.error('Ошибка парсинга Excel:', error);
          message.error('Ошибка при чтении файла Excel');
          resolve(false);
        }
      };

      reader.onerror = () => {
        message.error('Ошибка чтения файла');
        resolve(false);
      };

      reader.readAsBinaryString(file);
    });
  };

  // ===========================
  // ВАЛИДАЦИЯ
  // ===========================

  const validateParsedData = (data: ParsedBoqItem[]): ValidationResult => {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];
    const missingWorksMap = new Map<string, MissingNomenclatureGroup>();
    const missingMaterialsMap = new Map<string, MissingNomenclatureGroup>();
    const unknownCostsMap = new Map<string, number[]>();
    const unmatchedPositionsMap = new Map<string, number[]>();

    const validBoqTypes = ['раб', 'суб-раб', 'раб-комп.', 'мат', 'суб-мат', 'мат-комп.'];
    const validMaterialTypes = ['основн.', 'вспомогат.'];
    const validCurrencies = ['RUB', 'USD', 'EUR', 'CNY'];
    const validDeliveryTypes = ['в цене', 'не в цене', 'суммой'];

    data.forEach((item) => {
      const row = item.rowIndex;

      // 1. Проверка номера позиции и сопоставление
      if (!item.positionNumber) {
        errors.push({
          rowIndex: row,
          type: 'missing_field',
          field: 'positionNumber',
          message: 'Отсутствует номер позиции',
          severity: 'error',
        });
      } else {
        const position = clientPositionsMap.get(item.positionNumber);
        if (!position) {
          // Группируем несопоставленные позиции
          if (!unmatchedPositionsMap.has(item.positionNumber)) {
            unmatchedPositionsMap.set(item.positionNumber, []);
          }
          unmatchedPositionsMap.get(item.positionNumber)!.push(row);

          errors.push({
            rowIndex: row,
            type: 'position_not_found',
            field: 'positionNumber',
            message: `Позиция "${item.positionNumber}" не найдена в тендере`,
            severity: 'error',
          });
        } else {
          item.matchedPositionId = position.id;
        }
      }

      // 2. Проверка обязательных полей
      if (!item.nameText) {
        errors.push({
          rowIndex: row,
          type: 'missing_field',
          field: 'nameText',
          message: 'Отсутствует наименование',
          severity: 'error',
        });
      }

      if (!item.unit_code) {
        errors.push({
          rowIndex: row,
          type: 'missing_field',
          field: 'unit_code',
          message: 'Отсутствует единица измерения',
          severity: 'error',
        });
      }

      if (!item.costCategoryText || item.costCategoryText.trim() === '') {
        errors.push({
          rowIndex: row,
          type: 'missing_field',
          field: 'costCategoryText',
          message: 'Отсутствует затрата на строительство',
          severity: 'error',
        });
      }

      // 3. Проверка типов
      if (!validBoqTypes.includes(item.boq_item_type)) {
        errors.push({
          rowIndex: row,
          type: 'invalid_type',
          field: 'boq_item_type',
          message: `Недопустимый тип элемента: "${item.boq_item_type}"`,
          severity: 'error',
        });
      }

      if (isMaterial(item.boq_item_type) && item.material_type && !validMaterialTypes.includes(item.material_type)) {
        errors.push({
          rowIndex: row,
          type: 'invalid_type',
          field: 'material_type',
          message: `Недопустимый тип материала: "${item.material_type}"`,
          severity: 'error',
        });
      }

      if (!validCurrencies.includes(item.currency_type)) {
        errors.push({
          rowIndex: row,
          type: 'invalid_type',
          field: 'currency_type',
          message: `Недопустимая валюта: "${item.currency_type}"`,
          severity: 'error',
        });
      }

      if (item.delivery_price_type && !validDeliveryTypes.includes(item.delivery_price_type)) {
        errors.push({
          rowIndex: row,
          type: 'invalid_type',
          field: 'delivery_price_type',
          message: `Недопустимый тип доставки: "${item.delivery_price_type}"`,
          severity: 'error',
        });
      }

      // 4. Проверка номенклатуры
      if (isWork(item.boq_item_type)) {
        const key = `${normalizeString(item.nameText)}|${item.unit_code}`;
        const workId = workNamesMap.get(key);

        if (!workId) {
          errors.push({
            rowIndex: row,
            type: 'missing_nomenclature',
            field: 'work_name',
            message: `Работа "${item.nameText}" [${item.unit_code}] отсутствует в номенклатуре`,
            severity: 'error',
          });

          const groupKey = `${item.nameText}|${item.unit_code}`;
          if (!missingWorksMap.has(groupKey)) {
            missingWorksMap.set(groupKey, { name: item.nameText, unit: item.unit_code, rows: [] });
          }
          missingWorksMap.get(groupKey)!.rows.push(row);
        } else {
          item.work_name_id = workId;
        }
      }

      if (isMaterial(item.boq_item_type)) {
        const key = `${normalizeString(item.nameText)}|${item.unit_code}`;
        const materialId = materialNamesMap.get(key);

        if (!materialId) {
          errors.push({
            rowIndex: row,
            type: 'missing_nomenclature',
            field: 'material_name',
            message: `Материал "${item.nameText}" [${item.unit_code}] отсутствует в номенклатуре`,
            severity: 'error',
          });

          const groupKey = `${item.nameText}|${item.unit_code}`;
          if (!missingMaterialsMap.has(groupKey)) {
            missingMaterialsMap.set(groupKey, { name: item.nameText, unit: item.unit_code, rows: [] });
          }
          missingMaterialsMap.get(groupKey)!.rows.push(row);
        } else {
          item.material_name_id = materialId;
        }
      }

      // 5. Проверка затраты на строительство
      if (item.costCategoryText) {
        const parsed = parseCostCategory(item.costCategoryText);
        if (parsed.category && parsed.detail && parsed.location) {
          const key = `${normalizeString(parsed.category)}|${normalizeString(parsed.detail)}|${normalizeString(parsed.location)}`;
          const costId = costCategoriesMap.get(key);

          if (!costId) {
            errors.push({
              rowIndex: row,
              type: 'missing_cost',
              field: 'detail_cost_category_id',
              message: `Затрата "${item.costCategoryText}" не найдена в БД`,
              severity: 'error',
            });

            if (!unknownCostsMap.has(item.costCategoryText)) {
              unknownCostsMap.set(item.costCategoryText, []);
            }
            unknownCostsMap.get(item.costCategoryText)!.push(row);
          } else {
            item.detail_cost_category_id = costId;
          }
        }
      }
    });

    const result: ValidationResult = {
      isValid: errors.length === 0,
      errors,
      warnings,
      missingNomenclature: {
        works: Array.from(missingWorksMap.values()),
        materials: Array.from(missingMaterialsMap.values()),
      },
      unknownCosts: Array.from(unknownCostsMap.entries()).map(([text, rows]) => ({ text, rows })),
      unmatchedPositions: Array.from(unmatchedPositionsMap.entries()).map(([positionNumber, rows]) => ({ positionNumber, rows })),
    };

    setValidationResult(result);

    console.log('[MassBoqImport] Результат валидации:', {
      isValid: result.isValid,
      errorsCount: errors.length,
      unmatchedPositions: result.unmatchedPositions.length,
    });

    return result;
  };

  // ===========================
  // ОБРАБОТКА ПРИВЯЗОК
  // ===========================

  const processWorkBindings = (data: ParsedBoqItem[]): ValidationError[] => {
    const errors: ValidationError[] = [];

    // Группируем по позициям для правильной обработки привязок
    const byPosition = new Map<string, ParsedBoqItem[]>();
    data.forEach(item => {
      const posId = item.matchedPositionId || item.positionNumber;
      if (!byPosition.has(posId)) {
        byPosition.set(posId, []);
      }
      byPosition.get(posId)!.push(item);
    });

    // Обрабатываем привязки внутри каждой позиции
    byPosition.forEach((items, posId) => {
      let lastWork: ParsedBoqItem | null = null;

      items.forEach((item) => {
        if (isWork(item.boq_item_type)) {
          lastWork = item;
          item.tempId = `work_${item.rowIndex}`;
        } else if (item.bindToWork) {
          if (!lastWork) {
            errors.push({
              rowIndex: item.rowIndex,
              type: 'binding_error',
              field: 'parent_work_item_id',
              message: 'Материал с привязкой, но работа не найдена выше в этой позиции',
              severity: 'error',
            });
          } else {
            item.parent_work_item_id = lastWork.tempId;

            const workQty = lastWork.quantity || 0;
            const convCoef = item.conversion_coefficient || 1;
            const consCoef = item.consumption_coefficient || 1;
            item.quantity = workQty * convCoef * consCoef;
          }
        } else {
          const baseQty = item.base_quantity || 0;
          const consCoef = item.consumption_coefficient || 1;
          item.quantity = baseQty * consCoef;
        }
      });
    });

    return errors;
  };

  // ===========================
  // ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ДЛЯ РАСЧЕТА
  // ===========================

  const getCurrencyRate = (currency: string, rates?: { usd: number; eur: number; cny: number }): number => {
    const actualRates = rates || currencyRates;
    switch (currency) {
      case 'USD': return actualRates.usd;
      case 'EUR': return actualRates.eur;
      case 'CNY': return actualRates.cny;
      case 'RUB':
      default: return 1;
    }
  };

  const calculateTotalAmount = (item: ParsedBoqItem, rates?: { usd: number; eur: number; cny: number }): number => {
    const rate = getCurrencyRate(item.currency_type || 'RUB', rates);
    const unitRate = item.unit_rate || 0;
    const quantity = item.quantity || 0;

    if (isWork(item.boq_item_type)) {
      return quantity * unitRate * rate;
    } else {
      const unitPriceInRub = unitRate * rate;
      let deliveryPrice = 0;

      if (item.delivery_price_type === 'не в цене') {
        deliveryPrice = unitPriceInRub * 0.03;
      } else if (item.delivery_price_type === 'суммой') {
        deliveryPrice = item.delivery_amount || 0;
      }

      const consumptionCoeff = !item.parent_work_item_id ? (item.consumption_coefficient || 1) : 1;
      return quantity * consumptionCoeff * (unitPriceInRub + deliveryPrice);
    }
  };

  const loadCurrencyRates = async (tenderId: string): Promise<{ usd: number; eur: number; cny: number }> => {
    const { data: tender, error } = await supabase
      .from('tenders')
      .select('usd_rate, eur_rate, cny_rate')
      .eq('id', tenderId)
      .single();

    if (error || !tender) {
      throw new Error('Не удалось загрузить курсы валют');
    }

    const rates = {
      usd: tender.usd_rate || 1,
      eur: tender.eur_rate || 1,
      cny: tender.cny_rate || 1,
    };

    setCurrencyRates(rates);
    return rates;
  };

  // ===========================
  // ВСТАВКА В БД
  // ===========================

  const insertBoqItems = async (data: ParsedBoqItem[], tenderId: string): Promise<boolean> => {
    try {
      setUploading(true);
      setUploadProgress(0);

      const rates = await loadCurrencyRates(tenderId);

      // Группируем элементы по позициям
      const byPosition = new Map<string, ParsedBoqItem[]>();
      data.forEach(item => {
        if (!item.matchedPositionId) return;
        if (!byPosition.has(item.matchedPositionId)) {
          byPosition.set(item.matchedPositionId, []);
        }
        byPosition.get(item.matchedPositionId)!.push(item);
      });

      const totalPositions = byPosition.size;
      let processedPositions = 0;

      // Обрабатываем каждую позицию
      for (const [positionId, items] of byPosition) {
        // Получаем максимальный sort_number для этой позиции
        const { data: existingItems } = await supabase
          .from('boq_items')
          .select('sort_number')
          .eq('client_position_id', positionId)
          .order('sort_number', { ascending: false })
          .limit(1);

        const maxSortNumber = existingItems?.[0]?.sort_number ?? -1;

        // Map для привязки материалов к работам
        const workIdMap = new Map<string, string>();

        // Вставляем элементы
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          const actualSortNumber = maxSortNumber + 1 + i;

          const parentId = item.parent_work_item_id
            ? workIdMap.get(item.parent_work_item_id) || null
            : null;

          const totalAmount = calculateTotalAmount(item, rates);

          const insertData: any = {
            tender_id: tenderId,
            client_position_id: positionId,
            sort_number: actualSortNumber,
            boq_item_type: item.boq_item_type,
            unit_code: item.unit_code,
            quantity: item.quantity,
            base_quantity: item.base_quantity,
            consumption_coefficient: item.consumption_coefficient,
            conversion_coefficient: item.conversion_coefficient,
            currency_type: item.currency_type,
            delivery_price_type: item.delivery_price_type,
            delivery_amount: item.delivery_amount,
            unit_rate: item.unit_rate,
            total_amount: totalAmount,
            detail_cost_category_id: item.detail_cost_category_id,
            quote_link: item.quote_link,
            description: item.description,
          };

          if (isWork(item.boq_item_type)) {
            insertData.work_name_id = item.work_name_id;
          }

          if (isMaterial(item.boq_item_type)) {
            insertData.material_type = item.material_type;
            insertData.material_name_id = item.material_name_id;
            insertData.parent_work_item_id = parentId;
          }

          const { data: inserted, error } = await supabase
            .from('boq_items')
            .insert(insertData)
            .select('id')
            .single();

          if (error) {
            throw new Error(`Позиция ${positionId}, строка ${item.rowIndex}: ${error.message}`);
          }

          if (isWork(item.boq_item_type) && item.tempId && inserted) {
            workIdMap.set(item.tempId, inserted.id);
          }
        }

        // Обновляем данные позиции (manual_volume, manual_note)
        const posData = Array.from(positionUpdates.values()).find(
          p => clientPositionsMap.get(p.positionNumber)?.id === positionId
        );

        if (posData && (posData.manualVolume !== undefined || posData.manualNote !== undefined)) {
          const updateData: any = {};
          if (posData.manualVolume !== undefined) {
            updateData.manual_volume = posData.manualVolume;
          }
          if (posData.manualNote !== undefined) {
            updateData.manual_note = posData.manualNote;
          }

          await supabase
            .from('client_positions')
            .update(updateData)
            .eq('id', positionId);
        }

        processedPositions++;
        setUploadProgress(Math.round((processedPositions / totalPositions) * 100));
      }

      console.log('[MassBoqImport] Импорт завершён:', {
        positions: totalPositions,
        items: data.length,
      });

      message.success(`Импортировано ${data.length} элементов в ${totalPositions} позиций`);
      return true;
    } catch (error: any) {
      console.error('Ошибка импорта:', error);
      message.error('Ошибка при импорте: ' + error.message);
      return false;
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  // ===========================
  // ПУБЛИЧНЫЙ API
  // ===========================

  const reset = () => {
    setParsedData([]);
    setPositionUpdates(new Map());
    setValidationResult(null);
    setUploadProgress(0);
  };

  // Получение статистики по позициям
  const getPositionStats = () => {
    const stats = new Map<string, {
      positionNumber: string;
      positionName: string;
      matched: boolean;
      itemsCount: number;
      manualVolume?: number;
      manualNote?: string;
    }>();

    positionUpdates.forEach((data, posNum) => {
      const position = clientPositionsMap.get(posNum);
      stats.set(posNum, {
        positionNumber: posNum,
        positionName: position?.work_name || 'Не найдена',
        matched: !!position,
        itemsCount: data.itemsCount,
        manualVolume: data.manualVolume,
        manualNote: data.manualNote,
      });
    });

    return Array.from(stats.values());
  };

  return {
    // Данные
    parsedData,
    positionUpdates,
    validationResult,
    uploading,
    uploadProgress,
    clientPositionsMap,

    // Методы
    loadNomenclature,
    parseExcelFile,
    validateParsedData,
    processWorkBindings,
    insertBoqItems,
    reset,
    getPositionStats,
  };
};
