-- Миграция: Увеличение точности default_value в markup_parameters до 5 знаков после запятой
-- Дата: 2026-01-28
-- Проблема: default_value имеет тип numeric(5,2), что ограничивает ввод до 2 знаков после запятой

-- Изменяем тип колонки default_value с numeric(5,2) на numeric(10,5)
ALTER TABLE public.markup_parameters
ALTER COLUMN default_value TYPE numeric(10,5);

COMMENT ON COLUMN public.markup_parameters.default_value IS 'Базовое (глобальное) значение процента по умолчанию (до 5 знаков после запятой). Используется при создании новых тендеров и как значение по умолчанию в интерфейсе.';
