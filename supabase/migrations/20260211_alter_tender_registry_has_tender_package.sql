-- Изменить тип поля has_tender_package с boolean на text
ALTER TABLE public.tender_registry
ALTER COLUMN has_tender_package TYPE text USING
  CASE
    WHEN has_tender_package = true THEN 'Да'
    WHEN has_tender_package = false THEN 'Нет'
    ELSE NULL
  END;

ALTER TABLE public.tender_registry
ALTER COLUMN has_tender_package DROP DEFAULT;

COMMENT ON COLUMN public.tender_registry.has_tender_package IS 'Наличие тендерного пакета (текстовое поле)';
