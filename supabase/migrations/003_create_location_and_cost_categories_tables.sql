-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- 1. Create locations table
-- =====================================================
CREATE TABLE IF NOT EXISTS public.locations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    location TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for locations
CREATE INDEX IF NOT EXISTS idx_locations_location ON public.locations(location);
CREATE INDEX IF NOT EXISTS idx_locations_created_at ON public.locations(created_at DESC);

-- Add comment to table
COMMENT ON TABLE public.locations IS 'Справочник локаций/местоположений';
COMMENT ON COLUMN public.locations.id IS 'Уникальный идентификатор локации';
COMMENT ON COLUMN public.locations.location IS 'Наименование локации';
COMMENT ON COLUMN public.locations.created_at IS 'Дата создания записи';
COMMENT ON COLUMN public.locations.updated_at IS 'Дата последнего обновления записи';

-- =====================================================
-- 2. Create cost_categories table
-- =====================================================
CREATE TABLE IF NOT EXISTS public.cost_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    unit unit_type NOT NULL, -- Using existing ENUM from migration 002
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for cost_categories
CREATE INDEX IF NOT EXISTS idx_cost_categories_name ON public.cost_categories(name);
CREATE INDEX IF NOT EXISTS idx_cost_categories_unit ON public.cost_categories(unit);
CREATE INDEX IF NOT EXISTS idx_cost_categories_created_at ON public.cost_categories(created_at DESC);

-- Add comment to table
COMMENT ON TABLE public.cost_categories IS 'Категории затрат';
COMMENT ON COLUMN public.cost_categories.id IS 'Уникальный идентификатор категории затрат';
COMMENT ON COLUMN public.cost_categories.name IS 'Наименование категории затрат';
COMMENT ON COLUMN public.cost_categories.unit IS 'Единица измерения';
COMMENT ON COLUMN public.cost_categories.created_at IS 'Дата создания записи';
COMMENT ON COLUMN public.cost_categories.updated_at IS 'Дата последнего обновления записи';

-- =====================================================
-- 3. Create detail_cost_categories table
-- =====================================================
CREATE TABLE IF NOT EXISTS public.detail_cost_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cost_category_id UUID NOT NULL REFERENCES public.cost_categories(id) ON DELETE CASCADE,
    location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    unit unit_type NOT NULL, -- Using existing ENUM from migration 002
    order_num INT4 DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for detail_cost_categories
CREATE INDEX IF NOT EXISTS idx_detail_cost_categories_cost_category_id ON public.detail_cost_categories(cost_category_id);
CREATE INDEX IF NOT EXISTS idx_detail_cost_categories_location_id ON public.detail_cost_categories(location_id);
CREATE INDEX IF NOT EXISTS idx_detail_cost_categories_name ON public.detail_cost_categories(name);
CREATE INDEX IF NOT EXISTS idx_detail_cost_categories_unit ON public.detail_cost_categories(unit);
CREATE INDEX IF NOT EXISTS idx_detail_cost_categories_order_num ON public.detail_cost_categories(order_num);
CREATE INDEX IF NOT EXISTS idx_detail_cost_categories_created_at ON public.detail_cost_categories(created_at DESC);

-- Create composite index for common queries
CREATE INDEX IF NOT EXISTS idx_detail_cost_categories_category_location
    ON public.detail_cost_categories(cost_category_id, location_id);

-- Add comment to table
COMMENT ON TABLE public.detail_cost_categories IS 'Детализированные категории затрат с привязкой к локациям';
COMMENT ON COLUMN public.detail_cost_categories.id IS 'Уникальный идентификатор детализированной категории';
COMMENT ON COLUMN public.detail_cost_categories.cost_category_id IS 'Ссылка на категорию затрат';
COMMENT ON COLUMN public.detail_cost_categories.location_id IS 'Ссылка на локацию';
COMMENT ON COLUMN public.detail_cost_categories.name IS 'Наименование детализированной категории';
COMMENT ON COLUMN public.detail_cost_categories.unit IS 'Единица измерения';
COMMENT ON COLUMN public.detail_cost_categories.order_num IS 'Порядковый номер для сортировки';
COMMENT ON COLUMN public.detail_cost_categories.created_at IS 'Дата создания записи';
COMMENT ON COLUMN public.detail_cost_categories.updated_at IS 'Дата последнего обновления записи';

