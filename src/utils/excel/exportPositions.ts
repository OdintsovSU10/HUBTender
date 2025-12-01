import * as XLSX from 'xlsx-js-style';
import { supabase } from '../../lib/supabase';
import type { ClientPosition, BoqItemFull, ExportRow } from './types';
import {
  isWorkType,
  isMaterialType,
  createPositionRow,
  createBoqItemRow,
} from './formatters';
import {
  getCellStyle,
  headerStyle,
  cellBorderStyle,
  columnWidths,
  numericColIndices,
  fourDecimalColIndices,
  nameColIndex,
} from './styles';

/**
 * Загружает все позиции заказчика для тендера
 */
async function loadClientPositions(tenderId: string): Promise<ClientPosition[]> {
  const { data, error } = await supabase
    .from('client_positions')
    .select('*')
    .eq('tender_id', tenderId)
    .order('position_number', { ascending: true });

  if (error) {
    throw new Error(`Ошибка загрузки позиций: ${error.message}`);
  }

  return data || [];
}

/**
 * Загружает ВСЕ BOQ items для всего тендера одним запросом
 */
async function loadAllBoqItemsForTender(tenderId: string): Promise<Map<string, BoqItemFull[]>> {
  const { data, error } = await supabase
    .from('boq_items')
    .select(`
      *,
      work_names(name, unit),
      material_names(name, unit),
      detail_cost_categories(
        name,
        location,
        cost_categories(name)
      )
    `)
    .eq('tender_id', tenderId)
    .order('sort_number', { ascending: true });

  if (error) {
    throw new Error(`Ошибка загрузки BOQ items: ${error.message}`);
  }

  // Группировать по client_position_id
  const itemsByPosition = new Map<string, BoqItemFull[]>();

  (data || []).forEach((item: any) => {
    const positionId = item.client_position_id;
    if (!itemsByPosition.has(positionId)) {
      itemsByPosition.set(positionId, []);
    }
    itemsByPosition.get(positionId)!.push(item as BoqItemFull);
  });

  return itemsByPosition;
}

/**
 * Собирает все строки для экспорта в правильном порядке
 */
function collectExportRows(
  positions: ClientPosition[],
  boqItemsByPosition: Map<string, BoqItemFull[]>
): ExportRow[] {
  const rows: ExportRow[] = [];

  // Разделить на обычные и ДОП работы
  const normalPositions = positions.filter(p => !p.is_additional);
  const additionalPositions = positions.filter(p => p.is_additional);

  // Обработать обычные позиции
  for (const position of normalPositions) {
    // Проверить является ли позиция конечной
    const isLeaf = position.hierarchy_level !== undefined && position.hierarchy_level >= 3;

    // Добавить строку позиции
    rows.push(createPositionRow(position, isLeaf));

    // Если конечная позиция, добавить её BOQ items
    if (isLeaf) {
      const boqItems = boqItemsByPosition.get(position.id) || [];

      // Разделить на работы и материалы
      const works = boqItems.filter(item => isWorkType(item.boq_item_type));
      const materials = boqItems.filter(item => isMaterialType(item.boq_item_type));

      // Для каждой работы: работа + её материалы
      for (const work of works) {
        rows.push(createBoqItemRow(work, position));

        // Материалы привязанные к этой работе
        const linkedMaterials = materials.filter(
          m => m.parent_work_item_id === work.id
        );
        linkedMaterials.forEach(mat => {
          rows.push(createBoqItemRow(mat, position));
        });
      }

      // Непривязанные материалы (standalone)
      const standaloneMaterials = materials.filter(
        m => !m.parent_work_item_id || m.parent_work_item_id === null
      );
      standaloneMaterials.forEach(mat => {
        rows.push(createBoqItemRow(mat, position));
      });
    }

    // ДОП работы для этой позиции (обрабатываем для ВСЕХ позиций, не только листовых)
    const childAdditional = additionalPositions.filter(
      ap => ap.parent_position_id === position.id
    );

    for (const dopWork of childAdditional) {
      // Добавить строку ДОП работы
      rows.push(createPositionRow(dopWork, true));

      // BOQ items для ДОП работы
      const dopBoqItems = boqItemsByPosition.get(dopWork.id) || [];

      const dopWorks = dopBoqItems.filter(item => isWorkType(item.boq_item_type));
      const dopMaterials = dopBoqItems.filter(item => isMaterialType(item.boq_item_type));

      for (const work of dopWorks) {
        rows.push(createBoqItemRow(work, dopWork));

        const linkedMaterials = dopMaterials.filter(
          m => m.parent_work_item_id === work.id
        );
        linkedMaterials.forEach(mat => {
          rows.push(createBoqItemRow(mat, dopWork));
        });
      }

      const standaloneMaterials = dopMaterials.filter(
        m => !m.parent_work_item_id || m.parent_work_item_id === null
      );
      standaloneMaterials.forEach(mat => {
        rows.push(createBoqItemRow(mat, dopWork));
      });
    }
  }

  return rows;
}

/**
 * Создает рабочий лист Excel с данными и стилями
 */
