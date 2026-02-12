-- Добавить поле адрес объекта
ALTER TABLE public.tender_registry
ADD COLUMN object_address text;

COMMENT ON COLUMN public.tender_registry.object_address
IS 'Адрес объекта строительства';

-- Полнотекстовый индекс для поиска по адресу
CREATE INDEX IF NOT EXISTS idx_tender_registry_object_address
ON public.tender_registry USING gin(to_tsvector('russian', object_address));
