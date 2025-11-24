/**
 * Страница "Финансовые показатели"
 * Отображение финансовых показателей по тендеру с расчетами стоимостей
 */

import React, { useState, useEffect } from 'react';
import {
  Table,
  Select,
  Button,
  Space,
  Typography,
  Spin,
  message,
  Card,
  Tag,
  Row,
  Col,
  Tooltip,
} from 'antd';
import {
  ReloadOutlined,
  DownloadOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { supabase } from '../../lib/supabase';
import type { Tender } from '../../lib/supabase';
import { useTheme } from '../../contexts/ThemeContext';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

// Интерфейс для строки таблицы
interface IndicatorRow {
  key: string;
  row_number: number;
  indicator_name: string;
  coefficient?: string;
  sp_cost?: number;
  customer_cost?: number;
  total_cost?: number;
  is_header?: boolean;
  is_total?: boolean;
  is_yellow?: boolean; // Желтая заливка
  tooltip?: string; // Подсказка с формулой расчёта
}

const FinancialIndicators: React.FC = () => {
  const { theme: currentTheme } = useTheme();
  const [tenders, setTenders] = useState<Tender[]>([]);
  const [selectedTenderId, setSelectedTenderId] = useState<string | null>(null);
  const [selectedTenderTitle, setSelectedTenderTitle] = useState<string>('');
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<IndicatorRow[]>([]);
  const [totalArea, setTotalArea] = useState<number>(0);
  const [spTotal, setSpTotal] = useState<number>(0);
  const [customerTotal, setCustomerTotal] = useState<number>(0);
  // Загрузка тендеров
  useEffect(() => {
    loadTenders();
  }, []);

  const loadTenders = async () => {
    try {
      const { data: tendersData, error } = await supabase
        .from('tenders')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        await addNotification(
          'Ошибка загрузки списка тендеров',
          `Не удалось загрузить список тендеров: ${error.message}`,
          'warning'
        );
        throw error;
      }
      setTenders(tendersData || []);
    } catch (error: any) {
      console.error('Ошибка загрузки тендеров:', error);
    }
  };

  // Загрузка данных при выборе тендера
  useEffect(() => {
    if (selectedTenderId) {
      fetchFinancialIndicators();
    }
  }, [selectedTenderId]);

  // Функция для добавления уведомления
  const addNotification = async (title: string, message: string, type: 'success' | 'info' | 'warning' | 'pending' = 'warning') => {
    try {
      await supabase.from('notifications').insert({
        title,
        message,
        type,
        is_read: false,
      });
    } catch (error) {
      console.error('Ошибка создания уведомления:', error);
    }
  };

  const fetchFinancialIndicators = async () => {
    if (!selectedTenderId) return;

    setLoading(true);
    try {
      // Загружаем данные тендера (площади)
      const { data: tender, error: tenderError } = await supabase
        .from('tenders')
        .select('*')
        .eq('id', selectedTenderId)
        .single();

      if (tenderError) {
        await addNotification(
          'Ошибка загрузки тендера',
          `Не удалось загрузить данные тендера: ${tenderError.message}`,
          'warning'
        );
        throw tenderError;
      }

      // Загружаем тактику наценок для тендера (только базовую информацию)
      const { data: markupTactic, error: tacticError } = await supabase
        .from('markup_tactics')
        .select('*')
        .eq('id', tender.markup_tactic_id)
        .single();

      if (tacticError && tacticError.code !== 'PGRST116') {
        await addNotification(
          'Ошибка загрузки тактики наценок',
          `Не удалось загрузить тактику наценок: ${tacticError.message}`,
          'warning'
        );
      }

      // Загружаем проценты наценок для конкретного тендера с информацией о параметрах
      const { data: tenderMarkupPercentages, error: percentagesError } = await supabase
        .from('tender_markup_percentage')
        .select(`
          *,
          markup_parameter:markup_parameters(*)
        `)
        .eq('tender_id', selectedTenderId);

      if (percentagesError) {
        await addNotification(
          'Ошибка загрузки процентов наценок',
          `Не удалось загрузить проценты наценок: ${percentagesError.message}`,
          'warning'
        );
      }

      // Загружаем все boq_items для выбранного тендера
      const { data: boqItems, error: boqError } = await supabase
        .from('boq_items')
        .select(`
          *,
          client_position:client_positions!inner(tender_id)
        `)
        .eq('client_position.tender_id', selectedTenderId);

      if (boqError) throw boqError;

      // Считаем прямые затраты по типам (базовые цены без наценок)
      let subcontractWorks = 0;
      let subcontractMaterials = 0;
      let works = 0;
      let materials = 0;
      let materialsComp = 0;
      let worksComp = 0;

      boqItems?.forEach(item => {
        // Используем базовые цены (без наценок) для строк прямых затрат
        const baseCost = item.total_amount || 0;

        switch (item.boq_item_type) {
          case 'суб-раб':
            subcontractWorks += baseCost;
            break;
          case 'суб-мат':
            subcontractMaterials += baseCost;
            break;
          case 'раб':
            works += baseCost;
            break;
          case 'мат':
            materials += baseCost;
            break;
          case 'мат-комп.':
            materialsComp += baseCost;
            break;
          case 'раб-комп.':
            worksComp += baseCost;
            break;
        }
      });

      // Группируем затраты (БЕЗ комп. - они не участвуют в наценках)
      const subcontractTotal = subcontractWorks + subcontractMaterials; // Субподряд
      const su10Total = works + materials; // Работы + Материалы СУ-10 (БЕЗ комп.)

      // Прямые затраты всего (БЕЗ комп.)
      const directCostsTotal = subcontractTotal + su10Total;

      // Прямые затраты всего (С учётом комп. - только для отображения в строке 1)
      const directCostsTotalWithComp = directCostsTotal + materialsComp + worksComp;

      // Получаем площади из тендера
      const areaSp = tender?.area_sp || 0;
      const areaClient = tender?.area_client || 0;

      // Создаем массив параметров из tender_markup_percentage
      const markupParams = (tenderMarkupPercentages || [])
        .map(tmp => tmp.markup_parameter)
        .filter(Boolean); // Убираем null/undefined

      // Создаем мапу значений по ID параметров для быстрого доступа
      const percentagesMap = new Map<string, number>();
      tenderMarkupPercentages?.forEach(tmp => {
        percentagesMap.set(tmp.markup_parameter_id, tmp.value);
      });

      // Находим параметры для расчета
      const mechanizationParam = markupParams.find(p =>
        p.label.toLowerCase().includes('механизац') ||
        p.label.toLowerCase().includes('буринц')
      );

      const mvpGsmParam = markupParams.find(p =>
        p.label.toLowerCase().includes('мвп') ||
        p.label.toLowerCase().includes('гсм')
      );

      const warrantyParam = markupParams.find(p =>
        p.label.toLowerCase().includes('гарант')
      );

      const coefficient06Param = markupParams.find(p => {
        const name = p.label.toLowerCase();
        const key = p.key.toLowerCase();
        return name.includes('0,6') ||
               name.includes('0.6') ||
               name.includes('1,6') ||
               name.includes('1.6') ||
               (name.includes('раб') && name.includes('1')) ||
               key.includes('works_16') ||
               key.includes('works_markup');
      });

      // Параметры роста стоимости
      const worksCostGrowthParam = markupParams.find(p =>
        p.label.toLowerCase().includes('рост') &&
        p.label.toLowerCase().includes('работ') &&
        !p.label.toLowerCase().includes('субподряд')
      );

      const materialCostGrowthParam = markupParams.find(p =>
        p.label.toLowerCase().includes('рост') &&
        p.label.toLowerCase().includes('материал') &&
        !p.label.toLowerCase().includes('субподряд')
      );

      const subcontractWorksCostGrowthParam = markupParams.find(p =>
        p.label.toLowerCase().includes('рост') &&
        p.label.toLowerCase().includes('работ') &&
        p.label.toLowerCase().includes('субподряд')
      );

      const subcontractMaterialsCostGrowthParam = markupParams.find(p =>
        p.label.toLowerCase().includes('рост') &&
        p.label.toLowerCase().includes('материал') &&
        p.label.toLowerCase().includes('субподряд')
      );

      // Параметры ООЗ, ОФЗ и прибыли
      const overheadOwnForcesParam = markupParams.find(p =>
        p.label.toLowerCase().includes('ооз') &&
        !p.label.toLowerCase().includes('субподряд')
      );

      const overheadSubcontractParam = markupParams.find(p =>
        p.label.toLowerCase().includes('ооз') &&
        p.label.toLowerCase().includes('субподряд')
      );

      const generalCostsParam = markupParams.find(p =>
        p.label.toLowerCase().includes('офз') ||
        (p.label.toLowerCase().includes('общ') && p.label.toLowerCase().includes('затрат'))
      );

      const profitOwnForcesParam = markupParams.find(p =>
        p.label.toLowerCase().includes('прибыль') &&
        !p.label.toLowerCase().includes('субподряд')
      );

      const profitSubcontractParam = markupParams.find(p =>
        p.label.toLowerCase().includes('прибыль') &&
        p.label.toLowerCase().includes('субподряд')
      );

      // Параметр непредвиденных расходов
      const unforeseeableParam = markupParams.find(p =>
        p.label.toLowerCase().includes('непредвид') ||
        p.label.toLowerCase().includes('непредвиден')
      );

      // Получаем коэффициенты из введенных вручную значений (или из базовых, если не введены)
      const mechanizationCoeff = mechanizationParam
        ? (percentagesMap.get(mechanizationParam.id) ?? mechanizationParam.default_value)
        : 0;

      const mvpGsmCoeff = mvpGsmParam
        ? (percentagesMap.get(mvpGsmParam.id) ?? mvpGsmParam.default_value)
        : 0;

      const warrantyCoeff = warrantyParam
        ? (percentagesMap.get(warrantyParam.id) ?? warrantyParam.default_value)
        : 0;

      const coefficient06 = coefficient06Param
        ? (percentagesMap.get(coefficient06Param.id) ?? coefficient06Param.default_value)
        : 0;

      // Коэффициенты роста стоимости
      const worksCostGrowth = worksCostGrowthParam
        ? (percentagesMap.get(worksCostGrowthParam.id) ?? worksCostGrowthParam.default_value)
        : 0;

      const materialCostGrowth = materialCostGrowthParam
        ? (percentagesMap.get(materialCostGrowthParam.id) ?? materialCostGrowthParam.default_value)
        : 0;

      const subcontractWorksCostGrowth = subcontractWorksCostGrowthParam
        ? (percentagesMap.get(subcontractWorksCostGrowthParam.id) ?? subcontractWorksCostGrowthParam.default_value)
        : 0;

      const subcontractMaterialsCostGrowth = subcontractMaterialsCostGrowthParam
        ? (percentagesMap.get(subcontractMaterialsCostGrowthParam.id) ?? subcontractMaterialsCostGrowthParam.default_value)
        : 0;

      // Коэффициенты ООЗ, ОФЗ и прибыли
      const overheadOwnForcesCoeff = overheadOwnForcesParam
        ? (percentagesMap.get(overheadOwnForcesParam.id) ?? overheadOwnForcesParam.default_value)
        : 0;

      const overheadSubcontractCoeff = overheadSubcontractParam
        ? (percentagesMap.get(overheadSubcontractParam.id) ?? overheadSubcontractParam.default_value)
        : 0;

      const generalCostsCoeff = generalCostsParam
        ? (percentagesMap.get(generalCostsParam.id) ?? generalCostsParam.default_value)
        : 0;

      const profitOwnForcesCoeff = profitOwnForcesParam
        ? (percentagesMap.get(profitOwnForcesParam.id) ?? profitOwnForcesParam.default_value)
        : 0;

      const profitSubcontractCoeff = profitSubcontractParam
        ? (percentagesMap.get(profitSubcontractParam.id) ?? profitSubcontractParam.default_value)
        : 0;

      const unforeseeableCoeff = unforeseeableParam
        ? (percentagesMap.get(unforeseeableParam.id) ?? unforeseeableParam.default_value)
        : 0;

      // Debug logging для 0,6к параметра
      console.log('=== DEBUG 0,6к Parameter ===');
      console.log('All markup parameters:', markupParams.map(p => ({
        key: p.key,
        label: p.label,
        default_value: p.default_value
      })));
      console.log('Found 0,6к parameter:', coefficient06Param ? {
        key: coefficient06Param.key,
        label: coefficient06Param.label,
        default_value: coefficient06Param.default_value,
        manual_value: percentagesMap.get(coefficient06Param.id)
      } : 'NOT FOUND');
      console.log('Final coefficient06 value:', coefficient06);
      console.log('Works (раб):', works);
      console.log('WorksComp (раб-комп.):', worksComp);
      console.log('WorksSu10Only base:', works + worksComp);
      console.log('Calculated 0,6к cost:', (works + worksComp) * (coefficient06 / 100));
      console.log('=========================');

      // Расчет по базе (сумма всех базовых стоимостей по тактике)
      // Для большинства параметров база = сумма всех прямых затрат
      const baseForCalculation = directCostsTotal;

      // База для расчета механизации, МБП, гарантии - только работы СУ-10 (БЕЗ комп.)
      const worksSu10Only = works;

      // Строка - Служба механизации (применяется ТОЛЬКО к работам СУ-10 БЕЗ комп.)
      const mechanizationCost = worksSu10Only * (mechanizationCoeff / 100);

      // Строка "0,6 к (Раб+СМ)" = (Работы ПЗ + СМ) × процент
      const coefficient06Cost = (worksSu10Only + mechanizationCost) * (coefficient06 / 100);

      // Строка - МБП+ГСМ (применяется ТОЛЬКО к работам СУ-10 БЕЗ комп.)
      const mvpGsmCost = worksSu10Only * (mvpGsmCoeff / 100);

      // Строка - Гарантийный период (применяется ТОЛЬКО к работам СУ-10 БЕЗ комп.)
      const warrantyCost = worksSu10Only * (warrantyCoeff / 100);

      // Строка - Рост стоимости (инфляция)
      // Рост работ = (Работы + 0,6к + МБП + СМ) × процент роста
      const worksWithMarkup = worksSu10Only + coefficient06Cost + mvpGsmCost + mechanizationCost;
      const worksCostGrowthAmount = worksWithMarkup * (worksCostGrowth / 100);

      // Рост материалов - от базовых материалов
      const materialCostGrowthAmount = materials * (materialCostGrowth / 100);

      // Рост субподрядных работ - от базовых субподрядных работ
      const subcontractWorksCostGrowthAmount = subcontractWorks * (subcontractWorksCostGrowth / 100);

      // Рост субподрядных материалов - от базовых субподрядных материалов
      const subcontractMaterialsCostGrowthAmount = subcontractMaterials * (subcontractMaterialsCostGrowth / 100);

      // Общий рост стоимости
      const totalCostGrowth = worksCostGrowthAmount +
                              materialCostGrowthAmount +
                              subcontractWorksCostGrowthAmount +
                              subcontractMaterialsCostGrowthAmount;

      // Непредвиденные = (Работы + 0,6к + Материалы + МБП + СМ) × процент
      const baseForUnforeseeable = worksSu10Only + coefficient06Cost + materials + mvpGsmCost + mechanizationCost;
      const unforeseeableCost = baseForUnforeseeable * (unforeseeableCoeff / 100);

      // ООЗ = (Работы + 0,6к + Материалы + МБП + СМ + Рост работ + Рост материалов + Непредвиденные) × процент
      const baseForOOZ = baseForUnforeseeable + worksCostGrowthAmount + materialCostGrowthAmount + unforeseeableCost;
      const overheadOwnForcesCost = baseForOOZ * (overheadOwnForcesCoeff / 100);

      // ООЗ Субподряд = (Субподряд ПЗ + Рост субподряда) × процент ООЗ
      const subcontractGrowth = subcontractWorksCostGrowthAmount + subcontractMaterialsCostGrowthAmount;
      const baseForSubcontractOOZ = subcontractTotal + subcontractGrowth;
      const overheadSubcontractCost = baseForSubcontractOOZ * (overheadSubcontractCoeff / 100);

      // ОФЗ = (Работы + 0,6к + Материалы + МБП + СМ + Рост работ + Рост материалов + ООЗ) × процент
      const baseForOFZ = baseForOOZ + overheadOwnForcesCost;
      const generalCostsCost = baseForOFZ * (generalCostsCoeff / 100);

      // Прибыль = (Работы + 0,6к + Материалы + МБП + СМ + Рост работ + Рост материалов + Непредвиденные + ООЗ + ОФЗ) × процент
      const baseForProfit = baseForOFZ + generalCostsCost;
      const profitOwnForcesCost = baseForProfit * (profitOwnForcesCoeff / 100);

      // Прибыль Субподряд = (Субподряд ПЗ + Рост субподряда + ООЗ Субподряд) × процент
      const baseForSubcontractProfit = baseForSubcontractOOZ + overheadSubcontractCost;
      const profitSubcontractCost = baseForSubcontractProfit * (profitSubcontractCoeff / 100);

      // Итого: сумма всех строк (прямые затраты С комп. + все наценки)
      const grandTotal = directCostsTotalWithComp +
                        mechanizationCost +
                        mvpGsmCost +
                        warrantyCost +
                        coefficient06Cost +
                        totalCostGrowth +
                        unforeseeableCost +
                        overheadOwnForcesCost +
                        overheadSubcontractCost +
                        generalCostsCost +
                        profitOwnForcesCost +
                        profitSubcontractCost;

      // Debug: проверка расхождений
      console.log('=== Financial Indicators Calculation ===');
      console.log('Direct costs (base):', directCostsTotal);
      console.log('  - Subcontract:', subcontractTotal);
      console.log('  - SU-10:', su10Total);
      console.log('Mechanization:', mechanizationCost);
      console.log('MVP+GSM:', mvpGsmCost);
      console.log('Warranty:', warrantyCost);
      console.log('0.6k coefficient:', coefficient06Cost);
      console.log('Cost growth (inflation):', totalCostGrowth);
      console.log('Unforeseeable:', unforeseeableCost);
      console.log('Overhead own forces:', overheadOwnForcesCost);
      console.log('Overhead subcontract:', overheadSubcontractCost);
      console.log('General costs (OFZ):', generalCostsCost);
      console.log('Profit own forces:', profitOwnForcesCost);
      console.log('Profit subcontract:', profitSubcontractCost);
      console.log('GRAND TOTAL (sum of all rows):', grandTotal);
      console.log('=======================================');

      // Формируем данные для таблицы
      const tableData: IndicatorRow[] = [
        {
          key: '1',
          row_number: 1,
          indicator_name: 'Прямые затраты, в т.ч.',
          coefficient: '',
          sp_cost: areaSp > 0 ? directCostsTotalWithComp / areaSp : 0,
          customer_cost: areaClient > 0 ? directCostsTotalWithComp / areaClient : 0,
          total_cost: directCostsTotalWithComp,
          tooltip: `Состав прямых затрат:\n` +
                   `Субподряд работы: ${subcontractWorks.toLocaleString('ru-RU', { maximumFractionDigits: 2 })}\n` +
                   `+ Субподряд материалы: ${subcontractMaterials.toLocaleString('ru-RU', { maximumFractionDigits: 2 })}\n` +
                   `+ Работы СУ-10: ${works.toLocaleString('ru-RU', { maximumFractionDigits: 2 })}\n` +
                   `+ Материалы СУ-10: ${materials.toLocaleString('ru-RU', { maximumFractionDigits: 2 })}\n` +
                   `+ Работы комп.: ${worksComp.toLocaleString('ru-RU', { maximumFractionDigits: 2 })}\n` +
                   `+ Материалы комп.: ${materialsComp.toLocaleString('ru-RU', { maximumFractionDigits: 2 })}\n` +
                   `= ${directCostsTotalWithComp.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} руб.`
        },
        {
          key: '2',
          row_number: 2,
          indicator_name: 'Субподряд',
          sp_cost: areaSp > 0 ? subcontractTotal / areaSp : 0,
          customer_cost: areaClient > 0 ? subcontractTotal / areaClient : 0,
          total_cost: subcontractTotal
        },
        {
          key: '3',
          row_number: 3,
          indicator_name: 'Работы + Материалы СУ-10',
          sp_cost: areaSp > 0 ? su10Total / areaSp : 0,
          customer_cost: areaClient > 0 ? su10Total / areaClient : 0,
          total_cost: su10Total
        },
        {
          key: '4',
          row_number: 4,
          indicator_name: 'Служба механизации раб (бурильщики, автотехника, электрики)',
          coefficient: mechanizationCoeff > 0 ? `${mechanizationCoeff.toFixed(2)}%` : '',
          sp_cost: areaSp > 0 ? mechanizationCost / areaSp : 0,
          customer_cost: areaClient > 0 ? mechanizationCost / areaClient : 0,
          total_cost: mechanizationCost,
          tooltip: `Формула: Работы СУ-10 × ${mechanizationCoeff}%\n` +
                   `Расчёт: ${worksSu10Only.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} × ${mechanizationCoeff}% = ${mechanizationCost.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} руб.`
        },
        {
          key: '5',
          row_number: 5,
          indicator_name: 'МБП+ГСМ (топливо+масло)',
          coefficient: mvpGsmCoeff > 0 ? `${mvpGsmCoeff.toFixed(2)}%` : '',
          sp_cost: areaSp > 0 ? mvpGsmCost / areaSp : 0,
          customer_cost: areaClient > 0 ? mvpGsmCost / areaClient : 0,
          total_cost: mvpGsmCost,
          tooltip: `Формула: Работы СУ-10 × ${mvpGsmCoeff}%\n` +
                   `Расчёт: ${worksSu10Only.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} × ${mvpGsmCoeff}% = ${mvpGsmCost.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} руб.`
        },
        {
          key: '6',
          row_number: 6,
          indicator_name: 'Гарантийный период (Коэф. не применяется)',
          coefficient: warrantyCoeff > 0 ? `${warrantyCoeff.toFixed(2)}%` : '',
          sp_cost: areaSp > 0 ? warrantyCost / areaSp : 0,
          customer_cost: areaClient > 0 ? warrantyCost / areaClient : 0,
          total_cost: warrantyCost,
          tooltip: `Формула: Работы СУ-10 × ${warrantyCoeff}%\n` +
                   `Расчёт: ${worksSu10Only.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} × ${warrantyCoeff}% = ${warrantyCost.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} руб.`
        },
        {
          key: '7',
          row_number: 7,
          indicator_name: '0,6 к (Раб+СМ)',
          coefficient: coefficient06 > 0 ? `${coefficient06.toFixed(2)}%` : '',
          sp_cost: areaSp > 0 ? coefficient06Cost / areaSp : 0,
          customer_cost: areaClient > 0 ? coefficient06Cost / areaClient : 0,
          total_cost: coefficient06Cost,
          tooltip: `Формула: (Работы ПЗ + СМ) × ${coefficient06}%\n` +
                   `Работы ПЗ: ${worksSu10Only.toLocaleString('ru-RU', { maximumFractionDigits: 2 })}\n` +
                   `+ СМ: ${mechanizationCost.toLocaleString('ru-RU', { maximumFractionDigits: 2 })}\n` +
                   `= ${(worksSu10Only + mechanizationCost).toLocaleString('ru-RU', { maximumFractionDigits: 2 })}\n` +
                   `Расчёт: ${(worksSu10Only + mechanizationCost).toLocaleString('ru-RU', { maximumFractionDigits: 2 })} × ${coefficient06}% = ${coefficient06Cost.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} руб.`
        },
        {
          key: '8',
          row_number: 8,
          indicator_name: 'Рост стоимости',
          coefficient: [
            worksCostGrowth > 0 ? `Раб:${worksCostGrowth}%` : '',
            materialCostGrowth > 0 ? `Мат:${materialCostGrowth}%` : '',
            subcontractWorksCostGrowth > 0 ? `С.Раб:${subcontractWorksCostGrowth}%` : '',
            subcontractMaterialsCostGrowth > 0 ? `С.Мат:${subcontractMaterialsCostGrowth}%` : ''
          ].filter(Boolean).join(', '),
          sp_cost: areaSp > 0 ? totalCostGrowth / areaSp : 0,
          customer_cost: areaClient > 0 ? totalCostGrowth / areaClient : 0,
          total_cost: totalCostGrowth,
          tooltip: `Формула: Рост по каждой категории отдельно\n` +
                   `Работы СУ-10: (Работы + 0,6к + МБП + СМ) × ${worksCostGrowth}%\n` +
                   `  Работы: ${worksSu10Only.toLocaleString('ru-RU', { maximumFractionDigits: 2 })}\n` +
                   `  + 0,6к: ${coefficient06Cost.toLocaleString('ru-RU', { maximumFractionDigits: 2 })}\n` +
                   `  + МБП: ${mvpGsmCost.toLocaleString('ru-RU', { maximumFractionDigits: 2 })}\n` +
                   `  + СМ: ${mechanizationCost.toLocaleString('ru-RU', { maximumFractionDigits: 2 })}\n` +
                   `  = ${worksWithMarkup.toLocaleString('ru-RU', { maximumFractionDigits: 2 })}\n` +
                   `  Рост: ${worksWithMarkup.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} × ${worksCostGrowth}% = ${worksCostGrowthAmount.toLocaleString('ru-RU', { maximumFractionDigits: 2 })}\n` +
                   `Материалы СУ-10: ${materials.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} × ${materialCostGrowth}% = ${materialCostGrowthAmount.toLocaleString('ru-RU', { maximumFractionDigits: 2 })}\n` +
                   `Работы субподряд: ${subcontractWorks.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} × ${subcontractWorksCostGrowth}% = ${subcontractWorksCostGrowthAmount.toLocaleString('ru-RU', { maximumFractionDigits: 2 })}\n` +
                   `Материалы субподряд: ${subcontractMaterials.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} × ${subcontractMaterialsCostGrowth}% = ${subcontractMaterialsCostGrowthAmount.toLocaleString('ru-RU', { maximumFractionDigits: 2 })}\n` +
                   `Итого: ${totalCostGrowth.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} руб.`
        },
        {
          key: '9',
          row_number: 9,
          indicator_name: 'Непредвиденные',
          coefficient: unforeseeableCoeff > 0 ? `${unforeseeableCoeff.toFixed(2)}%` : '',
          sp_cost: areaSp > 0 ? unforeseeableCost / areaSp : 0,
          customer_cost: areaClient > 0 ? unforeseeableCost / areaClient : 0,
          total_cost: unforeseeableCost,
          tooltip: `Формула: (Работы + 0,6к + Материалы + МБП + СМ) × ${unforeseeableCoeff}%\n` +
                   `Работы: ${worksSu10Only.toLocaleString('ru-RU', { maximumFractionDigits: 2 })}\n` +
                   `+ 0,6к: ${coefficient06Cost.toLocaleString('ru-RU', { maximumFractionDigits: 2 })}\n` +
                   `+ Материалы: ${materials.toLocaleString('ru-RU', { maximumFractionDigits: 2 })}\n` +
                   `+ МБП: ${mvpGsmCost.toLocaleString('ru-RU', { maximumFractionDigits: 2 })}\n` +
                   `+ СМ: ${mechanizationCost.toLocaleString('ru-RU', { maximumFractionDigits: 2 })}\n` +
                   `= ${baseForUnforeseeable.toLocaleString('ru-RU', { maximumFractionDigits: 2 })}\n` +
                   `Расчёт: ${baseForUnforeseeable.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} × ${unforeseeableCoeff}% = ${unforeseeableCost.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} руб.`
        },
        {
          key: '10',
          row_number: 10,
          indicator_name: 'ООЗ',
          coefficient: overheadOwnForcesCoeff > 0 ? `${overheadOwnForcesCoeff.toFixed(2)}%` : '',
          sp_cost: areaSp > 0 ? overheadOwnForcesCost / areaSp : 0,
          customer_cost: areaClient > 0 ? overheadOwnForcesCost / areaClient : 0,
          total_cost: overheadOwnForcesCost,
          tooltip: `Формула: (Работы + 0,6к + Материалы + МБП + СМ + Рост работ + Рост материалов + Непредвиденные) × ${overheadOwnForcesCoeff}%\n` +
                   `Работы + 0,6к + Материалы + МБП + СМ: ${baseForUnforeseeable.toLocaleString('ru-RU', { maximumFractionDigits: 2 })}\n` +
                   `+ Рост работ: ${worksCostGrowthAmount.toLocaleString('ru-RU', { maximumFractionDigits: 2 })}\n` +
                   `+ Рост материалов: ${materialCostGrowthAmount.toLocaleString('ru-RU', { maximumFractionDigits: 2 })}\n` +
                   `+ Непредвиденные: ${unforeseeableCost.toLocaleString('ru-RU', { maximumFractionDigits: 2 })}\n` +
                   `= ${baseForOOZ.toLocaleString('ru-RU', { maximumFractionDigits: 2 })}\n` +
                   `Расчёт: ${baseForOOZ.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} × ${overheadOwnForcesCoeff}% = ${overheadOwnForcesCost.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} руб.`
        },
        {
          key: '11',
          row_number: 11,
          indicator_name: 'ООЗ Субподряд',
          coefficient: overheadSubcontractCoeff > 0 ? `${overheadSubcontractCoeff.toFixed(2)}%` : '',
          sp_cost: areaSp > 0 ? overheadSubcontractCost / areaSp : 0,
          customer_cost: areaClient > 0 ? overheadSubcontractCost / areaClient : 0,
          total_cost: overheadSubcontractCost,
          tooltip: `Формула: (Субподряд ПЗ + Рост субподряда) × ${overheadSubcontractCoeff}%\n` +
                   `Субподряд ПЗ: ${subcontractTotal.toLocaleString('ru-RU', { maximumFractionDigits: 2 })}\n` +
                   `+ Рост субподряда: ${subcontractGrowth.toLocaleString('ru-RU', { maximumFractionDigits: 2 })}\n` +
                   `  (Рост работ: ${subcontractWorksCostGrowthAmount.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} + Рост мат.: ${subcontractMaterialsCostGrowthAmount.toLocaleString('ru-RU', { maximumFractionDigits: 2 })})\n` +
                   `= ${baseForSubcontractOOZ.toLocaleString('ru-RU', { maximumFractionDigits: 2 })}\n` +
                   `Расчёт: ${baseForSubcontractOOZ.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} × ${overheadSubcontractCoeff}% = ${overheadSubcontractCost.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} руб.`
        },
        {
          key: '12',
          row_number: 12,
          indicator_name: 'ОФЗ',
          coefficient: generalCostsCoeff > 0 ? `${generalCostsCoeff.toFixed(2)}%` : '',
          sp_cost: areaSp > 0 ? generalCostsCost / areaSp : 0,
          customer_cost: areaClient > 0 ? generalCostsCost / areaClient : 0,
          total_cost: generalCostsCost,
          tooltip: `Формула: (Работы + 0,6к + Материалы + МБП + СМ + Рост работ + Рост материалов + Непредвиденные + ООЗ) × ${generalCostsCoeff}%\n` +
                   `Работы + 0,6к + Материалы + МБП + СМ + Рост + Непредв.: ${baseForOOZ.toLocaleString('ru-RU', { maximumFractionDigits: 2 })}\n` +
                   `+ ООЗ: ${overheadOwnForcesCost.toLocaleString('ru-RU', { maximumFractionDigits: 2 })}\n` +
                   `= ${baseForOFZ.toLocaleString('ru-RU', { maximumFractionDigits: 2 })}\n` +
                   `Расчёт: ${baseForOFZ.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} × ${generalCostsCoeff}% = ${generalCostsCost.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} руб.`
        },
        {
          key: '13',
          row_number: 13,
          indicator_name: 'Прибыль',
          coefficient: profitOwnForcesCoeff > 0 ? `${profitOwnForcesCoeff.toFixed(2)}%` : '',
          sp_cost: areaSp > 0 ? profitOwnForcesCost / areaSp : 0,
          customer_cost: areaClient > 0 ? profitOwnForcesCost / areaClient : 0,
          total_cost: profitOwnForcesCost,
          tooltip: `Формула: (Работы + 0,6к + Материалы + МБП + СМ + Рост работ + Рост материалов + Непредвиденные + ООЗ + ОФЗ) × ${profitOwnForcesCoeff}%\n` +
                   `Работы + 0,6к + Материалы + МБП + СМ + Рост + Непредв. + ООЗ: ${baseForOFZ.toLocaleString('ru-RU', { maximumFractionDigits: 2 })}\n` +
                   `+ ОФЗ: ${generalCostsCost.toLocaleString('ru-RU', { maximumFractionDigits: 2 })}\n` +
                   `= ${baseForProfit.toLocaleString('ru-RU', { maximumFractionDigits: 2 })}\n` +
                   `Расчёт: ${baseForProfit.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} × ${profitOwnForcesCoeff}% = ${profitOwnForcesCost.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} руб.`
        },
        {
          key: '14',
          row_number: 14,
          indicator_name: 'Прибыль субподряд',
          coefficient: profitSubcontractCoeff > 0 ? `${profitSubcontractCoeff.toFixed(2)}%` : '',
          sp_cost: areaSp > 0 ? profitSubcontractCost / areaSp : 0,
          customer_cost: areaClient > 0 ? profitSubcontractCost / areaClient : 0,
          total_cost: profitSubcontractCost,
          tooltip: `Формула: (Субподряд ПЗ + Рост субподряда + ООЗ Субподряд) × ${profitSubcontractCoeff}%\n` +
                   `Субподряд ПЗ + Рост: ${baseForSubcontractOOZ.toLocaleString('ru-RU', { maximumFractionDigits: 2 })}\n` +
                   `+ ООЗ Субподряд: ${overheadSubcontractCost.toLocaleString('ru-RU', { maximumFractionDigits: 2 })}\n` +
                   `= ${baseForSubcontractProfit.toLocaleString('ru-RU', { maximumFractionDigits: 2 })}\n` +
                   `Расчёт: ${baseForSubcontractProfit.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} × ${profitSubcontractCoeff}% = ${profitSubcontractCost.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} руб.`
        },
        {
          key: '15',
          row_number: 15,
          indicator_name: 'ИТОГО',
          coefficient: '',
          sp_cost: areaSp > 0 ? grandTotal / areaSp : 0,
          customer_cost: areaClient > 0 ? grandTotal / areaClient : 0,
          total_cost: grandTotal,
          is_total: true
        },
      ];

      setData(tableData);

      // Устанавливаем площади из тендера
      setTotalArea(areaSp); // Общая площадь - используем площадь СП
      setSpTotal(areaSp);
      setCustomerTotal(areaClient);
    } catch (error: any) {
      console.error('Ошибка загрузки показателей:', error);
      await addNotification(
        'Ошибка загрузки финансовых показателей',
        `Не удалось загрузить финансовые показатели: ${error.message || error}`,
        'warning'
      );
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (value: number | undefined) => {
    if (value === undefined) return '';
    return value.toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  };

  const columns: ColumnsType<IndicatorRow> = [
    {
      title: '№ п/п',
      dataIndex: 'row_number',
      key: 'row_number',
      width: 60,
      align: 'center',
    },
    {
      title: 'Наименование',
      dataIndex: 'indicator_name',
      key: 'indicator_name',
      width: 400,
      render: (text, record) => {
        // Строки 2-3 (подпункты прямых затрат) выравниваем с отступом
        const isIndented = record.row_number >= 2 && record.row_number <= 3;
        const content = (
          <Text
            strong={record.is_header || record.is_total}
            style={isIndented ? { paddingLeft: '40px' } : {}}
          >
            {text}
          </Text>
        );

        // Если есть подсказка, оборачиваем в Tooltip
        if (record.tooltip) {
          return (
            <Tooltip title={<pre style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{record.tooltip}</pre>}>
              {content}
            </Tooltip>
          );
        }

        return content;
      },
    },
    {
      title: 'коэф-ты',
      dataIndex: 'coefficient',
      key: 'coefficient',
      width: 120,
      align: 'center',
    },
    {
      title: (
        <div style={{ textAlign: 'center' }}>
          <div>Площадь по СП</div>
          <div>{formatNumber(spTotal)} м²</div>
        </div>
      ),
      key: 'sp_cost',
      width: 150,
      align: 'center',
      render: (_, record) => {
        if (record.is_header) return 'стоимость на 1м²';
        return <Text strong={record.is_total}>{formatNumber(record.sp_cost)}</Text>;
      },
    },
    {
      title: (
        <div style={{ textAlign: 'center' }}>
          <div>Площадь Заказчика</div>
          <div>{formatNumber(customerTotal)} м²</div>
        </div>
      ),
      key: 'customer_cost',
      width: 150,
      align: 'center',
      render: (_, record) => {
        if (record.is_header) return 'стоимость на 1м²';
        return <Text strong={record.is_total}>{formatNumber(record.customer_cost)}</Text>;
      },
    },
    {
      title: 'Итого',
      dataIndex: 'total_cost',
      key: 'total_cost',
      width: 200,
      align: 'right',
      render: (value, record) => {
        if (record.is_header) return 'итоговая стоимость';
        return <Text strong={record.is_total}>{formatNumber(value)}</Text>;
      },
    },
  ];

  // Получение уникальных наименований тендеров
  const getTenderTitles = () => {
    const uniqueTitles = new Map<string, { value: string; label: string }>();

    tenders.forEach(tender => {
      if (!uniqueTitles.has(tender.title)) {
        uniqueTitles.set(tender.title, {
          value: tender.title,
          label: tender.title,
        });
      }
    });

    return Array.from(uniqueTitles.values());
  };

  // Получение версий для выбранного тендера
  const getVersionsForTitle = (title: string) => {
    return tenders
      .filter(t => t.title === title)
      .map(t => ({
        value: t.version || 1,
        label: `Версия ${t.version || 1}`,
      }));
  };

  // Обработка выбора наименования тендера
  const handleTenderTitleChange = (title: string) => {
    setSelectedTenderTitle(title);
    // Сбрасываем версию и ID при смене тендера
    setSelectedVersion(null);
    setSelectedTenderId(null);
    setData([]);
  };

  // Обработка выбора версии
  const handleVersionChange = (version: number) => {
    setSelectedVersion(version);
    const tender = tenders.find(t => t.title === selectedTenderTitle && t.version === version);
    if (tender) {
      setSelectedTenderId(tender.id);
    }
  };

  // Если тендер не выбран, показываем только выбор тендера
  if (!selectedTenderId) {
    return (
      <div style={{ margin: '-16px', padding: '24px' }}>
        <Card bordered={false} style={{ height: '100%' }}>
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <Title level={4} style={{ marginBottom: 24 }}>
              Финансовые показатели
            </Title>
            <Text type="secondary" style={{ fontSize: 16, marginBottom: 24, display: 'block' }}>
              Выберите тендер для просмотра показателей
            </Text>
            <Select
              style={{ width: 400, marginBottom: 32 }}
              placeholder="Выберите тендер"
              value={selectedTenderTitle}
              onChange={handleTenderTitleChange}
              showSearch
              optionFilterProp="children"
              filterOption={(input, option) =>
                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
              options={getTenderTitles()}
              size="large"
            />

            {selectedTenderTitle && (
              <Select
                style={{ width: 200, marginBottom: 32, marginLeft: 16 }}
                placeholder="Выберите версию"
                value={selectedVersion}
                onChange={handleVersionChange}
                options={getVersionsForTitle(selectedTenderTitle)}
                size="large"
              />
            )}

            {/* Быстрый выбор через карточки */}
            {tenders.length > 0 && (
              <div style={{ marginTop: 32 }}>
                <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
                  Или выберите из списка:
                </Text>
                <Row gutter={[16, 16]} justify="center">
                  {tenders.slice(0, 6).map(tender => (
                    <Col key={tender.id}>
                      <Card
                        hoverable
                        style={{
                          width: 200,
                          textAlign: 'center',
                          cursor: 'pointer'
                        }}
                        onClick={() => {
                          // При быстром выборе через карточку - автоматически выбираем тендер и версию
                          setSelectedTenderTitle(tender.title);
                          setSelectedVersion(tender.version || 1);
                          setSelectedTenderId(tender.id);
                        }}
                      >
                        <div style={{ marginBottom: 8 }}>
                          <Tag color="blue">{tender.tender_number}</Tag>
                        </div>
                        <div style={{ marginBottom: 8 }}>
                          <Text strong style={{ marginRight: 8 }}>
                            {tender.title}
                          </Text>
                          <Tag color="orange">v{tender.version || 1}</Tag>
                        </div>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {tender.client_name}
                        </Text>
                      </Card>
                    </Col>
                  ))}
                </Row>
              </div>
            )}
          </div>
        </Card>
      </div>
    );
  }

  // Если тендер выбран, показываем таблицу с данными
  return (
    <div style={{ margin: '-16px', padding: '24px' }}>
      {/* Кнопка "Назад" */}
      <div style={{ marginBottom: 16 }}>
        <Button
          type="primary"
          style={{ backgroundColor: '#10b981', borderColor: '#10b981' }}
          onClick={() => {
            setSelectedTenderId(null);
            setSelectedTenderTitle('');
            setSelectedVersion(null);
            setData([]);
          }}
        >
          ← Назад к выбору тендера
        </Button>
      </div>

      {/* Заголовок страницы */}
      <div style={{ marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>
          Финансовые показатели
        </Title>
      </div>

      {/* Выбор тендера и версии */}
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <Space size="small">
          <Text type="secondary">Тендер:</Text>
          <Select
            style={{ width: 300 }}
            placeholder="Выберите тендер"
            value={selectedTenderTitle}
            onChange={handleTenderTitleChange}
            loading={loading}
            options={getTenderTitles()}
            showSearch
            optionFilterProp="children"
            filterOption={(input, option) =>
              (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
            }
          />
        </Space>
        {selectedTenderTitle && (
          <Space size="small">
            <Text type="secondary">Версия:</Text>
            <Select
              style={{ width: 150 }}
              placeholder="Выберите версию"
              value={selectedVersion}
              onChange={handleVersionChange}
              options={getVersionsForTitle(selectedTenderTitle)}
            />
          </Space>
        )}
        <Button
          icon={<ReloadOutlined />}
          onClick={fetchFinancialIndicators}
        >
          Обновить
        </Button>
        <Button
          icon={<DownloadOutlined />}
          type="primary"
        >
          Экспорт
        </Button>
      </div>

      {/* Таблица с данными */}
      <Card bordered={false}>
        <div style={{ marginBottom: 24 }}>
          <Title level={3} style={{ margin: 0, textAlign: 'center', color: '#ff4d4f' }}>
            Полный объём строительства
          </Title>
          {selectedTenderTitle && (
            <Title level={4} style={{ margin: '8px 0 0 0', textAlign: 'center', color: '#ff4d4f' }}>
              {selectedTenderTitle}
            </Title>
          )}
          <div style={{ textAlign: 'center', marginTop: 8 }}>
            <Text type="secondary">
              {dayjs().format('DD.MM.YYYY')}
            </Text>
          </div>
        </div>

        <Spin spinning={loading}>
          <Table
            columns={columns}
            dataSource={data}
            pagination={false}
            bordered
            size="small"
            rowClassName={(record) => {
              if (record.is_header) return `header-row-${currentTheme}`;
              if (record.is_total) return `total-row-${currentTheme}`;
              if (record.is_yellow) return `yellow-row-${currentTheme}`;
              return '';
            }}
          />
        </Spin>

        <style>{`
          /* Светлая тема */
          .header-row-light {
            background-color: #e6f7ff !important;
            font-weight: bold;
          }
          .total-row-light {
            background-color: #f0f0f0 !important;
            font-weight: bold;
          }
          .yellow-row-light {
            background-color: #fff9e6 !important;
          }
          /* Темная тема */
          .header-row-dark {
            background-color: #1f1f1f !important;
            font-weight: bold;
          }
          .total-row-dark {
            background-color: #262626 !important;
            font-weight: bold;
          }
          .yellow-row-dark {
            background-color: #3a3a1a !important;
          }
        `}</style>
      </Card>
    </div>
  );
};

export default FinancialIndicators;
