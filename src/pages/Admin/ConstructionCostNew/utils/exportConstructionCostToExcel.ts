/**
 * Утилита экспорта затрат на строительство в Excel
 * Создает файл с двумя типами затрат (прямые и коммерческие) в одной таблице
 */

import * as XLSX from 'xlsx-js-style';
import dayjs from 'dayjs';
import { message } from 'antd';
import { supabase } from '../../../../lib/supabase';
import type { CostRow } from '../hooks/useCostData';

interface ExportParams {
  selectedTenderId: string;
  selectedTenderTitle: string;
  selectedVersion: number | null;
  costType: 'base' | 'commercial';
  filteredData: CostRow[];
}

interface OppositeCosts {
  materials: number;
  works: number;
  subMaterials: number;
  subWorks: number;
  materialsComp: number;
  worksComp: number;
}

/**
 * Получает данные для противоположного типа затрат
 */
async function fetchOppositeCosts(
  tenderId: string,
  currentCostType: 'base' | 'commercial'
): Promise<Map<string, OppositeCosts>> {
  const oppositeType = currentCostType === 'base' ? 'commercial' : 'base';

  const { data: oppositeBOQItems, error: oppError } = await supabase
    .from('boq_items')
    .select(`
      detail_cost_category_id,
      boq_item_type,
      ${oppositeType === 'base' ? 'total_amount' : 'total_commercial_material_cost, total_commercial_work_cost'},
      client_positions!inner(tender_id)
    `)
    .eq('client_positions.tender_id', tenderId);

  if (oppError) throw oppError;

  const oppositeCostMap = new Map<string, OppositeCosts>();

  (oppositeBOQItems || []).forEach((item: any) => {
    const catId = item.detail_cost_category_id;
    if (!catId) return;

    if (!oppositeCostMap.has(catId)) {
      oppositeCostMap.set(catId, {
        materials: 0,
        works: 0,
        subMaterials: 0,
        subWorks: 0,
        materialsComp: 0,
        worksComp: 0,
      });
    }

    const costs = oppositeCostMap.get(catId)!;

    if (oppositeType === 'base') {
      const amount = item.total_amount || 0;
      switch (item.boq_item_type) {
        case 'мат':
          costs.materials += amount;
          break;
        case 'суб-мат':
          costs.subMaterials += amount;
          break;
        case 'мат-комп.':
          costs.materialsComp += amount;
          break;
        case 'раб':
          costs.works += amount;
          break;
        case 'суб-раб':
          costs.subWorks += amount;
          break;
        case 'раб-комп.':
          costs.worksComp += amount;
          break;
      }
    } else {
      const materialCost = item.total_commercial_material_cost || 0;
      const workCost = item.total_commercial_work_cost || 0;

      switch (item.boq_item_type) {
        case 'мат':
          costs.materials += materialCost;
          break;
        case 'суб-мат':
          costs.subMaterials += materialCost;
          break;
        case 'мат-комп.':
          costs.materialsComp += materialCost;
          break;
        case 'раб':
          costs.works += workCost;
          break;
        case 'суб-раб':
          costs.subWorks += workCost;
          break;
        case 'раб-комп.':
          costs.worksComp += workCost;
          break;
      }
    }
  });

  return oppositeCostMap;
}

// Кастомный порядок для отделочных работ
const finishingWorksOrder: Record<string, number> = {
  'Отделка полов': 1,
  'Отделка Стен': 2,
  'Отделка Потолков': 3,
  'навигация': 4,
  'Почтовые ящики': 5,
  'Лифтовые порталы': 6,
  'Мебель': 7,
};

// Кастомный порядок для дверей по локализациям
const doorsOrder: Record<string, Record<string, number>> = {
  'Автостоянка': {
    'Двери тех помещений': 1,
    'двери кладовых': 2,
    'ворота': 3,
    'противопожарные шторы': 4,
  },
  'МОПы': {
    'двери лифтового холла': 1,
    'двери лестничной клетки': 2,
    'двери квартирные': 3,
    'выход на кровлю': 4,
    'люки скрытые': 5,
    'Двери тех помещений': 6,
    'потолочные люки': 7,
  },
  '1-й этаж лобби': {
    'двери скрытого монтажа': 1,
    'двери входные': 2,
  },
};

