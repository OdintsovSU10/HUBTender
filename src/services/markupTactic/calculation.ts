/**
 * Логика расчета наценок для элементов BOQ
 */

import { supabase } from '../../lib/supabase';
import type { BoqItem, MarkupStep } from '../../lib/supabase';
import {
  calculateMarkupResult,
  type CalculationContext
} from '../../utils/markupCalculator';

/**
 * Результат применения тактики
 */
export interface TacticApplicationResult {
  success: boolean;
  updatedCount?: number;
  errors?: string[];
  details?: {
    itemId: string;
    commercialCost: number;
    markupCoefficient: number;
    errors?: string[];
  }[];
}

/**
 * Настройки ценообразования для тендера
 */
export interface PricingDistribution {
  basic_material_base_target: 'material' | 'work';
  basic_material_markup_target: 'material' | 'work';
  auxiliary_material_base_target: 'material' | 'work';
  auxiliary_material_markup_target: 'material' | 'work';
  component_material_base_target?: 'material' | 'work';
  component_material_markup_target?: 'material' | 'work';
  subcontract_basic_material_base_target?: 'material' | 'work';
  subcontract_basic_material_markup_target?: 'material' | 'work';
  subcontract_auxiliary_material_base_target?: 'material' | 'work';
  subcontract_auxiliary_material_markup_target?: 'material' | 'work';
  work_base_target: 'material' | 'work';
  work_markup_target: 'material' | 'work';
  component_work_base_target?: 'material' | 'work';
  component_work_markup_target?: 'material' | 'work';
}

/**
 * Загружает настройки ценообразования для тендера
 */
export async function loadPricingDistribution(tenderId: string): Promise<PricingDistribution | null> {
  const { data, error } = await supabase
    .from('tender_pricing_distribution')
    .select('*')
    .eq('tender_id', tenderId)
    .single();

  if (error || !data) {
    console.warn('⚠️ Настройки ценообразования не найдены, используются defaults');
    return null;
  }

  return data as PricingDistribution;
}

/**
 * Определяет тип материала на основе boq_item_type и material_type
 */
function getMaterialType(
  boqItemType: string,
  materialType?: string | null
): 'basic' | 'auxiliary' | 'component_material' | 'subcontract_basic' | 'subcontract_auxiliary' | 'work' | 'component_work' | null {
  // Для материалов проверяем material_type (основн./вспомогат.)
  if (boqItemType === 'мат') {
    return materialType === 'вспомогат.' ? 'auxiliary' : 'basic';
  }
  if (boqItemType === 'мат-комп.') {
    return materialType === 'вспомогат.' ? 'auxiliary' : 'component_material';
  }
  if (boqItemType === 'суб-мат') {
    return materialType === 'вспомогат.' ? 'subcontract_auxiliary' : 'subcontract_basic';
  }
  if (boqItemType === 'раб') return 'work';
  if (boqItemType === 'раб-комп.') return 'component_work';
  if (boqItemType === 'суб-раб') return 'work';
  return null;
}

/**
 * Применяет распределение ценообразования к коммерческой стоимости
 * Разделяет commercialCost на базовую стоимость и наценку, затем распределяет их
 */
