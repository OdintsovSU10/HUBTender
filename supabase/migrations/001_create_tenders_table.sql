-- =============================================
-- Создание таблицы Tenders
-- Дата создания: 2025-11-08
-- =============================================

-- Включение необходимых расширений
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Удаление таблицы если существует (опционально, раскомментируйте при необходимости)
-- DROP TABLE IF EXISTS public.tenders CASCADE;

-- Создание таблицы Tenders
CREATE TABLE IF NOT EXISTS public.tenders (
    -- Основные поля
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    description TEXT,
    client_name TEXT NOT NULL,
    tender_number TEXT NOT NULL UNIQUE,
    submission_deadline TIMESTAMPTZ,
    version INTEGER DEFAULT 1,

    -- Площади
    area_client DECIMAL(12,2),
    area_sp DECIMAL(12,2),

    -- Курсы валют
    usd_rate DECIMAL(10,4),
    eur_rate DECIMAL(10,4),
    cny_rate DECIMAL(10,4),

    -- Ссылки на документы
    upload_folder TEXT,
    bsm_link TEXT,
    tz_link TEXT,
    qa_form_link TEXT,

    -- Служебные поля
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

-- =============================================
-- Создание индексов для оптимизации запросов
-- =============================================

CREATE INDEX IF NOT EXISTS idx_tenders_tender_number ON public.tenders(tender_number);
CREATE INDEX IF NOT EXISTS idx_tenders_submission_deadline ON public.tenders(submission_deadline);
CREATE INDEX IF NOT EXISTS idx_tenders_client_name ON public.tenders(client_name);
CREATE INDEX IF NOT EXISTS idx_tenders_created_at ON public.tenders(created_at DESC);

-- =============================================
-- Функция для автоматического обновления updated_at
-- =============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- =============================================
-- Триггер для автоматического обновления updated_at
-- =============================================

DROP TRIGGER IF EXISTS update_tenders_updated_at ON public.tenders;
CREATE TRIGGER update_tenders_updated_at
    BEFORE UPDATE ON public.tenders
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- Row Level Security (RLS) - ОТКЛЮЧЕН
-- =============================================

-- RLS отключен для этой таблицы
ALTER TABLE public.tenders DISABLE ROW LEVEL SECURITY;

-- Политики RLS закомментированы, но сохранены для возможного использования в будущем
/*
-- Включение RLS
ALTER TABLE public.tenders ENABLE ROW LEVEL SECURITY;

-- Политика: Все авторизованные пользователи могут просматривать тендеры
CREATE POLICY "Enable read access for authenticated users" ON public.tenders
    FOR SELECT
    USING (auth.role() = 'authenticated');

-- Политика: Только создатель может редактировать свои тендеры
CREATE POLICY "Enable update for tender creators" ON public.tenders
    FOR UPDATE
    USING (auth.uid() = created_by);

-- Политика: Все авторизованные пользователи могут создавать тендеры
CREATE POLICY "Enable insert for authenticated users" ON public.tenders
    FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');

-- Политика: Только создатель может удалять свои тендеры
CREATE POLICY "Enable delete for tender creators" ON public.tenders
    FOR DELETE
    USING (auth.uid() = created_by);
*/

-- =============================================
-- Комментарии к полям для документации
-- =============================================

COMMENT ON TABLE public.tenders IS 'Основная таблица для хранения информации о тендерах';
COMMENT ON COLUMN public.tenders.id IS 'Уникальный идентификатор тендера (UUID)';
COMMENT ON COLUMN public.tenders.title IS 'Название тендера';
COMMENT ON COLUMN public.tenders.description IS 'Подробное описание тендера';
COMMENT ON COLUMN public.tenders.client_name IS 'Наименование заказчика';
COMMENT ON COLUMN public.tenders.tender_number IS 'Номер тендера (уникальный, текст+цифры)';
COMMENT ON COLUMN public.tenders.submission_deadline IS 'Дата и время окончания приема заявок';
COMMENT ON COLUMN public.tenders.version IS 'Версия тендера';
COMMENT ON COLUMN public.tenders.area_client IS 'Площадь объекта заказчика (м²)';
COMMENT ON COLUMN public.tenders.area_sp IS 'Площадь СП (м²)';
COMMENT ON COLUMN public.tenders.usd_rate IS 'Курс доллара США';
COMMENT ON COLUMN public.tenders.eur_rate IS 'Курс евро';
COMMENT ON COLUMN public.tenders.cny_rate IS 'Курс китайского юаня';
COMMENT ON COLUMN public.tenders.upload_folder IS 'Ссылка на папку с загруженными файлами';
COMMENT ON COLUMN public.tenders.bsm_link IS 'Ссылка на БСМ (Bill of Materials)';
COMMENT ON COLUMN public.tenders.tz_link IS 'Ссылка на техническое задание';
COMMENT ON COLUMN public.tenders.qa_form_link IS 'Ссылка на форму вопросов и ответов';
COMMENT ON COLUMN public.tenders.created_at IS 'Дата и время создания записи';
COMMENT ON COLUMN public.tenders.updated_at IS 'Дата и время последнего обновления';
COMMENT ON COLUMN public.tenders.created_by IS 'ID пользователя, создавшего тендер';

-- =============================================
-- Пример вставки тестовых данных (опционально)
-- =============================================

/*
INSERT INTO public.tenders (
    title,
    description,
    client_name,
    tender_number,
    submission_deadline,
    version,
    area_client,
    area_sp,
    usd_rate,
    eur_rate,
    cny_rate
) VALUES (
    'Строительство офисного здания',
    'Тендер на строительство 5-этажного офисного здания в центре города',
    'ООО "СтройИнвест"',
    'T-2025-001',
    '2025-12-31 23:59:59+03',
    1,
    2500.50,
    2000.00,
    95.5000,
    102.3000,
    13.2000
);
*/