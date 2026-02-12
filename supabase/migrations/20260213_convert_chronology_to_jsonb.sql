-- Добавить новое поле chronology_items (массив объектов {date, text})
ALTER TABLE public.tender_registry
ADD COLUMN chronology_items jsonb DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.tender_registry.chronology_items
IS 'Хронология событий тендера (массив {date: ISO string, text: string})';

-- Автоматическая миграция данных из старого text-поля
UPDATE public.tender_registry
SET chronology_items =
  CASE
    WHEN chronology IS NOT NULL AND trim(chronology) != ''
    THEN jsonb_build_array(
      jsonb_build_object(
        'date', null,
        'text', chronology
      )
    )
    ELSE '[]'::jsonb
  END
WHERE chronology_items = '[]'::jsonb;

-- Оставить старое поле для совместимости (можно удалить позже)
-- ALTER TABLE public.tender_registry DROP COLUMN chronology;