export function applyPricingDistribution(
  baseAmount: number,
  commercialCost: number,
  boqItemType: string,
  materialTypeField: string | null | undefined,
  distribution: PricingDistribution | null
): { materialCost: number; workCost: number } {
  // Если настроек нет, используем старую логику
  if (!distribution) {
    const isMaterial = ['мат', 'суб-мат', 'мат-комп.'].includes(boqItemType);
    return {
      materialCost: isMaterial ? commercialCost : 0,
      workCost: isMaterial ? 0 : commercialCost
    };
  }

  // Вычисляем базовую стоимость и наценку
  const markup = commercialCost - baseAmount;

  // Определяем тип материала/работы с учетом material_type поля
  const materialType = getMaterialType(boqItemType, materialTypeField);
  if (!materialType) {
    console.warn(`⚠️ Неизвестный тип элемента: ${boqItemType}`);
    return { materialCost: 0, workCost: commercialCost };
  }

  let materialCost = 0;
  let workCost = 0;

  // Применяем распределение для каждого типа
  switch (materialType) {
    case 'basic':
      materialCost += distribution.basic_material_base_target === 'material' ? baseAmount : 0;
      workCost += distribution.basic_material_base_target === 'work' ? baseAmount : 0;
      materialCost += distribution.basic_material_markup_target === 'material' ? markup : 0;
      workCost += distribution.basic_material_markup_target === 'work' ? markup : 0;
      break;

    case 'auxiliary':
      materialCost += distribution.auxiliary_material_base_target === 'material' ? baseAmount : 0;
      workCost += distribution.auxiliary_material_base_target === 'work' ? baseAmount : 0;
      materialCost += distribution.auxiliary_material_markup_target === 'material' ? markup : 0;
      workCost += distribution.auxiliary_material_markup_target === 'work' ? markup : 0;
      break;

    case 'component_material':
      if (distribution.component_material_base_target && distribution.component_material_markup_target) {
        materialCost += distribution.component_material_base_target === 'material' ? baseAmount : 0;
        workCost += distribution.component_material_base_target === 'work' ? baseAmount : 0;
        materialCost += distribution.component_material_markup_target === 'material' ? markup : 0;
        workCost += distribution.component_material_markup_target === 'work' ? markup : 0;
      } else {
        // Fallback к auxiliary если нет настроек для component_material
        materialCost += distribution.auxiliary_material_base_target === 'material' ? baseAmount : 0;
        workCost += distribution.auxiliary_material_base_target === 'work' ? baseAmount : 0;
        materialCost += distribution.auxiliary_material_markup_target === 'material' ? markup : 0;
        workCost += distribution.auxiliary_material_markup_target === 'work' ? markup : 0;
      }
      break;

    case 'subcontract_basic':
      if (distribution.subcontract_basic_material_base_target && distribution.subcontract_basic_material_markup_target) {
        materialCost += distribution.subcontract_basic_material_base_target === 'material' ? baseAmount : 0;
        workCost += distribution.subcontract_basic_material_base_target === 'work' ? baseAmount : 0;
        materialCost += distribution.subcontract_basic_material_markup_target === 'material' ? markup : 0;
        workCost += distribution.subcontract_basic_material_markup_target === 'work' ? markup : 0;
      } else {
        // Fallback на старую логику для субматериалов
        workCost = commercialCost;
      }
      break;

    case 'subcontract_auxiliary':
      if (distribution.subcontract_auxiliary_material_base_target && distribution.subcontract_auxiliary_material_markup_target) {
        materialCost += distribution.subcontract_auxiliary_material_base_target === 'material' ? baseAmount : 0;
        workCost += distribution.subcontract_auxiliary_material_base_target === 'work' ? baseAmount : 0;
        materialCost += distribution.subcontract_auxiliary_material_markup_target === 'material' ? markup : 0;
        workCost += distribution.subcontract_auxiliary_material_markup_target === 'work' ? markup : 0;
      } else {
        // Fallback на старую логику
        workCost = commercialCost;
      }
      break;

    case 'work':
      materialCost += distribution.work_base_target === 'material' ? baseAmount : 0;
      workCost += distribution.work_base_target === 'work' ? baseAmount : 0;
      materialCost += distribution.work_markup_target === 'material' ? markup : 0;
      workCost += distribution.work_markup_target === 'work' ? markup : 0;
      break;

    case 'component_work':
      if (distribution.component_work_base_target && distribution.component_work_markup_target) {
        materialCost += distribution.component_work_base_target === 'material' ? baseAmount : 0;
        workCost += distribution.component_work_base_target === 'work' ? baseAmount : 0;
        materialCost += distribution.component_work_markup_target === 'material' ? markup : 0;
        workCost += distribution.component_work_markup_target === 'work' ? markup : 0;
      } else {
        // Fallback к work если нет настроек для component_work
        materialCost += distribution.work_base_target === 'material' ? baseAmount : 0;
        workCost += distribution.work_base_target === 'work' ? baseAmount : 0;
        materialCost += distribution.work_markup_target === 'material' ? markup : 0;
        workCost += distribution.work_markup_target === 'work' ? markup : 0;
      }
      break;
  }

  return { materialCost, workCost };
}

