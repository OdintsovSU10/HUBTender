const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const envVars = {};

envContent.split(/\r?\n/).forEach(line => {
  line = line.trim();
  if (line && !line.startsWith('#')) {
    const equalIndex = line.indexOf('=');
    if (equalIndex > 0) {
      const key = line.substring(0, equalIndex).trim();
      const value = line.substring(equalIndex + 1).trim().replace(/^['"]|['"]$/g, '');
      envVars[key] = value;
    }
  }
});

const supabase = createClient(
  envVars.VITE_SUPABASE_URL,
  envVars.VITE_SUPABASE_SERVICE_ROLE_KEY
);

async function verifyCalculation() {
  try {
    // Найти первый материал из примера
    const { data: material, error } = await supabase
      .from('boq_items')
      .select(`
        *,
        client_positions(manual_volume, volume),
        material_names(name)
      `)
      .eq('client_position_id', '92a5622b-18d0-4505-9765-87bcfabd6fae')
      .eq('boq_item_type', 'мат')
      .is('parent_work_item_id', null)
      .limit(1)
      .single();

    if (error) {
      console.error('Ошибка:', error);
      return;
    }

    console.log('\n📦 Материал:', material.material_names.name);
    console.log('\n📊 Данные позиции:');
    console.log('  manual_volume (ГП):', material.client_positions.manual_volume);
    console.log('  volume (заказчик):', material.client_positions.volume);

    console.log('\n📊 Данные материала из БД:');
    console.log('  base_quantity:', material.base_quantity);
    console.log('  consumption_coefficient:', material.consumption_coefficient);
    console.log('  quantity:', material.quantity);
    console.log('  unit_rate:', material.unit_rate);
    console.log('  currency_type:', material.currency_type);
    console.log('  delivery_price_type:', material.delivery_price_type);
    console.log('  delivery_amount:', material.delivery_amount);
    console.log('  total_amount:', material.total_amount);

    console.log('\n🧮 Проверка расчета:');

    // Шаг 1: Определить базовое количество
    const gpVolume = material.client_positions.manual_volume || 0;
    const expectedBaseQty = gpVolume > 0 ? gpVolume : 1;
    console.log('  1. Ожидаемое base_quantity:', expectedBaseQty);
    console.log('     (manual_volume > 0 ? manual_volume : 1)');
    console.log('     ✅ Совпадает:', material.base_quantity === expectedBaseQty);

    // Шаг 2: Вычислить количество с коэффициентом расхода
    const expectedQty = material.base_quantity * material.consumption_coefficient;
    console.log('\n  2. Ожидаемое quantity:', expectedQty);
    console.log('     (base_quantity * consumption_coefficient)');
    console.log('     ✅ Совпадает:', Math.abs(material.quantity - expectedQty) < 0.01);

    // Шаг 3: Вычислить цену доставки
    const rate = 1; // RUB
    let deliveryPrice = 0;
    if (material.delivery_price_type === 'не в цене') {
      deliveryPrice = Math.round(material.unit_rate * rate * 0.03 * 100) / 100;
    } else if (material.delivery_price_type === 'суммой' && material.delivery_amount) {
      deliveryPrice = material.delivery_amount;
    }
    console.log('\n  3. Цена доставки:', deliveryPrice);
    console.log('     Тип доставки:', material.delivery_price_type);

    // Шаг 4: Вычислить итоговую сумму
    const expectedTotal = Math.round(material.quantity * (material.unit_rate * rate + deliveryPrice) * 100) / 100;
    console.log('\n  4. Ожидаемая total_amount:', expectedTotal);
    console.log('     (quantity * (unit_rate * rate + deliveryPrice))');
    console.log('     = ', material.quantity, '* (', material.unit_rate, '* 1 +', deliveryPrice, ')');
    console.log('     =', material.quantity, '*', (material.unit_rate + deliveryPrice));
    console.log('     =', expectedTotal);
    console.log('     Фактическая total_amount:', material.total_amount);
    console.log('     ✅ Совпадает:', Math.abs(material.total_amount - expectedTotal) < 0.01);

    console.log('\n🔍 Анализ:');
    if (material.base_quantity === 0) {
      console.log('  ⚠️ base_quantity = 0, хотя должно быть', expectedBaseQty);
      console.log('  ⚠️ Это означает, что либо:');
      console.log('     1. Материал был добавлен до исправления кода');
      console.log('     2. base_quantity было изменено вручную в БД');
      console.log('     3. Есть триггер который обнуляет base_quantity');
    }

    if (Math.abs(material.quantity - expectedQty) > 0.01) {
      console.log('  ⚠️ quantity не соответствует формуле base_quantity * consumption_coefficient');
      console.log('  ⚠️ Возможно, quantity было изменено вручную');
    }

  } catch (error) {
    console.error('Ошибка:', error);
  }
}

verifyCalculation();
