import { useTendersData } from './useTendersData';
import { useFinancialCalculations } from './useFinancialCalculations';

export type { IndicatorRow } from './useFinancialCalculations';

export const useFinancialData = () => {
  const {
    tenders,
    loading: tendersLoading,
    loadTenders,
  } = useTendersData();

  const {
    data,
    spTotal,
    customerTotal,
    loading: calculationsLoading,
    isVatInConstructor,
    fetchFinancialIndicators,
  } = useFinancialCalculations();

  return {
    tenders,
    loading: tendersLoading || calculationsLoading,
    data,
    spTotal,
    customerTotal,
    isVatInConstructor,
    loadTenders,
    fetchFinancialIndicators,
  };
};
