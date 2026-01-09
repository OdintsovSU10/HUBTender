const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
);

const TENDER_ID = 'b307b7d5-b145-4d06-a92e-8d1d50a6befe';

// Импортируем логику из src/services/markupTactic/tactics.ts
async function recalculateTender() {
  console.log('🚀 Запуск пересчета тендера ЖК Событие 6.2...\n');

  // Получаем тактику тендера
  const { data: tender, error: tenderError } = await supabase
    .from('tenders')
    .select('markup_tactic_id, name')
    .eq('id', TENDER_ID)
    .single();

  if (tenderError || !tender?.markup_tactic_id) {
    console.error('❌ У тендера не задана тактика наценок');
    return;
  }

  console.log(`📊 Тендер: ${tender.name}`);
  console.log(`📋 Тактика ID: ${tender.markup_tactic_id}\n`);

  // Вызываем RPC функцию для пересчета (если она есть)
  // Или используем прямой SQL UPDATE

  console.log('⚠️  Для пересчета нужно:');
  console.log('1. Открыть /commerce в браузере');
  console.log('2. Выбрать тендер "ЖК Событие 6.2"');
  console.log('3. Нажать кнопку "Пересчитать" (иконка калькулятора)\n');

  console.log('Или запустите команду:');
  console.log('node scripts/recalculate-boq-items.js\n');
}

recalculateTender().catch(console.error);
