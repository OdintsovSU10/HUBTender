/**
 * Копирование объёмов затрат на строительство между версиями тендера
 */

import { supabase } from '../../lib/supabase';

export interface CopyCostVolumesResult {
  copied: number;
  errors: string[];
}

/**
 * Копирует все записи construction_cost_volumes из старого тендера в новый.
 * Копируются как detail-level записи (по detail_cost_category_id),
 * так и group-level записи (по group_key).
 */
export async function copyCostVolumes(
  sourceTenderId: string,
  newTenderId: string,
): Promise<CopyCostVolumesResult> {
  const errors: string[] = [];

  // Загрузить все объёмы из исходного тендера
  const { data: sourceVolumes, error: fetchError } = await supabase
    .from('construction_cost_volumes')
    .select('detail_cost_category_id, volume, group_key')
    .eq('tender_id', sourceTenderId);

  if (fetchError) {
    throw new Error(`Ошибка загрузки объёмов затрат: ${fetchError.message}`);
  }

  if (!sourceVolumes || sourceVolumes.length === 0) {
    return { copied: 0, errors: [] };
  }

  // Подготовить записи для вставки
  const insertData = sourceVolumes.map((vol) => ({
    tender_id: newTenderId,
    detail_cost_category_id: vol.detail_cost_category_id || null,
    volume: vol.volume,
    group_key: vol.group_key || null,
  }));

  // Вставить батчами по 500 записей
  const BATCH_SIZE = 500;
  let copied = 0;

  for (let i = 0; i < insertData.length; i += BATCH_SIZE) {
    const batch = insertData.slice(i, i + BATCH_SIZE);

    const { error: insertError } = await supabase
      .from('construction_cost_volumes')
      .insert(batch);

    if (insertError) {
      errors.push(`Батч ${i / BATCH_SIZE + 1}: ${insertError.message}`);
    } else {
      copied += batch.length;
    }
  }

  return { copied, errors };
}
