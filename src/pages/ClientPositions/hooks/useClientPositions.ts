import { useState, useEffect } from 'react';
import { message } from 'antd';
import { supabase, type Tender, type ClientPosition } from '../../../lib/supabase';

export const useClientPositions = () => {
  const [tenders, setTenders] = useState<Tender[]>([]);
  const [selectedTender, setSelectedTender] = useState<Tender | null>(null);
  const [clientPositions, setClientPositions] = useState<ClientPosition[]>([]);
  const [loading, setLoading] = useState(false);
  const [positionCounts, setPositionCounts] = useState<Record<string, { works: number; materials: number; total: number }>>({});
  const [totalSum, setTotalSum] = useState<number>(0);
  const [leafPositionIndices, setLeafPositionIndices] = useState<Set<number>>(new Set());

  // Загрузка тендеров
  useEffect(() => {
    fetchTenders();
  }, []);

  const fetchTenders = async () => {
    try {
      const { data, error } = await supabase
        .from('tenders')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTenders(data || []);
    } catch (error: any) {
      message.error('Ошибка загрузки тендеров: ' + error.message);
    }
  };

  // Вычисление листовых позиций (конечных узлов иерархии)
  const computeLeafPositions = (positions: ClientPosition[]): Set<number> => {
    const leafIndices = new Set<number>();

    positions.forEach((position, index) => {
      if (index === positions.length - 1) {
        leafIndices.add(index);
        return;
      }

      const currentLevel = position.hierarchy_level || 0;
      let nextIndex = index + 1;

      // Пропускаем ДОП работы при определении листового узла
      while (nextIndex < positions.length && positions[nextIndex].is_additional) {
        nextIndex++;
      }

      if (nextIndex >= positions.length) {
        leafIndices.add(index);
        return;
      }

      const nextLevel = positions[nextIndex].hierarchy_level || 0;
      if (currentLevel >= nextLevel) {
        leafIndices.add(index);
      }
    });

    return leafIndices;
  };

  // Загрузка позиций заказчика
  const fetchClientPositions = async (tenderId: string) => {
    setLoading(true);
    try {
      // Загружаем данные батчами, так как Supabase ограничивает 1000 строк за запрос
      let allPositions: ClientPosition[] = [];
      let from = 0;
      const positionsBatchSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from('client_positions')
          .select('*')
          .eq('tender_id', tenderId)
          .order('position_number', { ascending: true })
          .range(from, from + positionsBatchSize - 1);

        if (error) throw error;

        if (data && data.length > 0) {
          allPositions = [...allPositions, ...data];
          from += positionsBatchSize;
          hasMore = data.length === positionsBatchSize;
        } else {
          hasMore = false;
        }
      }

      setClientPositions(allPositions);

      // Вычисляем листовые позиции для оптимизации рендеринга
      const leafIndices = computeLeafPositions(allPositions);
      setLeafPositionIndices(leafIndices);

      // Загружаем счетчики работ/материалов и общую сумму батчами
      if (allPositions.length > 0) {
        const positionIds = allPositions.map(p => p.id);

        // Разбиваем на батчи по 100 ID для избежания ошибки 400 (URL too long)
        const boqBatchSize = 100;
        const batches = [];
        for (let i = 0; i < positionIds.length; i += boqBatchSize) {
          batches.push(positionIds.slice(i, i + boqBatchSize));
        }

        let allBoqData: any[] = [];
        for (const batch of batches) {
          const { data: boqData, error: boqError } = await supabase
            .from('boq_items')
            .select('client_position_id, boq_item_type, total_amount')
            .in('client_position_id', batch);

          if (boqError) throw boqError;
          allBoqData = [...allBoqData, ...(boqData || [])];
        }

        // Обрабатываем данные в памяти
        const counts: Record<string, { works: number; materials: number; total: number }> = {};
        let sum = 0;

        allBoqData.forEach((item) => {
          // Подсчет работ и материалов
          if (!counts[item.client_position_id]) {
            counts[item.client_position_id] = { works: 0, materials: 0, total: 0 };
          }

          if (['раб', 'суб-раб', 'раб-комп.'].includes(item.boq_item_type)) {
            counts[item.client_position_id].works += 1;
          } else if (['мат', 'суб-мат', 'мат-комп.'].includes(item.boq_item_type)) {
            counts[item.client_position_id].materials += 1;
          }

          // Суммирование для каждой позиции и общей суммы
          const itemTotal = item.total_amount || 0;
          counts[item.client_position_id].total += itemTotal;
          sum += itemTotal;
        });

        setPositionCounts(counts);
        setTotalSum(sum);
      } else {
        setPositionCounts({});
        setTotalSum(0);
      }
    } catch (error: any) {
      message.error('Ошибка загрузки позиций: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return {
    tenders,
    selectedTender,
    setSelectedTender,
    clientPositions,
    setClientPositions,
    loading,
    setLoading,
    positionCounts,
    totalSum,
    leafPositionIndices,
    fetchClientPositions,
  };
};
