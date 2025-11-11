-- Migration: Merge item_type and work_item_type into boq_item_type
-- Description: Объединяет два enum типа (item_type и work_item_type) в один общий boq_item_type
-- Date: 2025-11-11

-- Шаг 1: Создаем новый объединенный enum тип
CREATE TYPE public.boq_item_type AS ENUM (
  'мат',
  'суб-мат',
  'мат-комп.',
  'раб',
  'суб-раб',
  'раб-комп.'
);

-- Шаг 2: Изменяем тип колонки item_type в таблице materials_library
ALTER TABLE public.materials_library
  ALTER COLUMN item_type TYPE public.boq_item_type
  USING item_type::text::public.boq_item_type;

-- Шаг 3: Изменяем тип колонки item_type в таблице works_library
ALTER TABLE public.works_library
  ALTER COLUMN item_type TYPE public.boq_item_type
  USING item_type::text::public.boq_item_type;

-- Шаг 4: Удаляем старые enum типы (если они не используются в других местах)
DROP TYPE IF EXISTS public.item_type;
DROP TYPE IF EXISTS public.work_item_type;

-- Комментарии к новому типу
COMMENT ON TYPE public.boq_item_type IS 'Тип позиции в BOQ: материалы (мат, суб-мат, мат-комп.) и работы (раб, суб-раб, раб-комп.)';
