-- Добавить новые статусы тендеров
INSERT INTO public.tender_statuses (name) VALUES
('Проиграли'),
('Выиграли')
ON CONFLICT (name) DO NOTHING;
