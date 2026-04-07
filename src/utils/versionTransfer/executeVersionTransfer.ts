import { supabase } from '../../lib/supabase';

export interface VersionTransferNewPositionPayload {
  row_index: number;
  item_no: string | null;
  hierarchy_level: number;
  work_name: string;
  unit_code: string | null;
  volume: number | null;
  client_note: string | null;
}

export interface VersionTransferMatchPayload {
  old_position_id: string;
  new_row_index: number;
}

export interface ExecuteVersionTransferParams {
  sourceTenderId: string;
  newPositions: VersionTransferNewPositionPayload[];
  matches: VersionTransferMatchPayload[];
}

export interface ExecuteVersionTransferResult {
  tenderId: string;
  version: number;
  positionsInserted: number;
  manualTransferred: number;
  boqItemsCopied: number;
  parentLinksRestored: number;
  costVolumesCopied: number;
  insuranceRowsCopied: number;
  additionalWorksCopied: number;
  additionalWorksSkipped: number;
}

export async function executeVersionTransfer({
  sourceTenderId,
  newPositions,
  matches,
}: ExecuteVersionTransferParams): Promise<ExecuteVersionTransferResult> {
  const { data, error } = await supabase.rpc('execute_version_transfer', {
    p_source_tender_id: sourceTenderId,
    p_new_positions: newPositions,
    p_matches: matches,
  });

  if (error) {
    const baseMessage = `Ошибка серверного переноса версии: ${error.message}`;

    if (error.message.includes('statement timeout')) {
      throw new Error(
        `${baseMessage}. Проверьте, что в Supabase применена последняя SQL-миграция для execute_version_transfer.`
      );
    }

    throw new Error(baseMessage);
  }

  if (!data || typeof data !== 'object') {
    throw new Error('Сервер не вернул результат переноса версии');
  }

  const result = data as Partial<ExecuteVersionTransferResult>;

  if (!result.tenderId || typeof result.version !== 'number') {
    throw new Error('Сервер вернул неполный результат переноса версии');
  }

  return {
    tenderId: result.tenderId,
    version: result.version,
    positionsInserted: result.positionsInserted ?? 0,
    manualTransferred: result.manualTransferred ?? 0,
    boqItemsCopied: result.boqItemsCopied ?? 0,
    parentLinksRestored: result.parentLinksRestored ?? 0,
    costVolumesCopied: result.costVolumesCopied ?? 0,
    insuranceRowsCopied: result.insuranceRowsCopied ?? 0,
    additionalWorksCopied: result.additionalWorksCopied ?? 0,
    additionalWorksSkipped: result.additionalWorksSkipped ?? 0,
  };
}
