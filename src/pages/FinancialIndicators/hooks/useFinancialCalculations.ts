import { useState, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';

export interface IndicatorRow {
  key: string;
  row_number: number;
  indicator_name: string;
  coefficient?: string;
  sp_cost?: number;
  customer_cost?: number;
  total_cost?: number;
  is_header?: boolean;
  is_total?: boolean;
  is_yellow?: boolean;
  tooltip?: string;
  // Промежуточные расчеты для роста стоимости
  works_su10_growth?: number;
  materials_su10_growth?: number;
  works_sub_growth?: number;
  materials_sub_growth?: number;
}

const addNotification = async (
  title: string,
  message: string,
  type: 'success' | 'info' | 'warning' | 'pending' = 'warning'
) => {
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

export const useFinancialCalculations = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<IndicatorRow[]>([]);
  const [spTotal, setSpTotal] = useState<number>(0);
  const [customerTotal, setCustomerTotal] = useState<number>(0);

  const fetchFinancialIndicators = useCallback(async (selectedTenderId: string | null) => {
    if (!selectedTenderId) return;

    setLoading(true);
    try {
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

      const { error: tacticError } = await supabase
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

      // Загружаем ВСЕ BOQ элементы с батчингом (Supabase лимит 1000 строк)
      let boqItems: any[] = [];
      let from = 0;
      const batchSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from('boq_items')
          .select(`
            *,
            client_position:client_positions!inner(tender_id)
          `)
          .eq('client_position.tender_id', selectedTenderId)
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

      // Загрузка исключений роста субподряда для текущего тендера
      const { data: exclusions } = await supabase
        .from('subcontract_growth_exclusions')
        .select('detail_cost_category_id')
        .eq('tender_id', selectedTenderId);

      const excludedCategoryIds = new Set(
        exclusions?.map(e => e.detail_cost_category_id) || []
      );

      // Расчет прямых затрат
      let subcontractWorks = 0;
      let subcontractMaterials = 0;
      let subcontractWorksForGrowth = 0; // Субподряд работы для расчета роста (с учетом исключений)
      let subcontractMaterialsForGrowth = 0; // Субподряд материалы для расчета роста (с учетом исключений)
      let works = 0;
      let materials = 0;
      let materialsComp = 0;
      let worksComp = 0;

      boqItems?.forEach(item => {
        const baseCost = item.total_amount || 0;
        const categoryId = item.detail_cost_category_id;
        const isExcludedFromGrowth = categoryId && excludedCategoryIds.has(categoryId);

        switch (item.boq_item_type) {
          case 'суб-раб':
            subcontractWorks += baseCost; // Всегда включаем в общую сумму
            if (!isExcludedFromGrowth) {
              subcontractWorksForGrowth += baseCost; // Включаем в базу для роста только если не исключено
            }
            break;
          case 'суб-мат':
            subcontractMaterials += baseCost; // Всегда включаем в общую сумму
            if (!isExcludedFromGrowth) {
              subcontractMaterialsForGrowth += baseCost; // Включаем в базу для роста только если не исключено
            }
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

      const subcontractTotal = subcontractWorks + subcontractMaterials;
      const su10Total = works + materials + materialsComp + worksComp;
      const directCostsTotal = subcontractTotal + su10Total;

      const areaSp = tender?.area_sp || 0;
      const areaClient = tender?.area_client || 0;

      const markupParams = (tenderMarkupPercentages || [])
        .map(tmp => tmp.markup_parameter)
        .filter(Boolean);

      const percentagesMap = new Map<string, number>();
      tenderMarkupPercentages?.forEach(tmp => {
        percentagesMap.set(tmp.markup_parameter_id, tmp.value);
      });

      // Получение параметров наценок
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

      const unforeseeableParam = markupParams.find(p =>
        p.label.toLowerCase().includes('непредвид') ||
        p.label.toLowerCase().includes('непредвиден')
      );

      const vatParam = markupParams.find(p =>
        p.label.toLowerCase().includes('ндс')
      );

      // Получение коэффициентов
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

      const vatCoeff = vatParam
        ? (percentagesMap.get(vatParam.id) ?? vatParam.default_value)
        : 0;

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

      const worksSu10Only = works;
      const mechanizationCost = worksSu10Only * (mechanizationCoeff / 100);
      const coefficient06Cost = (worksSu10Only + mechanizationCost) * (coefficient06 / 100);
      const mvpGsmCost = worksSu10Only * (mvpGsmCoeff / 100);
      const warrantyCost = worksSu10Only * (warrantyCoeff / 100);

      const worksWithMarkup = worksSu10Only + coefficient06Cost + mvpGsmCost + mechanizationCost;
      const worksCostGrowthAmount = worksWithMarkup * (worksCostGrowth / 100);
      const materialCostGrowthAmount = materials * (materialCostGrowth / 100);
      // Используем отфильтрованные суммы для расчета роста субподряда
      const subcontractWorksCostGrowthAmount = subcontractWorksForGrowth * (subcontractWorksCostGrowth / 100);
      const subcontractMaterialsCostGrowthAmount = subcontractMaterialsForGrowth * (subcontractMaterialsCostGrowth / 100);

      const totalCostGrowth = worksCostGrowthAmount +
                              materialCostGrowthAmount +
                              subcontractWorksCostGrowthAmount +
                              subcontractMaterialsCostGrowthAmount;

      const baseForUnforeseeable = worksSu10Only + coefficient06Cost + materials + mvpGsmCost + mechanizationCost;
      const unforeseeableCost = baseForUnforeseeable * (unforeseeableCoeff / 100);

      const baseForOOZ = baseForUnforeseeable + worksCostGrowthAmount + materialCostGrowthAmount + unforeseeableCost;
      const overheadOwnForcesCost = baseForOOZ * (overheadOwnForcesCoeff / 100);

      const subcontractGrowth = subcontractWorksCostGrowthAmount + subcontractMaterialsCostGrowthAmount;
      const baseForSubcontractOOZ = subcontractTotal + subcontractGrowth;
      const overheadSubcontractCost = baseForSubcontractOOZ * (overheadSubcontractCoeff / 100);

      const baseForOFZ = baseForOOZ + overheadOwnForcesCost;
      const generalCostsCost = baseForOFZ * (generalCostsCoeff / 100);

      const baseForProfit = baseForOFZ + generalCostsCost;
      const profitOwnForcesCost = baseForProfit * (profitOwnForcesCoeff / 100);

      const baseForSubcontractProfit = baseForSubcontractOOZ + overheadSubcontractCost;
      const profitSubcontractCost = baseForSubcontractProfit * (profitSubcontractCoeff / 100);

      const grandTotalBeforeVAT = directCostsTotal +
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

      const vatCost = grandTotalBeforeVAT * (vatCoeff / 100);
      const grandTotal = grandTotalBeforeVAT + vatCost;

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

      const tableData: IndicatorRow[] = [
        {
          key: '1',
          row_number: 1,
          indicator_name: 'Прямые затраты, в т.ч.',
          coefficient: '',
          sp_cost: areaSp > 0 ? directCostsTotal / areaSp : 0,
          customer_cost: areaClient > 0 ? directCostsTotal / areaClient : 0,
          total_cost: directCostsTotal,
          tooltip: `Состав прямых затрат:\n` +
                   `Субподряд работы: ${subcontractWorks.toLocaleString('ru-RU', { maximumFractionDigits: 2 })}\n` +
                   `+ Субподряд материалы: ${subcontractMaterials.toLocaleString('ru-RU', { maximumFractionDigits: 2 })}\n` +
                   `+ Работы СУ-10: ${works.toLocaleString('ru-RU', { maximumFractionDigits: 2 })}\n` +
                   `+ Материалы СУ-10: ${materials.toLocaleString('ru-RU', { maximumFractionDigits: 2 })}\n` +
                   `+ Работы комп.: ${worksComp.toLocaleString('ru-RU', { maximumFractionDigits: 2 })}\n` +
                   `+ Материалы комп.: ${materialsComp.toLocaleString('ru-RU', { maximumFractionDigits: 2 })}\n` +
                   `= ${directCostsTotal.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} руб.`
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
          indicator_name: 'Служба механизации',
          coefficient: mechanizationCoeff > 0 ? `${parseFloat(mechanizationCoeff.toFixed(5))}%` : '',
          sp_cost: areaSp > 0 ? mechanizationCost / areaSp : 0,
          customer_cost: areaClient > 0 ? mechanizationCost / areaClient : 0,
          total_cost: mechanizationCost,
          tooltip: `Формула: Работы СУ-10 × ${mechanizationCoeff}%\n` +
                   `Расчёт: ${worksSu10Only.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} × ${mechanizationCoeff}% = ${mechanizationCost.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} руб.`
        },
        {
          key: '5',
          row_number: 5,
          indicator_name: 'МБП+ГСМ',
          coefficient: mvpGsmCoeff > 0 ? `${parseFloat(mvpGsmCoeff.toFixed(5))}%` : '',
          sp_cost: areaSp > 0 ? mvpGsmCost / areaSp : 0,
          customer_cost: areaClient > 0 ? mvpGsmCost / areaClient : 0,
          total_cost: mvpGsmCost,
          tooltip: `Формула: Работы СУ-10 × ${mvpGsmCoeff}%\n` +
                   `Расчёт: ${worksSu10Only.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} × ${mvpGsmCoeff}% = ${mvpGsmCost.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} руб.`
        },
        {
          key: '6',
          row_number: 6,
          indicator_name: 'Гарантийный период',
          coefficient: warrantyCoeff > 0 ? `${parseFloat(warrantyCoeff.toFixed(5))}%` : '',
          sp_cost: areaSp > 0 ? warrantyCost / areaSp : 0,
          customer_cost: areaClient > 0 ? warrantyCost / areaClient : 0,
          total_cost: warrantyCost,
          tooltip: `Формула: Работы СУ-10 × ${warrantyCoeff}%\n` +
                   `Расчёт: ${worksSu10Only.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} × ${warrantyCoeff}% = ${warrantyCost.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} руб.`
        },
        {
          key: '7',
          row_number: 7,
          indicator_name: '1,6',
          coefficient: coefficient06 > 0 ? `${parseFloat(coefficient06.toFixed(5))}%` : '',
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
            worksCostGrowth > 0 ? `Раб:${parseFloat(worksCostGrowth.toFixed(5))}%` : '',
            materialCostGrowth > 0 ? `Мат:${parseFloat(materialCostGrowth.toFixed(5))}%` : '',
            subcontractWorksCostGrowth > 0 ? `С.Раб:${parseFloat(subcontractWorksCostGrowth.toFixed(5))}%` : '',
            subcontractMaterialsCostGrowth > 0 ? `С.Мат:${parseFloat(subcontractMaterialsCostGrowth.toFixed(5))}%` : ''
          ].filter(Boolean).join(', '),
          sp_cost: areaSp > 0 ? totalCostGrowth / areaSp : 0,
          customer_cost: areaClient > 0 ? totalCostGrowth / areaClient : 0,
          total_cost: totalCostGrowth,
          // Промежуточные расчеты для роста стоимости
          works_su10_growth: worksCostGrowthAmount,
          materials_su10_growth: materialCostGrowthAmount,
          works_sub_growth: subcontractWorksCostGrowthAmount,
          materials_sub_growth: subcontractMaterialsCostGrowthAmount,
          tooltip: `Формула: Рост по каждой категории отдельно\n` +
                   `Работы СУ-10: (Работы + 0,6к + МБП + СМ) × ${worksCostGrowth}%\n` +
                   `  Работы: ${worksSu10Only.toLocaleString('ru-RU', { maximumFractionDigits: 2 })}\n` +
                   `  + 0,6к: ${coefficient06Cost.toLocaleString('ru-RU', { maximumFractionDigits: 2 })}\n` +
                   `  + МБП: ${mvpGsmCost.toLocaleString('ru-RU', { maximumFractionDigits: 2 })}\n` +
                   `  + СМ: ${mechanizationCost.toLocaleString('ru-RU', { maximumFractionDigits: 2 })}\n` +
                   `  = ${worksWithMarkup.toLocaleString('ru-RU', { maximumFractionDigits: 2 })}\n` +
                   `  Рост: ${worksWithMarkup.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} × ${worksCostGrowth}% = ${worksCostGrowthAmount.toLocaleString('ru-RU', { maximumFractionDigits: 2 })}\n` +
                   `Материалы СУ-10: ${materials.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} × ${materialCostGrowth}% = ${materialCostGrowthAmount.toLocaleString('ru-RU', { maximumFractionDigits: 2 })}\n` +
                   `Работы субподряд: ${subcontractWorksForGrowth.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} × ${subcontractWorksCostGrowth}% = ${subcontractWorksCostGrowthAmount.toLocaleString('ru-RU', { maximumFractionDigits: 2 })}\n` +
                   `  (База для роста: ${subcontractWorksForGrowth.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} из ${subcontractWorks.toLocaleString('ru-RU', { maximumFractionDigits: 2 })})\n` +
                   `Материалы субподряд: ${subcontractMaterialsForGrowth.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} × ${subcontractMaterialsCostGrowth}% = ${subcontractMaterialsCostGrowthAmount.toLocaleString('ru-RU', { maximumFractionDigits: 2 })}\n` +
                   `  (База для роста: ${subcontractMaterialsForGrowth.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} из ${subcontractMaterials.toLocaleString('ru-RU', { maximumFractionDigits: 2 })})\n` +
                   `Итого: ${totalCostGrowth.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} руб.`
        },
        {
          key: '9',
          row_number: 9,
          indicator_name: 'Непредвиденные',
          coefficient: unforeseeableCoeff > 0 ? `${parseFloat(unforeseeableCoeff.toFixed(5))}%` : '',
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
          coefficient: overheadOwnForcesCoeff > 0 ? `${parseFloat(overheadOwnForcesCoeff.toFixed(5))}%` : '',
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
          coefficient: overheadSubcontractCoeff > 0 ? `${parseFloat(overheadSubcontractCoeff.toFixed(5))}%` : '',
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
          coefficient: generalCostsCoeff > 0 ? `${parseFloat(generalCostsCoeff.toFixed(5))}%` : '',
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
          coefficient: profitOwnForcesCoeff > 0 ? `${parseFloat(profitOwnForcesCoeff.toFixed(5))}%` : '',
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
          coefficient: profitSubcontractCoeff > 0 ? `${parseFloat(profitSubcontractCoeff.toFixed(5))}%` : '',
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
          indicator_name: 'НДС',
          coefficient: vatCoeff > 0 ? `${parseFloat(vatCoeff.toFixed(5))}%` : '',
          sp_cost: areaSp > 0 ? vatCost / areaSp : 0,
          customer_cost: areaClient > 0 ? vatCost / areaClient : 0,
          total_cost: vatCost,
          is_yellow: true,
          tooltip: `Формула: (Сумма строк 1-14) × ${vatCoeff}%\n` +
                   `Сумма без НДС: ${grandTotalBeforeVAT.toLocaleString('ru-RU', { maximumFractionDigits: 2 })}\n` +
                   `Расчёт: ${grandTotalBeforeVAT.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} × ${vatCoeff}% = ${vatCost.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} руб.`
        },
        {
          key: '16',
          row_number: 16,
          indicator_name: 'ИТОГО',
          coefficient: '',
          sp_cost: areaSp > 0 ? grandTotal / areaSp : 0,
          customer_cost: areaClient > 0 ? grandTotal / areaClient : 0,
          total_cost: grandTotal,
          is_total: true
        },
      ];

      setData(tableData);
      setSpTotal(areaSp);
      setCustomerTotal(areaClient);
    } catch (error) {
      console.error('Ошибка загрузки показателей:', error);
      await addNotification(
        'Ошибка загрузки финансовых показателей',
        `Не удалось загрузить финансовые показатели: ${error instanceof Error ? error.message : String(error)}`,
        'warning'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    data,
    spTotal,
    customerTotal,
    loading,
    fetchFinancialIndicators,
  };
};
