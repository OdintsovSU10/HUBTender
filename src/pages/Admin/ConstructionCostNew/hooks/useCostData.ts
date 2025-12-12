import { useState, useEffect } from 'react';
import { message } from 'antd';
import { supabase, type Tender } from '../../../../lib/supabase';

export interface CostRow {
  key: string;
  detail_cost_category_id?: string;
  cost_category_name: string;
  detail_category_name: string;
  location_name: string;
  volume: number;
  unit: string;
  materials_cost: number;
  works_cost: number;
  sub_materials_cost: number;
  sub_works_cost: number;
  materials_comp_cost: number;
  works_comp_cost: number;
  total_cost: number;
  cost_per_unit: number;
  order_num?: number;
  is_category?: boolean;
  children?: CostRow[];
}

export interface TenderOption {
  value: string;
  label: string;
  clientName: string;
}

export const useCostData = () => {
  const [tenders, setTenders] = useState<Tender[]>([]);
  const [selectedTenderId, setSelectedTenderId] = useState<string | null>(null);
  const [selectedTenderTitle, setSelectedTenderTitle] = useState<string | null>(null);
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<CostRow[]>([]);
  const [costType, setCostType] = useState<'base' | 'commercial'>('base');

  const getTenderTitles = (): TenderOption[] => {
    const uniqueTitles = new Map<string, TenderOption>();

    tenders.forEach(tender => {
      if (!uniqueTitles.has(tender.title)) {
        uniqueTitles.set(tender.title, {
          value: tender.title,
          label: tender.title,
          clientName: tender.client_name,
        });
      }
    });

    return Array.from(uniqueTitles.values());
  };

  const getVersionsForTitle = (title: string) => {
    return tenders
      .filter(t => t.title === title)
      .map(t => ({
        value: t.version || 1,
        label: `Версия ${t.version || 1}`,
      }));
  };

  const handleTenderTitleChange = (title: string) => {
    setSelectedTenderTitle(title);
    setSelectedVersion(null);
    setSelectedTenderId(null);
    setData([]);
  };

  const handleVersionChange = (version: number) => {
    setSelectedVersion(version);
    const tender = tenders.find(t => t.title === selectedTenderTitle && t.version === version);
    if (tender) {
      setSelectedTenderId(tender.id);
    }
  };

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

  const fetchConstructionCosts = async () => {
    if (!selectedTenderId) return;

    setLoading(true);
    try {
      const { data: categories, error: catError } = await supabase
        .from('detail_cost_categories')
        .select(`
          id,
          name,
          unit,
          location,
          order_num,
          cost_categories (name)
        `)
        .order('order_num', { ascending: true });

      if (catError) throw catError;

      const { data: volumes, error: volError } = await supabase
        .from('construction_cost_volumes')
        .select('*')
        .eq('tender_id', selectedTenderId);

      if (volError) throw volError;

      const volumeMap = new Map(
        (volumes || []).map(v => [v.detail_cost_category_id, v.volume || 0])
      );

      // Загружаем ВСЕ BOQ элементы с батчингом (Supabase лимит 1000 строк)
      let boqItems: any[] = [];
      let from = 0;
      const batchSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from('boq_items')
          .select(`
            detail_cost_category_id,
            boq_item_type,
            ${costType === 'base' ? 'total_amount' : 'total_commercial_material_cost, total_commercial_work_cost'},
            client_positions!inner(tender_id)
          `)
          .eq('client_positions.tender_id', selectedTenderId)
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

      const costMap = new Map<string, {
        materials: number;
        works: number;
        subMaterials: number;
        subWorks: number;
        materialsComp: number;
        worksComp: number;
      }>();

      (boqItems || []).forEach((item: any) => {
        const catId = item.detail_cost_category_id || 'uncategorized';

        if (!costMap.has(catId)) {
          costMap.set(catId, { materials: 0, works: 0, subMaterials: 0, subWorks: 0, materialsComp: 0, worksComp: 0 });
        }

        const costs = costMap.get(catId)!;

        if (costType === 'base') {
          const amount = item.total_amount || 0;
          switch (item.boq_item_type) {
            case 'мат':
              costs.materials += amount;
              break;
            case 'суб-мат':
              costs.subMaterials += amount;
              break;
            case 'мат-комп.':
              costs.materialsComp += amount;
              break;
            case 'раб':
              costs.works += amount;
              break;
            case 'суб-раб':
              costs.subWorks += amount;
              break;
            case 'раб-комп.':
              costs.worksComp += amount;
              break;
          }
        } else {
          const materialCost = item.total_commercial_material_cost || 0;
          const workCost = item.total_commercial_work_cost || 0;

          switch (item.boq_item_type) {
            case 'мат':
              costs.materials += materialCost;
              costs.works += workCost;
              break;
            case 'суб-мат':
              costs.subMaterials += materialCost;
              costs.subWorks += workCost;
              break;
            case 'мат-комп.':
              costs.materialsComp += materialCost;
              costs.worksComp += workCost;
              break;
            case 'раб':
              costs.materials += materialCost;
              costs.works += workCost;
              break;
            case 'суб-раб':
              costs.subMaterials += materialCost;
              costs.subWorks += workCost;
              break;
            case 'раб-комп.':
              costs.materialsComp += materialCost;
              costs.worksComp += workCost;
              break;
          }
        }
      });

      const categoryMap = new Map<string, CostRow>();

      (categories || []).forEach((cat: any) => {
        const volume = volumeMap.get(cat.id) || 0;
        const costs = costMap.get(cat.id) || { materials: 0, works: 0, subMaterials: 0, subWorks: 0, materialsComp: 0, worksComp: 0 };
        const totalCost = costs.materials + costs.works + costs.subMaterials + costs.subWorks + costs.materialsComp + costs.worksComp;
        const costPerUnit = volume > 0 ? totalCost / volume : 0;

        const categoryName = cat.cost_categories?.name || '';

        const detailRow: CostRow = {
          key: cat.id,
          detail_cost_category_id: cat.id,
          cost_category_name: categoryName,
          detail_category_name: cat.name,
          location_name: cat.location || '',
          volume,
          unit: cat.unit,
          materials_cost: costs.materials,
          works_cost: costs.works,
          sub_materials_cost: costs.subMaterials,
          sub_works_cost: costs.subWorks,
          materials_comp_cost: costs.materialsComp,
          works_comp_cost: costs.worksComp,
          total_cost: totalCost,
          cost_per_unit: costPerUnit,
          order_num: cat.order_num,
        };

        if (!categoryMap.has(categoryName)) {
          categoryMap.set(categoryName, {
            key: `category-${categoryName}`,
            cost_category_name: categoryName,
            detail_category_name: '',
            location_name: '',
            volume: 0,
            unit: '',
            materials_cost: 0,
            works_cost: 0,
            sub_materials_cost: 0,
            sub_works_cost: 0,
            materials_comp_cost: 0,
            works_comp_cost: 0,
            total_cost: 0,
            cost_per_unit: 0,
            is_category: true,
            children: [],
            order_num: cat.order_num,
          });
        }

        const categoryRow = categoryMap.get(categoryName)!;
        categoryRow.children!.push(detailRow);

        categoryRow.materials_cost += costs.materials;
        categoryRow.works_cost += costs.works;
        categoryRow.sub_materials_cost += costs.subMaterials;
        categoryRow.sub_works_cost += costs.subWorks;
        categoryRow.materials_comp_cost += costs.materialsComp;
        categoryRow.works_comp_cost += costs.worksComp;
        categoryRow.total_cost += totalCost;
      });

      // Добавляем категорию "Не распределено" если есть items без detail_cost_category_id
      if (costMap.has('uncategorized')) {
        const uncategorizedCosts = costMap.get('uncategorized')!;
        const uncategorizedTotal = uncategorizedCosts.materials + uncategorizedCosts.works +
          uncategorizedCosts.subMaterials + uncategorizedCosts.subWorks +
          uncategorizedCosts.materialsComp + uncategorizedCosts.worksComp;

        if (uncategorizedTotal > 0) {
          categoryMap.set('Не распределено', {
            key: 'category-uncategorized',
            cost_category_name: 'Не распределено',
            detail_category_name: '',
            location_name: '',
            volume: 0,
            unit: '',
            materials_cost: uncategorizedCosts.materials,
            works_cost: uncategorizedCosts.works,
            sub_materials_cost: uncategorizedCosts.subMaterials,
            sub_works_cost: uncategorizedCosts.subWorks,
            materials_comp_cost: uncategorizedCosts.materialsComp,
            works_comp_cost: uncategorizedCosts.worksComp,
            total_cost: uncategorizedTotal,
            cost_per_unit: 0,
            is_category: true,
            children: [{
              key: 'uncategorized-detail',
              cost_category_name: 'Не распределено',
              detail_category_name: 'Элементы без затрат',
              location_name: '-',
              volume: 0,
              unit: '-',
              materials_cost: uncategorizedCosts.materials,
              works_cost: uncategorizedCosts.works,
              sub_materials_cost: uncategorizedCosts.subMaterials,
              sub_works_cost: uncategorizedCosts.subWorks,
              materials_comp_cost: uncategorizedCosts.materialsComp,
              works_comp_cost: uncategorizedCosts.worksComp,
              total_cost: uncategorizedTotal,
              cost_per_unit: 0,
            }],
            order_num: 999999, // В конец списка
          });
        }
      }

      let rows: CostRow[] = Array.from(categoryMap.values()).sort((a, b) =>
        (a.order_num || 0) - (b.order_num || 0)
      );

      rows = rows.map(category => ({
        ...category,
        children: category.children?.filter(child => child.total_cost > 0)
      })).filter(category =>
        category.children && category.children.length > 0
      );

      setData(rows);
    } catch (error: any) {
      console.error('Ошибка загрузки затрат:', error);
      message.error(`Не удалось загрузить данные затрат: ${error.message || 'Неизвестная ошибка'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleVolumeChange = async (value: number | null, record: CostRow) => {
    if (value === null || value === record.volume) return;

    try {
      const { error } = await supabase
        .from('construction_cost_volumes')
        .upsert({
          tender_id: selectedTenderId!,
          detail_cost_category_id: record.detail_cost_category_id,
          volume: value,
        }, {
          onConflict: 'tender_id,detail_cost_category_id'
        });

      if (error) throw error;

      message.success('Объем сохранен');
      fetchConstructionCosts();
    } catch (error: any) {
      message.error('Ошибка сохранения: ' + error.message);
    }
  };

  useEffect(() => {
    fetchTenders();
  }, []);

  useEffect(() => {
    if (selectedTenderId) {
      fetchConstructionCosts();
    }
  }, [selectedTenderId, costType]);

  return {
    tenders,
    selectedTenderId,
    selectedTenderTitle,
    selectedVersion,
    loading,
    data,
    costType,
    setCostType,
    setSelectedTenderId,
    setSelectedTenderTitle,
    setSelectedVersion,
    setData,
    getTenderTitles,
    getVersionsForTitle,
    handleTenderTitleChange,
    handleVersionChange,
    fetchConstructionCosts,
    handleVolumeChange,
  };
};
