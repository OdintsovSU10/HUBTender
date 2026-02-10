-- Разрешить создание задач без привязки к тендеру (пункт "Прочее")
ALTER TABLE public.user_tasks ALTER COLUMN tender_id DROP NOT NULL;
