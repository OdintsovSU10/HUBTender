const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
);

const TENDER_ID = 'b307b7d5-b145-4d06-a92e-8d1d50a6befe';

async function checkRecalcCoverage() {
  console.log('🔍 Проверка покрытия пересчета...\n');

  // Загрузка всех элементов
  let allBoqItems = [];
  let from = 0;
  const batchSize = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from('boq_items')
      .select('*')
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

  console.log(`📝 Всего элементов: ${allBoqItems.length}\n`);

  // Проверка суб-мат_основн. на точность коэффициента
  const subMatBasic = allBoqItems.filter(item =>
    item.boq_item_type === 'суб-мат' && item.material_type === 'основн.'
  );

  console.log('=== АНАЛИЗ СУБ-МАТ_ОСНОВН. ===');
  console.log(`Элементов: ${subMatBasic.length}\n`);

  let totalRoundingError = 0;
  let elementsWithWrongCoeff = 0;
  const EXPECTED_COEFF = 1.4036;
  const TOLERANCE = 0.000001; // 0.0001%

  subMatBasic.forEach(item => {
    const base = item.total_amount || 0;
    if (base === 0) return;

    const mat = item.total_commercial_material_cost || 0;
    const work = item.total_commercial_work_cost || 0;
    const commercial = mat + work;

    const actualCoeff = commercial / base;
    const expectedCommercial = base * EXPECTED_COEFF;
    const roundingError = expectedCommercial - commercial;

    totalRoundingError += roundingError;

    if (Math.abs(actualCoeff - EXPECTED_COEFF) > TOLERANCE) {
      elementsWithWrongCoeff++;
    }
  });

  console.log(`Элементов с неправильным коэффициентом: ${elementsWithWrongCoeff}`);
  console.log(`Суммарная ошибка округления: ${totalRoundingError.toFixed(2)}`);
  console.log(`Средняя ошибка на элемент: ${(totalRoundingError / subMatBasic.length).toFixed(6)}\n`);

  // Проверка раб
  const works = allBoqItems.filter(item => item.boq_item_type === 'раб');
  console.log('=== АНАЛИЗ РАБ ===');
  console.log(`Элементов: ${works.length}\n`);

  let worksRoundingError = 0;
  let worksWithWrongCoeff = 0;
  const EXPECTED_WORKS_COEFF = 2.869;

  works.forEach(item => {
    const base = item.total_amount || 0;
    if (base === 0) return;

    const mat = item.total_commercial_material_cost || 0;
    const work = item.total_commercial_work_cost || 0;
    const commercial = mat + work;

    const actualCoeff = commercial / base;
    const expectedCommercial = base * EXPECTED_WORKS_COEFF;
    const roundingError = expectedCommercial - commercial;

    worksRoundingError += roundingError;

    if (Math.abs(actualCoeff - EXPECTED_WORKS_COEFF) > TOLERANCE) {
      worksWithWrongCoeff++;
    }
  });

  console.log(`Элементов с неправильным коэффициентом: ${worksWithWrongCoeff}`);
  console.log(`Суммарная ошибка округления: ${worksRoundingError.toFixed(2)}`);
  console.log(`Средняя ошибка на элемент: ${(worksRoundingError / works.length).toFixed(6)}\n`);

  console.log('=== ИТОГО ===');
  console.log(`Ошибка от суб-мат_основн.: ${totalRoundingError.toFixed(2)}`);
  console.log(`Ошибка от раб: ${worksRoundingError.toFixed(2)}`);
  console.log(`Общая ошибка округления: ${(totalRoundingError + worksRoundingError).toFixed(2)}`);
  console.log(`Ожидаемая разница: 687,956.80`);
}

checkRecalcCoverage().catch(console.error);
