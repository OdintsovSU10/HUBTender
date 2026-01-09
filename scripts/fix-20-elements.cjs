const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
);

const TENDER_ID = 'b307b7d5-b145-4d06-a92e-8d1d50a6befe';
const EXPECTED_COEFF = 1.4036;
const WRONG_COEFF = 1.344431;

async function fix20Elements() {
  console.log('🔧 Исправление 20 элементов с неправильным коэффициентом...\n');

  // Загрузка элементов
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

  // Найти элементы с неправильным коэффициентом
  const wrongElements = allBoqItems.filter(item => {
    const base = item.total_amount || 0;
    if (base === 0) return false;

    const mat = item.total_commercial_material_cost || 0;
    const work = item.total_commercial_work_cost || 0;
    const commercial = mat + work;
    const coeff = commercial / base;

    return Math.abs(coeff - WRONG_COEFF) < 0.00001;
  });

  console.log(`Найдено элементов для исправления: ${wrongElements.length}\n`);

  if (wrongElements.length === 0) {
    console.log('✅ Все элементы уже имеют правильный коэффициент!');
    return;
  }

  // Исправить каждый элемент
  let fixed = 0;
  let totalDiffBefore = 0;
  let totalDiffAfter = 0;

  for (const item of wrongElements) {
    const base = item.total_amount || 0;
    const oldMat = item.total_commercial_material_cost || 0;
    const oldWork = item.total_commercial_work_cost || 0;
    const oldCommercial = oldMat + oldWork;

    // Рассчитываем новую коммерческую стоимость
    const newCommercial = base * EXPECTED_COEFF;

    // Для суб-мат основн.: база в Mat, наценка в Work
    const newMat = base; // база
    const newWork = newCommercial - base; // наценка

    const diffBefore = (base * EXPECTED_COEFF) - oldCommercial;
    totalDiffBefore += diffBefore;

    // Обновляем
    const { error } = await supabase
      .from('boq_items')
      .update({
        total_commercial_material_cost: newMat,
        total_commercial_work_cost: newWork,
        commercial_markup: EXPECTED_COEFF,
        updated_at: new Date().toISOString()
      })
      .eq('id', item.id);

    if (error) {
      console.error(`❌ Ошибка обновления ${item.id}:`, error);
    } else {
      fixed++;
      console.log(`✅ ${item.id.substring(0, 8)}: база ${base.toFixed(2)}, было ${oldCommercial.toFixed(2)}, стало ${newCommercial.toFixed(2)}, diff ${diffBefore.toFixed(2)}`);
    }
  }

  console.log(`\n=== ИТОГО ===`);
  console.log(`Исправлено элементов: ${fixed} из ${wrongElements.length}`);
  console.log(`Общая разница ДО: ${totalDiffBefore.toFixed(2)}`);
  console.log(`Ожидаемая общая разница: 603,187.59`);
  console.log(`\nТеперь откройте /commerce и проверьте итоговую сумму.`);
}

fix20Elements().catch(console.error);