/**
 * Интерфейс тактики наценок
 */
interface MarkupTactic {
  sequences: Record<string, MarkupStep[]>;
  base_costs?: Record<string, number>;
}

/**
 * Структура для хранения исключений роста субподряда
 */
export interface SubcontractGrowthExclusions {
  works: Set<string>;      // Категории исключенные для суб-раб
  materials: Set<string>;  // Категории исключенные для суб-мат
}

/**
 * Загружает исключения роста субподряда для тендера
 */
export async function loadSubcontractGrowthExclusions(tenderId: string): Promise<SubcontractGrowthExclusions> {
  const { data, error } = await supabase
    .from('subcontract_growth_exclusions')
    .select('detail_cost_category_id, exclusion_type')
    .eq('tender_id', tenderId);

  const exclusions: SubcontractGrowthExclusions = {
    works: new Set(),
    materials: new Set()
  };

  if (error || !data) {
    return exclusions;
  }

  // Разделяем исключения по типам
  data.forEach(e => {
    if (e.exclusion_type === 'works') {
      exclusions.works.add(e.detail_cost_category_id);
    } else if (e.exclusion_type === 'materials') {
      exclusions.materials.add(e.detail_cost_category_id);
    }
  });

  return exclusions;
}

/**
 * Проверяет, исключен ли элемент из роста субподряда
 */
function isExcludedFromGrowth(
  item: BoqItem,
  exclusions: SubcontractGrowthExclusions
): boolean {
  // Если нет категории, не исключаем
  if (!item.detail_cost_category_id) {
    return false;
  }

  // Проверяем для суб-раб
  if (item.boq_item_type === 'суб-раб') {
    return exclusions.works.has(item.detail_cost_category_id);
  }

  // Проверяем для суб-мат
  if (item.boq_item_type === 'суб-мат') {
    return exclusions.materials.has(item.detail_cost_category_id);
  }

  return false;
}

/**
 * Фильтрует последовательность наценок, удаляя параметры роста субподряда для исключенных категорий
 */
function filterSequenceForExclusions(
  sequence: MarkupStep[],
  isExcluded: boolean,
  itemType: string
): MarkupStep[] {
  if (!isExcluded) {
    return sequence;
  }

  // Определяем какой ключ роста нужно убрать в зависимости от типа элемента
  const growthKeyToRemove = itemType === 'суб-раб'
    ? 'subcontract_works_cost_growth'
    : 'subcontract_materials_cost_growth';

  // Находим индексы шагов, которые нужно удалить
  const removedIndices: number[] = [];
  sequence.forEach((step, index) => {
    const operandKeys = [
      step.operand1Key,
      step.operand2Key,
      step.operand3Key,
      step.operand4Key,
      step.operand5Key
    ].filter(Boolean);

    if (operandKeys.includes(growthKeyToRemove)) {
      removedIndices.push(index);
    }
  });

  // Фильтруем последовательность
  const filtered = sequence.filter((_, index) => !removedIndices.includes(index));

  // ВАЖНО: Пересчитываем baseIndex для оставшихся шагов
  // Если шаг ссылался на удаленный шаг, он должен ссылаться на базовую стоимость (-1)
  // Если шаг ссылался на сохраненный шаг, нужно скорректировать индекс
  return filtered.map((step, newIndex) => {
    let newBaseIndex = step.baseIndex;

    if (newBaseIndex >= 0) {
      // Проверяем, был ли удален шаг, на который ссылается baseIndex
      if (removedIndices.includes(newBaseIndex)) {
        // Если да, то теперь применяем к базовой стоимости
        newBaseIndex = -1;
      } else {
        // Если нет, пересчитываем индекс с учетом удаленных шагов
        // Считаем сколько шагов было удалено до текущего baseIndex
        const removedBefore = removedIndices.filter(i => i < newBaseIndex).length;
        newBaseIndex = newBaseIndex - removedBefore;
      }
    }

    return {
      ...step,
      baseIndex: newBaseIndex
    };
  });
}

