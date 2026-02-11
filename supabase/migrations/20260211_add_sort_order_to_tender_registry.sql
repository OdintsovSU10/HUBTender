-- Добавить колонку sort_order для ручной сортировки тендеров
ALTER TABLE public.tender_registry
ADD COLUMN sort_order integer;

-- Установить начальные значения sort_order на основе created_at
WITH ordered_tenders AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at DESC) as rn
  FROM public.tender_registry
)
UPDATE public.tender_registry
SET sort_order = ordered_tenders.rn
FROM ordered_tenders
WHERE tender_registry.id = ordered_tenders.id;

-- Сделать sort_order NOT NULL после заполнения
ALTER TABLE public.tender_registry
ALTER COLUMN sort_order SET NOT NULL;

-- Добавить индекс для быстрой сортировки
CREATE INDEX idx_tender_registry_sort_order ON public.tender_registry(sort_order);
