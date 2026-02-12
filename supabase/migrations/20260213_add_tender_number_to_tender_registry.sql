-- Добавить поле tender_number как текстовое (nullable)
ALTER TABLE public.tender_registry
ADD COLUMN tender_number text;

COMMENT ON COLUMN public.tender_registry.tender_number
IS 'Номер тендера (связь с таблицей tenders.tender_number, но не жесткий FK для гибкости)';

-- Индекс для производительности
CREATE INDEX IF NOT EXISTS idx_tender_registry_tender_number
ON public.tender_registry(tender_number);

-- Добавить поле is_archived для архивации тендеров
ALTER TABLE public.tender_registry
ADD COLUMN is_archived boolean DEFAULT false NOT NULL;

COMMENT ON COLUMN public.tender_registry.is_archived
IS 'Флаг архивации тендера (true = в архиве, false = текущий)';

-- Индекс для фильтрации по архиву
CREATE INDEX IF NOT EXISTS idx_tender_registry_is_archived
ON public.tender_registry(is_archived);