/**
 * Фильтрует последовательность, исключая шаги с НДС
 */
function filterVATFromSequence(
  sequence: MarkupStep[],
  markupParameters: Map<string, number>
): { filtered: MarkupStep[]; vatCoefficient: number } {
  // Ищем параметр НДС по ключу nds_22
  const vatKey = 'nds_22';
  const vatCoefficient = markupParameters.get(vatKey) || 0;

  // Если НДС не найден, возвращаем исходную последовательность
  if (!vatCoefficient) {
    return { filtered: sequence, vatCoefficient: 0 };
  }

  // Находим индексы шагов с НДС
  const removedIndices: number[] = [];
  sequence.forEach((step, index) => {
    const operandKeys = [
      step.operand1Key,
      step.operand2Key,
      step.operand3Key,
      step.operand4Key,
      step.operand5Key
    ].filter(Boolean);

    if (operandKeys.includes(vatKey)) {
      removedIndices.push(index);
    }
  });

  // Если шагов с НДС не найдено в последовательности, НЕ применяем НДС отдельно
  // Это значит что тактика не предусматривает НДС в расчете
  if (removedIndices.length === 0) {
    return { filtered: sequence, vatCoefficient: 0 };
  }

  // Фильтруем последовательность
  const filtered = sequence.filter((_, index) => !removedIndices.includes(index));

  // Пересчитываем baseIndex для оставшихся шагов
  const result = filtered.map((step, newIndex) => {
    let newBaseIndex = step.baseIndex;

    if (newBaseIndex >= 0) {
      if (removedIndices.includes(newBaseIndex)) {
        newBaseIndex = -1;
      } else {
        const removedBefore = removedIndices.filter(i => i < newBaseIndex).length;
        newBaseIndex = newBaseIndex - removedBefore;
      }
    }

    return {
      ...step,
      baseIndex: newBaseIndex
    };
  });

  return { filtered: result, vatCoefficient };
}

/**
 * Рассчитывает коэффициент наценки для типа элемента из тактики
 * Применяя последовательность к базе = 1, получаем коэффициент
 */
export function calculateTypeCoefficient(
  sequence: MarkupStep[],
  markupParameters: Map<string, number>,
  baseCost?: number
): number {
  if (!sequence || sequence.length === 0) {
    return 1;
  }

  // Создаем контекст с baseAmount = 1 для получения коэффициента
  const context: CalculationContext = {
    baseAmount: 1,
    itemType: 'мат' as const, // Тип не используется в расчете, указываем любой допустимый
    markupSequence: sequence,
    markupParameters,
    baseCost: baseCost
  };

  const result = calculateMarkupResult(context);
  return result.commercialCost;
}

/**
 * Кэш коэффициентов по типам элементов для текущего пересчёта
 */
const typeCoefficientsCache = new Map<string, number>();

/**
 * Структура для диагностики аномалий
 */
export interface AnomalyDiagnostic {
  itemId: string;
  itemType: string;
  detailCategoryId?: string | null;
  base: number;
  commercial: number;
  coefficient: number;
  expectedCoefficient: number;
  cacheKey: string;
  isExcluded: boolean;
  vatCoefficient: number;
  reason: string;
}

/**
 * Массив для сбора аномалий во время расчёта
 */
const anomaliesDiagnostics: AnomalyDiagnostic[] = [];

/**
 * Сбрасывает кэш коэффициентов (вызывать в начале пересчёта)
 */
export function resetTypeCoefficientsCache(): void {
  typeCoefficientsCache.clear();
  anomaliesDiagnostics.length = 0;
}

/**
 * Возвращает все кэшированные коэффициенты для логирования
 */
export function getCachedCoefficients(): Map<string, number> {
  return new Map(typeCoefficientsCache);
}

/**
 * Возвращает собранные аномалии для диагностики
 */
export function getAnomaliesDiagnostics(): AnomalyDiagnostic[] {
  return [...anomaliesDiagnostics];
}

/**
 * Выполняет расчет коммерческой стоимости для элемента BOQ
 * Упрощённая логика: коэффициент × база = коммерческая, затем распределение
 */
