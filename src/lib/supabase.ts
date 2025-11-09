import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Проверка наличия конфигурации
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Supabase configuration is missing!');
  console.error('Please add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env.local file');
}

// Создание клиента Supabase
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key'
);

// Типы для таблицы tenders
export interface TenderInsert {
  title: string;
  description?: string;
  client_name: string;
  tender_number: string;
  submission_deadline: string;
  version?: number;
  area_client?: number;
  area_sp?: number;
  usd_rate?: number;
  eur_rate?: number;
  cny_rate?: number;
  upload_folder?: string;
  bsm_link?: string;
  tz_link?: string;
  qa_form_link?: string;
}

export interface Tender extends TenderInsert {
  id: string;
  created_at: string;
  updated_at: string;
  created_by?: string;
}