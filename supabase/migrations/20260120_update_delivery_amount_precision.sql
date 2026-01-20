-- Изменение точности поля delivery_amount с 2 до 5 знаков после запятой
-- для таблиц boq_items и materials_library

-- Шаг 1: Удалить view, который зависит от materials_library.delivery_amount
DROP VIEW IF EXISTS public.materials_library_full_view;

-- Шаг 2: Обновление таблицы boq_items
ALTER TABLE public.boq_items
ALTER COLUMN delivery_amount TYPE numeric(15, 5);

ALTER TABLE public.boq_items
ALTER COLUMN delivery_amount SET DEFAULT 0.00000;

-- Шаг 3: Обновление таблицы materials_library
ALTER TABLE public.materials_library
ALTER COLUMN delivery_amount TYPE numeric(15, 5);

ALTER TABLE public.materials_library
ALTER COLUMN delivery_amount SET DEFAULT 0.00000;

-- Шаг 4: Восстановить view с обновленной структурой
CREATE OR REPLACE VIEW public.materials_library_full_view AS
SELECT m.id,
  m.material_type,
  m.item_type,
  mn.name AS material_name,
  mn.unit,
  m.consumption_coefficient,
  m.unit_rate,
  m.currency_type,
  m.delivery_price_type,
  m.delivery_amount,
  m.created_at,
  m.updated_at
FROM (materials_library m
  JOIN material_names mn ON ((m.material_name_id = mn.id)));
