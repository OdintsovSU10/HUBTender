-- Миграция: Добавление поля для пользовательского заголовка объема строительства
-- Цель: Позволить редактировать заголовок "Полный объём строительства" для каждого тендера

BEGIN;

-- Добавляем поле volume_title в таблицу tenders
ALTER TABLE public.tenders
  ADD COLUMN IF NOT EXISTS volume_title text DEFAULT 'Полный объём строительства';

-- Комментарий к полю
COMMENT ON COLUMN public.tenders.volume_title IS 'Пользовательский заголовок для объема строительства на странице финансовых показателей';

COMMIT;

-- Перезагрузить схему PostgREST
NOTIFY pgrst, 'reload schema';
