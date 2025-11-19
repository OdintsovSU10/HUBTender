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
  markup_tactic_id?: string; // Ссылка на тактику наценок для данного тендера
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
}

// =============================================
// Типы для таблицы works_library
// =============================================

export interface WorkLibraryInsert {
  work_name_id: string;
  item_type: WorkItemType;
  unit_rate: number;
  currency_type?: CurrencyType;
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
}

// =============================================
// Типы для таблицы work_material_templates
// =============================================

export interface WorkMaterialTemplateInsert {
  template_name: string;
  detail_cost_category_id: string;
  consumption_coefficient: number;
  work_library_id: string;
  material_library_id: string;
  order_num?: number;
  is_active?: boolean;
}

export interface WorkMaterialTemplate extends WorkMaterialTemplateInsert {
  id: string;
  created_at: string;
  updated_at: string;
}

// =============================================
// Расширенный тип для work_material_templates с JOIN данными
// =============================================

export interface WorkMaterialTemplateFull extends WorkMaterialTemplate {
  work_name: string;
  work_unit: UnitType;
  work_item_type: WorkItemType;
  work_unit_rate: number;
  work_currency_type: CurrencyType;
  material_name: string;
  material_unit: UnitType;
  material_type: MaterialType;
  material_item_type: ItemType;
  material_unit_rate: number;
  material_currency_type: CurrencyType;
  detail_cost_category_name: string;
  cost_category_name: string;
  location: string;
}

// =============================================
// Типы для таблицы markup_parameters (справочник параметров наценок)
// =============================================

export interface MarkupParameterInsert {
  key: string;
  label: string;
  is_active?: boolean;
  order_num?: number;
  default_value?: number;
}

export interface MarkupParameter extends MarkupParameterInsert {
  id: string;
  created_at: string;
  updated_at: string;
  default_value: number;
}

// =============================================
// Типы для таблицы tender_markup_percentage
// =============================================

export interface TenderMarkupPercentageInsert {
  tender_id: string;
  markup_parameter_id: string;
  value: number;
}

export interface TenderMarkupPercentage extends TenderMarkupPercentageInsert {
  id: string;
  created_at: string;
  updated_at: string;
}

// Расширенный тип с данными параметра наценки
export interface TenderMarkupPercentageFull extends TenderMarkupPercentage {
  markup_parameter: MarkupParameter;
}

// Вспомогательный тип для UI - данные наценок с ключами параметров
export interface TenderMarkupPercentageUI {
  tender_id: string;
  [key: string]: number | string; // динамические ключи параметров
}

// =============================================
// Типы для таблицы templates
// =============================================

export interface TemplateInsert {
  name: string;
  detail_cost_category_id: string;
}

export interface Template extends TemplateInsert {
  id: string;
  created_at: string;
  updated_at: string;
}

// =============================================
// Типы для таблицы template_items
// =============================================

export type TemplateItemKind = 'work' | 'material';

export interface TemplateItemInsert {
  template_id: string;
  kind: TemplateItemKind;
  work_library_id?: string | null;
  material_library_id?: string | null;
  parent_work_item_id?: string | null;
  conversation_coeff?: number | null;
  detail_cost_category_id?: string | null;
  position?: number;
  note?: string | null;
}

export interface TemplateItem extends TemplateItemInsert {
  id: string;
  created_at: string;
  updated_at: string;
}

// Расширенные типы с JOIN данными
export interface TemplateItemFull extends TemplateItem {
  work_name?: string;
  work_unit?: UnitType;
  material_name?: string;
  material_unit?: UnitType;
  parent_work_name?: string;
  detail_cost_category_name?: string;
  detail_cost_category_full?: string; // Format: "Category / Detail / Location"
}

// =============================================
// Markup Tactics (Тактики наценок)
// =============================================

// Структура шага наценки
export interface MarkupStep {
  name?: string; // Название пункта
  baseIndex: number; // -1 для базовой стоимости, или индекс пункта в массиве

  // Первая операция (обязательная)
  action1: 'multiply' | 'divide' | 'add' | 'subtract';
  operand1Type: 'markup' | 'step' | 'number'; // наценка, результат другого шага или число
  operand1Key?: string | number; // ключ наценки (если operand1Type = 'markup') или число (если operand1Type = 'number')
  operand1Index?: number; // индекс шага (если operand1Type = 'step')
  operand1MultiplyFormat?: 'addOne' | 'direct'; // формат умножения: 'addOne' = (1 + %), 'direct' = %

  // Вторая операция (опциональная)
  action2?: 'multiply' | 'divide' | 'add' | 'subtract';
  operand2Type?: 'markup' | 'step' | 'number';
  operand2Key?: string | number;
  operand2Index?: number;
  operand2MultiplyFormat?: 'addOne' | 'direct';

  // Третья операция (опциональная)
  action3?: 'multiply' | 'divide' | 'add' | 'subtract';
  operand3Type?: 'markup' | 'step' | 'number';
  operand3Key?: string | number;
  operand3Index?: number;
  operand3MultiplyFormat?: 'addOne' | 'direct';

