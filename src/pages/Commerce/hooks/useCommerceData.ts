/**
 * Хук для загрузки и управления данными коммерции
 */

import { useState, useEffect, useMemo } from 'react';
import { message } from 'antd';
import { supabase } from '../../../lib/supabase';
import type { Tender } from '../../../lib/supabase';
import type { PositionWithCommercialCost, MarkupTactic } from '../types';

export function useCommerceData() {
  const [loading, setLoading] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [tenders, setTenders] = useState<Tender[]>([]);
  const [selectedTenderId, setSelectedTenderId] = useState<string | undefined>();
  const [selectedTenderTitle, setSelectedTenderTitle] = useState<string | null>(null);
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null);
  const [positions, setPositions] = useState<PositionWithCommercialCost[]>([]);
  const [markupTactics, setMarkupTactics] = useState<MarkupTactic[]>([]);
  const [selectedTacticId, setSelectedTacticId] = useState<string | undefined>();
  const [tacticChanged, setTacticChanged] = useState(false);
  const [referenceTotal, setReferenceTotal] = useState<number>(0);

  // Загрузка списка тендеров и тактик
  useEffect(() => {
    loadTenders();
    loadMarkupTactics();
  }, []);

  // Загрузка позиций при выборе тендера
  useEffect(() => {
    if (selectedTenderId) {
      loadPositions(selectedTenderId);
      // Установить тактику из тендера
      const tender = tenders.find(t => t.id === selectedTenderId);
      if (tender?.markup_tactic_id) {
        setSelectedTacticId(tender.markup_tactic_id);
        setTacticChanged(false);
      } else {
        setSelectedTacticId(undefined);
      }
    } else {
      setPositions([]);
    }
  }, [selectedTenderId, tenders]);

  const loadTenders = async () => {
    try {
      const { data, error } = await supabase
        .from('tenders')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTenders(data || []);
    } catch (error) {
      console.error('Ошибка загрузки тендеров:', error);
      message.error('Не удалось загрузить список тендеров');
    }
  };

  const loadMarkupTactics = async () => {
    try {
      const { data, error } = await supabase
        .from('markup_tactics')
        .select('*')
        .order('is_global', { ascending: false })
        .order('name');

      if (error) throw error;
      setMarkupTactics(data || []);
    } catch (error) {
      console.error('Ошибка загрузки тактик наценок:', error);
      message.error('Не удалось загрузить список тактик');
    }
  };

  const loadPositions = async (tenderId: string) => {
    setLoading(true);

    try {
      console.log('🔄 Загрузка позиций для тендера:', tenderId);
      const startTime = Date.now();

      // Загружаем позиции заказчика с батчингом (Supabase лимит 1000 строк)
      let clientPositions: any[] = [];
      let posFrom = 0;
      const posBatchSize = 1000;
      let posHasMore = true;

      while (posHasMore) {
        const { data, error } = await supabase
          .from('client_positions')
          .select('*')
          .eq('tender_id', tenderId)
          .order('position_number')
          .range(posFrom, posFrom + posBatchSize - 1);

        if (error) throw error;

        if (data && data.length > 0) {
          clientPositions = [...clientPositions, ...data];
          posFrom += posBatchSize;
          posHasMore = data.length === posBatchSize;
        } else {
          posHasMore = false;
        }
      }

      console.log(`📋 Загружено позиций: ${clientPositions.length}`);

      // Загружаем ВСЕ BOQ элементы для тендера с батчингом (Supabase лимит 1000 строк)
      let allBoqItems: any[] = [];
      let from = 0;
      const batchSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from('boq_items')
          .select('client_position_id, boq_item_type, material_type, total_amount, total_commercial_material_cost, total_commercial_work_cost')
          .eq('tender_id', tenderId)
          .range(from, from + batchSize - 1);

        if (error) {
          console.error('Ошибка загрузки элементов:', error);
          throw error;
        }

        if (data && data.length > 0) {
          allBoqItems = [...allBoqItems, ...data];
          from += batchSize;
          hasMore = data.length === batchSize;
        } else {
          hasMore = false;
        }
      }

      console.log(`📝 Загружено BOQ элементов: ${allBoqItems.length}`);

      // Вычисляем эталонную сумму напрямую из boq_items (как на странице позиций)
      const refTotal = allBoqItems.reduce((sum, item) => sum + (item.total_amount || 0), 0);
      setReferenceTotal(refTotal);

      // Группируем элементы по позициям в памяти
      const itemsByPosition = new Map<string, typeof allBoqItems>();
      for (const item of allBoqItems) {
        if (!itemsByPosition.has(item.client_position_id)) {
          itemsByPosition.set(item.client_position_id, []);
        }
        itemsByPosition.get(item.client_position_id)!.push(item);
      }

      // ОБЩАЯ СТАТИСТИКА ПО ТИПАМ
      const globalCounters: any = {};
      let nullMatCount = 0;
      let nullWorkCount = 0;
      let nullMatSum = 0;
      const nullItems: any[] = [];

      for (const item of allBoqItems) {
        const key = `${item.boq_item_type}${item.material_type ? `_${item.material_type}` : ''}`;
        if (!globalCounters[key]) {
          globalCounters[key] = { count: 0, base: 0, mat: 0, work: 0 };
        }
        globalCounters[key].count++;
        globalCounters[key].base += item.total_amount || 0;
        globalCounters[key].mat += item.total_commercial_material_cost || 0;
        globalCounters[key].work += item.total_commercial_work_cost || 0;

        // Проверка на NULL
        if (item.total_commercial_material_cost === null || item.total_commercial_material_cost === undefined) {
          nullMatCount++;
          nullMatSum += item.total_amount || 0;
          nullItems.push({
            id: item.id,
            type: item.boq_item_type,
            material_type: item.material_type,
            base: item.total_amount,
            position_id: item.client_position_id
          });
        }
        if (item.total_commercial_work_cost === null || item.total_commercial_work_cost === undefined) {
          nullWorkCount++;
        }
      }

      // Проверка сумм
      const totalMatFromData = allBoqItems.reduce((sum, item) => sum + (item.total_commercial_material_cost || 0), 0);
      const totalWorkFromData = allBoqItems.reduce((sum, item) => sum + (item.total_commercial_work_cost || 0), 0);
      const totalCommercialFromData = totalMatFromData + totalWorkFromData;

      // Проверка на элементы с нулевыми коммерческими стоимостями
      const zeroCommercialItems = allBoqItems.filter(item => {
        const mat = item.total_commercial_material_cost || 0;
        const work = item.total_commercial_work_cost || 0;
        const base = item.total_amount || 0;
        return (mat + work) === 0 && base > 0;
      });

      console.log('\n=== ПРОВЕРКА NULL ЗНАЧЕНИЙ ===');
      console.log('Элементов с NULL mat:', nullMatCount, 'база:', nullMatSum.toLocaleString('ru-RU'));
      console.log('Элементов с NULL work:', nullWorkCount);
      console.log('Всего элементов:', allBoqItems.length);
      if (nullItems.length > 0) {
        console.log('Элементы с NULL:');
        console.table(nullItems);
      }

      console.log('\n=== ЭЛЕМЕНТЫ С НУЛЕВОЙ КОММЕРЧЕСКОЙ ===');
      console.log('Элементов с commercial=0 при base>0:', zeroCommercialItems.length);
      if (zeroCommercialItems.length > 0) {
        const zeroSum = zeroCommercialItems.reduce((sum, item) => sum + (item.total_amount || 0), 0);
        console.log('Сумма базовой стоимости:', zeroSum.toLocaleString('ru-RU'));
        console.table(zeroCommercialItems.slice(0, 10).map(item => ({
          id: item.id?.substring(0, 8) + '...',
          type: item.boq_item_type,
          material_type: item.material_type,
          base: item.total_amount,
          mat: item.total_commercial_material_cost,
          work: item.total_commercial_work_cost
        })));
      }

      console.log('\n=== ПРЯМАЯ СУММА ИЗ ДАННЫХ ===');
      console.log('Сумма mat:', totalMatFromData.toLocaleString('ru-RU'));
      console.log('Сумма work:', totalWorkFromData.toLocaleString('ru-RU'));
      console.log('mat + work:', totalCommercialFromData.toLocaleString('ru-RU'));
      console.log('Ожидается:', '5,613,631,822');
      console.log('Разница:', (5613631822 - totalCommercialFromData).toLocaleString('ru-RU'));

      console.log('\n=== СТАТИСТИКА ПО ТИПАМ ЭЛЕМЕНТОВ ===');
      console.log(globalCounters);

      // Обрабатываем позиции с уже загруженными данными
      const positionsWithCosts = (clientPositions || []).map((position) => {
        const boqItems = itemsByPosition.get(position.id) || [];

        // Суммируем стоимости
        let baseTotal = 0;
        let commercialTotal = 0;
        let materialCostTotal = 0;
        let workCostTotal = 0;
        let itemsCount = 0;

        for (const item of boqItems) {
          const itemBase = item.total_amount || 0;
          const itemMaterial = item.total_commercial_material_cost || 0;
          const itemWork = item.total_commercial_work_cost || 0;

          baseTotal += itemBase;
          commercialTotal += itemMaterial + itemWork; // ПОЛНАЯ коммерческая

          // Материалы КП = коммерческая стоимость материалов (с НДС)
          materialCostTotal += itemMaterial;
          // Работы КП = коммерческая стоимость работ (с НДС)
          workCostTotal += itemWork;

          itemsCount++;
        }
        const commercialTotalFinal = commercialTotal;

        // Рассчитываем коэффициент наценки
        const markupCoefficient = baseTotal > 0
          ? commercialTotalFinal / baseTotal
          : 1;

        return {
          ...position,
          base_total: baseTotal,
          commercial_total: commercialTotalFinal,
          material_cost_total: materialCostTotal,
          work_cost_total: workCostTotal,
          markup_percentage: markupCoefficient,
          items_count: itemsCount
        } as PositionWithCommercialCost;
      });

      const loadTime = Date.now() - startTime;

      // ИТОГОВАЯ СТАТИСТИКА
      const totalMaterials = positionsWithCosts.reduce((sum, p) => sum + (p.material_cost_total || 0), 0);
      const totalWorks = positionsWithCosts.reduce((sum, p) => sum + (p.work_cost_total || 0), 0);
      const totalCommercial = positionsWithCosts.reduce((sum, p) => sum + (p.commercial_total || 0), 0);
      const totalBase = positionsWithCosts.reduce((sum, p) => sum + (p.base_total || 0), 0);

      console.log('\n=== ИТОГОВАЯ СТАТИСТИКА КП ===');
      console.log('Базовая стоимость:', totalBase.toLocaleString('ru-RU'));
      console.log('Материалы КП:', totalMaterials.toLocaleString('ru-RU'));
      console.log('Работы КП:', totalWorks.toLocaleString('ru-RU'));
      console.log('Коммерческая ИТОГО:', totalCommercial.toLocaleString('ru-RU'));
      console.log('Проверка (мат+раб):', (totalMaterials + totalWorks).toLocaleString('ru-RU'));
      console.log(`✅ Данные загружены за ${loadTime}ms`);

      setPositions(positionsWithCosts);
    } catch (error) {
      console.error('Ошибка загрузки позиций:', error);
      message.error('Не удалось загрузить позиции заказчика');
    } finally {
      setLoading(false);
    }
  };

  const handleTacticChange = (tacticId: string) => {
    setSelectedTacticId(tacticId);
    // Проверяем, изменилась ли тактика относительно сохраненной в тендере
    const tender = tenders.find(t => t.id === selectedTenderId);
    setTacticChanged(tacticId !== tender?.markup_tactic_id);
  };

  // Рассчитываем итоговые суммы
  const totals = useMemo(() => {
    const baseTotal = positions.reduce((sum, pos) => sum + (pos.base_total || 0), 0);
    const commercialTotal = positions.reduce((sum, pos) => sum + (pos.commercial_total || 0), 0);
    const difference = commercialTotal - baseTotal;
    const markupPercentage = baseTotal > 0 ? (difference / baseTotal) * 100 : 0;

    return {
      base: baseTotal,
      commercial: commercialTotal,
      difference,
      markupPercentage
    };
  }, [positions]);

  return {
    loading,
    calculating,
    setCalculating,
    tenders,
    selectedTenderId,
    setSelectedTenderId,
    selectedTenderTitle,
    setSelectedTenderTitle,
    selectedVersion,
    setSelectedVersion,
    positions,
    setPositions,
    markupTactics,
    selectedTacticId,
    setSelectedTacticId,
    tacticChanged,
    setTacticChanged,
    loadTenders,
    loadPositions,
    handleTacticChange,
    totals,
    referenceTotal
  };
}
