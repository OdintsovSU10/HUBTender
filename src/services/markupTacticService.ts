/**
 * Сервис применения тактик наценок к элементам BOQ
 * Обеспечивает интеграцию между калькулятором наценок и базой данных
 */

import { supabase } from '../lib/supabase';
import type {
  BoqItem
} from '../lib/supabase';
import {
  calculateMarkupResult,
  validateMarkupSequence,
  type CalculationContext
} from '../utils/markupCalculator';

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
 * Загружает параметры наценок для тендера
 * @param tenderId ID тендера
 * @returns Map с параметрами наценок (ключ -> значение)
 */
export async function loadMarkupParameters(tenderId: string): Promise<Map<string, number>> {
  // ИСПРАВЛЕННАЯ ВЕРСИЯ: Загружаем параметры напрямую из tender_markup_percentage
  const parametersMap = new Map<string, number>();

  try {
    // Определяем соответствие ID -> ключ параметра
    const PARAMETER_KEYS: Record<string, string> = {
      '2c487a7b-bfb2-4315-84e2-47204ef1b4d8': 'mechanization_service',
      '69bb3c39-68b6-4738-b1ad-855b06ef65b6': 'mbp_gsm',
      '4c7f6c87-5603-49de-ab14-a41e4cc1576d': 'warranty_period',
      '8025d9c4-7702-4f3a-a496-1eca820345e6': 'works_16_markup',
      'be99baf4-2afe-4387-8591-decb50cc44e4': 'works_cost_growth',
      '78b4763a-1b67-4079-a0ec-fe40c8a05e00': 'material_cost_growth',
      '4961e7f2-4abc-4d3c-8213-6f49424387f8': 'subcontract_works_cost_growth',
      '214d9304-a070-4a82-a302-1d880efa7fdd': 'subcontract_materials_cost_growth',
      '4952629e-3026-47f3-a7de-1f0166de75d4': 'contingency_costs',
      '227c4abd-e3bd-471c-95ea-d0c1d0100506': 'overhead_own_forces',
      'e322a83d-ad51-45d9-b809-b56904971f40': 'overhead_subcontract',
      'd40f22a5-119c-47ed-817d-ce58603b398d': 'general_costs_without_subcontract',
      '369e3c15-a03e-475c-bdd4-a91a0b70a4e9': 'profit_own_forces',
      '46be3bc8-80a9-4eda-b8b2-a1f8a550bbfc': 'profit_subcontract'
    };

    // Загружаем значения из tender_markup_percentage
    const { data: tenderPercentages, error } = await supabase
      .from('tender_markup_percentage')
      .select('markup_parameter_id, value')
      .eq('tender_id', tenderId);

    if (error) {
      console.error('Ошибка загрузки параметров тендера:', error);
      return getFallbackParameters();
    }

    if (tenderPercentages && tenderPercentages.length > 0) {
      // Заполняем Map параметрами из БД
      for (const param of tenderPercentages) {
        const key = PARAMETER_KEYS[param.markup_parameter_id];
        if (key) {
          parametersMap.set(key, param.value);
          if (key === 'material_cost_growth') {
            console.log(`✅ Загружен material_cost_growth = ${param.value}% из БД`);
          }
        }
      }

      console.log('Загружены параметры из БД:', {
        size: parametersMap.size,
        entries: Array.from(parametersMap.entries())
      });
    }

    // Если параметров мало, используем фоллбэк
    if (parametersMap.size === 0) {
      console.warn('Параметры не найдены, используем фоллбэк');
      return getFallbackParameters();
    }

    return parametersMap;

  } catch (error) {
    console.error('Ошибка загрузки параметров:', error);
    return getFallbackParameters();
  }

  // КОД НИЖЕ ЗАКОММЕНТИРОВАН ДО НАСТРОЙКИ БД
  /*
  const parametersMap = new Map<string, number>();

  try {
    // Сначала загружаем все активные параметры с их значениями по умолчанию
    const { data: allParameters, error: paramsError } = await supabase
      .from('markup_parameters')
      .select('*')
      .eq('is_active', true)
      .order('order_num');

    if (paramsError) {
      console.error('Ошибка загрузки параметров:', paramsError);
      // Если таблица не существует, используем фоллбэк значения
      return getFallbackParameters();
    }
    // Заполняем Map значениями по умолчанию
    if (allParameters) {
      for (const param of allParameters) {
        parametersMap.set(param.key, param.default_value || 0);
      }
    }

    // Теперь загружаем конкретные значения для тендера
    const { data: tenderPercentages, error: percentagesError } = await supabase
      .from('tender_markup_percentage')
      .select(`
        value,
        markup_parameter:markup_parameter_id (
          key,
          label
        )
      `)
      .eq('tender_id', tenderId);

    if (percentagesError) {
      console.error('Ошибка загрузки процентов тендера:', percentagesError);
      // Продолжаем с дефолтными значениями
    } else if (tenderPercentages && tenderPercentages.length > 0) {
      // Обновляем Map значениями из тендера
      for (const percentage of tenderPercentages) {
        const param = percentage.markup_parameter as any;
        if (param && param.key) {
          parametersMap.set(param.key, percentage.value);
        }
      }
    }

    console.log('Загружены параметры наценок из БД:', {
      size: parametersMap.size,
      entries: Array.from(parametersMap.entries())
    });

    // Специальная проверка для material_cost_growth
    const materialGrowth = parametersMap.get('material_cost_growth');
    console.log('🔍 ПРОВЕРКА material_cost_growth:', materialGrowth, '%');
    if (materialGrowth === 0 || materialGrowth === undefined) {
      console.error('❌ ПРОБЛЕМА: material_cost_growth равен 0 или не загружен!');
    }

    // Если параметров мало или нет, возвращаем фоллбэк
    if (parametersMap.size === 0) {
      console.warn('Параметры не найдены в БД, используем фоллбэк');
      return getFallbackParameters();
    }

    return parametersMap;
  } catch (error) {
    console.error('Критическая ошибка загрузки параметров:', error);
    return getFallbackParameters();
  }
  */
}