export function calculateBoqItemCost(
  item: BoqItem,
  tactic: MarkupTactic,
  markupParameters: Map<string, number>,
  pricingDistribution: PricingDistribution | null,
  exclusions?: SubcontractGrowthExclusions
): { materialCost: number; workCost: number; markupCoefficient: number } | null {
  try {
    // Получаем последовательность для типа элемента
    let sequence = tactic.sequences[item.boq_item_type];
    if (!sequence || sequence.length === 0) {
      return null;
    }

    const baseAmount = item.total_amount || 0;

    // Проверяем, исключен ли элемент из роста субподряда
    const isExcluded = exclusions
      ? isExcludedFromGrowth(item, exclusions)
      : false;

    // Если исключен, фильтруем последовательность
    if (isExcluded) {
      sequence = filterSequenceForExclusions(sequence, true, item.boq_item_type);
    }

    // Исключаем НДС из последовательности (НДС применим отдельно)
    const { filtered: sequenceWithoutVAT, vatCoefficient } = filterVATFromSequence(sequence, markupParameters);

    // Формируем ключ для кэша (тип + исключён + НДС)
    const cacheKey = `${item.boq_item_type}_${isExcluded ? 'excl' : 'norm'}_${vatCoefficient}`;

    // Получаем коэффициент из кэша или рассчитываем
    let coefficientWithoutVAT: number;
    if (typeCoefficientsCache.has(cacheKey)) {
      coefficientWithoutVAT = typeCoefficientsCache.get(cacheKey)!;
    } else {
      coefficientWithoutVAT = calculateTypeCoefficient(
        sequenceWithoutVAT,
        markupParameters,
        tactic.base_costs?.[item.boq_item_type]
      );
      typeCoefficientsCache.set(cacheKey, coefficientWithoutVAT);
    }

    // Коммерческая стоимость БЕЗ НДС = база × коэффициент
    const commercialCostWithoutVAT = baseAmount * coefficientWithoutVAT;

    // Применяем распределение ценообразования
    let { materialCost, workCost } = applyPricingDistribution(
      baseAmount,
      commercialCostWithoutVAT,
      item.boq_item_type,
      item.material_type,
      pricingDistribution
    );

    // Применяем НДС ОТДЕЛЬНО к материалам и работам
    if (vatCoefficient > 0) {
      const vatMultiplier = 1 + (vatCoefficient / 100);
      materialCost = materialCost * vatMultiplier;
      workCost = workCost * vatMultiplier;
    }

    // Итоговый коэффициент наценки с учетом НДС
    const totalCommercialCost = materialCost + workCost;
    const markupCoefficient = baseAmount > 0
      ? totalCommercialCost / baseAmount
      : 1;

    // Диагностика аномалий для суб-типов
    if (['суб-мат', 'суб-раб'].includes(item.boq_item_type) && baseAmount > 0) {
      // Получаем ожидаемый коэффициент для нормальных (неисключённых) элементов
      const normalCacheKey = `${item.boq_item_type}_norm_${vatCoefficient}`;
      const expectedCoeff = typeCoefficientsCache.get(normalCacheKey) || coefficientWithoutVAT * (1 + vatCoefficient / 100);

      // Если коэффициент отличается от ожидаемого более чем на 0.001
      if (Math.abs(markupCoefficient - expectedCoeff) > 0.001) {
        let reason = 'Неизвестная причина';

        if (isExcluded) {
          reason = `Исключён из роста субподряда (категория: ${item.detail_cost_category_id})`;
        } else if (markupCoefficient === 0) {
          reason = 'Нулевая коммерческая стоимость (не был рассчитан)';
        } else if (markupCoefficient < expectedCoeff * 0.9) {
          reason = `Коэффициент слишком низкий (возможно исключение или ошибка данных)`;
        } else if (markupCoefficient > expectedCoeff * 1.1) {
          reason = `Коэффициент слишком высокий (возможно старые данные или другая тактика)`;
        }

        anomaliesDiagnostics.push({
          itemId: item.id,
          itemType: item.boq_item_type,
          detailCategoryId: item.detail_cost_category_id,
          base: baseAmount,
          commercial: totalCommercialCost,
          coefficient: markupCoefficient,
          expectedCoefficient: expectedCoeff,
          cacheKey,
          isExcluded,
          vatCoefficient,
          reason
        });
      }
    }

    return {
      materialCost,
      workCost,
      markupCoefficient
    };

  } catch (error) {
    console.error(`Ошибка расчета элемента ${item.id}:`, error);
    return null;
  }
}

