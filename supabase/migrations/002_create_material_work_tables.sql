-- =============================================
-- Создание таблиц material_names и work_names
-- Дата создания: 2025-11-08
-- =============================================

-- Включение необходимых расширений
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- Создание ENUM для единиц измерения
-- =============================================

-- Удаление типа если существует (опционально, раскомментируйте при необходимости)
-- DROP TYPE IF EXISTS unit_type CASCADE;

-- Создание ENUM типа для единиц измерения
CREATE TYPE unit_type AS ENUM (
    'шт',       -- штуки
    'м',        -- метры
    'м2',       -- квадратные метры
    'м3',       -- кубические метры
    'кг',       -- килограммы
    'т',        -- тонны
    'л',        -- литры
    'компл',    -- комплект
    'м.п.'      -- метры погонные
);

-- =============================================
-- Создание таблицы material_names
-- =============================================

-- Удаление таблицы если существует (опционально, раскомментируйте при необходимости)
-- DROP TABLE IF EXISTS public.material_names CASCADE;

CREATE TABLE IF NOT EXISTS public.material_names (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    unit unit_type NOT NULL,

    -- Служебные поля
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- Создание таблицы work_names
-- =============================================

-- Удаление таблицы если существует (опционально, раскомментируйте при необходимости)
-- DROP TABLE IF EXISTS public.work_names CASCADE;

CREATE TABLE IF NOT EXISTS public.work_names (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    unit unit_type NOT NULL,

    -- Служебные поля
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- Создание индексов для оптимизации запросов
-- =============================================

-- Индексы для material_names
CREATE INDEX IF NOT EXISTS idx_material_names_name ON public.material_names(name);
CREATE INDEX IF NOT EXISTS idx_material_names_unit ON public.material_names(unit);

-- Индексы для work_names
CREATE INDEX IF NOT EXISTS idx_work_names_name ON public.work_names(name);
CREATE INDEX IF NOT EXISTS idx_work_names_unit ON public.work_names(unit);

-- =============================================
-- Триггеры для автоматического обновления updated_at
-- =============================================

-- Функция уже создана в предыдущей миграции, проверяем существование
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Триггер для material_names
DROP TRIGGER IF EXISTS update_material_names_updated_at ON public.material_names;
CREATE TRIGGER update_material_names_updated_at
    BEFORE UPDATE ON public.material_names
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Триггер для work_names
DROP TRIGGER IF EXISTS update_work_names_updated_at ON public.work_names;
CREATE TRIGGER update_work_names_updated_at
    BEFORE UPDATE ON public.work_names
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- Row Level Security (RLS) - ОТКЛЮЧЕН
-- =============================================

-- RLS отключен для этих таблиц
ALTER TABLE public.material_names DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_names DISABLE ROW LEVEL SECURITY;

-- =============================================
-- Комментарии к полям для документации
-- =============================================

-- Комментарии для material_names
COMMENT ON TABLE public.material_names IS 'Справочник наименований материалов';
COMMENT ON COLUMN public.material_names.id IS 'Уникальный идентификатор материала (UUID)';
COMMENT ON COLUMN public.material_names.name IS 'Наименование материала';
COMMENT ON COLUMN public.material_names.unit IS 'Единица измерения материала';
COMMENT ON COLUMN public.material_names.created_at IS 'Дата и время создания записи';
COMMENT ON COLUMN public.material_names.updated_at IS 'Дата и время последнего обновления';

-- Комментарии для work_names
COMMENT ON TABLE public.work_names IS 'Справочник наименований работ';
COMMENT ON COLUMN public.work_names.id IS 'Уникальный идентификатор работы (UUID)';
COMMENT ON COLUMN public.work_names.name IS 'Наименование работы';
COMMENT ON COLUMN public.work_names.unit IS 'Единица измерения работы';
COMMENT ON COLUMN public.work_names.created_at IS 'Дата и время создания записи';
COMMENT ON COLUMN public.work_names.updated_at IS 'Дата и время последнего обновления';

-- =============================================
-- Пример вставки тестовых данных (опционально)
-- =============================================

/*
-- Примеры материалов
INSERT INTO public.material_names (name, unit) VALUES
    ('Кирпич красный полнотелый', 'шт'),
    ('Цемент М500', 'кг'),
    ('Арматура А500С d12', 'т'),
    ('Доска обрезная 50x150x6000', 'м3'),
    ('Песок речной', 'м3'),
    ('Щебень гранитный фр. 20-40', 'м3'),
    ('Утеплитель минеральная вата 100мм', 'м2'),
    ('Краска водоэмульсионная', 'л'),
    ('Гвозди строительные 100мм', 'кг'),
    ('Плитка керамическая 300x300', 'м2'),
    ('Труба стальная', 'м.п.'),
    ('Кабель ВВГ 3x2.5', 'м.п.');

-- Примеры работ
INSERT INTO public.work_names (name, unit) VALUES
    ('Кладка кирпичных стен', 'м3'),
    ('Монтаж арматурного каркаса', 'т'),
    ('Бетонирование фундамента', 'м3'),
    ('Штукатурка стен', 'м2'),
    ('Покраска стен', 'м2'),
    ('Укладка плитки', 'м2'),
    ('Монтаж утеплителя', 'м2'),
    ('Земляные работы', 'м3'),
    ('Монтаж трубопровода', 'м.п.'),
    ('Прокладка кабеля', 'м.п.');
*/

-- =============================================
-- Полезные запросы для работы с ENUM
-- =============================================

/*
-- Получить все возможные значения единиц измерения:
SELECT unnest(enum_range(NULL::unit_type)) AS unit_value;

-- Добавить новое значение в ENUM (требует осторожности):
-- ALTER TYPE unit_type ADD VALUE 'новая_единица';

-- Проверить, существует ли значение в ENUM:
-- SELECT 'шт'::unit_type;
*/