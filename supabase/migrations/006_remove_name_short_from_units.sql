-- Миграция: Удаление столбца name_short из таблицы units
-- Причина: Столбец name_short дублирует столбец code и не несет дополнительной информации

-- Удаляем столбец name_short из таблицы units
ALTER TABLE public.units
DROP COLUMN IF EXISTS name_short;

-- Комментарий к таблице units после изменения
COMMENT ON TABLE public.units IS 'Единицы измерения. Столбец code используется как для уникального идентификатора, так и для краткого обозначения единицы.';

-- Проверка структуры таблицы после удаления столбца
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_schema = 'public'
--   AND table_name = 'units'
-- ORDER BY ordinal_position;
