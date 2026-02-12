-- Добавить новое поле tender_package_items (массив объектов {date, text})
ALTER TABLE public.tender_registry
ADD COLUMN tender_package_items jsonb DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.tender_registry.tender_package_items
IS 'Информация о тендерном пакете (массив {date: ISO string, text: string})';

-- Автоматическая миграция данных
UPDATE public.tender_registry
SET tender_package_items =
  CASE
    WHEN has_tender_package IS NOT NULL AND trim(has_tender_package) != ''
    THEN jsonb_build_array(
      jsonb_build_object(
        'date', null,
        'text', has_tender_package
      )
    )
    ELSE '[]'::jsonb
  END
WHERE tender_package_items = '[]'::jsonb;

-- Оставить старое поле для совместимости (можно удалить позже)
-- ALTER TABLE public.tender_registry DROP COLUMN has_tender_package;
