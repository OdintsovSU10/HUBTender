import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// Проверка наличия конфигурации
if (!supabaseUrl || !supabasePublishableKey) {
  console.error('Supabase configuration is missing!');
  console.error('Please add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to your .env.local file');
}

// Создание клиента Supabase с настройками timeout
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabasePublishableKey || 'placeholder-key',
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
    global: {
      headers: {
        'X-Client-Info': 'supabase-js-web',
      },
    },
    db: {
      schema: 'public',
    },
    // Увеличиваем timeout для медленных соединений
    realtime: {
      timeout: 30000,
    },
  }
);