function createWorksheet(rows: ExportRow[]) {
  // Заголовки колонок
  const headers = [
    'Номер позиции',
    '№ п/п',
    'Затрата на строительство',
    'Тип элемента',
    'Тип материала',
    'Наименование',
    'Ед. изм.',
    'Количество заказчика',
    'Коэфф. перевода',
    'Коэфф. расхода',
    'Количество ГП',
    'Валюта',
    'Тип доставки',
    'Стоимость доставки',
    'Цена за единицу',
    'Итоговая сумма',
    'Ссылка на КП',
    'Примечание заказчика',
    'Примечание ГП',
  ];

  // Создать массив данных (числа записываем как числа, НЕ как строки!)
  const data = rows.map(row => [
    row.itemNo,
    row.positionNumber,
    row.costCategory,
    row.elementType,
    row.materialType,
    row.name,
    row.unit,
    row.clientVolume !== null ? row.clientVolume : '',
    row.conversionCoeff !== null ? row.conversionCoeff : '',
    row.consumptionCoeff !== null ? row.consumptionCoeff : '',
    row.gpVolume !== null ? row.gpVolume : '',
    row.currency,
    row.deliveryType,
    row.deliveryCost !== null ? row.deliveryCost : '',
    row.unitPrice !== null ? row.unitPrice : '',
    row.totalAmount !== null ? row.totalAmount : '',
    row.quoteLink,
    row.clientNote,
    row.gpNote,
  ]);

  // Создать рабочий лист
  const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);

  // Применить стили к заголовкам
  for (let col = 0; col < headers.length; col++) {
    const cellRef = XLSX.utils.encode_cell({ r: 0, c: col });
    if (!ws[cellRef]) ws[cellRef] = { t: 's', v: headers[col] };
    ws[cellRef].s = headerStyle;
  }

  // Применить стили к ячейкам данных
  rows.forEach((row, rowIndex) => {
    const style = getCellStyle(row);

    for (let col = 0; col < headers.length; col++) {
      const cellRef = XLSX.utils.encode_cell({ r: rowIndex + 1, c: col });
      if (!ws[cellRef]) ws[cellRef] = { t: 's', v: '' };

      const isNumeric = numericColIndices.includes(col);

      // Колонка 5 (Наименование) - выравнивание по левому краю с переносом
      // Остальные колонки - выравнивание по центру
      if (col === nameColIndex) {
        // Наименование - по левому краю, по вертикали по центру
        ws[cellRef].s = {
          ...style,
          border: cellBorderStyle,
          alignment: {
            wrapText: true,
            vertical: 'center',
            horizontal: 'left'
          },
        };
      } else {
        // Все остальные колонки - по центру
        ws[cellRef].s = {
          ...style,
          border: cellBorderStyle,
          alignment: {
            wrapText: true,
            vertical: 'center',
            horizontal: 'center'
          },
        };
      }

      // Установить числовой формат для ВСЕХ числовых колонок (даже пустых)
      if (isNumeric) {
        // Колонки 7,8,9,10 (количества и коэффициенты) - 4 знака после запятой БЕЗ разделителя тысяч
        // Колонки 13,14,15 (стоимости и суммы) - 2 знака после запятой С разделителем тысяч
        ws[cellRef].z = fourDecimalColIndices.includes(col) ? '0.0000' : '# ##0.00';

        // Если ячейка не пустая, убедиться что это число
        if (ws[cellRef].v !== '' && ws[cellRef].v !== null && ws[cellRef].v !== undefined) {
          // Если это уже число - просто установить тип
          if (typeof ws[cellRef].v === 'number') {
            ws[cellRef].t = 'n';
          }
          // Если это строка - попробовать преобразовать
          else if (typeof ws[cellRef].v === 'string') {
            const numValue = parseFloat(ws[cellRef].v);
            if (!isNaN(numValue)) {
              ws[cellRef].t = 'n';
              ws[cellRef].v = numValue;
            }
          }
        }
      }
    }
  });

  // Установить ширину колонок
  ws['!cols'] = columnWidths;

  // Установить высоту строки заголовка (увеличена для переноса текста)
  ws['!rows'] = [{ hpt: 40 }];

  // Заморозить первую строку (заголовки)
  ws['!freeze'] = { xSplit: 0, ySplit: 1 };

  return ws;
}

/**
 * Главная функция экспорта позиций заказчика в Excel
 */
export async function exportPositionsToExcel(
  tenderId: string,
  tenderTitle: string,
  tenderVersion: number
): Promise<void> {
  try {
    // Загрузить все позиции и все BOQ items ОДНИМ запросом каждый
    const [positions, boqItemsByPosition] = await Promise.all([
      loadClientPositions(tenderId),
      loadAllBoqItemsForTender(tenderId)
    ]);

    if (positions.length === 0) {
      throw new Error('Нет позиций для экспорта');
    }

    // Собрать все строки для экспорта (БЕЗ дополнительных запросов к БД)
    const rows = collectExportRows(positions, boqItemsByPosition);

    // Создать рабочий лист
    const worksheet = createWorksheet(rows);

    // Создать рабочую книгу
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Позиции заказчика');

    // Сформировать имя файла
    const fileName = `Форма КП_${tenderTitle} (v${tenderVersion}).xlsx`;

    // Экспортировать файл
    XLSX.writeFile(workbook, fileName);
  } catch (error: any) {
    console.error('Ошибка экспорта в Excel:', error);
    throw error;
  }
}