const sortDetailRows = (rows: CostRow[], categoryName: string, locationName?: string): CostRow[] => {
  if (categoryName.toLowerCase().includes('отделочн')) {
    return [...rows].sort((a, b) => {
      const orderA = finishingWorksOrder[a.detail_category_name] || 999;
      const orderB = finishingWorksOrder[b.detail_category_name] || 999;
      if (orderA !== orderB) return orderA - orderB;
      return (a.order_num || 0) - (b.order_num || 0);
    });
  }

  if (categoryName.toLowerCase().includes('двер') && locationName) {
    const locationOrder = doorsOrder[locationName];
    if (locationOrder) {
      return [...rows].sort((a, b) => {
        const orderA = locationOrder[a.detail_category_name] || 999;
        const orderB = locationOrder[b.detail_category_name] || 999;
        if (orderA !== orderB) return orderA - orderB;
        return (a.order_num || 0) - (b.order_num || 0);
      });
    }
  }

  return rows;
};

/**
 * Формирует данные для экспорта в Excel
 */
function buildExportData(
  filteredData: CostRow[],
  oppositeCostMap: Map<string, OppositeCosts>
): any[][] {
  const exportData: any[][] = [];

  // Заголовки
  exportData.push([
    'Затрата тендера',
    'Комментарий',
    'Объем',
    'Ед. изм.',
    'Прямые Затраты',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    'Коммерческие Затраты',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
  ]);

  exportData.push([
    '',
    '',
    '',
    '',
    'Работы',
    'Материалы',
    'Работы суб.',
    'Материал суб.',
    'Раб-комп.',
    'Мат-комп.',
    'Итого работ',
    'Итого материалы',
    'Итого',
    'Итого работ за ед.',
    'Итого материалы за ед.',
    'Итого за единицу',
    'Работы',
    'Материалы',
    'Работы суб.',
    'Материал суб.',
    'Раб-комп.',
    'Мат-комп.',
    'Итого работ',
    'Итого материалы',
    'Итого',
    'Итого работ за ед.',
    'Итого материалы за ед.',
    'Итого за единицу',
  ]);

  let categoryIndex = 1;

  filteredData.forEach((category) => {
    if (category.is_category && category.total_cost > 0) {
      const catNum = String(categoryIndex).padStart(2, '0');
      const categoryTotalVolume =
        category.children?.reduce((sum, c) => sum + (c.volume || 0), 0) || 0;
      const categoryTotalWorks =
        category.works_cost + category.sub_works_cost + category.works_comp_cost;
      const categoryTotalMaterials =
        category.materials_cost +
        category.sub_materials_cost +
        category.materials_comp_cost;

      // Суммируем противоположные затраты для категории
      let oppCatWorks = 0,
        oppCatMaterials = 0,
        oppCatSubWorks = 0,
        oppCatSubMaterials = 0,
        oppCatWorksComp = 0,
        oppCatMaterialsComp = 0;

      category.children?.forEach((child) => {
        if (child.detail_cost_category_id) {
          const oppCosts = oppositeCostMap.get(child.detail_cost_category_id);
          if (oppCosts) {
            oppCatWorks += oppCosts.works;
            oppCatMaterials += oppCosts.materials;
            oppCatSubWorks += oppCosts.subWorks;
            oppCatSubMaterials += oppCosts.subMaterials;
            oppCatWorksComp += oppCosts.worksComp;
            oppCatMaterialsComp += oppCosts.materialsComp;
          }
        }
      });

      const oppCatTotalWorks = oppCatWorks + oppCatSubWorks + oppCatWorksComp;
      const oppCatTotalMaterials =
        oppCatMaterials + oppCatSubMaterials + oppCatMaterialsComp;
      const oppCatTotal = oppCatTotalWorks + oppCatTotalMaterials;

      // Строка категории
      exportData.push([
        `${catNum}. ${category.cost_category_name.toUpperCase()}`,
        '',
        categoryTotalVolume,
        category.children?.[0]?.unit || 'м2',
        category.works_cost,
        category.materials_cost,
        category.sub_works_cost,
        category.sub_materials_cost,
        category.works_comp_cost,
        category.materials_comp_cost,
        categoryTotalWorks,
        categoryTotalMaterials,
        category.total_cost,
        categoryTotalVolume ? categoryTotalWorks / categoryTotalVolume : '',
        categoryTotalVolume ? categoryTotalMaterials / categoryTotalVolume : '',
        categoryTotalVolume ? category.total_cost / categoryTotalVolume : '',
        oppCatWorks,
        oppCatMaterials,
        oppCatSubWorks,
        oppCatSubMaterials,
        oppCatWorksComp,
        oppCatMaterialsComp,
        oppCatTotalWorks,
        oppCatTotalMaterials,
        oppCatTotal,
        categoryTotalVolume ? oppCatTotalWorks / categoryTotalVolume : '',
        categoryTotalVolume ? oppCatTotalMaterials / categoryTotalVolume : '',
        categoryTotalVolume ? oppCatTotal / categoryTotalVolume : '',
      ]);

      // Строки деталей (с учетом локализаций)
      let detailIndex = 1;
      const sortedChildren = category.children ? sortDetailRows(category.children, category.cost_category_name) : [];
      sortedChildren.forEach((child) => {
        if (child.is_location && child.total_cost > 0) {
          // Строка локализации
          const locationNum = `${catNum}.${String(detailIndex).padStart(2, '0')}.`;
          const locationTotalWorks =
            child.works_cost + child.sub_works_cost + child.works_comp_cost;
          const locationTotalMaterials =
            child.materials_cost +
            child.sub_materials_cost +
            child.materials_comp_cost;

          // Суммируем противоположные затраты для локализации
          let oppLocWorks = 0,
            oppLocMaterials = 0,
            oppLocSubWorks = 0,
            oppLocSubMaterials = 0,
            oppLocWorksComp = 0,
            oppLocMaterialsComp = 0;

          child.children?.forEach((detail) => {
            if (detail.detail_cost_category_id) {
              const oppCosts = oppositeCostMap.get(detail.detail_cost_category_id);
              if (oppCosts) {
                oppLocWorks += oppCosts.works;
                oppLocMaterials += oppCosts.materials;
                oppLocSubWorks += oppCosts.subWorks;
                oppLocSubMaterials += oppCosts.subMaterials;
                oppLocWorksComp += oppCosts.worksComp;
                oppLocMaterialsComp += oppCosts.materialsComp;
              }
            }
          });

          const oppLocTotalWorks = oppLocWorks + oppLocSubWorks + oppLocWorksComp;
          const oppLocTotalMaterials = oppLocMaterials + oppLocSubMaterials + oppLocMaterialsComp;
          const oppLocTotal = oppLocTotalWorks + oppLocTotalMaterials;

          exportData.push([
            `${locationNum} ${child.location_name}`,
            '',
            '',
            '',
            child.works_cost || '',
            child.materials_cost || '',
            child.sub_works_cost || '',
            child.sub_materials_cost || '',
            child.works_comp_cost || '',
            child.materials_comp_cost || '',
            locationTotalWorks || '',
            locationTotalMaterials || '',
            child.total_cost || '',
            '',
            '',
            '',
            oppLocWorks || '',
            oppLocMaterials || '',
            oppLocSubWorks || '',
            oppLocSubMaterials || '',
            oppLocWorksComp || '',
            oppLocMaterialsComp || '',
            oppLocTotalWorks || '',
            oppLocTotalMaterials || '',
            oppLocTotal || '',
            '',
            '',
            '',
          ]);

          // Детали внутри локализации
          let locationDetailIndex = 1;
          const sortedLocationChildren = child.children ? sortDetailRows(child.children, category.cost_category_name, child.location_name) : [];
          sortedLocationChildren.forEach((detail) => {
            if (detail.total_cost > 0) {
              const detailNum = `${catNum}.${String(detailIndex).padStart(2, '0')}.${String(locationDetailIndex).padStart(2, '0')}.`;
              const detailTotalWorks =
                detail.works_cost + detail.sub_works_cost + detail.works_comp_cost;
              const detailTotalMaterials =
                detail.materials_cost +
                detail.sub_materials_cost +
                detail.materials_comp_cost;

              const oppDetailCosts = oppositeCostMap.get(
                detail.detail_cost_category_id || ''
              ) || {
                materials: 0,
                works: 0,
                subMaterials: 0,
                subWorks: 0,
                materialsComp: 0,
                worksComp: 0,
              };

              const oppDetailTotalWorks =
                oppDetailCosts.works +
                oppDetailCosts.subWorks +
                oppDetailCosts.worksComp;
              const oppDetailTotalMaterials =
                oppDetailCosts.materials +
                oppDetailCosts.subMaterials +
                oppDetailCosts.materialsComp;
              const oppDetailTotal = oppDetailTotalWorks + oppDetailTotalMaterials;

              exportData.push([
                `${detailNum} ${detail.detail_category_name}`,
                detail.location_name || '',
                detail.volume || '',
                detail.unit || '',
                detail.works_cost || '',
                detail.materials_cost || '',
                detail.sub_works_cost || '',
                detail.sub_materials_cost || '',
                detail.works_comp_cost || '',
                detail.materials_comp_cost || '',
                detailTotalWorks || '',
                detailTotalMaterials || '',
                detail.total_cost || '',
                detail.volume ? detailTotalWorks / detail.volume : '',
                detail.volume ? detailTotalMaterials / detail.volume : '',
                detail.volume ? detail.total_cost / detail.volume : '',
                oppDetailCosts.works || '',
                oppDetailCosts.materials || '',
                oppDetailCosts.subWorks || '',
                oppDetailCosts.subMaterials || '',
                oppDetailCosts.worksComp || '',
                oppDetailCosts.materialsComp || '',
                oppDetailTotalWorks || '',
                oppDetailTotalMaterials || '',
                oppDetailTotal || '',
                detail.volume ? oppDetailTotalWorks / detail.volume : '',
                detail.volume ? oppDetailTotalMaterials / detail.volume : '',
                detail.volume ? oppDetailTotal / detail.volume : '',
              ]);

              locationDetailIndex++;
            }
          });

          detailIndex++;
        } else if (!child.is_location && child.total_cost > 0) {
          // Обычная детальная строка (без локализации)
          const detailNum = `${catNum}.${String(detailIndex).padStart(2, '0')}.`;
          const detailTotalWorks =
            child.works_cost + child.sub_works_cost + child.works_comp_cost;
          const detailTotalMaterials =
            child.materials_cost +
            child.sub_materials_cost +
            child.materials_comp_cost;

          const oppDetailCosts = oppositeCostMap.get(
            child.detail_cost_category_id || ''
          ) || {
            materials: 0,
            works: 0,
            subMaterials: 0,
            subWorks: 0,
            materialsComp: 0,
            worksComp: 0,
          };

          const oppDetailTotalWorks =
            oppDetailCosts.works +
            oppDetailCosts.subWorks +
            oppDetailCosts.worksComp;
          const oppDetailTotalMaterials =
            oppDetailCosts.materials +
            oppDetailCosts.subMaterials +
            oppDetailCosts.materialsComp;
          const oppDetailTotal = oppDetailTotalWorks + oppDetailTotalMaterials;

          exportData.push([
            `${detailNum} ${child.detail_category_name}`,
            child.location_name || '',
            child.volume || '',
            child.unit || '',
            child.works_cost || '',
            child.materials_cost || '',
            child.sub_works_cost || '',
            child.sub_materials_cost || '',
            child.works_comp_cost || '',
            child.materials_comp_cost || '',
            detailTotalWorks || '',
            detailTotalMaterials || '',
            child.total_cost || '',
            child.volume ? detailTotalWorks / child.volume : '',
            child.volume ? detailTotalMaterials / child.volume : '',
            child.volume ? child.total_cost / child.volume : '',
            oppDetailCosts.works || '',
            oppDetailCosts.materials || '',
            oppDetailCosts.subWorks || '',
            oppDetailCosts.subMaterials || '',
            oppDetailCosts.worksComp || '',
            oppDetailCosts.materialsComp || '',
            oppDetailTotalWorks || '',
            oppDetailTotalMaterials || '',
            oppDetailTotal || '',
            child.volume ? oppDetailTotalWorks / child.volume : '',
            child.volume ? oppDetailTotalMaterials / child.volume : '',
            child.volume ? oppDetailTotal / child.volume : '',
          ]);

          detailIndex++;
        }
      });

      categoryIndex++;
    }
  });

  return exportData;
}

