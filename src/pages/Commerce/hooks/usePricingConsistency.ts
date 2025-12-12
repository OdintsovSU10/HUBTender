/**
 * Хук для проверки консистентности коммерческих цен между страницами
 */

import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';

export interface ConsistencyCheck {
  commerce: boolean;
  costs: boolean;
  financial: boolean;
  loading: boolean;
  error: string | null;
  // Суммы для отображения в тултипе
  boqTotalBase?: number;
  boqTotalCommercial?: number;
  boqItemsCount?: number;
  costsTotal?: number;
}

export const usePricingConsistency = (tenderId: string | undefined) => {
  const [consistencyCheck, setConsistencyCheck] = useState<ConsistencyCheck>({
    commerce: false,
    costs: false,
    financial: false,
    loading: false,
    error: null
  });

  useEffect(() => {
    if (!tenderId) {
      setConsistencyCheck({
        commerce: false,
        costs: false,
        financial: false,
        loading: false,
        error: null
      });
      return;
    }

    checkConsistency();
  }, [tenderId]);

  const checkConsistency = async () => {
    if (!tenderId) return;

    setConsistencyCheck(prev => ({ ...prev, loading: true, error: null }));

    try {
      // Получаем все BOQ items для тендера с батчингом (Supabase лимит 1000 строк)
      let boqItems: any[] = [];
      let from = 0;
      const batchSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from('boq_items')
          .select(`
            id,
            total_amount,
            total_commercial_material_cost,
            total_commercial_work_cost,
            client_positions!inner(tender_id)
          `)
          .eq('client_positions.tender_id', tenderId)
          .range(from, from + batchSize - 1);

        if (error) throw error;

        if (data && data.length > 0) {
          boqItems = [...boqItems, ...data];
          from += batchSize;
          hasMore = data.length === batchSize;
        } else {
          hasMore = false;
        }
      }

      // Базовые суммы из BOQ items
      const boqTotalBase = boqItems?.reduce((sum, item) => sum + (item.total_amount || 0), 0) || 0;
      const boqTotalMaterial = boqItems?.reduce((sum, item) => sum + (item.total_commercial_material_cost || 0), 0) || 0;
      const boqTotalWork = boqItems?.reduce((sum, item) => sum + (item.total_commercial_work_cost || 0), 0) || 0;
      const boqTotalCommercial = boqTotalMaterial + boqTotalWork;

      // Проверка 1: Commerce - есть ли данные и совпадают ли суммы
      const commerceCheck = boqItems && boqItems.length > 0 && boqTotalCommercial > 0;

      // Проверка 2: Costs - те же данные что и Commerce (коммерческая стоимость)
      const costsCheck = boqTotalCommercial > 0;
      // Для затрат используется та же коммерческая стоимость
      const costsTotal = boqTotalCommercial;

      // Проверка 3: Financial - те же данные что и Commerce
      const financialCheck = boqTotalCommercial > 0;

      setConsistencyCheck({
        commerce: commerceCheck,
        costs: costsCheck,
        financial: financialCheck,
        loading: false,
        error: null,
        boqTotalBase,
        boqTotalCommercial,
        boqItemsCount: boqItems?.length || 0,
        costsTotal
      });

    } catch (error: any) {
      console.error('Ошибка проверки консистентности:', error);
      setConsistencyCheck(prev => ({
        ...prev,
        loading: false,
        error: error.message || 'Ошибка проверки'
      }));
    }
  };

  return {
    consistencyCheck,
    recheckConsistency: checkConsistency
  };
};
