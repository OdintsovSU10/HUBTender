import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import * as url from 'url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

// Чтение .env.local
const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
const envLines = envContent.split('\n');

let supabaseUrl = '';
let supabaseKey = '';

envLines.forEach(line => {
  const [key, value] = line.split('=');
  if (key === 'VITE_SUPABASE_URL') {
    supabaseUrl = value.trim();
  } else if (key === 'VITE_SUPABASE_ANON_KEY') {
    supabaseKey = value.trim();
  }
});

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixGlobalTactic() {
  console.log('Исправление глобальной схемы наценок...');

  // Шаг 1: Убираем is_global у всех схем
  const { error: updateAllError } = await supabase
    .from('markup_tactics')
    .update({ is_global: false })
    .neq('id', '00000000-0000-0000-0000-000000000000'); // Обновляем все записи

  if (updateAllError) {
    console.error('Ошибка при сбросе is_global:', updateAllError);
    return;
  }

  console.log('✓ Флаг is_global сброшен для всех схем');

  // Шаг 2: Удаляем схему "Текущая тактика" если она есть
  const { error: deleteError } = await supabase
    .from('markup_tactics')
    .delete()
    .eq('name', 'Текущая тактика');

  if (deleteError) {
    console.error('Ошибка при удалении "Текущая тактика":', deleteError);
  } else {
    console.log('✓ Схема "Текущая тактика" удалена');
  }

  // Шаг 3: Проверяем, есть ли схема "Базовая схема"
  const { data: existingTactic, error: findError } = await supabase
    .from('markup_tactics')
    .select('*')
    .eq('name', 'Базовая схема')
    .single();

  if (findError && findError.code !== 'PGRST116') { // PGRST116 = no rows
    console.error('Ошибка при поиске схемы:', findError);
    return;
  }

  if (existingTactic) {
    // Шаг 4a: Схема существует, устанавливаем is_global = true
    const { error: updateError } = await supabase
      .from('markup_tactics')
      .update({ is_global: true })
      .eq('id', existingTactic.id);

    if (updateError) {
      console.error('Ошибка при установке is_global:', updateError);
      return;
    }

    console.log('✓ Схема "Базовая схема" помечена как глобальная');
  } else {
    // Шаг 4b: Схемы нет, создаём новую
    const { error: insertError } = await supabase
      .from('markup_tactics')
      .insert({
        name: 'Базовая схема',
        is_global: true,
        sequences: {
          'раб': [],
          'мат': [],
          'суб-раб': [],
          'суб-мат': [],
          'раб-комп.': [],
          'мат-комп.': []
        },
        base_costs: {
          'раб': 0,
          'мат': 0,
          'суб-раб': 0,
          'суб-мат': 0,
          'раб-комп.': 0,
          'мат-комп.': 0
        }
      });

    if (insertError) {
      console.error('Ошибка при создании схемы:', insertError);
      return;
    }

    console.log('✓ Схема "Базовая схема" создана и помечена как глобальная');
  }

  console.log('\n✅ Исправление завершено успешно!');
}

fixGlobalTactic();