/**
 * Настройка стилей и структуры листа Excel
 */
function configureWorksheet(ws: XLSX.WorkSheet): void {
  // Ширина колонок
  ws['!cols'] = [
    { wch: 50 },
    { wch: 20 },
    { wch: 12 },
    { wch: 10 },
    { wch: 15 },
    { wch: 15 },
    { wch: 15 },
    { wch: 15 },
    { wch: 15 },
    { wch: 15 },
    { wch: 15 },
    { wch: 15 },
    { wch: 15 },
    { wch: 18 },
    { wch: 20 },
    { wch: 18 },
    { wch: 15 },
    { wch: 15 },
    { wch: 15 },
    { wch: 15 },
    { wch: 15 },
    { wch: 15 },
    { wch: 15 },
    { wch: 15 },
    { wch: 15 },
    { wch: 18 },
    { wch: 20 },
    { wch: 18 },
  ];

  // Объединение ячеек в заголовке
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 1, c: 0 } }, // Затрата тендера
    { s: { r: 0, c: 1 }, e: { r: 1, c: 1 } }, // Комментарий
    { s: { r: 0, c: 2 }, e: { r: 1, c: 2 } }, // Объем
    { s: { r: 0, c: 3 }, e: { r: 1, c: 3 } }, // Ед. изм.
    { s: { r: 0, c: 4 }, e: { r: 0, c: 15 } }, // Прямые Затраты
    { s: { r: 0, c: 16 }, e: { r: 0, c: 27 } }, // Коммерческие Затраты
  ];
}

