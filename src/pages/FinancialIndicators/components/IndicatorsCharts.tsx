import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Typography, Table, Button, Spin } from 'antd';
import { supabase } from '../../../lib/supabase';

const { Text, Title } = Typography;
import { Bar, Doughnut } from 'react-chartjs-2';
import { useTheme } from '../../../contexts/ThemeContext';
import type { IndicatorRow } from '../hooks/useFinancialData';

interface IndicatorsChartsProps {
  data: IndicatorRow[];
  spTotal: number;
  formatNumber: (value: number | undefined) => string;
  selectedTenderId: string | null;
}

interface CategoryBreakdown {
  category_name: string;
  detail_name: string;
  location_name: string;
  total_amount: number;
  works_amount: number;
  materials_amount: number;
}

interface DrillDownLevel {
  type: 'root' | 'direct_costs' | 'markups' | 'indicator' | 'profit_breakdown' | 'ooz_breakdown' | 'cost_growth_breakdown';
  indicatorName?: string;
  rowNumber?: number;
}

export const IndicatorsCharts: React.FC<IndicatorsChartsProps> = ({
  data,
  spTotal,
  formatNumber,
  selectedTenderId,
}) => {
  const { theme: currentTheme } = useTheme();
  const [selectedIndicator, setSelectedIndicator] = useState<number | null>(null);
  const [breakdownData, setBreakdownData] = useState<CategoryBreakdown[]>([]);
  const [loadingBreakdown, setLoadingBreakdown] = useState(false);
  const [drillDownPath, setDrillDownPath] = useState<DrillDownLevel[]>([{ type: 'root' }]);

  // Справочная информация
  const [referenceInfo, setReferenceInfo] = useState<{
    monolithPerM3: number;
    visPerM2: number;
    facadePerM2: number;
  }>({
    monolithPerM3: 0,
    visPerM2: 0,
    facadePerM2: 0,
  });

  // Рассчитываем общую площадь для отображения (unused, but kept for reference)
  // const totalArea = spTotal + customerTotal;

  // Данные для круговой диаграммы - адаптивные в зависимости от уровня drill-down
  const getCategoriesData = () => {
    const currentLevel = drillDownPath[drillDownPath.length - 1];

    // Уровень 1 (корень): Показываем только "Прямые затраты" и "Наценки"
    if (currentLevel.type === 'root') {
      if (data.length === 0) return null;

      // Фильтруем данные
      const baseData = data.filter(d =>
        !d.is_header &&
        !d.is_total &&
        d.row_number >= 2 &&
        d.row_number <= 14
      );

      // Прямые затраты: строки 2-6
      const directCosts = baseData
        .filter(d => d.row_number >= 2 && d.row_number <= 6)
        .reduce((sum, d) => sum + (d.total_cost || 0), 0);

      // Наценки: строки 7-14
      const markups = baseData
        .filter(d => d.row_number >= 7 && d.row_number <= 14)
        .reduce((sum, d) => sum + (d.total_cost || 0), 0);

      // Сортируем по убыванию
      const items = [
        { label: 'Прямые затраты', value: directCosts, color: '#1890ff' },
        { label: 'Наценки', value: markups, color: '#52c41a' },
      ].sort((a, b) => b.value - a.value);

      return {
        labels: items.map(item => item.label),
        datasets: [
          {
            data: items.map(item => item.value),
            backgroundColor: items.map(item => item.color),
            borderWidth: 2,
            borderColor: currentTheme === 'dark' ? '#1f1f1f' : '#ffffff',
          },
        ],
      };
    }

    // Уровень 2: Детализация прямых затрат
    if (currentLevel.type === 'direct_costs') {
      if (data.length === 0) return null;

      const directCostsData = data.filter(d =>
        !d.is_header &&
        !d.is_total &&
        d.row_number >= 2 &&
        d.row_number <= 6
      );

      const colors = [
        '#ff4d4f', // Субподряд
        '#1890ff', // Работы + Материалы СУ-10
        '#52c41a', // Служба механизации
        '#faad14', // МБП+ГСМ
        '#722ed1', // Гарантийный период
      ];

      // Создаем массив с цветами и сортируем по убыванию стоимости
      const items = directCostsData.map((d, idx) => ({
        label: d.indicator_name,
        value: d.total_cost || 0,
        color: colors[idx] || '#1890ff',
        originalIndex: idx,
      })).sort((a, b) => b.value - a.value);

      return {
        labels: items.map(item => item.label),
        datasets: [
          {
            data: items.map(item => item.value),
            backgroundColor: items.map(item => item.color),
            borderWidth: 2,
            borderColor: currentTheme === 'dark' ? '#1f1f1f' : '#ffffff',
          },
        ],
      };
    }

    // Уровень 2: Детализация наценок
    if (currentLevel.type === 'markups') {
      if (data.length === 0) return null;

      const markupsData = data.filter(d =>
        !d.is_header &&
        !d.is_total &&
        d.row_number >= 7 &&
        d.row_number <= 14
      );

      // Находим строки прибыли и объединяем их
      const profitRow = markupsData.find(d => d.row_number === 13);
      const profitSubRow = markupsData.find(d => d.row_number === 14);

      const combinedProfit = profitRow && profitSubRow ? {
        ...profitRow,
        indicator_name: 'Прибыль',
        total_cost: (profitRow.total_cost || 0) + (profitSubRow.total_cost || 0),
        row_number: 13,
      } : profitRow;

      // Находим строки ООЗ и объединяем их
      const oozRow = markupsData.find(d => d.row_number === 10);
      const oozSubRow = markupsData.find(d => d.row_number === 11);

      const combinedOOZ = oozRow && oozSubRow ? {
        ...oozRow,
        indicator_name: 'ООЗ',
        total_cost: (oozRow.total_cost || 0) + (oozSubRow.total_cost || 0),
        row_number: 10,
      } : oozRow;

      const filteredMarkups = markupsData
        .filter(d => d.row_number !== 14 && d.row_number !== 11) // Исключаем "Прибыль субподряд" и "ООЗ Субподряд"
        .map(d => {
          if (d.row_number === 13) return combinedProfit;
          if (d.row_number === 10) return combinedOOZ;
          return d;
        })
        .filter(Boolean);

      const colors = [
        '#13c2c2', // 1,6
        '#fa8c16', // Рост стоимости
        '#eb2f96', // Непредвиденные
        '#52c41a', // ООЗ (объединенная)
        '#faad14', // ОФЗ
        '#1890ff', // Прибыль (объединенная)
      ];

      // Создаем массив с цветами и сортируем по убыванию стоимости
      const items = filteredMarkups.map((d, idx) => ({
        label: d!.indicator_name,
        value: d!.total_cost || 0,
        color: colors[idx] || '#1890ff',
        originalData: d,
      })).sort((a, b) => b.value - a.value);

      return {
        labels: items.map(item => item.label),
        datasets: [
          {
            data: items.map(item => item.value),
            backgroundColor: items.map(item => item.color),
            borderWidth: 2,
            borderColor: currentTheme === 'dark' ? '#1f1f1f' : '#ffffff',
          },
        ],
      };
    }

    // Уровень 2: Показываем drill-down для прибыли
    if (currentLevel.type === 'profit_breakdown') {
      const profitRow = data.find(d => d.row_number === 13);
      const profitSubRow = data.find(d => d.row_number === 14);

      if (profitRow && profitSubRow) {
        // Сортируем по убыванию стоимости
        const items = [
          { label: 'Прибыль', value: profitRow.total_cost || 0, color: '#1890ff' },
          { label: 'Прибыль субподряд', value: profitSubRow.total_cost || 0, color: '#40a9ff' },
        ].sort((a, b) => b.value - a.value);

        return {
          labels: items.map(item => item.label),
          datasets: [
            {
              data: items.map(item => item.value),
              backgroundColor: items.map(item => item.color),
              borderWidth: 2,
              borderColor: currentTheme === 'dark' ? '#1f1f1f' : '#ffffff',
            },
          ],
        };
      }
    }

    // Уровень 3: Показываем drill-down для ООЗ
    if (currentLevel.type === 'ooz_breakdown') {
      const oozRow = data.find(d => d.row_number === 10);
      const oozSubRow = data.find(d => d.row_number === 11);

      if (oozRow && oozSubRow) {
        // Сортируем по убыванию стоимости
        const items = [
          { label: 'ООЗ', value: oozRow.total_cost || 0, color: '#52c41a' },
          { label: 'ООЗ Субподряд', value: oozSubRow.total_cost || 0, color: '#95de64' },
        ].sort((a, b) => b.value - a.value);

        return {
          labels: items.map(item => item.label),
          datasets: [
            {
              data: items.map(item => item.value),
              backgroundColor: items.map(item => item.color),
              borderWidth: 2,
              borderColor: currentTheme === 'dark' ? '#1f1f1f' : '#ffffff',
            },
          ],
        };
      }
    }

    // Уровень 3: Показываем drill-down для роста стоимости
    if (currentLevel.type === 'cost_growth_breakdown') {
      // Получаем данные из промежуточных расчетов (не из tooltip)
      const costGrowthRow = data.find(d => d.row_number === 8);

      if (costGrowthRow) {
        // Используем промежуточные значения расчетов
        const worksSu10Growth = costGrowthRow.works_su10_growth || 0;
        const materialsSu10Growth = costGrowthRow.materials_su10_growth || 0;
        const worksSubGrowth = costGrowthRow.works_sub_growth || 0;
        const materialsSubGrowth = costGrowthRow.materials_sub_growth || 0;

        // Сортируем по убыванию стоимости
        const items = [
          { label: 'Рост работ СУ-10', value: worksSu10Growth, color: '#fa8c16' },
          { label: 'Рост материалов СУ-10', value: materialsSu10Growth, color: '#faad14' },
          { label: 'Рост субподрядных работ', value: worksSubGrowth, color: '#ff7a45' },
          { label: 'Рост субподрядных материалов', value: materialsSubGrowth, color: '#ffa940' },
        ].sort((a, b) => b.value - a.value);

        return {
          labels: items.map(item => item.label),
          datasets: [
            {
              data: items.map(item => item.value),
              backgroundColor: items.map(item => item.color),
              borderWidth: 2,
              borderColor: currentTheme === 'dark' ? '#1f1f1f' : '#ffffff',
            },
          ],
        };
      }
    }

    // Уровень 2: Показываем детализацию по категориям для выбранного индикатора
    if (currentLevel.type === 'indicator') {
      // Если есть загруженные данные breakdown, показываем их
      if (breakdownData.length > 0) {
        const colors = [
          '#ff4d4f', '#1890ff', '#52c41a', '#faad14', '#722ed1',
          '#13c2c2', '#fa8c16', '#eb2f96', '#95de64', '#40a9ff',
          '#f759ab', '#fadb14', '#a0d911', '#36cfc9', '#597ef7',
        ];

        return {
          labels: breakdownData.map(item => item.category_name),
          datasets: [
            {
              data: breakdownData.map(item => item.total_amount),
              backgroundColor: breakdownData.map((_, idx) => colors[idx % colors.length]),
              borderWidth: 2,
              borderColor: currentTheme === 'dark' ? '#1f1f1f' : '#ffffff',
            },
          ],
        };
      }

      // Проверяем, есть ли детализация для этого показателя
      if (!hasDetailedBreakdown(currentLevel.rowNumber || 0)) {
        // Для показателей без детализации возвращаем null (будет показано сообщение)
        return null;
      }
    }

    return null;
  };

  // Проверка, доступна ли детализация для данного показателя
  const hasDetailedBreakdown = (rowNumber: number): boolean => {
    // Детализация доступна только для показателей, привязанных к boq_items
    return rowNumber === 2 || rowNumber === 3; // Субподряд или Работы+Материалы СУ-10
  };

  // Загрузка детализации по категориям затрат для выбранного индикатора
  const fetchCategoryBreakdown = async (rowNumber: number) => {
    if (!selectedTenderId) return;

    setLoadingBreakdown(true);
    try {
      // Проверяем, доступна ли детализация
      if (!hasDetailedBreakdown(rowNumber)) {
        // Для показателей без привязки к BOQ показываем пустой массив
        setBreakdownData([]);
        setLoadingBreakdown(false);
        return;
      }

      // Определяем тип элементов для фильтрации
      let boqItemTypes: string[] = [];

      switch (rowNumber) {
        case 2: // Субподряд
          boqItemTypes = ['суб-раб', 'суб-мат'];
          break;
        case 3: // Работы + Материалы СУ-10
          boqItemTypes = ['раб', 'мат'];
          break;
        default:
          boqItemTypes = [];
      }

      // Один запрос с вложенной структурой - получаем категорию, вид и локализацию
      const { data: boqItems, error } = await supabase
        .from('boq_items')
        .select(`
          boq_item_type,
          total_amount,
          detail_cost_category:detail_cost_categories(
            id,
            name,
            location,
            cost_category:cost_categories(id, name)
          ),
          client_position:client_positions!inner(tender_id)
        `)
        .eq('client_position.tender_id', selectedTenderId)
        .in('boq_item_type', boqItemTypes);

      if (error) throw error;

      if (!boqItems || boqItems.length === 0) {
        setBreakdownData([]);
        return;
      }

      // Группировка по категории + вид + локализация
      const categoryMap = new Map<string, CategoryBreakdown>();

      boqItems.forEach(item => {
        const detailCategory = Array.isArray(item.detail_cost_category) ? item.detail_cost_category[0] : item.detail_cost_category;
        const costCategory = detailCategory?.cost_category;
        const categoryObj = Array.isArray(costCategory) ? costCategory[0] : costCategory;

        const categoryName = categoryObj?.name || 'Без категории';
        const detailName = detailCategory?.name || 'Без вида';
        const locationName = detailCategory?.location || 'Без локализации';
        const amount = item.total_amount || 0;
        const isWork = item.boq_item_type === 'раб' || item.boq_item_type === 'суб-раб' || item.boq_item_type === 'раб-комп.';

        // Ключ: категория + вид + локализация для группировки
        const key = `${categoryName}|${detailName}|${locationName}`;

        if (!categoryMap.has(key)) {
          categoryMap.set(key, {
            category_name: categoryName,
            detail_name: detailName,
            location_name: locationName,
            total_amount: 0,
            works_amount: 0,
            materials_amount: 0,
          });
        }

        const cat = categoryMap.get(key)!;
        cat.total_amount += amount;

        if (isWork) {
          cat.works_amount += amount;
        } else {
          cat.materials_amount += amount;
        }
      });

      const breakdown = Array.from(categoryMap.values())
        .sort((a, b) => b.total_amount - a.total_amount);

      setBreakdownData(breakdown);
    } catch (error) {
      console.error('Ошибка загрузки детализации:', error);
      setBreakdownData([]);
    } finally {
      setLoadingBreakdown(false);
    }
  };

  // Загрузка справочной информации
  const fetchReferenceInfo = async () => {
    if (!selectedTenderId) return;

    try {
      // Получаем все boq_items для текущего тендера с категориями затрат
      const { data: boqItems, error } = await supabase
        .from('boq_items')
        .select(`
          boq_item_type,
          quantity,
          total_amount,
          detail_cost_category:detail_cost_categories(
            id,
            name,
            cost_category:cost_categories(id, name)
          ),
          client_position:client_positions!inner(tender_id)
        `)
        .eq('client_position.tender_id', selectedTenderId);

      if (error) throw error;
      if (!boqItems || boqItems.length === 0) return;

      let monolithVolume = 0;
      let monolithCost = 0;
      let visVolume = 0;
      let visCost = 0;
      let facadeVolume = 0;
      let facadeCost = 0;

      boqItems.forEach(item => {
        const detailCategory = Array.isArray(item.detail_cost_category) ? item.detail_cost_category[0] : item.detail_cost_category;
        const costCategory = detailCategory?.cost_category;
        const categoryObj = Array.isArray(costCategory) ? costCategory[0] : costCategory;
        const categoryName = categoryObj?.name || '';

        const quantity = item.quantity || 0;
        const totalAmount = item.total_amount || 0;

        // Монолитные работы (м³)
        if (categoryName === 'МОНОЛИТ') {
          monolithVolume += quantity;
          monolithCost += totalAmount;
        }
        // ВИСы (м²) - три категории
        else if (
          categoryName === 'ВИС / Электрические системы' ||
          categoryName === 'ВИС / Механические системы' ||
          categoryName === 'ВИС / Слаботочные системы'
        ) {
          visVolume += quantity;
          visCost += totalAmount;
        }
        // Фасады (м²)
        else if (categoryName === 'ФАСАДНЫЕ РАБОТЫ') {
          facadeVolume += quantity;
          facadeCost += totalAmount;
        }
      });

      setReferenceInfo({
        monolithPerM3: monolithVolume > 0 ? monolithCost / monolithVolume : 0,
        visPerM2: visVolume > 0 ? visCost / visVolume : 0,
        facadePerM2: facadeVolume > 0 ? facadeCost / facadeVolume : 0,
      });
    } catch (error) {
      console.error('Ошибка загрузки справочной информации:', error);
    }
  };

  // Обработчик клика на сегмент круговой диаграммы
  const handlePieClick = async (_event: any, elements: any[]) => {
    if (elements.length === 0) return;

    const index = elements[0].index;
    const currentLevel = drillDownPath[drillDownPath.length - 1];

    // Уровень 1 (корень): Клик по "Прямые затраты" или "Наценки"
    if (currentLevel.type === 'root') {
      if (index === 0) {
        // Прямые затраты
        setDrillDownPath([
          ...drillDownPath,
          {
            type: 'direct_costs',
            indicatorName: 'Прямые затраты',
          },
        ]);
      } else if (index === 1) {
        // Наценки
        setDrillDownPath([
          ...drillDownPath,
          {
            type: 'markups',
            indicatorName: 'Наценки',
          },
        ]);
      }
      return;
    }

    // Уровень 2: Клик по конкретному индикатору в Прямых затратах
    if (currentLevel.type === 'direct_costs') {
      const directCostsData = data.filter(d =>
        !d.is_header &&
        !d.is_total &&
        d.row_number >= 2 &&
        d.row_number <= 6
      );

      const clickedRow = directCostsData[index];

      if (clickedRow) {
        setSelectedIndicator(clickedRow.row_number);
        setLoadingBreakdown(true);

        await fetchCategoryBreakdown(clickedRow.row_number);

        setDrillDownPath([
          ...drillDownPath,
          {
            type: 'indicator',
            indicatorName: clickedRow.indicator_name,
            rowNumber: clickedRow.row_number,
          },
        ]);
      }
      return;
    }

    // Уровень 2: Клик по конкретному индикатору в Наценках
    if (currentLevel.type === 'markups') {
      const markupsData = data.filter(d =>
        !d.is_header &&
        !d.is_total &&
        d.row_number >= 7 &&
        d.row_number <= 14
      );

      const profitRow = markupsData.find(d => d.row_number === 13);
      const profitSubRow = markupsData.find(d => d.row_number === 14);
      const combinedProfit = profitRow && profitSubRow ? {
        ...profitRow,
        indicator_name: 'Прибыль',
        total_cost: (profitRow.total_cost || 0) + (profitSubRow.total_cost || 0),
        row_number: 13,
      } : profitRow;

      const oozRow = markupsData.find(d => d.row_number === 10);
      const oozSubRow = markupsData.find(d => d.row_number === 11);
      const combinedOOZ = oozRow && oozSubRow ? {
        ...oozRow,
        indicator_name: 'ООЗ',
        total_cost: (oozRow.total_cost || 0) + (oozSubRow.total_cost || 0),
        row_number: 10,
      } : oozRow;

      const filteredMarkups = markupsData
        .filter(d => d.row_number !== 14 && d.row_number !== 11)
        .map(d => {
          if (d.row_number === 13) return combinedProfit;
          if (d.row_number === 10) return combinedOOZ;
          return d;
        })
        .filter(Boolean);

      // Сортируем массив перед получением кликнутого элемента
      const sortedMarkups = filteredMarkups.map((d, idx) => ({
        data: d!,
        originalIndex: idx,
      })).sort((a, b) => (b.data.total_cost || 0) - (a.data.total_cost || 0));

      const clickedItem = sortedMarkups[index];
      const clickedRow = clickedItem?.data;

      if (clickedRow) {
        // Проверяем, это прибыль?
        if (clickedRow.row_number === 13) {
          // Переходим к drill-down прибыли
          setDrillDownPath([
            ...drillDownPath,
            {
              type: 'profit_breakdown',
              indicatorName: 'Прибыль',
              rowNumber: 13,
            },
          ]);
        } else if (clickedRow.row_number === 10) {
          // Переходим к drill-down ООЗ
          setDrillDownPath([
            ...drillDownPath,
            {
              type: 'ooz_breakdown',
              indicatorName: 'ООЗ',
              rowNumber: 10,
            },
          ]);
        } else if (clickedRow.row_number === 8) {
          // Переходим к drill-down роста стоимости
          setDrillDownPath([
            ...drillDownPath,
            {
              type: 'cost_growth_breakdown',
              indicatorName: 'Рост стоимости',
              rowNumber: 8,
            },
          ]);
        } else {
          // Обычный drill-down для других показателей
          setSelectedIndicator(clickedRow.row_number);
          setLoadingBreakdown(true);

          await fetchCategoryBreakdown(clickedRow.row_number);

          setDrillDownPath([
            ...drillDownPath,
            {
              type: 'indicator',
              indicatorName: clickedRow.indicator_name,
              rowNumber: clickedRow.row_number,
            },
          ]);
        }
      }
    }
  };

  // Функция для возврата на уровень выше
  const handleDrillUp = () => {
    if (drillDownPath.length > 1) {
      const newPath = drillDownPath.slice(0, -1);
      setDrillDownPath(newPath);

      if (newPath.length === 1) {
        // Возвращаемся на корневой уровень
        setSelectedIndicator(null);
        setBreakdownData([]);
      }
    }
  };

  // Сброс выбора при изменении тендера
  useEffect(() => {
    setSelectedIndicator(null);
    setBreakdownData([]);
    setDrillDownPath([{ type: 'root' }]);
    fetchReferenceInfo();
  }, [selectedTenderId]);

  // Автоматическая очистка блока детализации при выходе из режима просмотра конечного уровня
  useEffect(() => {
    const currentLevel = drillDownPath[drillDownPath.length - 1];

    // Если текущий уровень не 'indicator', очищаем детализацию
    if (currentLevel.type !== 'indicator') {
      setSelectedIndicator(null);
      setBreakdownData([]);
    }
  }, [drillDownPath]);

  // Данные для столбчатой диаграммы "Стоимость за м²"
  const getAreaBarData = () => {
    if (data.length === 0 || !selectedTenderId) return null;

    const currentLevel = drillDownPath[drillDownPath.length - 1];
    const totalAreaM2 = spTotal; // Используем только площадь по СП

    console.log('=== DEBUG getAreaBarData ===');
    console.log('currentLevel.type:', currentLevel.type);
    console.log('drillDownPath:', drillDownPath);
    console.log('breakdownData в начале функции:', breakdownData);

    // Определяем элементы для отображения в зависимости от уровня
    let barItems: { label: string; cost: number; color: string }[] = [];

    if (currentLevel.type === 'root') {
      // Корневой уровень: Прямые затраты и Наценки
      const directCosts = data.filter(d => !d.is_header && !d.is_total && d.row_number >= 2 && d.row_number <= 6)
        .reduce((sum, d) => sum + (d.total_cost || 0), 0);
      const markups = data.filter(d => !d.is_header && !d.is_total && d.row_number >= 7 && d.row_number <= 14)
        .reduce((sum, d) => sum + (d.total_cost || 0), 0);

      barItems = [
        { label: 'Прямые затраты', cost: directCosts, color: 'rgba(24, 144, 255, 0.6)' },
        { label: 'Наценки', cost: markups, color: 'rgba(82, 196, 26, 0.6)' },
      ].sort((a, b) => b.cost - a.cost); // Сортируем по убыванию стоимости
    } else if (currentLevel.type === 'direct_costs') {
      // Детализация прямых затрат
      const directCostsData = data.filter(d =>
        !d.is_header &&
        !d.is_total &&
        d.row_number >= 2 &&
        d.row_number <= 6
      );

      const colors = [
        'rgba(255, 77, 79, 0.6)',   // Субподряд
        'rgba(24, 144, 255, 0.6)',  // Работы + Материалы СУ-10
        'rgba(82, 196, 26, 0.6)',   // Служба механизации
        'rgba(250, 173, 20, 0.6)',  // МБП+ГСМ
        'rgba(114, 46, 209, 0.6)',  // Гарантийный период
      ];

      barItems = directCostsData.map((d, idx) => ({
        label: d.indicator_name,
        cost: d.total_cost || 0,
        color: colors[idx] || 'rgba(24, 144, 255, 0.6)',
      })).sort((a, b) => b.cost - a.cost); // Сортируем по убыванию стоимости
    } else if (currentLevel.type === 'markups') {
      // Детализация наценок
      const markupsData = data.filter(d =>
        !d.is_header &&
        !d.is_total &&
        d.row_number >= 7 &&
        d.row_number <= 14
      );

      // Объединяем строки прибыли
      const profitRow = markupsData.find(d => d.row_number === 13);
      const profitSubRow = markupsData.find(d => d.row_number === 14);
      const combinedProfit = profitRow && profitSubRow ? {
        ...profitRow,
        indicator_name: 'Прибыль',
        total_cost: (profitRow.total_cost || 0) + (profitSubRow.total_cost || 0),
      } : profitRow;

      // Объединяем строки ООЗ
      const oozRow = markupsData.find(d => d.row_number === 10);
      const oozSubRow = markupsData.find(d => d.row_number === 11);
      const combinedOOZ = oozRow && oozSubRow ? {
        ...oozRow,
        indicator_name: 'ООЗ',
        total_cost: (oozRow.total_cost || 0) + (oozSubRow.total_cost || 0),
      } : oozRow;

      const filteredMarkups = markupsData
        .filter(d => d.row_number !== 14 && d.row_number !== 11)
        .map(d => {
          if (d.row_number === 13) return combinedProfit;
          if (d.row_number === 10) return combinedOOZ;
          return d;
        })
        .filter(Boolean);

      const colors = [
        'rgba(19, 194, 194, 0.6)',  // 1,6
        'rgba(250, 140, 22, 0.6)',  // Рост стоимости
        'rgba(235, 47, 150, 0.6)',  // Непредвиденные
        'rgba(82, 196, 26, 0.6)',   // ООЗ (объединенная)
        'rgba(250, 173, 20, 0.6)',  // ОФЗ
        'rgba(24, 144, 255, 0.6)',  // Прибыль (объединенная)
      ];

      barItems = filteredMarkups.map((d, idx) => ({
        label: d!.indicator_name,
        cost: d!.total_cost || 0,
        color: colors[idx] || 'rgba(24, 144, 255, 0.6)',
      })).sort((a, b) => b.cost - a.cost); // Сортируем по убыванию стоимости
    } else if (currentLevel.type === 'indicator' && breakdownData.length > 0) {
      // Детализация по категориям затрат для конкретного индикатора
      console.log('=== DEBUG getAreaBarData для indicator (с данными breakdown) ===');
      console.log('breakdownData.length:', breakdownData.length);
      console.log('breakdownData:', breakdownData);

      // Группируем данные только по категориям (без видов и локализаций)
      const categoryMap = new Map<string, number>();
      breakdownData.forEach(item => {
        const current = categoryMap.get(item.category_name) || 0;
        categoryMap.set(item.category_name, current + item.total_amount);
      });

      const colors = [
        'rgba(255, 77, 79, 0.6)',     // #ff4d4f
        'rgba(24, 144, 255, 0.6)',    // #1890ff
        'rgba(82, 196, 26, 0.6)',     // #52c41a
        'rgba(250, 173, 20, 0.6)',    // #faad14
        'rgba(114, 46, 209, 0.6)',    // #722ed1
        'rgba(19, 194, 194, 0.6)',    // #13c2c2
        'rgba(250, 140, 22, 0.6)',    // #fa8c16
        'rgba(235, 47, 150, 0.6)',    // #eb2f96
        'rgba(149, 222, 100, 0.6)',   // #95de64
        'rgba(64, 169, 255, 0.6)',    // #40a9ff
        'rgba(247, 89, 171, 0.6)',    // #f759ab
        'rgba(250, 219, 20, 0.6)',    // #fadb14
        'rgba(160, 217, 17, 0.6)',    // #a0d911
        'rgba(54, 207, 201, 0.6)',    // #36cfc9
        'rgba(89, 126, 247, 0.6)',    // #597ef7
      ];

      barItems = Array.from(categoryMap.entries()).map(([categoryName, totalCost], idx) => ({
        label: categoryName,
        cost: totalCost,
        color: colors[idx % colors.length],
      })).sort((a, b) => b.cost - a.cost);

      console.log('barItems после маппинга:', barItems);
    } else if (currentLevel.type === 'indicator' && selectedIndicator) {
      // Конкретный показатель - один столбец (только если нет breakdown данных)
      const indicator = data.find(d => d.row_number === selectedIndicator);
      if (indicator) {
        barItems = [{
          label: indicator.indicator_name,
          cost: indicator.total_cost || 0,
          color: 'rgba(24, 144, 255, 0.6)',
        }];
      }
    } else if (currentLevel.type === 'profit_breakdown') {
      // Детализация прибыли
      const profitItems = data.filter(d => d.row_number === 13 || d.row_number === 14);
      barItems = profitItems.map((d, idx) => ({
        label: d.indicator_name,
        cost: d.total_cost || 0,
        color: idx === 0 ? 'rgba(24, 144, 255, 0.6)' : 'rgba(64, 169, 255, 0.6)',
      })).sort((a, b) => b.cost - a.cost); // Сортируем по убыванию стоимости
    } else if (currentLevel.type === 'ooz_breakdown') {
      // Детализация ООЗ
      const oozItems = data.filter(d => d.row_number === 10 || d.row_number === 11);
      barItems = oozItems.map((d, idx) => ({
        label: d.indicator_name,
        cost: d.total_cost || 0,
        color: idx === 0 ? 'rgba(82, 196, 26, 0.6)' : 'rgba(149, 222, 100, 0.6)',
      })).sort((a, b) => b.cost - a.cost); // Сортируем по убыванию стоимости
    } else if (currentLevel.type === 'cost_growth_breakdown') {
      // Детализация роста стоимости
      const costGrowthRow = data.find(d => d.row_number === 8);

      if (costGrowthRow) {
        // Используем промежуточные значения расчетов
        const worksSu10Growth = costGrowthRow.works_su10_growth || 0;
        const materialsSu10Growth = costGrowthRow.materials_su10_growth || 0;
        const worksSubGrowth = costGrowthRow.works_sub_growth || 0;
        const materialsSubGrowth = costGrowthRow.materials_sub_growth || 0;

        barItems = [
          { label: 'Рост работ СУ-10', cost: worksSu10Growth, color: 'rgba(250, 140, 22, 0.6)' },
          { label: 'Рост материалов СУ-10', cost: materialsSu10Growth, color: 'rgba(250, 173, 20, 0.6)' },
          { label: 'Рост субподрядных работ', cost: worksSubGrowth, color: 'rgba(255, 122, 69, 0.6)' },
          { label: 'Рост субподрядных материалов', cost: materialsSubGrowth, color: 'rgba(255, 169, 64, 0.6)' },
        ].sort((a, b) => b.cost - a.cost); // Сортируем по убыванию стоимости
      }
    }

    // Конвертируем в стоимость за м²
    const pricePerM2Items = barItems.map(item => ({
      label: item.label,
      pricePerM2: totalAreaM2 > 0 ? item.cost / totalAreaM2 : 0,
      color: item.color,
    }));

    return {
      labels: pricePerM2Items.map(item => item.label),
      datasets: [
        {
          label: 'Стоимость за м² (руб.)',
          data: pricePerM2Items.map(item => Math.round(item.pricePerM2)),
          backgroundColor: pricePerM2Items.map(item => item.color),
          borderColor: pricePerM2Items.map(item => item.color.replace('0.6', '1')),
          borderWidth: 1,
        },
      ],
    };
  };

  // Колонки таблицы детализации по категориям затрат
  const breakdownColumns = [
    {
      title: '№',
      dataIndex: 'key',
      key: 'key',
      width: 50,
      render: (_: any, __: any, index: number) => index + 1,
    },
    {
      title: 'Категория затрат',
      dataIndex: 'category_name',
      key: 'category_name',
      width: 200,
    },
    {
      title: 'Вид затрат',
      dataIndex: 'detail_name',
      key: 'detail_name',
      width: 200,
    },
    {
      title: 'Локализация',
      dataIndex: 'location_name',
      key: 'location_name',
      width: 150,
    },
    {
      title: 'Работы (руб.)',
      dataIndex: 'works_amount',
      key: 'works_amount',
      width: 150,
      align: 'right' as const,
      render: (val: number) => formatNumber(val),
    },
    {
      title: 'Материалы (руб.)',
      dataIndex: 'materials_amount',
      key: 'materials_amount',
      width: 150,
      align: 'right' as const,
      render: (val: number) => formatNumber(val),
    },
    {
      title: 'Итого (руб.)',
      dataIndex: 'total_amount',
      key: 'total_amount',
      width: 150,
      align: 'right' as const,
      render: (val: number) => <Text strong>{formatNumber(val)}</Text>,
    },
  ];

  // Получаем данные для таблицы детализации в зависимости от текущего уровня drill-down
  const getSummaryTableData = () => {
    const currentLevel = drillDownPath[drillDownPath.length - 1];
    const totalAreaM2 = spTotal; // Используем только площадь по СП

    if (currentLevel.type === 'root') {
      // Корневой уровень: показываем Прямые затраты и Наценки
      const directCosts = data.filter(d => !d.is_header && !d.is_total && d.row_number >= 2 && d.row_number <= 6)
        .reduce((sum, d) => sum + (d.total_cost || 0), 0);
      const markups = data.filter(d => !d.is_header && !d.is_total && d.row_number >= 7 && d.row_number <= 14)
        .reduce((sum, d) => sum + (d.total_cost || 0), 0);

      return [
        {
          key: 0,
          indicator_name: 'Прямые затраты',
          amount: directCosts,
          price_per_m2: totalAreaM2 > 0 ? directCosts / totalAreaM2 : 0,
        },
        {
          key: 1,
          indicator_name: 'Наценки',
          amount: markups,
          price_per_m2: totalAreaM2 > 0 ? markups / totalAreaM2 : 0,
        },
      ].sort((a, b) => b.amount - a.amount);
    } else if (currentLevel.type === 'direct_costs') {
      // Детализация прямых затрат
      return data
        .filter(d => !d.is_header && !d.is_total && d.row_number >= 2 && d.row_number <= 6)
        .map((d, idx) => ({
          key: idx,
          indicator_name: d.indicator_name,
          amount: d.total_cost || 0,
          price_per_m2: totalAreaM2 > 0 ? (d.total_cost || 0) / totalAreaM2 : 0,
        }))
        .sort((a, b) => b.amount - a.amount);
    } else if (currentLevel.type === 'markups') {
      // Детализация наценок
      const markupsData = data.filter(d =>
        !d.is_header &&
        !d.is_total &&
        d.row_number >= 7 &&
        d.row_number <= 14
      );

      // Объединяем строки прибыли
      const profitRow = markupsData.find(d => d.row_number === 13);
      const profitSubRow = markupsData.find(d => d.row_number === 14);
      const combinedProfit = profitRow && profitSubRow ? {
        ...profitRow,
        indicator_name: 'Прибыль',
        total_cost: (profitRow.total_cost || 0) + (profitSubRow.total_cost || 0),
      } : profitRow;

      // Объединяем строки ООЗ
      const oozRow = markupsData.find(d => d.row_number === 10);
      const oozSubRow = markupsData.find(d => d.row_number === 11);
      const combinedOOZ = oozRow && oozSubRow ? {
        ...oozRow,
        indicator_name: 'ООЗ',
        total_cost: (oozRow.total_cost || 0) + (oozSubRow.total_cost || 0),
      } : oozRow;

      const filteredMarkups = markupsData
        .filter(d => d.row_number !== 14 && d.row_number !== 11)
        .map(d => {
          if (d.row_number === 13) return combinedProfit;
          if (d.row_number === 10) return combinedOOZ;
          return d;
        })
        .filter(Boolean);

      return filteredMarkups.map((d, idx) => ({
        key: idx,
        indicator_name: d!.indicator_name,
        amount: d!.total_cost || 0,
        price_per_m2: totalAreaM2 > 0 ? (d!.total_cost || 0) / totalAreaM2 : 0,
      })).sort((a, b) => b.amount - a.amount);
    } else if (currentLevel.type === 'profit_breakdown') {
      // Детализация прибыли
      const profitItems = data.filter(d => d.row_number === 13 || d.row_number === 14);
      return profitItems.map((d, idx) => ({
        key: idx,
        indicator_name: d.indicator_name,
        amount: d.total_cost || 0,
        price_per_m2: totalAreaM2 > 0 ? (d.total_cost || 0) / totalAreaM2 : 0,
      })).sort((a, b) => b.amount - a.amount);
    } else if (currentLevel.type === 'ooz_breakdown') {
      // Детализация ООЗ
      const oozItems = data.filter(d => d.row_number === 10 || d.row_number === 11);
      return oozItems.map((d, idx) => ({
        key: idx,
        indicator_name: d.indicator_name,
        amount: d.total_cost || 0,
        price_per_m2: totalAreaM2 > 0 ? (d.total_cost || 0) / totalAreaM2 : 0,
      })).sort((a, b) => b.amount - a.amount);
    } else if (currentLevel.type === 'cost_growth_breakdown') {
      // Детализация роста стоимости
      const costGrowthRow = data.find(d => d.row_number === 8);

      if (costGrowthRow) {
        // Используем промежуточные значения расчетов
        const worksSu10Growth = costGrowthRow.works_su10_growth || 0;
        const materialsSu10Growth = costGrowthRow.materials_su10_growth || 0;
        const worksSubGrowth = costGrowthRow.works_sub_growth || 0;
        const materialsSubGrowth = costGrowthRow.materials_sub_growth || 0;

        return [
          { key: 0, indicator_name: 'Рост работ СУ-10', amount: worksSu10Growth, price_per_m2: totalAreaM2 > 0 ? worksSu10Growth / totalAreaM2 : 0 },
          { key: 1, indicator_name: 'Рост материалов СУ-10', amount: materialsSu10Growth, price_per_m2: totalAreaM2 > 0 ? materialsSu10Growth / totalAreaM2 : 0 },
          { key: 2, indicator_name: 'Рост субподрядных работ', amount: worksSubGrowth, price_per_m2: totalAreaM2 > 0 ? worksSubGrowth / totalAreaM2 : 0 },
          { key: 3, indicator_name: 'Рост субподрядных материалов', amount: materialsSubGrowth, price_per_m2: totalAreaM2 > 0 ? materialsSubGrowth / totalAreaM2 : 0 },
        ].sort((a, b) => b.amount - a.amount);
      }
    }

    return [];
  };

  const summaryTableColumns = [
    {
      title: '№',
      dataIndex: 'key',
      key: 'key',
      width: 50,
      render: (_: any, __: any, index: number) => index + 1,
    },
    {
      title: 'Показатель',
      dataIndex: 'indicator_name',
      key: 'indicator_name',
      width: 300,
    },
    {
      title: 'Сумма (руб.)',
      dataIndex: 'amount',
      key: 'amount',
      width: 150,
      align: 'right' as const,
      render: (val: number) => <Text strong>{formatNumber(val)}</Text>,
    },
    {
      title: 'Цена за м² (руб./м²)',
      dataIndex: 'price_per_m2',
      key: 'price_per_m2',
      width: 150,
      align: 'right' as const,
      render: (val: number) => <Text>{formatNumber(Math.round(val))}</Text>,
    },
  ];

  const pieOptions = {
    responsive: true,
    maintainAspectRatio: false,
    onClick: handlePieClick,
    layout: {
      padding: {
        top: 10,
        right: 10,
        bottom: 10,
        left: 10,
      },
    },
    plugins: {
      legend: {
        position: 'right' as const,
        labels: {
          color: currentTheme === 'dark' ? '#ffffff' : '#000000',
          padding: 6,
          font: { size: 10 },
          boxWidth: 12,
          boxHeight: 12,
          generateLabels: function(chart: any) {
            const currentLevel = drillDownPath[drillDownPath.length - 1];

            // Для уровня 2 (direct_costs или markups) добавляем разделители
            if (currentLevel.type === 'direct_costs') {
              const labels: any[] = [];

              // Добавляем заголовок "Прямые затраты, в том числе:"
              labels.push({
                text: 'Прямые затраты, в том числе:',
                fillStyle: 'transparent',
                strokeStyle: 'transparent',
                lineWidth: 0,
                hidden: false,
                index: -1,
                fontColor: currentTheme === 'dark' ? '#ffffff' : '#000000',
                fontStyle: 'bold',
              });

              // Добавляем все элементы прямых затрат с процентами
              const total = chart.data.datasets[0].data.reduce((a: number, b: number) => a + b, 0);
              chart.data.labels.forEach((label: string, i: number) => {
                const value = chart.data.datasets[0].data[i];
                const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : '0.0';
                labels.push({
                  text: `${label} (${percentage}%)`,
                  fillStyle: chart.data.datasets[0].backgroundColor[i],
                  hidden: false,
                  index: i,
                  fontColor: currentTheme === 'dark' ? '#ffffff' : '#000000',
                });
              });

              return labels;
            }

            if (currentLevel.type === 'markups') {
              const labels: any[] = [];

              // Добавляем заголовок "Наценки, в том числе:"
              labels.push({
                text: 'Наценки, в том числе:',
                fillStyle: 'transparent',
                strokeStyle: 'transparent',
                lineWidth: 0,
                hidden: false,
                index: -1,
                fontColor: currentTheme === 'dark' ? '#ffffff' : '#000000',
                fontStyle: 'bold',
              });

              // Добавляем все элементы наценок с процентами
              const totalMarkups = chart.data.datasets[0].data.reduce((a: number, b: number) => a + b, 0);
              chart.data.labels.forEach((label: string, i: number) => {
                const value = chart.data.datasets[0].data[i];
                const percentage = totalMarkups > 0 ? ((value / totalMarkups) * 100).toFixed(1) : '0.0';
                labels.push({
                  text: `${label} (${percentage}%)`,
                  fillStyle: chart.data.datasets[0].backgroundColor[i],
                  hidden: false,
                  index: i,
                  fontColor: currentTheme === 'dark' ? '#ffffff' : '#000000',
                });
              });

              return labels;
            }

            // Для всех остальных уровней (root, indicator, profit_breakdown) - стандартные метки с процентами
            const total = chart.data.datasets[0].data.reduce((a: number, b: number) => a + b, 0);
            return chart.data.labels.map((label: string, i: number) => {
              const value = chart.data.datasets[0].data[i];
              const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : '0.0';
              return {
                text: `${label} (${percentage}%)`,
                fillStyle: chart.data.datasets[0].backgroundColor[i],
                hidden: false,
                index: i,
                fontColor: currentTheme === 'dark' ? '#ffffff' : '#000000',
              };
            });
          },
        },
        maxWidth: 200,
        onClick: function(e: any, legendItem: any, legend: any) {
          // Игнорируем клики на заголовки и разделители
          if (legendItem.index < 0) return;

          // Стандартное поведение для остальных элементов
          const index = legendItem.index;
          const chart = legend.chart;

          // Вызываем handlePieClick программно
          const elements = chart.getElementsAtEventForMode(e, 'nearest', { intersect: true }, false);
          if (elements.length === 0) {
            // Создаем псевдо-элемент для handlePieClick
            handlePieClick(e, [{ index }]);
          }
        },
      },
      tooltip: {
        callbacks: {
          label: function(context: any) {
            const label = context.label || '';
            const value = context.parsed || 0;
            const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0);
            const percentage = ((value / total) * 100).toFixed(1);
            return `${label}: ${value.toLocaleString('ru-RU')} руб. (${percentage}%)`;
          }
        }
      },
      datalabels: { display: false },
    },
  };

  // Обработчик клика по столбцу в барной диаграмме
  const handleBarClick = async (_event: any, elements: any) => {
    if (elements.length === 0) return;

    const clickedIndex = elements[0].index;
    const currentLevel = drillDownPath[drillDownPath.length - 1];

    // На корневом уровне
    if (currentLevel.type === 'root') {
      const labels = ['Прямые затраты', 'Наценки'];
      const clickedLabel = labels[clickedIndex];

      if (clickedLabel === 'Прямые затраты') {
        setDrillDownPath([...drillDownPath, { type: 'direct_costs' }]);
      } else if (clickedLabel === 'Наценки') {
        setDrillDownPath([...drillDownPath, { type: 'markups' }]);
      }
    }
    // На уровне прямых затрат - переходим к конкретному показателю
    else if (currentLevel.type === 'direct_costs') {
      const directCostsData = data.filter(d =>
        !d.is_header &&
        !d.is_total &&
        d.row_number >= 2 &&
        d.row_number <= 6
      );

      if (clickedIndex < directCostsData.length) {
        const clickedRow = directCostsData[clickedIndex];
        setSelectedIndicator(clickedRow.row_number);
        setLoadingBreakdown(true);

        await fetchCategoryBreakdown(clickedRow.row_number);

        setDrillDownPath([
          ...drillDownPath,
          {
            type: 'indicator',
            indicatorName: clickedRow.indicator_name,
            rowNumber: clickedRow.row_number,
          },
        ]);
      }
    }
    // На уровне наценок
    else if (currentLevel.type === 'markups') {
      const markupsData = data.filter(d =>
        !d.is_header &&
        !d.is_total &&
        d.row_number >= 7 &&
        d.row_number <= 14
      );

      // Объединяем строки прибыли
      const profitRow = markupsData.find(d => d.row_number === 13);
      const profitSubRow = markupsData.find(d => d.row_number === 14);
      const combinedProfit = profitRow && profitSubRow ? {
        ...profitRow,
        indicator_name: 'Прибыль',
        total_cost: (profitRow.total_cost || 0) + (profitSubRow.total_cost || 0),
        row_number: 13,
      } : profitRow;

      // Объединяем строки ООЗ
      const oozRow = markupsData.find(d => d.row_number === 10);
      const oozSubRow = markupsData.find(d => d.row_number === 11);
      const combinedOOZ = oozRow && oozSubRow ? {
        ...oozRow,
        indicator_name: 'ООЗ',
        total_cost: (oozRow.total_cost || 0) + (oozSubRow.total_cost || 0),
        row_number: 10,
      } : oozRow;

      const filteredMarkups = markupsData
        .filter(d => d.row_number !== 14 && d.row_number !== 11) // Исключаем "Прибыль субподряд" и "ООЗ Субподряд"
        .map(d => {
          if (d.row_number === 13) return combinedProfit;
          if (d.row_number === 10) return combinedOOZ;
          return d;
        })
        .filter(Boolean);

      // Сортируем массив перед получением кликнутого элемента
      const sortedMarkups = filteredMarkups.map((d, idx) => ({
        data: d!,
        originalIndex: idx,
      })).sort((a, b) => (b.data.total_cost || 0) - (a.data.total_cost || 0));

      const clickedItem = sortedMarkups[clickedIndex];
      const clickedRow = clickedItem?.data;

      if (clickedRow) {
        // Проверяем, это прибыль?
        if (clickedRow.row_number === 13) {
          setDrillDownPath([
            ...drillDownPath,
            {
              type: 'profit_breakdown',
              indicatorName: 'Прибыль',
              rowNumber: 13,
            },
          ]);
        } else if (clickedRow.row_number === 10) {
          // Переходим к drill-down ООЗ
          setDrillDownPath([
            ...drillDownPath,
            {
              type: 'ooz_breakdown',
              indicatorName: 'ООЗ',
              rowNumber: 10,
            },
          ]);
        } else if (clickedRow.row_number === 8) {
          // Переходим к drill-down роста стоимости
          setDrillDownPath([
            ...drillDownPath,
            {
              type: 'cost_growth_breakdown',
              indicatorName: 'Рост стоимости',
              rowNumber: 8,
            },
          ]);
        } else {
          // Обычный drill-down для других показателей
          setSelectedIndicator(clickedRow.row_number);
          setLoadingBreakdown(true);

          await fetchCategoryBreakdown(clickedRow.row_number);

          setDrillDownPath([
            ...drillDownPath,
            {
              type: 'indicator',
              indicatorName: clickedRow.indicator_name,
              rowNumber: clickedRow.row_number,
            },
          ]);
        }
      }
    }
  };

  // Extract current drill-down level for use in barOptions
  const currentLevel = drillDownPath[drillDownPath.length - 1];

  const barOptions = {
    responsive: true,
    maintainAspectRatio: false,
    onClick: handleBarClick,
    plugins: {
      legend: {
        display: true,
        position: 'top' as const,
        labels: {
          color: currentTheme === 'dark' ? '#ffffff' : '#000000',
          font: { size: 12 },
        },
      },
      tooltip: {
        callbacks: {
          label: function(context: any) {
            const value = context.parsed.y || 0;
            return `Стоимость за м²: ${value.toLocaleString('ru-RU')} руб.`;
          }
        }
      },
      datalabels: { display: false },
    },
    scales: {
      y: {
        ticks: {
          color: currentTheme === 'dark' ? '#ffffff' : '#000000',
        },
        grid: {
          color: currentTheme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
        },
      },
      x: {
        ticks: {
          color: currentTheme === 'dark' ? '#ffffff' : '#000000',
          font: {
            size: currentLevel.type === 'indicator' && breakdownData.length > 0 ? 10 : 12
          },
          maxRotation: currentLevel.type === 'indicator' && breakdownData.length > 0 ? 0 : 0,
          minRotation: 0,
          autoSkip: false,
          callback: function(value: any, index: number) {
            // Для детализации категорий затрат разбиваем на две строки
            if (currentLevel.type === 'indicator' && breakdownData.length > 0) {
              const label = this.getLabelForValue(value);
              // Разбиваем длинные строки на части по 20 символов
              if (label.length > 20) {
                const words = label.split(' ');
                const lines: string[] = [];
                let currentLine = '';

                words.forEach(word => {
                  if ((currentLine + ' ' + word).length > 20 && currentLine.length > 0) {
                    lines.push(currentLine);
                    currentLine = word;
                  } else {
                    currentLine = currentLine ? currentLine + ' ' + word : word;
                  }
                });

                if (currentLine) lines.push(currentLine);
                return lines;
              }
              return label;
            }
            return this.getLabelForValue(value);
          }
        },
        grid: {
          color: currentTheme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
        },
      },
    },
  };

  // Получаем имя выбранного индикатора
  const selectedIndicatorName = selectedIndicator
    ? data.find(d => d.row_number === selectedIndicator)?.indicator_name
    : null;

  return (
    <div>
      {/* Верхний ряд: Круговая диаграмма и столбчатая диаграмма */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} lg={12}>
          <Card
            bordered
            style={{
              height: 450,
              background: currentTheme === 'dark' ? '#1f1f1f' : '#ffffff',
            }}
          >
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <Title level={5} style={{ margin: 0, color: currentTheme === 'dark' ? '#ffffff' : '#000000' }}>
                  Структура Цены
                </Title>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  {data.length > 0 && (
                    <Text strong style={{ fontSize: 16, color: currentTheme === 'dark' ? '#ffffff' : '#000000' }}>
                      {formatNumber(
                        drillDownPath.length === 1
                          ? data.find(d => d.is_total)?.total_cost
                          : drillDownPath[drillDownPath.length - 1].type === 'direct_costs'
                          ? data.filter(d => !d.is_header && !d.is_total && d.row_number >= 2 && d.row_number <= 6).reduce((sum, d) => sum + (d.total_cost || 0), 0)
                          : drillDownPath[drillDownPath.length - 1].type === 'markups'
                          ? data.filter(d => !d.is_header && !d.is_total && d.row_number >= 7 && d.row_number <= 14).reduce((sum, d) => sum + (d.total_cost || 0), 0)
                          : drillDownPath[drillDownPath.length - 1].type === 'indicator' && selectedIndicator
                          ? data.find(d => d.row_number === selectedIndicator)?.total_cost
                          : drillDownPath[drillDownPath.length - 1].type === 'profit_breakdown'
                          ? data.filter(d => d.row_number === 13 || d.row_number === 14).reduce((sum, d) => sum + (d.total_cost || 0), 0)
                          : data.find(d => d.is_total)?.total_cost
                      )} Руб.
                    </Text>
                  )}
                  {drillDownPath.length > 1 && (
                    <Button
                      size="small"
                      style={{ backgroundColor: '#52c41a', borderColor: '#52c41a', color: '#fff' }}
                      onClick={handleDrillUp}
                    >
                      ← Назад
                    </Button>
                  )}
                </div>
              </div>

              {/* Breadcrumb навигация */}
              {drillDownPath.length > 1 && (
                <div style={{ marginBottom: 8 }}>
                  {drillDownPath.map((level, idx) => (
                    <span key={idx}>
                      {idx > 0 && <Text type="secondary"> → </Text>}
                      <Text
                        type={idx === drillDownPath.length - 1 ? undefined : 'secondary'}
                        style={{
                          cursor: idx < drillDownPath.length - 1 ? 'pointer' : 'default',
                          fontWeight: idx === drillDownPath.length - 1 ? 600 : 400,
                          color: idx === drillDownPath.length - 1 ? '#1890ff' : undefined,
                        }}
                        onClick={() => {
                          if (idx < drillDownPath.length - 1) {
                            setDrillDownPath(drillDownPath.slice(0, idx + 1));
                            if (idx === 0) {
                              setSelectedIndicator(null);
                              setBreakdownData([]);
                            }
                          }
                        }}
                      >
                        {level.type === 'root'
                          ? 'Все показатели'
                          : level.type === 'direct_costs'
                          ? 'Прямые затраты'
                          : level.type === 'markups'
                          ? 'Наценки'
                          : level.type === 'profit_breakdown'
                          ? 'Детализация прибыли'
                          : level.indicatorName || 'Детализация'}
                      </Text>
                    </span>
                  ))}
                </div>
              )}

              <div style={{ marginBottom: 8 }}>
                <Text type="secondary" style={{ fontSize: 13 }}>
                  {drillDownPath.length === 1
                    ? 'Кликните для детализации'
                    : drillDownPath[drillDownPath.length - 1].type === 'indicator'
                    ? 'Детализация по категориям затрат'
                    : 'Детализация по показателям'}
                </Text>
              </div>
            </div>
            <Spin spinning={loadingBreakdown}>
              {getCategoriesData() ? (
                <div style={{ height: 320, maxHeight: 320, overflow: 'hidden' }}>
                  <Doughnut data={getCategoriesData()!} options={pieOptions} />
                </div>
              ) : drillDownPath.length > 1 ? (
                <div style={{ height: 320, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
                  <Text type="secondary" style={{ fontSize: 16, marginBottom: 12 }}>
                    📊 Детализация недоступна
                  </Text>
                  <Text type="secondary" style={{ fontSize: 14 }}>
                    Для показателя "{drillDownPath[drillDownPath.length - 1].indicatorName}"
                  </Text>
                  <Text type="secondary" style={{ fontSize: 14 }}>
                    детализация по категориям затрат не предусмотрена
                  </Text>
                  <Button type="primary" onClick={handleDrillUp} style={{ marginTop: 16 }}>
                    Вернуться к общему обзору
                  </Button>
                </div>
              ) : null}
            </Spin>
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card
            bordered
            style={{
              height: 450,
              background: currentTheme === 'dark' ? '#1f1f1f' : '#ffffff',
            }}
          >
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Title level={5} style={{ margin: 0, color: currentTheme === 'dark' ? '#ffffff' : '#000000' }}>
                  Стоимость за м²
                </Title>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  {data.length > 0 && (
                    <Text strong style={{ fontSize: 16, color: currentTheme === 'dark' ? '#ffffff' : '#000000' }}>
                      {(() => {
                        const currentLevel = drillDownPath[drillDownPath.length - 1];
                        const totalAreaM2 = spTotal; // Используем только площадь по СП
                        let currentCost = 0;

                        if (currentLevel.type === 'root') {
                          currentCost = data.find(d => d.is_total)?.total_cost || 0;
                        } else if (currentLevel.type === 'direct_costs') {
                          currentCost = data.filter(d => !d.is_header && !d.is_total && d.row_number >= 2 && d.row_number <= 6)
                            .reduce((sum, d) => sum + (d.total_cost || 0), 0);
                        } else if (currentLevel.type === 'markups') {
                          currentCost = data.filter(d => !d.is_header && !d.is_total && d.row_number >= 7 && d.row_number <= 14)
                            .reduce((sum, d) => sum + (d.total_cost || 0), 0);
                        } else if (currentLevel.type === 'indicator' && selectedIndicator) {
                          currentCost = data.find(d => d.row_number === selectedIndicator)?.total_cost || 0;
                        } else if (currentLevel.type === 'profit_breakdown') {
                          currentCost = data.filter(d => d.row_number === 13 || d.row_number === 14)
                            .reduce((sum, d) => sum + (d.total_cost || 0), 0);
                        }

                        const pricePerM2 = totalAreaM2 > 0 ? currentCost / totalAreaM2 : 0;
                        return `${formatNumber(Math.round(pricePerM2))} Руб./м²`;
                      })()}
                    </Text>
                  )}
                  {drillDownPath.length > 1 && (
                    <Button
                      size="small"
                      style={{ backgroundColor: '#52c41a', borderColor: '#52c41a', color: '#fff' }}
                      onClick={handleDrillUp}
                    >
                      ← Назад
                    </Button>
                  )}
                </div>
              </div>
            </div>
            {getAreaBarData() && (
              <div style={{ height: 350 }}>
                <Bar data={getAreaBarData()!} options={barOptions} />
              </div>
            )}
          </Card>
        </Col>
      </Row>

      {/* Детализация по категориям затрат (показывается только для Субподряда и Работы+Материалы СУ-10) */}
      {selectedIndicator && (selectedIndicator === 2 || selectedIndicator === 3) && (
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col xs={24}>
            <Card
              bordered
              style={{
                background: currentTheme === 'dark' ? '#1f1f1f' : '#ffffff',
              }}
            >
              <div style={{ marginBottom: 16 }}>
                <Title level={5} style={{ margin: 0, marginBottom: 4 }}>
                  Детализация по категориям затрат
                </Title>
                <Text type="secondary" style={{ fontSize: 13 }}>
                  {selectedIndicatorName}
                </Text>
              </div>

              <Spin spinning={loadingBreakdown}>
                <Table
                  dataSource={breakdownData}
                  columns={breakdownColumns}
                  pagination={false}
                  size="small"
                  bordered
                  scroll={{ x: 1200 }}
                  summary={(data) => {
                    const totalWorks = data.reduce((sum, item) => sum + item.works_amount, 0);
                    const totalMaterials = data.reduce((sum, item) => sum + item.materials_amount, 0);
                    const total = data.reduce((sum, item) => sum + item.total_amount, 0);

                    return (
                      <Table.Summary.Row style={{ background: currentTheme === 'dark' ? '#262626' : '#fafafa' }}>
                        <Table.Summary.Cell index={0} colSpan={4}>
                          <Text strong>ИТОГО:</Text>
                        </Table.Summary.Cell>
                        <Table.Summary.Cell index={1} align="right">
                          <Text strong>{formatNumber(totalWorks)}</Text>
                        </Table.Summary.Cell>
                        <Table.Summary.Cell index={2} align="right">
                          <Text strong>{formatNumber(totalMaterials)}</Text>
                        </Table.Summary.Cell>
                        <Table.Summary.Cell index={3} align="right">
                          <Text strong style={{ color: '#1890ff' }}>{formatNumber(total)}</Text>
                        </Table.Summary.Cell>
                      </Table.Summary.Row>
                    );
                  }}
                />
              </Spin>
            </Card>
          </Col>
        </Row>
      )}

      {/* Нижний ряд: Таблица сводки по выбранному уровню (скрыт когда открыт блок детализации затрат) */}
      {!(selectedIndicator && (selectedIndicator === 2 || selectedIndicator === 3)) && (
        <Row gutter={[16, 16]}>
          <Col xs={24}>
            <Card
              bordered
              style={{
                background: currentTheme === 'dark' ? '#1f1f1f' : '#ffffff',
              }}
            >
              <div style={{ marginBottom: 16 }}>
                <Title level={5} style={{ margin: 0, marginBottom: 4 }}>
                  Краткая сводка
                </Title>
              <Text type="secondary" style={{ fontSize: 13 }}>
                {drillDownPath.length === 1
                  ? 'Общая структура затрат'
                  : drillDownPath[drillDownPath.length - 1].type === 'direct_costs'
                  ? 'Состав прямых затрат'
                  : drillDownPath[drillDownPath.length - 1].type === 'markups'
                  ? 'Состав наценок'
                  : drillDownPath[drillDownPath.length - 1].type === 'profit_breakdown'
                  ? 'Детализация прибыли'
                  : drillDownPath[drillDownPath.length - 1].type === 'ooz_breakdown'
                  ? 'Детализация ООЗ'
                  : drillDownPath[drillDownPath.length - 1].type === 'cost_growth_breakdown'
                  ? 'Детализация роста стоимости'
                  : drillDownPath[drillDownPath.length - 1].indicatorName || 'Детализация'}
              </Text>
            </div>

            <Table
              dataSource={getSummaryTableData()}
              columns={summaryTableColumns}
              pagination={false}
              size="small"
              bordered
              scroll={{ x: 650 }}
              summary={(pageData) => {
                const totalAmount = pageData.reduce((sum, item) => sum + item.amount, 0);
                const totalAreaM2 = spTotal;
                const avgPricePerM2 = totalAreaM2 > 0 ? totalAmount / totalAreaM2 : 0;

                return (
                  <Table.Summary.Row style={{ background: currentTheme === 'dark' ? '#262626' : '#fafafa' }}>
                    <Table.Summary.Cell index={0} colSpan={2}>
                      <Text strong>ИТОГО:</Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={1} align="right">
                      <Text strong style={{ color: '#1890ff' }}>{formatNumber(totalAmount)}</Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={2} align="right">
                      <Text strong>{formatNumber(Math.round(avgPricePerM2))}</Text>
                    </Table.Summary.Cell>
                  </Table.Summary.Row>
                );
              }}
            />
          </Card>
        </Col>
      </Row>
      )}

      {/* Справочная информация */}
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24}>
          <Card
            bordered
            style={{
              background: currentTheme === 'dark' ? '#1f1f1f' : '#ffffff',
            }}
          >
            <Title level={5} style={{ marginBottom: 16 }}>
              Справочная информация
            </Title>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text>1. Стоимость монолита за м³</Text>
                <Text strong style={{ fontSize: 16 }}>
                  {formatNumber(Math.round(referenceInfo.monolithPerM3))} руб/м³
                </Text>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text>2. Стоимость ВИСов за м²</Text>
                <Text strong style={{ fontSize: 16 }}>
                  {formatNumber(Math.round(referenceInfo.visPerM2))} руб/м²
                </Text>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text>3. Стоимость Фасадов за м²</Text>
                <Text strong style={{ fontSize: 16 }}>
                  {formatNumber(Math.round(referenceInfo.facadePerM2))} руб/м²
                </Text>
              </div>
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
};
