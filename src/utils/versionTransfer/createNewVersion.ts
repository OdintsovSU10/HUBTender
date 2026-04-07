/**
 * Создание новой версии тендера с автоматическим увеличением номера версии
 */

import { supabase } from '../../lib/supabase';
import type { Tender, ClientPositionInsert } from '../../lib/supabase';
import type { ParsedRow } from '../matching';

/**
 * Опции для создания новой версии тендера
 */
export interface CreateVersionOptions {
  sourceTender: Tender;
  newPositions: ParsedRow[];
}

/**
 * Результат создания новой версии
 */
export interface CreateVersionResult {
  tenderId: string;
  version: number;
  positionIdMap: Map<number, string>; // index в newPositions → новый client_position_id
}

/**
 * Создать новую версию тендера
 *
 * Создает:
 * 1. Новую запись в tenders с version + 1
 * 2. Новые записи в client_positions из Excel файла
 *
 * @param options - параметры создания
 * @returns результат с ID нового тендера и маппингом позиций
 */
export async function createNewVersion(
  options: CreateVersionOptions
): Promise<CreateVersionResult> {
  const { sourceTender, newPositions } = options;

  // 1. Проверить уникальность tender_number + version
  const newVersion = (sourceTender.version || 0) + 1;

  const { data: existing } = await supabase
    .from('tenders')
    .select('id')
    .eq('tender_number', sourceTender.tender_number)
    .eq('version', newVersion)
    .single();

  if (existing) {
    throw new Error(
      `Тендер ${sourceTender.tender_number} версия ${newVersion} уже существует`
    );
  }

  // 2. Создать новый тендер
  const newTenderData = {
    title: sourceTender.title,
    description: sourceTender.description,
    client_name: sourceTender.client_name,
    tender_number: sourceTender.tender_number,
    submission_deadline: sourceTender.submission_deadline,
    version: newVersion,
    area_client: sourceTender.area_client,
    area_sp: sourceTender.area_sp,
    usd_rate: sourceTender.usd_rate,
    eur_rate: sourceTender.eur_rate,
    cny_rate: sourceTender.cny_rate,
    upload_folder: sourceTender.upload_folder,
    bsm_link: sourceTender.bsm_link,
    tz_link: sourceTender.tz_link,
    qa_form_link: sourceTender.qa_form_link,
    markup_tactic_id: sourceTender.markup_tactic_id,
    housing_class: sourceTender.housing_class,
    construction_scope: sourceTender.construction_scope,
  };

  const { data: newTender, error: tenderError } = await supabase
    .from('tenders')
    .insert(newTenderData)
    .select()
    .single();

  if (tenderError) {
    throw new Error(`Ошибка создания тендера: ${tenderError.message}`);
  }

  // 3. Получить список существующих единиц измерения
  const { data: existingUnits } = await supabase
    .from('units')
    .select('code');

  const validUnitCodes = new Set(existingUnits?.map(u => u.code) || []);

  // 4. Создать позиции заказчика из Excel
  // ВАЖНО: position_number определяет порядок отображения
  // ВАЖНО: unit_code валидируется - если его нет в справочнике units, устанавливается null
  const positionsToInsert: ClientPositionInsert[] = newPositions.map((pos, index) => {
    // Проверяем unit_code - если его нет в справочнике units, ставим null
    const unitCode = pos.unit_code && validUnitCodes.has(pos.unit_code)
      ? pos.unit_code
      : null;

    return {
      tender_id: newTender.id,
      position_number: index + 1, // Порядковый номер из Excel
      item_no: pos.item_no,
      work_name: pos.work_name,
      unit_code: unitCode,
      volume: pos.volume ?? null,
      client_note: pos.client_note || null,
      hierarchy_level: pos.hierarchy_level || 0,
      is_additional: false,
      parent_position_id: null,
      manual_volume: null,
      manual_note: null,
    };
  });

  const { data: createdPositions, error: positionsError } = await supabase
    .from('client_positions')
    .insert(positionsToInsert)
    .select('id');

  if (positionsError) {
    // Rollback: удалить созданный тендер
    await supabase.from('tenders').delete().eq('id', newTender.id);
    throw new Error(`Ошибка создания позиций: ${positionsError.message}`);
  }

  // 5. Создать маппинг индексов → ID позиций
  const positionIdMap = new Map<number, string>();
  createdPositions.forEach((pos, index) => {
    positionIdMap.set(index, pos.id);
  });

  return {
    tenderId: newTender.id,
    version: newVersion,
    positionIdMap,
  };
}

/**
 * Проверить возможность создания новой версии
 *
 * @param sourceTender - исходный тендер
 * @returns объект с результатом проверки
 */
export async function validateNewVersion(
  sourceTender: Tender
): Promise<{ canCreate: boolean; reason?: string }> {
  const newVersion = (sourceTender.version || 0) + 1;

  // Проверка уникальности версии
  const { data: existing } = await supabase
    .from('tenders')
    .select('id')
    .eq('tender_number', sourceTender.tender_number)
    .eq('version', newVersion)
    .maybeSingle();

  if (existing) {
    return {
      canCreate: false,
      reason: `Версия ${newVersion} уже существует`,
    };
  }

  return { canCreate: true };
}
