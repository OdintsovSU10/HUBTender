const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
);

const TENDER_ID = 'b307b7d5-b145-4d06-a92e-8d1d50a6befe';

async function checkTenderMarkups() {
  console.log('📊 Параметры наценок для тендера ЖК Событие 6.2:\n');

  const { data, error } = await supabase
    .from('tender_markup_percentage')
    .select('value, markup_parameters(key, label)')
    .eq('tender_id', TENDER_ID);

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('Все параметры:');
  data.forEach(row => {
    console.log(`  ${row.markup_parameters.key}: ${row.value}%`);
  });

  // Найти нужные параметры
  const growth = data.find(r => r.markup_parameters.key === 'subcontract_materials_cost_growth');
  const overhead = data.find(r => r.markup_parameters.key === 'overhead_subcontract');
  const profit = data.find(r => r.markup_parameters.key === 'profit_subcontract');

  console.log('\n=== ПАРАМЕТРЫ ДЛЯ СУБ-МАТ ===');
  if (growth) {
    console.log(`Рост субмат: ${growth.value}% (коэфф ${1 + growth.value / 100})`);
  } else {
    console.log('❌ Рост субмат НЕ найден!');
  }

  if (overhead) {
    console.log(`ООЗ субмат: ${overhead.value}% (коэфф ${1 + overhead.value / 100})`);
  } else {
    console.log('❌ ООЗ субмат НЕ найден!');
  }

  if (profit) {
    console.log(`Прибыль субподряд: ${profit.value}% (коэфф ${1 + profit.value / 100})`);
  } else {
    console.log('❌ Прибыль субподряд НЕ найден!');
  }

  if (growth && overhead && profit) {
    const coeff1 = 1 + growth.value / 100;
    const coeff2 = 1 + overhead.value / 100;
    const coeff3 = 1 + profit.value / 100;
    const total = coeff1 * coeff2 * coeff3;

    console.log('\n=== РАСЧЕТ ===');
    console.log(`${coeff1} × ${coeff2} × ${coeff3} = ${total.toFixed(6)}`);
    console.log(`Ожидаемый коэффициент: 1.403600`);
    console.log(`Фактический у 20 элементов: 1.344431`);
  }
}

checkTenderMarkups().catch(console.error);
