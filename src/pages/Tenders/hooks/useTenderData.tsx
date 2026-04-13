import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import type { TenderRegistryWithRelations, TenderStatus, ConstructionScope } from '../../../lib/supabase';

const normalizeTenderTitle = (title?: string | null) =>
  (title || '')
    .replace(/\s*\([^)]*\)\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase('ru-RU');

const getTenderRegistryDedupKey = (tender: TenderRegistryWithRelations) => {
  if (tender.tender_number) {
    return `number:${tender.tender_number}`;
  }

  return `title:${normalizeTenderTitle(tender.title)}|client:${(tender.client_name || '').trim().toLocaleLowerCase('ru-RU')}`;
};

const dedupeTenderRegistry = (items: TenderRegistryWithRelations[]) => {
  const map = new Map<string, TenderRegistryWithRelations>();

  items.forEach((item) => {
    const key = getTenderRegistryDedupKey(item);
    const current = map.get(key);

    if (!current) {
      map.set(key, item);
      return;
    }

    const nextTimestamp = new Date(item.updated_at || item.created_at).getTime();
    const currentTimestamp = new Date(current.updated_at || current.created_at).getTime();

    if (nextTimestamp > currentTimestamp) {
      map.set(key, item);
    }
  });

  return Array.from(map.values()).sort((left, right) => (left.sort_order || 0) - (right.sort_order || 0));
};

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
      const tendersData = dedupeTenderRegistry(data as TenderRegistryWithRelations[]);

      // Сначала устанавливаем данные без стоимости
      setTenders(tendersData);
      setLoading(false);

      // Затем асинхронно загружаем стоимости для тендеров с tender_number
      const tendersWithNumbers = tendersData.filter(t => t.tender_number);

      // tender_number → tender_id (максимальная версия)
      const tenderIdMap = new Map<string, string>();
      // tender_id → cached_grand_total (включает страховку от судимостей)
      const grandTotalMap = new Map<string, number>();

      if (tendersWithNumbers.length > 0) {
        const tenderNumbersList = tendersWithNumbers
          .map(t => t.tender_number)
          .filter((tn): tn is string => tn != null);

        const { data: relatedTenders } = await supabase
          .from('tenders')
          .select('id, tender_number, version, cached_grand_total')
          .in('tender_number', tenderNumbersList);

        if (relatedTenders && relatedTenders.length > 0) {
          // Сортируем по версии убыванием, берём первый (максимальная версия)
          const sortedTenders = [...relatedTenders].sort((a, b) => (b.version || 0) - (a.version || 0));

          sortedTenders.forEach(rt => {
            if (!tenderIdMap.has(rt.tender_number)) {
              tenderIdMap.set(rt.tender_number, rt.id);
            }
            grandTotalMap.set(rt.id, rt.cached_grand_total || 0);
          });
        }
      }

      // Берём cached_grand_total из БД (включает страховку от судимостей)
      const updatedTenders = tendersData.map((tender) => {
        if (tender.manual_total_cost != null) {
          return { ...tender, total_cost: tender.manual_total_cost };
        }

        if (tender.tender_number && tenderIdMap.has(tender.tender_number)) {
          const tenderId = tenderIdMap.get(tender.tender_number)!;
          return { ...tender, total_cost: grandTotalMap.get(tenderId) ?? null };
        }

        return { ...tender, total_cost: null };
      });

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
