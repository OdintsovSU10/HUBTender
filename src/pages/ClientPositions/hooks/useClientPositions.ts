import { useState, useEffect } from 'react';
import { message } from 'antd';
import { supabase, type Tender, type ClientPosition } from '../../../lib/supabase';

export const useClientPositions = () => {
  const [tenders, setTenders] = useState<Tender[]>([]);
  const [selectedTender, setSelectedTender] = useState<Tender | null>(null);
  const [clientPositions, setClientPositions] = useState<ClientPosition[]>([]);
  const [loading, setLoading] = useState(false);
  const [positionCounts, setPositionCounts] = useState<Record<string, { works: number; materials: number }>>({});
  const [totalSum, setTotalSum] = useState<number>(0);

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

  // Загрузка позиций заказчика
  const fetchClientPositions = async (tenderId: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('client_positions')
        .select('*')
        .eq('tender_id', tenderId)
        .order('position_number', { ascending: true });

      if (error) throw error;
      setClientPositions(data || []);

      // Загружаем счетчики работ и материалов для каждой позиции
      if (data && data.length > 0) {
        await fetchPositionCounts(data.map(p => p.id));
        await fetchTotalSum(data.map(p => p.id));
      } else {
        setTotalSum(0);
      }
    } catch (error: any) {
      message.error('Ошибка загрузки позиций: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Загрузка количества работ и материалов для позиций
  const fetchPositionCounts = async (positionIds: string[]) => {
    try {
      const { data, error } = await supabase
        .from('boq_items')
        .select('client_position_id, boq_item_type')
        .in('client_position_id', positionIds);

      if (error) throw error;

      // Подсчитываем количество работ и материалов для каждой позиции
      const counts: Record<string, { works: number; materials: number }> = {};

      (data || []).forEach((item) => {
        if (!counts[item.client_position_id]) {
          counts[item.client_position_id] = { works: 0, materials: 0 };
        }

        if (['раб', 'суб-раб', 'раб-комп.'].includes(item.boq_item_type)) {
          counts[item.client_position_id].works += 1;
        } else if (['мат', 'суб-мат', 'мат-комп.'].includes(item.boq_item_type)) {
          counts[item.client_position_id].materials += 1;
        }
      });

      setPositionCounts(counts);
    } catch (error: any) {
      console.error('Ошибка загрузки счетчиков:', error);
    }
  };

  // Загрузка общей суммы по всем элементам позиций
  const fetchTotalSum = async (positionIds: string[]) => {
    try {
      const { data, error } = await supabase
        .from('boq_items')
        .select('total_amount')
        .in('client_position_id', positionIds);

      if (error) throw error;

      // Суммируем все total_amount
      const sum = (data || []).reduce((acc, item) => acc + (item.total_amount || 0), 0);
      setTotalSum(sum);
    } catch (error: any) {
      console.error('Ошибка загрузки общей суммы:', error);
      setTotalSum(0);
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
    fetchClientPositions,
  };
};
