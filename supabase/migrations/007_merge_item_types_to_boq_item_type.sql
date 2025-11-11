-- Migration: Merge item_type and work_item_type into boq_item_type
-- Description: Объединяет два enum типа (item_type и work_item_type) в один общий boq_item_type
-- Date: 2025-11-11

-- Шаг 1: Удаляем views, которые зависят от колонок item_type
DROP VIEW IF EXISTS public.materials_library_full_view;
DROP VIEW IF EXISTS public.works_library_full_view;

-- Шаг 2: Создаем новый объединенный enum тип
CREATE TYPE public.boq_item_type AS ENUM (
  'мат',
  'суб-мат',
  'мат-комп.',
  'раб',
  'суб-раб',
  'раб-комп.'
);

-- Шаг 3: Изменяем тип колонки item_type в таблице materials_library
ALTER TABLE public.materials_library
  ALTER COLUMN item_type TYPE public.boq_item_type
  USING item_type::text::public.boq_item_type;

-- Шаг 4: Изменяем тип колонки item_type в таблице works_library
ALTER TABLE public.works_library
  ALTER COLUMN item_type TYPE public.boq_item_type
  USING item_type::text::public.boq_item_type;

-- Шаг 5: Пересоздаем view для materials_library
CREATE OR REPLACE VIEW public.materials_library_full_view AS
SELECT
  m.id,
  m.material_type,
  m.item_type,
  mn.name AS material_name,
  mn.unit,
  m.consumption_coefficient,
  m.unit_rate,
  m.currency_type,
  m.delivery_price_type,
  m.delivery_amount,
  dcc.name AS detail_cost_category_name,
  cc.name AS cost_category_name,
  m.created_at,
  m.updated_at
FROM materials_library m
JOIN material_names mn ON m.material_name_id = mn.id
LEFT JOIN detail_cost_categories dcc ON m.detail_cost_category_id = dcc.id
LEFT JOIN cost_categories cc ON dcc.cost_category_id = cc.id;

-- Шаг 6: Пересоздаем view для works_library
CREATE OR REPLACE VIEW public.works_library_full_view AS
SELECT
  w.id,
  w.item_type,
  wn.name AS work_name,
  wn.unit,
  w.unit_rate,
  w.currency_type,
  dcc.name AS detail_cost_category_name,
  cc.name AS cost_category_name,
  w.created_at,
  w.updated_at
FROM works_library w
JOIN work_names wn ON w.work_name_id = wn.id
LEFT JOIN detail_cost_categories dcc ON w.detail_cost_category_id = dcc.id
LEFT JOIN cost_categories cc ON dcc.cost_category_id = cc.id;

-- Шаг 7: Удаляем старые enum типы
DROP TYPE IF EXISTS public.item_type;
DROP TYPE IF EXISTS public.work_item_type;

-- Комментарии к новому типу
COMMENT ON TYPE public.boq_item_type IS 'Тип позиции в BOQ: материалы (мат, суб-мат, мат-комп.) и работы (раб, суб-раб, раб-комп.)';
