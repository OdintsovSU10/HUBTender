import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import type { TenderRegistryWithRelations, TenderStatus, ConstructionScope } from '../../../lib/supabase';
import { calculateGrandTotal } from '../../../utils/calculateGrandTotal';

export const useTenderData = () => {
  const [tenders, setTenders] = useState<TenderRegistryWithRelations[]>([]);
  const [statuses, setStatuses] = useState<TenderStatus[]>([]);
  const [constructionScopes, setConstructionScopes] = useState<ConstructionScope[]>([]);
  const [tenderNumbers, setTenderNumbers] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchTenders = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('tender_registry')
      .select('*, status:status_id(id, name), construction_scope:construction_scope_id(id, name)')
      .order('sort_order', { ascending: true });

    if (!error && data) {
      const tendersData = data as TenderRegistryWithRelations[];

      // Сначала устанавливаем данные без стоимости
      setTenders(tendersData);
      setLoading(false);

      // Затем асинхронно загружаем стоимости для тендеров с tender_number
      const tendersWithNumbers = tendersData.filter(t => t.tender_number);

      // Создаем map для быстрого поиска tender_id по tender_number
      const tenderIdMap = new Map<string, string>();

      if (tendersWithNumbers.length > 0) {
        // Загружаем все связанные tenders одним запросом
        const tenderNumbersList = tendersWithNumbers
          .map(t => t.tender_number)
          .filter((tn): tn is string => tn != null);

        const { data: relatedTenders } = await supabase
          .from('tenders')
          .select('id, tender_number, version')
          .in('tender_number', tenderNumbersList);

        if (relatedTenders && relatedTenders.length > 0) {
          // Сортируем по версии (убывание), чтобы первый был с максимальной версией
          const sortedTenders = [...relatedTenders].sort((a, b) => (b.version || 0) - (a.version || 0));

          // Для каждого tender_number берем первый (с максимальной версией)
          sortedTenders.forEach(rt => {
            if (!tenderIdMap.has(rt.tender_number)) {
              tenderIdMap.set(rt.tender_number, rt.id);
            }
          });
        }
      }

      // Рассчитываем стоимость для каждого тендера асинхронно
      const updatedTenders = await Promise.all(
        tendersData.map(async (tender) => {
          // Приоритет 1: Ручной ввод стоимости
          if (tender.manual_total_cost != null) {
            return { ...tender, total_cost: tender.manual_total_cost };
          }

          // Приоритет 2: Расчет из таблицы tenders
          if (tender.tender_number && tenderIdMap.has(tender.tender_number)) {
            const tenderId = tenderIdMap.get(tender.tender_number)!;
            try {
              const totalCost = await calculateGrandTotal({ tenderId });
              return { ...tender, total_cost: totalCost };
            } catch (error) {
              console.error(`Ошибка расчета стоимости для тендера ${tender.tender_number}:`, error);
              return { ...tender, total_cost: null };
            }
          }
          return { ...tender, total_cost: null };
        })
      );

      setTenders(updatedTenders);
    } else {
      setLoading(false);
    }
  };

  const fetchStatuses = async () => {
    const { data } = await supabase.from('tender_statuses').select('*').order('name');
    setStatuses(data || []);
  };

  const fetchConstructionScopes = async () => {
    const { data } = await supabase.from('construction_scopes').select('*').order('name');
    setConstructionScopes(data || []);
  };

  const fetchTenderNumbers = async () => {
    const { data } = await supabase
      .from('tenders')
      .select('tender_number')
      .order('created_at', { ascending: false });

    const unique = Array.from(new Set(data?.map(t => t.tender_number) || []));
    setTenderNumbers(unique);
  };

  useEffect(() => {
    fetchTenders();
    fetchStatuses();
    fetchConstructionScopes();
    fetchTenderNumbers();
  }, []);

  return { tenders, statuses, constructionScopes, tenderNumbers, loading, refetch: fetchTenders };
};