  // Четвертая операция (опциональная)
  action4?: 'multiply' | 'divide' | 'add' | 'subtract';
  operand4Type?: 'markup' | 'step' | 'number';
  operand4Key?: string | number;
  operand4Index?: number;
  operand4MultiplyFormat?: 'addOne' | 'direct';

  // Пятая операция (опциональная)
  action5?: 'multiply' | 'divide' | 'add' | 'subtract';
  operand5Type?: 'markup' | 'step' | 'number';
  operand5Key?: string | number;
  operand5Index?: number;
  operand5MultiplyFormat?: 'addOne' | 'direct';
}

// Маппинг UI ключей вкладок на boq_item_type
export type TabKey = 'works' | 'materials' | 'subcontract_works' | 'subcontract_materials' | 'work_comp' | 'material_comp';

export const TAB_TO_BOQ_TYPE: Record<TabKey, BoqItemType> = {
  works: 'раб',
  materials: 'мат',
  subcontract_works: 'суб-раб',
  subcontract_materials: 'суб-мат',
  work_comp: 'раб-комп.',
  material_comp: 'мат-комп.',
};

export const BOQ_TYPE_TO_TAB: Record<BoqItemType, TabKey> = {
  'раб': 'works',
  'мат': 'materials',
  'суб-раб': 'subcontract_works',
  'суб-мат': 'subcontract_materials',
  'раб-комп.': 'work_comp',
  'мат-комп.': 'material_comp',
};

// Структура последовательностей наценок (используем boq_item_type)
export interface MarkupSequences {
  'раб': MarkupStep[];
  'мат': MarkupStep[];
  'суб-раб': MarkupStep[];
  'суб-мат': MarkupStep[];
  'раб-комп.': MarkupStep[];
  'мат-комп.': MarkupStep[];
}

// Структура базовых стоимостей (используем boq_item_type)
export interface BaseCosts {
  'раб': number;
  'мат': number;
  'суб-раб': number;
  'суб-мат': number;
  'раб-комп.': number;
  'мат-комп.': number;
}

// Вставка новой тактики
export interface MarkupTacticInsert {
  name?: string;
  sequences: MarkupSequences;
  base_costs: BaseCosts;
  user_id?: string;
  is_global?: boolean;
}

// Полная тактика наценок
export interface MarkupTactic extends MarkupTacticInsert {
  id: string;
  created_at: string;
  updated_at: string;
}

// =============================================
// Типы для таблицы boq_items (элементы позиций заказчика)
// =============================================

export interface BoqItemInsert {
  // Связи
  tender_id: string;
  client_position_id: string;

  // Сортировка
  sort_number?: number;

  // Типы элементов
  boq_item_type: BoqItemType;
  material_type?: MaterialType | null;

  // Наименования
  material_name_id?: string | null;
  work_name_id?: string | null;

  // Единица измерения
  unit_code?: string | null;

  // Количественные показатели
  quantity?: number | null;
  base_quantity?: number | null;
  consumption_coefficient?: number | null;
  conversion_coefficient?: number | null;

  // Привязка материала к работе
  parent_work_item_id?: string | null;

  // Доставка
  delivery_price_type?: DeliveryPriceType | null;
  delivery_amount?: number | null;

  // Валюта и суммы
  currency_type?: CurrencyType;
  unit_rate?: number | null;
  total_amount?: number | null;

  // Затрата на строительство
  detail_cost_category_id?: string | null;

  // Примечание
  quote_link?: string | null;
  description?: string | null;

  // Коммерческие показатели
  commercial_markup?: number | null;
  total_commercial_material_cost?: number | null;
  total_commercial_work_cost?: number | null;
}

export interface BoqItem extends BoqItemInsert {
  id: string;
  created_at: string;
  updated_at: string;
}

// Расширенный тип с JOIN данными
export interface BoqItemFull extends BoqItem {
  // Данные из material_names
  material_name?: string;
  material_unit?: UnitType;

  // Данные из work_names
  work_name?: string;
  work_unit?: UnitType;

  // Данные из detail_cost_categories
  detail_cost_category_name?: string;
  detail_cost_category_full?: string; // Format: "Category / Detail / Location"

  // Данные из units
  unit_name?: string;

  // Данные родительской работы (для привязанных материалов)
  parent_work_name?: string;
  parent_work_unit?: UnitType;
  parent_work_quantity?: number;
}

// =============================================
// Типы для таблицы client_positions (позиции заказчика)
// =============================================

export interface ClientPositionInsert {
  tender_id: string;
  position_number: number;
  unit_code?: string | null;
  volume?: number | null;
  client_note?: string | null;
  item_no?: string | null;
  work_name: string;
  manual_volume?: number | null;
  manual_note?: string | null;
  hierarchy_level?: number;
  is_additional?: boolean;
  parent_position_id?: string | null;
  total_material?: number;
  total_works?: number;
  material_cost_per_unit?: number;
  work_cost_per_unit?: number;
  total_commercial_material?: number;
  total_commercial_work?: number;
  total_commercial_material_per_unit?: number;
  total_commercial_work_per_unit?: number;
}

export interface ClientPosition extends ClientPositionInsert {
  id: string;
  created_at: string;
  updated_at: string;
}