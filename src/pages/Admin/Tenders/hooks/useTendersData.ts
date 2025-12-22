import { useState, useEffect } from 'react';
import { message } from 'antd';
import { supabase, type Tender, type HousingClassType, type ConstructionScopeType } from '../../../../lib/supabase';
import dayjs from 'dayjs';

export interface TenderRecord {
  key: string;
  id: string;
  tender: string;
  tenderNumber: string;
  deadline: string;
  daysUntilDeadline: number;
  client: string;
  estimatedCost: number;
  areaClient: number;
  areaSp: number;
  areaZakazchik: number;
  usdRate: number;
  eurRate: number;
  cnyRate: number;
  hasLinks: boolean;
  uploadFolder?: string;
  bsmLink?: string;
  tzLink?: string;
  qaFormLink?: string;
  projectFolderLink?: string;
  createdAt: string;
  description: string;
  status: 'completed' | 'in_progress' | 'pending';
  version: string;
  housingClass?: HousingClassType;
  constructionScope?: ConstructionScopeType;
}

export const useTendersData = () => {
  const [tendersData, setTendersData] = useState<TenderRecord[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchTenders = async () => {
    setLoading(true);
    try {
      // Получаем все тендеры
      const { data, error } = await supabase
        .from('tenders')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Ошибка загрузки тендеров:', error);
        message.error('Ошибка загрузки тендеров');
        setLoading(false);
        return;
      }

      if (!data || data.length === 0) {
        setTendersData([]);
        setLoading(false);
        return;
      }

      // Получаем все boq_items для всех тендеров с батчингом
      const tenderIds = data.map(t => t.id);
      let commercialCostsByTender: Record<string, number> = {};

      // Батчинг по tenderIds (максимум 100 ID за запрос, чтобы избежать URL too long)
      const tenderIdBatchSize = 100;
      for (let i = 0; i < tenderIds.length; i += tenderIdBatchSize) {
        const tenderIdBatch = tenderIds.slice(i, i + tenderIdBatchSize);

        // Загружаем все boq_items для батча тендеров с батчингом по 1000 строк
        let from = 0;
        const boqBatchSize = 1000;
        let hasMore = true;

        while (hasMore) {
          const { data: boqItems } = await supabase
            .from('boq_items')
            .select('tender_id, total_commercial_material_cost, total_commercial_work_cost')
            .in('tender_id', tenderIdBatch)
            .range(from, from + boqBatchSize - 1);

          if (boqItems && boqItems.length > 0) {
            boqItems.forEach(item => {
              if (!commercialCostsByTender[item.tender_id]) {
                commercialCostsByTender[item.tender_id] = 0;
              }
              commercialCostsByTender[item.tender_id] +=
                (item.total_commercial_material_cost || 0) +
                (item.total_commercial_work_cost || 0);
            });

            from += boqBatchSize;
            hasMore = boqItems.length === boqBatchSize;
          } else {
            hasMore = false;
          }
        }
      }

      // Форматируем данные
      const formattedData: TenderRecord[] = data.map((tender: Tender) => ({
        key: tender.id,
        id: tender.id,
        tender: tender.title,
        tenderNumber: tender.tender_number,
        deadline: tender.submission_deadline ? dayjs(tender.submission_deadline).format('DD.MM.YYYY') : '',
        daysUntilDeadline: tender.submission_deadline ?
          dayjs(tender.submission_deadline).diff(dayjs(), 'day') : 0,
        client: tender.client_name,
        estimatedCost: commercialCostsByTender[tender.id] || 0,
        areaClient: tender.area_client || 0,
        areaSp: tender.area_sp || 0,
        areaZakazchik: tender.area_client || 0,
        usdRate: tender.usd_rate || 0,
        eurRate: tender.eur_rate || 0,
        cnyRate: tender.cny_rate || 0,
        hasLinks: !!(tender.upload_folder || tender.bsm_link || tender.tz_link || tender.qa_form_link || tender.project_folder_link),
        uploadFolder: tender.upload_folder || undefined,
        bsmLink: tender.bsm_link || undefined,
        tzLink: tender.tz_link || undefined,
        qaFormLink: tender.qa_form_link || undefined,
        projectFolderLink: tender.project_folder_link || undefined,
        createdAt: dayjs(tender.created_at).format('DD.MM.YYYY'),
        description: tender.description || '',
        status: 'in_progress' as const,
        version: tender.version?.toString() || '1',
        housingClass: tender.housing_class || undefined,
        constructionScope: tender.construction_scope || undefined
      }));

      setTendersData(formattedData);
    } catch (err) {
      console.error('Неожиданная ошибка:', err);
      message.error('Произошла неожиданная ошибка');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTenders();
  }, []);

  return {
    tendersData,
    loading,
    fetchTenders,
  };
};