-- =====================================================
-- Create update triggers for all tables
-- =====================================================

-- Trigger for locations
CREATE TRIGGER update_locations_updated_at
    BEFORE UPDATE ON public.locations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger for cost_categories
CREATE TRIGGER update_cost_categories_updated_at
    BEFORE UPDATE ON public.cost_categories
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger for detail_cost_categories
CREATE TRIGGER update_detail_cost_categories_updated_at
    BEFORE UPDATE ON public.detail_cost_categories
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- Row Level Security (RLS) - disabled by default
-- =====================================================

-- Uncomment to enable RLS when authentication is implemented
/*
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cost_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.detail_cost_categories ENABLE ROW LEVEL SECURITY;

-- Policy: All authenticated users can view locations
CREATE POLICY "Authenticated users can view locations" ON public.locations
    FOR SELECT
    USING (auth.role() = 'authenticated');

-- Policy: Only admins and moderators can manage locations
CREATE POLICY "Admins and moderators can manage locations" ON public.locations
    FOR ALL
    USING (
        auth.jwt() ->> 'role' IN ('administrator', 'moderator')
    );

-- Policy: All authenticated users can view cost_categories
CREATE POLICY "Authenticated users can view cost_categories" ON public.cost_categories
    FOR SELECT
    USING (auth.role() = 'authenticated');

-- Policy: Only admins and moderators can manage cost_categories
CREATE POLICY "Admins and moderators can manage cost_categories" ON public.cost_categories
    FOR ALL
    USING (
        auth.jwt() ->> 'role' IN ('administrator', 'moderator')
    );

-- Policy: All authenticated users can view detail_cost_categories
CREATE POLICY "Authenticated users can view detail_cost_categories" ON public.detail_cost_categories
    FOR SELECT
    USING (auth.role() = 'authenticated');

-- Policy: Only admins and moderators can manage detail_cost_categories
CREATE POLICY "Admins and moderators can manage detail_cost_categories" ON public.detail_cost_categories
    FOR ALL
    USING (
        auth.jwt() ->> 'role' IN ('administrator', 'moderator')
    );
*/

-- =====================================================
-- Sample data (uncomment to insert test data)
-- =====================================================

/*
-- Insert sample locations
INSERT INTO public.locations (location) VALUES
    ('Москва'),
    ('Санкт-Петербург'),
    ('Екатеринбург'),
    ('Новосибирск'),
    ('Казань');

-- Insert sample cost_categories
INSERT INTO public.cost_categories (name, unit) VALUES
    ('Бетонные работы', 'м3'),
    ('Арматурные работы', 'т'),
    ('Кирпичная кладка', 'м3'),
    ('Монтаж металлоконструкций', 'т'),
    ('Электромонтажные работы', 'м'),
    ('Сантехнические работы', 'шт'),
    ('Отделочные работы', 'м2');

-- Insert sample detail_cost_categories (need to get actual IDs from above inserts)
-- This is an example - in production, you'd use actual UUIDs
INSERT INTO public.detail_cost_categories (cost_category_id, location_id, name, unit, order_num)
SELECT
    cc.id,
    l.id,
    cc.name || ' - ' || l.location,
    cc.unit,
    ROW_NUMBER() OVER (ORDER BY cc.name, l.location)
FROM
    public.cost_categories cc
    CROSS JOIN public.locations l
WHERE
    cc.name = 'Бетонные работы'
    AND l.location = 'Москва';
*/