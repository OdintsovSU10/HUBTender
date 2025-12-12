/**
 * Скрипт для проверки расхождения в стоимостях между страницами
 * Позиции заказчика и Коммерция
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Отсутствуют переменные окружения VITE_SUPABASE_URL или VITE_SUPABASE_PUBLISHABLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkPositionTotals() {
  try {
    console.log('🔍 Поиск тендера "ЖК События 6.2"...\n');

    // Найти тендер
    const { data: tenders, error: tenderError } = await supabase
      .from('tenders')
      .select('*')
      .ilike('title', '%События%')
      .order('version', { ascending: false });

    if (tenderError) throw tenderError;

    if (!tenders || tenders.length === 0) {
      console.log('❌ Тендер "ЖК События" не найден');
      return;
    }

    console.log(`✅ Найдено тендеров: ${tenders.length}`);
    tenders.forEach(t => {
      console.log(`   - ${t.title} (версия ${t.version || 1}), ID: ${t.id}`);
    });

    // Берем последнюю версию (6.2 должна быть версия 2)
    const tender = tenders.find(t => (t.version || 1) === 2) || tenders[0];
    console.log(`\n📋 Используется тендер: ${tender.title} (версия ${tender.version || 1})`);
    console.log(`   ID: ${tender.id}\n`);

    // Найти позицию с названием про дорогу
    const { data: positions, error: posError } = await supabase
      .from('client_positions')
      .select('*')
      .eq('tender_id', tender.id)
      .ilike('work_name', '%временной технологической дороги%');

    if (posError) throw posError;

    if (!positions || positions.length === 0) {
      console.log('❌ Позиция с названием про "временную технологическую дорогу" не найдена');
      console.log('\n🔍 Поиск всех позиций с номером "3.3"...\n');

      const { data: positionsBy33, error: pos33Error } = await supabase
        .from('client_positions')
        .select('*')
        .eq('tender_id', tender.id)
        .or('position_number.eq.3.3,item_no.eq.3.3');

      if (pos33Error) throw pos33Error;

      if (!positionsBy33 || positionsBy33.length === 0) {
        console.log('❌ Позиция с номером "3.3" не найдена');
        return;
      }

      positions.push(...positionsBy33);
    }

    console.log(`✅ Найдено позиций: ${positions.length}\n`);
    positions.forEach(p => {
      console.log(`   Позиция: ${p.position_number || p.item_no} - ${p.work_name}`);
      console.log(`   ID: ${p.id}`);
      console.log(`   Объем: ${p.manual_volume || p.volume || 0} ${p.unit_code || ''}`);
      console.log('');
    });

    // Проверяем каждую позицию
    for (const position of positions) {
      console.log(`\n${'='.repeat(80)}`);
      console.log(`📊 АНАЛИЗ ПОЗИЦИИ: ${position.position_number || position.item_no}`);
      console.log(`${position.work_name}`);
      console.log(`${'='.repeat(80)}\n`);

      // Получить все boq_items для этой позиции
      const { data: boqItems, error: boqError } = await supabase
        .from('boq_items')
        .select('*')
        .eq('client_position_id', position.id);

      if (boqError) throw boqError;

      console.log(`✅ Найдено BOQ элементов: ${boqItems?.length || 0}\n`);

      if (!boqItems || boqItems.length === 0) {
        console.log('⚠️  Нет BOQ элементов для этой позиции');
        continue;
      }

      // РАСЧЕТ 1: Как в позициях заказчика (useClientPositions.ts)
      let totalAmountSum = 0;
      for (const item of boqItems) {
        totalAmountSum += item.total_amount || 0;
      }

      // РАСЧЕТ 2: Как в коммерции (useCommerceData.ts)
      let baseTotal = 0;
      let commercialTotal = 0;
      let materialCostTotal = 0;
      let workCostTotal = 0;

      for (const item of boqItems) {
        const itemBase = item.total_amount || 0;
        const itemMaterial = item.total_commercial_material_cost || 0;
        const itemWork = item.total_commercial_work_cost || 0;
        const itemCommercial = itemMaterial + itemWork;

        baseTotal += itemBase;
        commercialTotal += itemCommercial;
        materialCostTotal += itemMaterial;
        workCostTotal += itemWork;
      }

      console.log('📈 РЕЗУЛЬТАТЫ РАСЧЕТОВ:\n');
      console.log(`1️⃣  ПОЗИЦИИ ЗАКАЗЧИКА (sum of total_amount):`);
      console.log(`   Итого: ${totalAmountSum.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} руб.\n`);

      console.log(`2️⃣  КОММЕРЦИЯ (base_total from total_amount):`);
      console.log(`   Базовая стоимость: ${baseTotal.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} руб.`);
      console.log(`   Коммерческая: ${commercialTotal.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} руб.`);
      console.log(`   Материалы: ${materialCostTotal.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} руб.`);
      console.log(`   Работы: ${workCostTotal.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} руб.\n`);

      const difference = totalAmountSum - baseTotal;
      console.log(`📊 РАЗНИЦА:`);
      console.log(`   ${difference.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} руб.`);

      if (Math.abs(difference) < 0.01) {
        console.log(`   ✅ Значения совпадают!`);
      } else {
        console.log(`   ❌ РАСХОЖДЕНИЕ ОБНАРУЖЕНО!`);
      }

      // Детальный вывод элементов
      console.log(`\n📝 ДЕТАЛИ BOQ ЭЛЕМЕНТОВ (первые 10):\n`);
      boqItems.slice(0, 10).forEach((item, idx) => {
        console.log(`   ${idx + 1}. ${item.boq_item_type} - ${item.work_name || item.material_name || 'Без названия'}`);
        console.log(`      total_amount: ${(item.total_amount || 0).toLocaleString('ru-RU', { minimumFractionDigits: 2 })}`);
        console.log(`      total_commercial_material_cost: ${(item.total_commercial_material_cost || 0).toLocaleString('ru-RU', { minimumFractionDigits: 2 })}`);
        console.log(`      total_commercial_work_cost: ${(item.total_commercial_work_cost || 0).toLocaleString('ru-RU', { minimumFractionDigits: 2 })}`);
        console.log('');
      });

      if (boqItems.length > 10) {
        console.log(`   ... и еще ${boqItems.length - 10} элементов\n`);
      }
    }

    // Проверка ИТОГО по всему тендеру
    console.log(`\n${'='.repeat(80)}`);
    console.log(`📊 АНАЛИЗ ИТОГО ПО ВСЕМУ ТЕНДЕРУ`);
    console.log(`${'='.repeat(80)}\n`);

    // Получить ВСЕ позиции тендера
    const { data: allPositions, error: allPosError } = await supabase
      .from('client_positions')
      .select('*')
      .eq('tender_id', tender.id);

    if (allPosError) throw allPosError;

    console.log(`✅ Всего позиций в тендере: ${allPositions?.length || 0}\n`);

    // Получить ВСЕ boq_items тендера
    const { data: allBoqItems, error: allBoqError } = await supabase
      .from('boq_items')
      .select('*')
      .eq('tender_id', tender.id);

    if (allBoqError) throw allBoqError;

    console.log(`✅ Всего BOQ элементов в тендере: ${allBoqItems?.length || 0}\n`);

    // РАСЧЕТ ИТОГО как в позициях заказчика
    let totalSumPositions = 0;
    for (const item of allBoqItems) {
      totalSumPositions += item.total_amount || 0;
    }

    // РАСЧЕТ ИТОГО как в коммерции
    let totalBaseCommerce = 0;
    let totalCommercialCommerce = 0;

    for (const item of allBoqItems) {
      const itemBase = item.total_amount || 0;
      const itemMaterial = item.total_commercial_material_cost || 0;
      const itemWork = item.total_commercial_work_cost || 0;
      const itemCommercial = itemMaterial + itemWork;

      totalBaseCommerce += itemBase;
      totalCommercialCommerce += itemCommercial;
    }

    console.log('📈 РЕЗУЛЬТАТЫ РАСЧЕТОВ ИТОГО:\n');
    console.log(`1️⃣  ПОЗИЦИИ ЗАКАЗЧИКА (sum of total_amount):`);
    console.log(`   Итого: ${totalSumPositions.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} руб.\n`);

    console.log(`2️⃣  КОММЕРЦИЯ (base_total):`);
    console.log(`   Базовая стоимость: ${totalBaseCommerce.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} руб.`);
    console.log(`   Коммерческая: ${totalCommercialCommerce.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} руб.\n`);

    const totalDifference = totalSumPositions - totalBaseCommerce;
    console.log(`📊 РАЗНИЦА В ИТОГО:`);
    console.log(`   ${totalDifference.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} руб.`);

    if (Math.abs(totalDifference) < 0.01) {
      console.log(`   ✅ Значения совпадают!`);
    } else {
      console.log(`   ❌ РАСХОЖДЕНИЕ ОБНАРУЖЕНО!`);
    }

  } catch (error) {
    console.error('❌ Ошибка:', error);
    throw error;
  }
}

checkPositionTotals().catch(console.error);