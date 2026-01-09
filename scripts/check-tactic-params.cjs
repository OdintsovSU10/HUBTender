const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
);

const TENDER_ID = 'b307b7d5-b145-4d06-a92e-8d1d50a6befe'; // ЖК Событие 6.2

async function checkTacticParams() {
  // Получить тактику тендера
  const { data: tender, error: tenderError } = await supabase
    .from('tenders')
    .select('id, title, markup_tactic_id')
    .eq('id', TENDER_ID)
    .single();

  if (tenderError || !tender) {
    console.error('❌ Ошибка загрузки тендера:', tenderError);
    return;
  }

  console.log(`\n📊 Тендер: ${tender.title}`);
  console.log(`🎯 Тактика ID: ${tender.markup_tactic_id}`);

  // Получить тактику с sequences
  const { data: tactic, error: tacticError } = await supabase
    .from('markup_tactics')
    .select('*')
    .eq('id', tender.markup_tactic_id)
    .single();

  if (tacticError || !tactic) {
    console.error('❌ Ошибка загрузки тактики:', tacticError);
    return;
  }

  console.log(`\n📋 Тактика: ${tactic.name}`);
  console.log(`\n🔧 Sequences в тактике:`);
  console.log(JSON.stringify(tactic.sequences, null, 2));

  // Подсчет параметров
  const allParams = [
    ...(tactic.sequences['мат'] || []),
    ...(tactic.sequences['раб'] || []),
    ...(tactic.sequences['суб-мат'] || []),
    ...(tactic.sequences['суб-раб'] || []),
    ...(tactic.sequences['мат-комп.'] || []),
    ...(tactic.sequences['раб-комп.'] || [])
  ];

  console.log(`\n📊 Всего параметров в sequences: ${allParams.length}`);
}

checkTacticParams().catch(console.error);
