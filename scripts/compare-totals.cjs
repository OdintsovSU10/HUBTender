const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
);

const TENDER_ID = 'b307b7d5-b145-4d06-a92e-8d1d50a6befe'; // ЖК Событие 6.2
const EXPECTED_TOTAL = 5613631822; // из Financial Indicators

async function compareTotals() {
  console.log('🔍 Загрузка всех boq_items для тендера...');

  // Загрузка всех BOQ элементов с батчингом
  let allBoqItems = [];
  let from = 0;
  const batchSize = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from('boq_items')
      .select('id, boq_item_type, material_type, total_amount, total_commercial_material_cost, total_commercial_work_cost, client_position_id')
      .eq('tender_id', TENDER_ID)
      .range(from, from + batchSize - 1);

    if (error) {
      console.error('❌ Ошибка:', error);
      return;
    }

    if (data && data.length > 0) {
      allBoqItems = [...allBoqItems, ...data];
      from += batchSize;
      hasMore = data.length === batchSize;
    } else {
      hasMore = false;
    }
  }

  console.log(`📝 Загружено элементов: ${allBoqItems.length}`);

  // Проверка NULL значений
  const nullItems = allBoqItems.filter(item =>
    item.total_commercial_material_cost === null || item.total_commercial_work_cost === null
  );

  console.log(`\n⚠️  Элементов с NULL: ${nullItems.length}`);
  if (nullItems.length > 0) {
    const nullSum = nullItems.reduce((sum, item) => sum + (item.total_amount || 0), 0);
    console.log(`Базовая стоимость NULL элементов: ${nullSum.toLocaleString('ru-RU')}`);
    console.table(nullItems.map(item => ({
      id: item.id.substring(0, 8),
      type: item.boq_item_type,
      mat_type: item.material_type,
      base: item.total_amount
    })));
  }

  // Подсчет сумм
  const baseTotal = allBoqItems.reduce((sum, item) => sum + (item.total_amount || 0), 0);
  const matTotal = allBoqItems.reduce((sum, item) => sum + (item.total_commercial_material_cost || 0), 0);
  const workTotal = allBoqItems.reduce((sum, item) => sum + (item.total_commercial_work_cost || 0), 0);
  const commercialTotal = matTotal + workTotal;
  const markupsTotal = commercialTotal - baseTotal;

  console.log('\n=== ИТОГОВЫЕ СУММЫ ===');
  console.log(`Базовая стоимость:     ${baseTotal.toLocaleString('ru-RU')}`);
  console.log(`Материалы commercial:  ${matTotal.toLocaleString('ru-RU')}`);
  console.log(`Работы commercial:     ${workTotal.toLocaleString('ru-RU')}`);
  console.log(`Commercial ИТОГО:      ${commercialTotal.toLocaleString('ru-RU')}`);
  console.log(`Наценки (разница):     ${markupsTotal.toLocaleString('ru-RU')}`);

  console.log('\n=== СРАВНЕНИЕ С ОЖИДАЕМЫМ ===');
  console.log(`Ожидается:             ${EXPECTED_TOTAL.toLocaleString('ru-RU')}`);
  console.log(`Фактически:            ${commercialTotal.toLocaleString('ru-RU')}`);
  const difference = EXPECTED_TOTAL - commercialTotal;
  console.log(`Разница:               ${difference.toLocaleString('ru-RU')} ${difference > 0 ? '(недостает)' : '(переизбыток)'}`);
  console.log(`Процент расхождения:   ${((difference / EXPECTED_TOTAL) * 100).toFixed(4)}%`);

  // Разбивка по типам
  console.log('\n=== РАЗБИВКА ПО ТИПАМ ЭЛЕМЕНТОВ ===');
  const byType = {};
  allBoqItems.forEach(item => {
    const key = `${item.boq_item_type}${item.material_type ? `_${item.material_type}` : ''}`;
    if (!byType[key]) {
      byType[key] = { count: 0, base: 0, mat: 0, work: 0, commercial: 0 };
    }
    byType[key].count++;
    byType[key].base += item.total_amount || 0;
    byType[key].mat += item.total_commercial_material_cost || 0;
    byType[key].work += item.total_commercial_work_cost || 0;
    byType[key].commercial += (item.total_commercial_material_cost || 0) + (item.total_commercial_work_cost || 0);
  });

  console.table(Object.entries(byType).map(([type, stats]) => ({
    type,
    count: stats.count,
    base: stats.base.toLocaleString('ru-RU'),
    commercial: stats.commercial.toLocaleString('ru-RU'),
    markup: (stats.commercial - stats.base).toLocaleString('ru-RU')
  })));
}

compareTotals().catch(console.error);
