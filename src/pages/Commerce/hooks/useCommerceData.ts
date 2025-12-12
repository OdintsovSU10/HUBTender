/**
 * Хук для загрузки и управления данными коммерции
 */

import { useState, useEffect, useMemo } from 'react';
import { message } from 'antd';
import { supabase } from '../../../lib/supabase';
import type { Tender } from '../../../lib/supabase';
import type { PositionWithCommercialCost, MarkupTactic } from '../types';
import { checkCommercialData } from '../../../utils/checkCommercialData';
import { checkDatabaseStructure } from '../../../utils/checkDatabaseStructure';

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

  // Загрузка списка тендеров и тактик
  useEffect(() => {
    loadTenders();
    loadMarkupTactics();
    // В dev режиме проверяем структуру БД при первой загрузке
    if (process.env.NODE_ENV === 'development') {
      checkDatabaseStructure();
    }
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

    // Диагностика данных (только в dev режиме)
    if (process.env.NODE_ENV === 'development') {
      checkCommercialData(tenderId);
    }

    try {
      console.log('🔄 Загрузка позиций для тендера:', tenderId);
      const startTime = Date.now();

      // Загружаем позиции заказчика
      const { data: clientPositions, error: posError } = await supabase
        .from('client_positions')
        .select('*')
        .eq('tender_id', tenderId)
        .order('position_number');

      if (posError) throw posError;
      console.log(`📋 Загружено позиций: ${clientPositions?.length || 0}`);

      // Загружаем ВСЕ BOQ элементы для тендера с батчингом (Supabase лимит 1000 строк)
      let allBoqItems: any[] = [];
      let from = 0;
      const batchSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from('boq_items')
          .select('client_position_id, total_amount, total_commercial_material_cost, total_commercial_work_cost')
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

      // Группируем элементы по позициям в памяти
      const itemsByPosition = new Map<string, typeof allBoqItems>();
      for (const item of allBoqItems) {
        if (!itemsByPosition.has(item.client_position_id)) {
          itemsByPosition.set(item.client_position_id, []);
        }
        itemsByPosition.get(item.client_position_id)!.push(item);
      }

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
          const itemCommercial = itemMaterial + itemWork;

          baseTotal += itemBase;
          commercialTotal += itemCommercial;
          materialCostTotal += itemMaterial;
          workCostTotal += itemWork;
          itemsCount++;
        }

        // Рассчитываем коэффициент наценки
        const markupCoefficient = baseTotal > 0
          ? commercialTotal / baseTotal
          : 1;

        return {
          ...position,
          base_total: baseTotal,
          commercial_total: commercialTotal,
          material_cost_total: materialCostTotal,
          work_cost_total: workCostTotal,
          markup_percentage: markupCoefficient,
          items_count: itemsCount
        } as PositionWithCommercialCost;
      });

      const loadTime = Date.now() - startTime;
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
    totals
  };
}
