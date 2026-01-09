const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
);

const TACTIC_ID = '9cc46d62-03ce-43ca-b33d-bb903cef3338'; // Admiral

async function checkAdmiralParams() {
  console.log('📋 Параметры тактики Admiral:\n');

  const { data: params, error } = await supabase
    .from('markup_parameters')
    .select('*')
    .eq('markup_tactic_id', TACTIC_ID)
    .order('order_number', { ascending: true });

  if (error) {
    console.error('Ошибка:', error);
    return;
  }

  params.forEach(p => {
    console.log(`${p.order_number}. ${p.parameter_name}`);
    console.log(`   База: ${p.base_value}`);
    console.log(`   Коэффициент: ${p.coefficient}`);
    console.log(`   Процент: ${p.is_percentage ? 'Да' : 'Нет'}`);
    console.log('');
  });

  // Проверка на наличие параметра "Рост субмат 10%"
  const growthParam = params.find(p => p.parameter_name.includes('Рост субмат'));

  if (growthParam) {
    console.log(`✅ Найден параметр роста субподряда: "${growthParam.parameter_name}"`);
    console.log(`   Порядок: ${growthParam.order_number}`);
    console.log(`   База: ${growthParam.base_value}`);
    console.log(`   Коэффициент: ${growthParam.coefficient}`);
  } else {
    console.log('❌ Параметр роста субподряда НЕ найден!');
  }
}

checkAdmiralParams().catch(console.error);
