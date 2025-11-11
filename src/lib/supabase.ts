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

// =============================================
// ENUM типы
// =============================================

export type UnitType = 'шт' | 'м' | 'м2' | 'м3' | 'кг' | 'т' | 'л' | 'компл' | 'м.п.';
export type MaterialType = 'основн.' | 'вспомогат.';
export type BoqItemType = 'мат' | 'суб-мат' | 'мат-комп.' | 'раб' | 'суб-раб' | 'раб-комп.';
export type CurrencyType = 'RUB' | 'USD' | 'EUR' | 'CNY';
export type DeliveryPriceType = 'в цене' | 'не в цене' | 'суммой';

// Подтипы для материалов и работ (для удобства использования в UI)
export type ItemType = Extract<BoqItemType, 'мат' | 'суб-мат' | 'мат-комп.'>;
export type WorkItemType = Extract<BoqItemType, 'раб' | 'суб-раб' | 'раб-комп.'>;

// =============================================
// Типы для таблицы materials_library
// =============================================

export interface MaterialLibraryInsert {
  material_type: MaterialType;
  item_type: ItemType;
  consumption_coefficient?: number;
  unit_rate: number;
  currency_type?: CurrencyType;
  delivery_price_type?: DeliveryPriceType;
  delivery_amount?: number;
  detail_cost_category_id?: string | null;
  material_name_id: string;
}

export interface MaterialLibrary extends MaterialLibraryInsert {
  id: string;
  created_at: string;
  updated_at: string;
}

// =============================================
// Типы для таблицы material_names
// =============================================

export interface MaterialNameInsert {
  name: string;
  unit: UnitType;
}

export interface MaterialName extends MaterialNameInsert {
  id: string;
  created_at: string;
  updated_at: string;
}

// =============================================
// Типы для таблицы work_names
// =============================================

export interface WorkNameInsert {
  name: string;
  unit: UnitType;
}

export interface WorkName extends WorkNameInsert {
  id: string;
  created_at: string;
  updated_at: string;
}

// =============================================
// Типы для таблицы locations
// =============================================

export interface LocationInsert {
  location: string;
}

export interface Location extends LocationInsert {
  id: string;
  created_at: string;
  updated_at: string;
}

// =============================================
// Типы для таблицы cost_categories
// =============================================

export interface CostCategoryInsert {
  name: string;
  unit: UnitType;
}

export interface CostCategory extends CostCategoryInsert {
  id: string;
  created_at: string;
  updated_at: string;
}

// =============================================
// Типы для таблицы detail_cost_categories
// =============================================

export interface DetailCostCategoryInsert {
  cost_category_id: string;
  location_id: string;
  name: string;
  unit: UnitType;
  order_num?: number;
}

export interface DetailCostCategory extends DetailCostCategoryInsert {
  id: string;
  created_at: string;
  updated_at: string;
}

// =============================================
// Расширенный тип для materials_library с JOIN данными
// =============================================

export interface MaterialLibraryFull extends MaterialLibrary {
  material_name: string;
  unit: UnitType;
  detail_cost_category_name?: string;
  detail_cost_category_location?: string;
  cost_category_name?: string;
}

// =============================================
// Типы для таблицы works_library
// =============================================

export interface WorkLibraryInsert {
  work_name_id: string;
  item_type: WorkItemType;
  unit_rate: number;
  currency_type?: CurrencyType;
  detail_cost_category_id?: string | null;
}

export interface WorkLibrary extends WorkLibraryInsert {
  id: string;
  created_at: string;
  updated_at: string;
}

// =============================================
// Расширенный тип для works_library с JOIN данными
// =============================================

export interface WorkLibraryFull extends WorkLibrary {
  work_name: string;
  unit: UnitType;
  detail_cost_category_name?: string;
  detail_cost_category_location?: string;
  cost_category_name?: string;
}