/**
 * Основная функция экспорта затрат в Excel
 */
export async function exportConstructionCostToExcel(
  params: ExportParams
): Promise<void> {
  const {
    selectedTenderId,
    selectedTenderTitle,
    selectedVersion,
    costType,
    filteredData,
  } = params;

  if (!selectedTenderId || !selectedTenderTitle) {
    message.warning('Выберите тендер для экспорта');
    return;
  }

  try {
    // Получаем данные для противоположного типа затрат
    const oppositeCostMap = await fetchOppositeCosts(selectedTenderId, costType);

    // Формируем данные для экспорта
    const exportData = buildExportData(filteredData, oppositeCostMap);

    // Создаем рабочую книгу и лист
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(exportData);

    // Настраиваем стили и структуру
    configureWorksheet(ws);

    // Добавляем лист в книгу
    XLSX.utils.book_append_sheet(wb, ws, 'Затраты');

    // Формируем имя файла
    const costTypeLabel = costType === 'base' ? 'Прямые' : 'Коммерческие';
    const fileName = `Затраты_${selectedTenderTitle}_v${selectedVersion || 1}_${costTypeLabel}_${dayjs().format('DD-MM-YYYY')}.xlsx`;

    // Экспортируем файл
    XLSX.writeFile(wb, fileName);
    message.success('Файл успешно экспортирован');
  } catch (error: any) {
    console.error('Ошибка экспорта:', error);
    message.error('Ошибка экспорта: ' + error.message);
  }
}