/**
 * Возвращает фоллбэк параметры для случаев когда БД недоступна
 */
function getFallbackParameters(): Map<string, number> {
  const parametersMap = new Map<string, number>();

  // Базовые параметры для расчета коэффициентов
  parametersMap.set('mechanization_service', 5);
  parametersMap.set('mbp_gsm', 5);
  parametersMap.set('warranty_period', 5);
  parametersMap.set('works_16_markup', 60);
  parametersMap.set('works_cost_growth', 10);
  parametersMap.set('material_cost_growth', 10);
  parametersMap.set('subcontract_works_cost_growth', 10);
  parametersMap.set('subcontract_materials_cost_growth', 10);
  parametersMap.set('contingency_costs', 3);
  parametersMap.set('overhead_own_forces', 10);
  parametersMap.set('overhead_subcontract', 10);
  parametersMap.set('general_costs_without_subcontract', 20);
  parametersMap.set('profit_own_forces', 10);
  parametersMap.set('profit_subcontract', 16);

  console.log('Используются фоллбэк параметры наценок');
  return parametersMap;
}

/**
 * Применяет тактику наценки к одному элементу BOQ
 * @param itemId ID элемента BOQ
 * @param tacticId ID тактики наценок
 * @param markupParameters Параметры наценок (опционально, будут загружены если не переданы)
 * @returns Результат применения тактики
 */
