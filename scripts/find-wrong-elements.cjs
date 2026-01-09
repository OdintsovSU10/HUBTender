const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
);

const TENDER_ID = 'b307b7d5-b145-4d06-a92e-8d1d50a6befe';

async function findWrongElements() {
  console.log('🔍 Поиск элементов с неправильным коэффициентом...\n');

  // Загрузка суб-мат_основн.
  let allBoqItems = [];
  let from = 0;
  const batchSize = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from('boq_items')
      .select('*')
      .eq('tender_id', TENDER_ID)
      .eq('boq_item_type', 'суб-мат')
      .eq('material_type', 'основн.')
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

  const EXPECTED_COEFF = 1.4036;
  const WRONG_COEFF = 1.344431; // Коэфф без роста субмат (1.1 × 1.16)
  const TOLERANCE = 0.00001;

  const wrongElements = allBoqItems.filter(item => {
    const base = item.total_amount || 0;
    if (base === 0) return false;

    const mat = item.total_commercial_material_cost || 0;
    const work = item.total_commercial_work_cost || 0;
    const commercial = mat + work;
    const actualCoeff = commercial / base;

    // Ищем элементы с коэффициентом близким к WRONG_COEFF (без роста)
    return Math.abs(actualCoeff - WRONG_COEFF) < TOLERANCE;
  });

  console.log(`Найдено элементов с неправильным коэффициентом: ${wrongElements.length}\n`);

  if (wrongElements.length > 0) {
    console.log('Примеры (первые 10):');
    wrongElements.slice(0, 10).forEach(item => {
      const base = item.total_amount || 0;
      const mat = item.total_commercial_material_cost || 0;
      const work = item.total_commercial_work_cost || 0;
      const commercial = mat + work;
      const actualCoeff = commercial / base;
      const expectedCommercial = base * EXPECTED_COEFF;

      console.log(`\nID: ${item.id.substring(0, 8)}`);
      console.log(`  База: ${base.toFixed(2)}`);
      console.log(`  Mat: ${mat.toFixed(2)}`);
      console.log(`  Work: ${work.toFixed(2)}`);
      console.log(`  Commercial: ${commercial.toFixed(2)}`);
      console.log(`  Коэфф факт: ${actualCoeff.toFixed(6)}`);
      console.log(`  Коэфф ожид: ${EXPECTED_COEFF.toFixed(6)}`);
      console.log(`  Ожид commercial: ${expectedCommercial.toFixed(2)}`);
      console.log(`  Разница: ${(expectedCommercial - commercial).toFixed(2)}`);
      console.log(`  Updated: ${item.updated_at}`);
    });

    // Проверка времени обновления
    const recentlyUpdated = wrongElements.filter(item => {
      const updated = new Date(item.updated_at);
      const now = new Date();
      const diffMinutes = (now - updated) / 1000 / 60;
      return diffMinutes < 10; // обновлены в последние 10 минут
    });

    console.log(`\n\nОбновлены в последние 10 минут: ${recentlyUpdated.length} из ${wrongElements.length}`);

    // Общая разница
    const totalDiff = wrongElements.reduce((sum, item) => {
      const base = item.total_amount || 0;
      const mat = item.total_commercial_material_cost || 0;
      const work = item.total_commercial_work_cost || 0;
      const commercial = mat + work;
      const expectedCommercial = base * EXPECTED_COEFF;
      return sum + (expectedCommercial - commercial);
    }, 0);

    console.log(`\n=== ИТОГО ===`);
    console.log(`Суммарная разница от 20 элементов: ${totalDiff.toFixed(2)}`);
    console.log(`Ожидаемая общая разница: 603,187.59`);
  }
}

findWrongElements().catch(console.error);
