/**
 * Поиск позиции со значением 91 880 340
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function findValue() {
  const TARGET_VALUE = 91880340;
  const TOLERANCE = 1000; // допуск ±1000

  try {
    console.log(`🔍 Поиск значения близкого к ${TARGET_VALUE.toLocaleString('ru-RU')} руб.\n`);

    // Найти тендер
    const { data: tenders } = await supabase
      .from('tenders')
      .select('*')
      .ilike('title', '%События%');

    if (!tenders || tenders.length === 0) {
      console.log('❌ Тендер не найден');
      return;
    }

    const tender = tenders[0];
    console.log(`Тендер: ${tender.title} (ID: ${tender.id})\n`);

    // Получить все позиции
    const { data: positions } = await supabase
      .from('client_positions')
      .select('*')
      .eq('tender_id', tender.id);

    // Получить все boq_items
    const { data: allBoqItems } = await supabase
      .from('boq_items')
      .select('*')
      .eq('tender_id', tender.id);

    console.log(`Позиций: ${positions.length}, BOQ элементов: ${allBoqItems.length}\n`);

    // Группируем элементы по позициям
    const itemsByPosition = new Map();
    for (const item of allBoqItems) {
      if (!itemsByPosition.has(item.client_position_id)) {
        itemsByPosition.set(item.client_position_id, []);
      }
      itemsByPosition.get(item.client_position_id).push(item);
    }

    console.log(`${'='.repeat(80)}\n`);
    console.log(`ПОИСК ПОЗИЦИЙ С РАЗНЫМИ СУММАМИ:\n`);
    console.log(`Ищем значение близкое к: ${TARGET_VALUE.toLocaleString('ru-RU')} ±${TOLERANCE}\n`);
    console.log(`${'='.repeat(80)}\n`);

    let found = false;

    for (const position of positions) {
      const boqItems = itemsByPosition.get(position.id) || [];

      // Считаем все возможные суммы
      let totalAmount = 0;
      let totalCommercialMaterial = 0;
      let totalCommercialWork = 0;
      let totalCommercial = 0;
      let baseTotal = 0;

      for (const item of boqItems) {
        totalAmount += item.total_amount || 0;
        totalCommercialMaterial += item.total_commercial_material_cost || 0;
        totalCommercialWork += item.total_commercial_work_cost || 0;
        totalCommercial += (item.total_commercial_material_cost || 0) + (item.total_commercial_work_cost || 0);
        baseTotal += item.total_amount || 0;
      }

      // Проверяем все суммы
      const sums = {
        'total_amount (Итого в позициях заказчика)': totalAmount,
        'base_total (Базовая стоимость в коммерции)': baseTotal,
        'total_commercial_material_cost (Материалы КП)': totalCommercialMaterial,
        'total_commercial_work_cost (Работы КП)': totalCommercialWork,
        'commercial_total (Коммерческая стоимость)': totalCommercial,
      };

      for (const [name, value] of Object.entries(sums)) {
        if (Math.abs(value - TARGET_VALUE) <= TOLERANCE) {
          found = true;
          console.log(`✅ НАЙДЕНО!\n`);
          console.log(`Позиция: ${position.position_number || position.item_no}`);
          console.log(`Название: ${position.work_name}`);
          console.log(`ID: ${position.id}\n`);
          console.log(`Поле: ${name}`);
          console.log(`Значение: ${value.toLocaleString('ru-RU', { minimumFractionDigits: 2 })} руб.\n`);
          console.log(`Детали:`);
          console.log(`  - total_amount: ${totalAmount.toLocaleString('ru-RU', { minimumFractionDigits: 2 })}`);
          console.log(`  - base_total: ${baseTotal.toLocaleString('ru-RU', { minimumFractionDigits: 2 })}`);
          console.log(`  - commercial_material: ${totalCommercialMaterial.toLocaleString('ru-RU', { minimumFractionDigits: 2 })}`);
          console.log(`  - commercial_work: ${totalCommercialWork.toLocaleString('ru-RU', { minimumFractionDigits: 2 })}`);
          console.log(`  - commercial_total: ${totalCommercial.toLocaleString('ru-RU', { minimumFractionDigits: 2 })}`);
          console.log(`  - элементов: ${boqItems.length}\n`);
          console.log(`${'='.repeat(80)}\n`);
        }
      }
    }

    if (!found) {
      console.log(`❌ Позиция с значением ${TARGET_VALUE.toLocaleString('ru-RU')} не найдена\n`);
      console.log(`Попробуем найти позицию с номером "3.3" и проверим все её суммы:\n`);

      const pos33 = positions.find(p =>
        p.position_number === 3.3 ||
        p.position_number === '3.3' ||
        p.item_no === '3.3'
      );

      if (pos33) {
        const boqItems = itemsByPosition.get(pos33.id) || [];

        let totalAmount = 0;
        let totalCommercialMaterial = 0;
        let totalCommercialWork = 0;

        for (const item of boqItems) {
          totalAmount += item.total_amount || 0;
          totalCommercialMaterial += item.total_commercial_material_cost || 0;
          totalCommercialWork += item.total_commercial_work_cost || 0;
        }

        console.log(`Позиция 3.3: ${pos33.work_name}`);
        console.log(`\nВсе суммы для этой позиции:`);
        console.log(`  - total_amount: ${totalAmount.toLocaleString('ru-RU', { minimumFractionDigits: 2 })}`);
        console.log(`  - commercial_material: ${totalCommercialMaterial.toLocaleString('ru-RU', { minimumFractionDigits: 2 })}`);
        console.log(`  - commercial_work: ${totalCommercialWork.toLocaleString('ru-RU', { minimumFractionDigits: 2 })}`);
        console.log(`  - commercial_total: ${(totalCommercialMaterial + totalCommercialWork).toLocaleString('ru-RU', { minimumFractionDigits: 2 })}`);
        console.log(`  - элементов: ${boqItems.length}\n`);
      } else {
        console.log(`❌ Позиция 3.3 не найдена`);
      }
    }

    // Попробуем найти любую комбинацию, дающую 91 880 340
    console.log(`\n${'='.repeat(80)}\n`);
    console.log(`ПОИСК КОМБИНАЦИЙ СУММ:\n`);

    // Группировка по секциям
    const sections = new Map();
    for (const position of positions) {
      const sectionNum = Math.floor(position.position_number || 0);
      if (!sections.has(sectionNum)) {
        sections.set(sectionNum, []);
      }
      sections.get(sectionNum).push(position);
    }

    for (const [sectionNum, sectionPositions] of sections.entries()) {
      if (sectionNum === 0) continue;

      let sectionTotalAmount = 0;
      let sectionCommercialMaterial = 0;
      let sectionCommercialWork = 0;

      for (const position of sectionPositions) {
        const boqItems = itemsByPosition.get(position.id) || [];
        for (const item of boqItems) {
          sectionTotalAmount += item.total_amount || 0;
          sectionCommercialMaterial += item.total_commercial_material_cost || 0;
          sectionCommercialWork += item.total_commercial_work_cost || 0;
        }
      }

      if (Math.abs(sectionTotalAmount - TARGET_VALUE) <= TOLERANCE ||
          Math.abs(sectionCommercialMaterial - TARGET_VALUE) <= TOLERANCE ||
          Math.abs(sectionCommercialWork - TARGET_VALUE) <= TOLERANCE) {
        console.log(`Раздел ${sectionNum}:`);
        console.log(`  - total_amount: ${sectionTotalAmount.toLocaleString('ru-RU', { minimumFractionDigits: 2 })}`);
        console.log(`  - commercial_material: ${sectionCommercialMaterial.toLocaleString('ru-RU', { minimumFractionDigits: 2 })}`);
        console.log(`  - commercial_work: ${sectionCommercialWork.toLocaleString('ru-RU', { minimumFractionDigits: 2 })}`);
        console.log(`  - позиций: ${sectionPositions.length}\n`);
      }
    }

  } catch (error) {
    console.error('❌ Ошибка:', error);
  }
}

findValue();
