/**
 * Загрузка параметров наценок для тендеров
 */

import { supabase } from '../../lib/supabase';

/**
 * Загружает параметры наценок для тендера
 * @param tenderId ID тендера
 * @returns Map с параметрами наценок (ключ -> значение)
 */
export async function loadMarkupParameters(tenderId: string): Promise<Map<string, number>> {
  // Загружаем параметры напрямую из tender_markup_percentage с join к markup_parameters
  const parametersMap = new Map<string, number>();

  console.log(`📊 [loadMarkupParameters] Загрузка параметров для тендера: ${tenderId}`);

  try {
    // Загружаем значения из tender_markup_percentage вместе с ключами из markup_parameters
    const { data: tenderPercentages, error } = await supabase
      .from('tender_markup_percentage')
      .select(`
        markup_parameter_id,
        value,
        markup_parameter:markup_parameters(key_name)
      `)
      .eq('tender_id', tenderId);

    console.log(`📊 [loadMarkupParameters] Получено записей: ${tenderPercentages?.length || 0}`);

    if (error) {
      console.error('Ошибка загрузки параметров тендера:', error);
      return getFallbackParameters();
    }

    if (tenderPercentages && tenderPercentages.length > 0) {
      // Заполняем Map параметрами из БД используя key_name
      for (const param of tenderPercentages) {
        const keyName = (param.markup_parameter as any)?.key_name;
        console.log(`  📌 [loadMarkupParameters] Обработка параметра: ID=${param.markup_parameter_id}, key_name=${keyName}, value=${param.value}`);

        if (keyName) {
          parametersMap.set(keyName, param.value);
          if (keyName === 'nds_22') {
            console.log(`  ✅ [НДС] Загружен НДС = ${param.value}% из БД`);
          }
          if (keyName === 'material_cost_growth') {
            console.log(`  ✅ [МАТ] Загружен material_cost_growth = ${param.value}% из БД`);
          }
        } else {
          console.warn(`  ⚠️ [loadMarkupParameters] Параметр без key_name:`, param);
        }
      }

      console.log('Загружены параметры из БД:', {
        size: parametersMap.size,
        keys: Array.from(parametersMap.keys()),
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
}

/**
 * Возвращает фоллбэк параметры для случаев когда БД недоступна
 */
export function getFallbackParameters(): Map<string, number> {
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
