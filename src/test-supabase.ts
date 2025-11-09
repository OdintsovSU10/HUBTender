// Тестовый файл для проверки подключения к Supabase
// Временный файл - можно удалить после тестирования

import { supabase } from './lib/supabase';

export async function testSupabaseConnection() {
  console.log('🔍 Тестирование подключения к Supabase...');

  try {
    // Проверка подключения - попытка получить список тендеров
    const { data, error, count } = await supabase
      .from('tenders')
      .select('*', { count: 'exact', head: false })
      .limit(1);

    if (error) {
      console.error('❌ Ошибка подключения к Supabase:', error);
      console.error('Детали ошибки:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      });
      return false;
    }

    console.log('✅ Подключение к Supabase успешно!');
    console.log(`📊 Количество тендеров в БД: ${count || 0}`);

    if (data && data.length > 0) {
      console.log('📄 Пример существующего тендера:', data[0]);
    }

    return true;
  } catch (err) {
    console.error('❌ Неожиданная ошибка:', err);
    return false;
  }
}

// Запуск теста при загрузке страницы (для отладки)
if (typeof window !== 'undefined') {
  // @ts-ignore
  window.testSupabase = testSupabaseConnection;
  console.log('💡 Для тестирования подключения выполните в консоли: window.testSupabase()');
}