/**
 * Выводит сводку по аномалиям в консоль
 */
export function printAnomaliesSummary(): void {
  if (anomaliesDiagnostics.length === 0) {
    console.log('\n✅ АНОМАЛИЙ НЕ ОБНАРУЖЕНО - все суб-типы имеют ожидаемые коэффициенты');
    return;
  }

  console.log('\n=== 🔍 ДИАГНОСТИКА АНОМАЛИЙ ===');
  console.log(`Обнаружено ${anomaliesDiagnostics.length} элементов с отклонениями:\n`);

  // Группируем по причинам
  const byReason: Record<string, AnomalyDiagnostic[]> = {};
  anomaliesDiagnostics.forEach(a => {
    if (!byReason[a.reason]) {
      byReason[a.reason] = [];
    }
    byReason[a.reason].push(a);
  });

  // Выводим сводку по причинам
  Object.entries(byReason).forEach(([reason, items]) => {
    const totalBase = items.reduce((sum, i) => sum + i.base, 0);
    console.log(`📋 ${reason}:`);
    console.log(`   Элементов: ${items.length}`);
    console.log(`   Сумма базовой стоимости: ${totalBase.toLocaleString('ru-RU')}`);

    // Показываем первые 5 элементов как примеры
    console.log('   Примеры:');
    items.slice(0, 5).forEach(item => {
      console.log(`   - ${item.itemType} | база: ${item.base.toLocaleString('ru-RU')} | коэфф: ${item.coefficient.toFixed(4)} (ожид: ${item.expectedCoefficient.toFixed(4)})`);
      if (item.detailCategoryId) {
        console.log(`     категория: ${item.detailCategoryId}`);
      }
    });
    if (items.length > 5) {
      console.log(`   ... и ещё ${items.length - 5} элементов\n`);
    }
    console.log('');
  });

  // Сводка по исключениям
  const excludedItems = anomaliesDiagnostics.filter(a => a.isExcluded);
  if (excludedItems.length > 0) {
    const excludedCategories = new Set(excludedItems.map(a => a.detailCategoryId).filter(Boolean));
    console.log('📌 ИСКЛЮЧЁННЫЕ КАТЕГОРИИ:');
    excludedCategories.forEach(catId => {
      const catItems = excludedItems.filter(a => a.detailCategoryId === catId);
      const catBase = catItems.reduce((sum, i) => sum + i.base, 0);
      console.log(`   - ${catId}: ${catItems.length} элементов, база: ${catBase.toLocaleString('ru-RU')}`);
    });
    console.log('');
  }

  console.log('===================================\n');
}

/**
 * Проверяет, нужен ли пересчет для элемента BOQ
 * @param item Элемент BOQ
 * @returns true, если нужен пересчет
 */
export function needsRecalculation(item: BoqItem): boolean {
  // Пересчет нужен, если:
  // 1. Есть базовая стоимость, но нет коммерческой
  // 2. Коэффициент наценки не соответствует отношению коммерческой к базовой стоимости

  if (!item.total_amount || item.total_amount === 0) {
    return false;
  }

  const isMaterial = ['мат', 'суб-мат', 'мат-комп.'].includes(item.boq_item_type);
  const commercialCost = isMaterial
    ? item.total_commercial_material_cost
    : item.total_commercial_work_cost;

  // Если коммерческая стоимость не задана
  if (!commercialCost) {
    return true;
  }

  // Проверяем соответствие коэффициента
  if (item.commercial_markup) {
    const expectedCost = item.total_amount * item.commercial_markup;
    const difference = Math.abs(expectedCost - commercialCost);

    // Если разница больше 0.01 (1 копейка), нужен пересчет
    return difference > 0.01;
  }

  return true;
}
