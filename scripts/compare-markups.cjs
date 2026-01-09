const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
);

const TENDER_ID = 'b307b7d5-b145-4d06-a92e-8d1d50a6befe';

async function compareMarkups() {
  console.log('🔍 Сравнение наценок по типам элементов...\n');

  // Загрузка данных
  let allBoqItems = [];
  let from = 0;
  const batchSize = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from('boq_items')
      .select('boq_item_type, material_type, total_amount, total_commercial_material_cost, total_commercial_work_cost')
      .eq('tender_id', TENDER_ID)
      .range(from, from + batchSize - 1);

    if (error) {
      console.error('Ошибка:', error);
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

  // Группировка по типам
  const byType = {};
  allBoqItems.forEach(item => {
    const key = `${item.boq_item_type}${item.material_type ? `_${item.material_type}` : ''}`;
    if (!byType[key]) {
      byType[key] = { count: 0, base: 0, commercial: 0 };
    }
    byType[key].count++;
    byType[key].base += item.total_amount || 0;
    byType[key].commercial += (item.total_commercial_material_cost || 0) + (item.total_commercial_work_cost || 0);
  });

  // Ожидаемые коэффициенты из тактики
  const expectedCoefficients = {
    'раб': 2.869, // (1 + 0.0408) * (1 + 0.6) * (1 + 0.1) * (1 + 0.03) * (1 + 0.1) * (1 + 0.2) * (1 + 0.1) - 1 = 186.9%
    'мат_основн.': 1.64076, // (1 + 0.1) * (1 + 0.03) * (1 + 0.1) * (1 + 0.2) * (1 + 0.1) - 1 = 64.076%
    'мат_вспомогат.': 1.64076, // Аналогично основным
    'суб-мат_основн.': 1.4036, // (1 + 0.1) * (1 + 0.1) * (1 + 0.16) - 1 = 40.36%
    'суб-мат_вспомогат.': 1.4036, // Аналогично основным субматериалам
    'суб-раб': 1.4036, // (1 + 0.1) * (1 + 0.1) * (1 + 0.16) - 1 = 40.36%
  };

  console.log('=== СРАВНЕНИЕ НАЦЕНОК ПО ТИПАМ ===\n');

  let totalDiff = 0;

  Object.entries(byType).forEach(([type, stats]) => {
    const actualMarkup = stats.commercial - stats.base;
    const actualRatio = stats.commercial / stats.base;

    const expectedRatio = expectedCoefficients[type] || null;
    const expectedCommercial = expectedRatio ? stats.base * expectedRatio : null;
    const expectedMarkup = expectedCommercial ? expectedCommercial - stats.base : null;
    const diff = expectedMarkup ? expectedMarkup - actualMarkup : null;

    if (diff) {
      totalDiff += diff;
    }

    console.log(`${type}:`);
    console.log(`  База:               ${stats.base.toFixed(2)}`);
    console.log(`  Факт commercial:    ${stats.commercial.toFixed(2)}`);
    console.log(`  Факт markup:        ${actualMarkup.toFixed(2)}`);
    console.log(`  Факт ratio:         ${actualRatio.toFixed(6)}`);
    if (expectedRatio) {
      console.log(`  Ожид ratio:         ${expectedRatio.toFixed(6)}`);
      console.log(`  Ожид commercial:    ${expectedCommercial.toFixed(2)}`);
      console.log(`  Ожид markup:        ${expectedMarkup.toFixed(2)}`);
      console.log(`  Разница markup:     ${diff.toFixed(2)}`);
      console.log(`  Разница %:          ${((diff / stats.base) * 100).toFixed(6)}%`);
    }
    console.log('');
  });

  console.log('=== ИТОГО ===');
  console.log(`Общая разница markup: ${totalDiff.toFixed(2)}`);
  console.log(`Ожидаемая разница:    687,956.80`);
}

compareMarkups().catch(console.error);
