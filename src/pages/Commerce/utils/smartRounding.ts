/**
 * Умное округление цен за единицу до 5 рублей с компенсацией ошибки
 */

import type { PositionWithCommercialCost } from '../types';

/**
 * Округляет число до ближайшего кратного 5
 */
export function roundTo5(value: number): number {
  if (value < 2.5) return 0;
  return Math.round(value / 5) * 5;
}

interface RoundingItem {
  index: number;
  originalPrice: number;
  roundedPrice: number;
  error: number;
  fractionalPart: number;
  quantity: number;
}

/**
 * Компенсирует ошибку округления, корректируя цены с наибольшими дробными частями
 */
function compensateError(
  items: RoundingItem[],
  totalError: number
): Map<number, number> {
  const adjustments = new Map<number, number>();

  if (Math.abs(totalError) < 1) {
    return adjustments;
  }

  // Сортируем по убыванию дробной части
  const sortedItems = [...items].sort((a, b) => b.fractionalPart - a.fractionalPart);

  let remainingError = totalError;
  const errorSign = totalError > 0 ? 1 : -1;
  const adjustmentStep = 5; // Шаг компенсации (кратно 5)

  for (const item of sortedItems) {
    if (Math.abs(remainingError) < adjustmentStep) {
      break;
    }

    // Вычисляем сколько нужно скорректировать цену
    const maxAdjustment = Math.floor(Math.abs(remainingError) / (item.quantity * adjustmentStep)) * adjustmentStep;

    if (maxAdjustment >= adjustmentStep) {
      const adjustment = maxAdjustment * errorSign;
      adjustments.set(item.index, item.roundedPrice + adjustment);
      remainingError -= adjustment * item.quantity;
    }
  }

  return adjustments;
}

export interface RoundedPosition extends PositionWithCommercialCost {
  rounded_material_unit_price?: number;
  rounded_work_unit_price?: number;
  rounded_material_cost_total?: number;
  rounded_work_cost_total?: number;
}

/**
 * Применяет умное округление к позициям с коммерческими стоимостями
 */
export function smartRoundPositions(positions: PositionWithCommercialCost[]): RoundedPosition[] {
  const materialItems: RoundingItem[] = [];
  const workItems: RoundingItem[] = [];

  // Собираем данные для округления
  positions.forEach((pos, index) => {
    const quantity = pos.manual_volume || 0;

    if (quantity <= 0) return;

    // Материалы
    const materialTotal = pos.material_cost_total || 0;
    if (materialTotal > 0) {
      const originalPrice = materialTotal / quantity;
      const roundedPrice = roundTo5(originalPrice);
      const fractionalPart = originalPrice - Math.floor(originalPrice);
      const error = (roundedPrice - originalPrice) * quantity;

      materialItems.push({
        index,
        originalPrice,
        roundedPrice,
        error,
        fractionalPart,
        quantity,
      });
    }

    // Работы
    const workTotal = pos.work_cost_total || 0;
    if (workTotal > 0) {
      const originalPrice = workTotal / quantity;
      const roundedPrice = roundTo5(originalPrice);
      const fractionalPart = originalPrice - Math.floor(originalPrice);
      const error = (roundedPrice - originalPrice) * quantity;

      workItems.push({
        index,
        originalPrice,
        roundedPrice,
        error,
        fractionalPart,
        quantity,
      });
    }
  });

  // Вычисляем общую ошибку
  const totalMaterialError = materialItems.reduce((sum, item) => sum + item.error, 0);
  const totalWorkError = workItems.reduce((sum, item) => sum + item.error, 0);

  console.log('🔄 Округление:');
  console.log(`  Материалы: ошибка ${totalMaterialError.toFixed(2)} руб`);
  console.log(`  Работы: ошибка ${totalWorkError.toFixed(2)} руб`);

  // Компенсируем ошибку
  const materialAdjustments = compensateError(materialItems, totalMaterialError);
  const workAdjustments = compensateError(workItems, totalWorkError);

  // Применяем округление и компенсацию
  const roundedPositions = positions.map((pos, index) => {
    const result: RoundedPosition = { ...pos };
    const quantity = pos.manual_volume || 0;

    if (quantity <= 0) return result;

    // Округляем материалы
    const materialTotal = pos.material_cost_total || 0;
    if (materialTotal > 0) {
      const roundedPrice = materialAdjustments.get(index) ?? roundTo5(materialTotal / quantity);
      result.rounded_material_unit_price = roundedPrice;
      result.rounded_material_cost_total = roundedPrice * quantity;
    } else {
      result.rounded_material_unit_price = 0;
      result.rounded_material_cost_total = 0;
    }

    // Округляем работы
    const workTotal = pos.work_cost_total || 0;
    if (workTotal > 0) {
      const roundedPrice = workAdjustments.get(index) ?? roundTo5(workTotal / quantity);
      result.rounded_work_unit_price = roundedPrice;
      result.rounded_work_cost_total = roundedPrice * quantity;
    } else {
      result.rounded_work_unit_price = 0;
      result.rounded_work_cost_total = 0;
    }

    return result;
  });

  return roundedPositions;
}