export async function applyTacticToBoqItem(
  itemId: string,
  tacticId: string,
  markupParameters?: Map<string, number>
): Promise<TacticApplicationResult> {
  try {
    // Загружаем элемент BOQ
    const { data: boqItem, error: itemError } = await supabase
      .from('boq_items')
      .select('*')
      .eq('id', itemId)
      .single();

    if (itemError || !boqItem) {
      return {
        success: false,
        errors: [`Элемент BOQ не найден: ${itemId}`]
      };
    }

    // Загружаем тактику наценок
    const { data: tactic, error: tacticError } = await supabase
      .from('markup_tactics')
      .select('*')
      .eq('id', tacticId)
      .single();

    if (tacticError || !tactic) {
      return {
        success: false,
        errors: [`Тактика наценок не найдена: ${tacticId}`]
      };
    }

    // Загружаем параметры наценок, если не переданы
    if (!markupParameters) {
      const { data: tender } = await supabase
        .from('tenders')
        .select('id')
        .eq('id', boqItem.tender_id)
        .single();

      if (!tender) {
        return {
          success: false,
          errors: ['Тендер не найден для элемента BOQ']
        };
      }

      markupParameters = await loadMarkupParameters(tender.id);
    }

    // Получаем последовательность операций для типа элемента
    const sequence = tactic.sequences[boqItem.boq_item_type];
    if (!sequence || sequence.length === 0) {
      return {
        success: false,
        errors: [`Отсутствует последовательность наценок для типа "${boqItem.boq_item_type}"`]
      };
    }

    // Валидируем последовательность
    const validationErrors = validateMarkupSequence(sequence);
    if (validationErrors.length > 0) {
      return {
        success: false,
        errors: validationErrors
      };
    }

    // Создаем контекст для расчета
    const context: CalculationContext = {
      baseAmount: boqItem.total_amount || 0,
      itemType: boqItem.boq_item_type,
      markupSequence: sequence,
      markupParameters,
      baseCost: tactic.base_costs?.[boqItem.boq_item_type]
    };

    // Выполняем расчет
    const result = calculateMarkupResult(context);

    // Определяем, какое поле обновлять в зависимости от типа
    const isMaterial = ['мат', 'суб-мат', 'мат-комп.'].includes(boqItem.boq_item_type);
    const updateData: any = {
      commercial_markup: result.markupCoefficient,
      updated_at: new Date().toISOString()
    };

    // Устанавливаем значение в нужное поле, остальное оставляем без изменений
    if (isMaterial) {
      updateData.total_commercial_material_cost = result.commercialCost;
    } else {
      updateData.total_commercial_work_cost = result.commercialCost;
    }

    // Обновляем элемент BOQ
    const { error: updateError } = await supabase
      .from('boq_items')
      .update(updateData)
      .eq('id', itemId);

    if (updateError) {
      return {
        success: false,
        errors: [`Ошибка обновления элемента: ${updateError.message}`]
      };
    }

    return {
      success: true,
      updatedCount: 1,
      details: [{
        itemId,
        commercialCost: result.commercialCost,
        markupCoefficient: result.markupCoefficient,
        errors: result.errors
      }]
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Неизвестная ошибка';
    return {
      success: false,
      errors: [`Ошибка применения тактики: ${errorMessage}`]
    };
  }
}

/**
 * Применяет тактику наценки ко всем элементам позиции заказчика
 * @param positionId ID позиции заказчика
 * @param tacticId ID тактики наценок
 * @returns Результат применения тактики
 */
export async function applyTacticToPosition(
  positionId: string,
  tacticId: string
): Promise<TacticApplicationResult> {
  try {
    // Загружаем все элементы позиции
    const { data: boqItems, error: itemsError } = await supabase
      .from('boq_items')
      .select('*')
      .eq('client_position_id', positionId)
      .order('sort_number');

    if (itemsError || !boqItems) {
      return {
        success: false,
        errors: [`Ошибка загрузки элементов позиции: ${itemsError?.message}`]
      };
    }

    if (boqItems.length === 0) {
      return {
        success: true,
        updatedCount: 0,
        errors: ['Нет элементов для обработки в позиции']
      };
    }

    // Загружаем тактику и параметры один раз для всех элементов
    const { data: tactic, error: tacticError } = await supabase
      .from('markup_tactics')
      .select('*')
      .eq('id', tacticId)
      .single();

    if (tacticError || !tactic) {
      return {
        success: false,
        errors: [`Тактика наценок не найдена: ${tacticId}`]
      };
    }

    // Получаем ID тендера из первого элемента
    const tenderId = boqItems[0].tender_id;
    const markupParameters = await loadMarkupParameters(tenderId);

    // Применяем тактику к каждому элементу
    const details: TacticApplicationResult['details'] = [];
    let successCount = 0;
    const errors: string[] = [];

    for (const item of boqItems) {
      try {
        // Получаем последовательность для типа элемента
        const sequence = tactic.sequences[item.boq_item_type];
        if (!sequence || sequence.length === 0) {
          errors.push(`Элемент ${item.id}: отсутствует последовательность для типа "${item.boq_item_type}"`);
          continue;
        }

        // Создаем контекст и выполняем расчет
        const context: CalculationContext = {
          baseAmount: item.total_amount || 0,
          itemType: item.boq_item_type,
          markupSequence: sequence,
          markupParameters,
          baseCost: tactic.base_costs?.[item.boq_item_type]
        };

        const result = calculateMarkupResult(context);

        // Определяем тип и обновляем
        const isMaterial = ['мат', 'суб-мат', 'мат-комп.'].includes(item.boq_item_type);
        const updateData: any = {
          commercial_markup: result.markupCoefficient,
          updated_at: new Date().toISOString()
        };

        // Устанавливаем значение в нужное поле
        if (isMaterial) {
          updateData.total_commercial_material_cost = result.commercialCost;
        } else {
          updateData.total_commercial_work_cost = result.commercialCost;
        }

        const { error: updateError } = await supabase
          .from('boq_items')
          .update(updateData)
          .eq('id', item.id);

        if (updateError) {
          errors.push(`Элемент ${item.id}: ${updateError.message}`);
        } else {
          successCount++;
          details?.push({
            itemId: item.id,
            commercialCost: result.commercialCost,
            markupCoefficient: result.markupCoefficient,
            errors: result.errors
          });
        }

      } catch (itemError) {
        const errorMessage = itemError instanceof Error ? itemError.message : 'Неизвестная ошибка';
        errors.push(`Элемент ${item.id}: ${errorMessage}`);
      }
    }

    // Обновляем итоги в client_positions
    await updatePositionTotals(positionId);

    return {
      success: successCount > 0,
      updatedCount: successCount,
      errors: errors.length > 0 ? errors : undefined,
      details
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Неизвестная ошибка';
    return {
      success: false,
      errors: [`Ошибка применения тактики к позиции: ${errorMessage}`]
    };
  }
}

/**
 * Настройки ценообразования для тендера
 */
interface PricingDistribution {
  basic_material_base_target: 'material' | 'work';
  basic_material_markup_target: 'material' | 'work';
  auxiliary_material_base_target: 'material' | 'work';
  auxiliary_material_markup_target: 'material' | 'work';
  subcontract_basic_material_base_target?: 'material' | 'work';
  subcontract_basic_material_markup_target?: 'material' | 'work';
  subcontract_auxiliary_material_base_target?: 'material' | 'work';
  subcontract_auxiliary_material_markup_target?: 'material' | 'work';
  work_base_target: 'material' | 'work';
  work_markup_target: 'material' | 'work';
}

/**
 * Загружает настройки ценообразования для тендера
 */
async function loadPricingDistribution(tenderId: string): Promise<PricingDistribution | null> {
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
 * Определяет тип материала на основе boq_item_type
 */
function getMaterialType(boqItemType: string): 'basic' | 'auxiliary' | 'subcontract_basic' | 'subcontract_auxiliary' | 'work' | null {
  // Определяем тип на основе названия типа элемента
  if (boqItemType === 'мат') return 'basic';
  if (boqItemType === 'мат-комп.') return 'auxiliary';
  if (boqItemType === 'суб-мат') {
    // Для субматериалов нужно различать основные и вспомогательные
    // Пока возвращаем subcontract_basic по умолчанию
    return 'subcontract_basic';
  }
  if (boqItemType === 'раб' || boqItemType === 'раб-комп.' || boqItemType === 'суб-раб') {
    return 'work';
  }
  return null;
}

/**
 * Применяет распределение ценообразования к коммерческой стоимости
 * Разделяет commercialCost на базовую стоимость и наценку, затем распределяет их
 */
function applyPricingDistribution(
  baseAmount: number,
  commercialCost: number,
  boqItemType: string,
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

  // Определяем тип материала/работы
  const materialType = getMaterialType(boqItemType);
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
  }

  return { materialCost, workCost };
}

/**
 * Применяет тактику наценки ко всем элементам тендера
 * @param tenderId ID тендера
 * @param tacticId ID тактики наценок (если не указан, используется тактика из тендера)
 * @returns Результат применения тактики
 */
export async function applyTacticToTender(
  tenderId: string,
  tacticId?: string
): Promise<TacticApplicationResult> {
  try {
    console.log('🚀 Начало пересчёта тендера:', tenderId);

    // Если тактика не указана, получаем ее из тендера
    if (!tacticId) {
      const { data: tender, error: tenderError } = await supabase
        .from('tenders')
        .select('markup_tactic_id')
        .eq('id', tenderId)
        .single();

      if (tenderError || !tender?.markup_tactic_id) {
        return {
          success: false,
          errors: ['У тендера не задана тактика наценок']
        };
      }

      tacticId = tender.markup_tactic_id;
    }

    // Загружаем тактику и параметры один раз для всего тендера
    const { data: tactic, error: tacticError } = await supabase
      .from('markup_tactics')
      .select('*')
      .eq('id', tacticId)
      .single();

    if (tacticError || !tactic) {
      return {
        success: false,
        errors: [`Тактика наценок не найдена: ${tacticId}`]
      };
    }

    const markupParameters = await loadMarkupParameters(tenderId);
    console.log('✅ Загружена тактика и параметры');

    // Загружаем настройки ценообразования
    const pricingDistribution = await loadPricingDistribution(tenderId);
    console.log('💰 Настройки ценообразования:', pricingDistribution ? 'загружены' : 'используются defaults');

    // Загружаем ВСЕ элементы BOQ тендера за один запрос
    const { data: allBoqItems, error: itemsError } = await supabase
      .from('boq_items')
      .select('*')
      .eq('tender_id', tenderId)
      .order('sort_number');

    if (itemsError || !allBoqItems) {
      return {
        success: false,
        errors: [`Ошибка загрузки элементов тендера: ${itemsError?.message}`]
      };
    }

    if (allBoqItems.length === 0) {
      return {
        success: true,
        updatedCount: 0,
        errors: ['Нет элементов для обработки в тендере']
      };
    }

    console.log(`📦 Загружено ${allBoqItems.length} элементов BOQ`);

    // Обрабатываем все элементы и готовим batch updates
    const updates: Array<{ id: string; data: any }> = [];
    const errors: string[] = [];

    for (const item of allBoqItems) {
      try {
        // Получаем последовательность для типа элемента
        const sequence = tactic.sequences[item.boq_item_type];
        if (!sequence || sequence.length === 0) {
          errors.push(`Элемент ${item.id}: отсутствует последовательность для типа "${item.boq_item_type}"`);
          continue;
        }

        // Создаем контекст и выполняем расчет
        const context: CalculationContext = {
          baseAmount: item.total_amount || 0,
          itemType: item.boq_item_type,
          markupSequence: sequence,
          markupParameters,
          baseCost: tactic.base_costs?.[item.boq_item_type]
        };

        const result = calculateMarkupResult(context);

        // Применяем распределение ценообразования
        const { materialCost, workCost } = applyPricingDistribution(
          item.total_amount || 0,
          result.commercialCost,
          item.boq_item_type,
          pricingDistribution
        );

        // Готовим данные для обновления
        const updateData: any = {
          commercial_markup: result.markupCoefficient,
          total_commercial_material_cost: materialCost,
          total_commercial_work_cost: workCost,
          updated_at: new Date().toISOString()
        };

        updates.push({ id: item.id, data: updateData });

      } catch (itemError) {
        const errorMessage = itemError instanceof Error ? itemError.message : 'Неизвестная ошибка';
        errors.push(`Элемент ${item.id}: ${errorMessage}`);
      }
    }

    console.log(`⚡ Подготовлено ${updates.length} обновлений`);

    // Выполняем batch updates параллельно (порциями по 50)
    const BATCH_SIZE = 50;
    let successCount = 0;

    for (let i = 0; i < updates.length; i += BATCH_SIZE) {
      const batch = updates.slice(i, i + BATCH_SIZE);

      // Выполняем обновления в этом батче параллельно
      const batchPromises = batch.map(({ id, data }) =>
        supabase.from('boq_items').update(data).eq('id', id)
      );

      const results = await Promise.allSettled(batchPromises);

      results.forEach((result, idx) => {
        if (result.status === 'fulfilled' && !result.value.error) {
          successCount++;
        } else {
          const error = result.status === 'rejected' ? result.reason : result.value.error;
          errors.push(`Элемент ${batch[idx].id}: ${error?.message || 'Ошибка обновления'}`);
        }
      });

      console.log(`✅ Обработан батч ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(updates.length / BATCH_SIZE)}`);
    }

    console.log(`🎉 Обновлено ${successCount} элементов`);

    return {
      success: successCount > 0,
      updatedCount: successCount,
      errors: errors.length > 0 ? errors : undefined
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Неизвестная ошибка';
    console.error('❌ Ошибка пересчёта:', errorMessage);
    return {
      success: false,
      errors: [`Ошибка применения тактики к тендеру: ${errorMessage}`]
    };
  }
}

/**
 * Обновляет итоговые суммы в позиции заказчика
 * @param positionId ID позиции
 */
async function updatePositionTotals(positionId: string): Promise<void> {
  try {
    // Загружаем все элементы позиции
    const { data: boqItems, error } = await supabase
      .from('boq_items')
      .select('total_commercial_material_cost, total_commercial_work_cost')
      .eq('client_position_id', positionId);

    if (error || !boqItems) {
      console.error('Ошибка загрузки элементов для расчета итогов:', error);
      return;
    }

    // Суммируем коммерческие стоимости
    let totalCommercialMaterial = 0;
    let totalCommercialWork = 0;

    for (const item of boqItems) {
      totalCommercialMaterial += item.total_commercial_material_cost || 0;
      totalCommercialWork += item.total_commercial_work_cost || 0;
    }

    // Обновляем позицию
    const { error: updateError } = await supabase
      .from('client_positions')
      .update({
        total_commercial_material: totalCommercialMaterial,
        total_commercial_work: totalCommercialWork,
        updated_at: new Date().toISOString()
      })
      .eq('id', positionId);

    if (updateError) {
      console.error('Ошибка обновления итогов позиции:', updateError);
    }

  } catch (error) {
    console.error('Ошибка в updatePositionTotals:', error);
  }
}

/**
 * Пересчитывает коммерческие стоимости при изменении параметров наценок
 * @param tenderId ID тендера
 * @param changedParameterKey Ключ измененного параметра (опционально)
 * @returns Результат пересчета
 */
export async function recalculateAfterParameterChange(
  tenderId: string,
  changedParameterKey?: string
): Promise<TacticApplicationResult> {
  try {
    // Получаем тактику тендера
    const { data: tender, error: tenderError } = await supabase
      .from('tenders')
      .select('markup_tactic_id')
      .eq('id', tenderId)
      .single();

    if (tenderError || !tender?.markup_tactic_id) {
      return {
        success: false,
        errors: ['У тендера не задана тактика наценок']
      };
    }

    // Применяем тактику ко всему тендеру
    return await applyTacticToTender(tenderId, tender.markup_tactic_id);

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Неизвестная ошибка';
    return {
      success: false,
      errors: [`Ошибка пересчета: ${errorMessage}`]
    };
  }
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