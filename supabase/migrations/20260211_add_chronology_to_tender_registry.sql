-- Добавить поле хронологии в таблицу tender_registry
ALTER TABLE public.tender_registry
ADD COLUMN chronology text;

COMMENT ON COLUMN public.tender_registry.chronology IS 'Хронология (текстовое поле)';
