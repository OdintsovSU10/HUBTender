const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
);

const TENDER_ID = 'b307b7d5-b145-4d06-a92e-8d1d50a6befe';

async function checkNullMaterialType() {
  console.log('🔍 Проверка элементов с material_type = NULL...\n');

  let allBoqItems = [];
  let from = 0;
  const batchSize = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from('boq_items')
      .select('id, boq_item_type, material_type, total_amount, total_commercial_material_cost, total_commercial_work_cost')
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

  // Элементы мат/мат-комп/суб-мат с NULL material_type
  const materialsWithNullType = allBoqItems.filter(item =>
    ['мат', 'суб-мат', 'мат-комп.'].includes(item.boq_item_type) && !item.material_type
  );

  console.log(`📊 Материалов с material_type = NULL: ${materialsWithNullType.length}`);
  if (materialsWithNullType.length > 0) {
    const byType = {};
    materialsWithNullType.forEach(item => {
      if (!byType[item.boq_item_type]) {
        byType[item.boq_item_type] = { count: 0, base: 0, mat: 0, work: 0 };
      }
      byType[item.boq_item_type].count++;
      byType[item.boq_item_type].base += item.total_amount || 0;
      byType[item.boq_item_type].mat += item.total_commercial_material_cost || 0;
      byType[item.boq_item_type].work += item.total_commercial_work_cost || 0;
    });

    console.log('\nРазбивка:');
    console.table(byType);
  }

  // Проверка вспомогательных материалов с Mat > 0
  const auxWithMat = allBoqItems.filter(item =>
    item.material_type === 'вспомогат.' &&
    (item.total_commercial_material_cost || 0) > 0
  );

  console.log(`\n⚠️  Вспомогательных материалов с Mat > 0: ${auxWithMat.length}`);
  if (auxWithMat.length > 0) {
    const matSum = auxWithMat.reduce((sum, item) => sum + (item.total_commercial_material_cost || 0), 0);
    console.log(`   Сумма Mat: ${matSum.toLocaleString('ru-RU')}`);
    console.log('\nПримеры:');
    console.table(auxWithMat.slice(0, 10).map(item => ({
      id: item.id.substring(0, 8),
      type: item.boq_item_type,
      base: item.total_amount,
      mat: item.total_commercial_material_cost,
      work: item.total_commercial_work_cost
    })));
  }

  // Ожидаемая сумма Mat для вспомогательных
  const expectedAuxMatSum = 3076734.15 + 102371.03; // из предыдущего анализа
  console.log(`\nОжидаемая сумма Mat вспомогательных: ${expectedAuxMatSum.toLocaleString('ru-RU')}`);
  console.log('Эта сумма должна быть переведена в Work для корректного расчета.');
}

checkNullMaterialType().catch(console.error);
