-- =============================================
-- TenderHub Database Schema (prod.sql)
-- Single Source of Truth for Database Structure
-- Generated: 2025-11-06
-- =============================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================
-- ENUMS
-- =============================================

-- User roles enum
CREATE TYPE user_role AS ENUM (
    'administrator',
    'moderator',
    'engineer',
    'manager',
    'director'
);

-- Tender status enum
CREATE TYPE tender_status AS ENUM (
    'draft',
    'active',
    'submitted',
    'evaluation',
    'awarded',
    'cancelled',
    'archived'
);

-- Position status enum
CREATE TYPE position_status AS ENUM (
    'draft',
    'pending',
    'approved',
    'rejected'
);

-- Material/Work unit types
CREATE TYPE unit_type AS ENUM (
    'шт',     -- штуки
    'м',      -- метры
    'м2',     -- квадратные метры
    'м3',     -- кубические метры
    'кг',     -- килограммы
    'т',      -- тонны
    'л',      -- литры
    'компл',  -- комплект
    'маш.ч',  -- машино-часы
    'чел.ч'   -- человеко-часы
);

-- =============================================
-- TABLES
-- =============================================

-- Users table (extends Supabase auth.users)
CREATE TABLE public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    role user_role NOT NULL DEFAULT 'engineer',
    phone TEXT,
    company TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Organizations table
CREATE TABLE public.organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    inn TEXT UNIQUE,
    kpp TEXT,
    legal_address TEXT,
    actual_address TEXT,
    phone TEXT,
    email TEXT,
    website TEXT,
    created_by UUID REFERENCES public.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tenders table
CREATE TABLE public.tenders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    number TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    organization_id UUID REFERENCES public.organizations(id),
    customer_name TEXT NOT NULL,
    start_date DATE,
    end_date DATE,
    status tender_status DEFAULT 'draft',
    total_amount DECIMAL(15,2) DEFAULT 0,
    currency TEXT DEFAULT 'RUB',
    created_by UUID REFERENCES public.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Material categories
CREATE TABLE public.material_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    parent_id UUID REFERENCES public.material_categories(id),
    code TEXT,
    description TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Materials library
CREATE TABLE public.materials (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code TEXT UNIQUE,
    name TEXT NOT NULL,
    category_id UUID REFERENCES public.material_categories(id),
    unit unit_type NOT NULL,
    base_price DECIMAL(12,2),
    description TEXT,
    specifications JSONB,
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES public.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Works library
CREATE TABLE public.works (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code TEXT UNIQUE,
    name TEXT NOT NULL,
    category_id UUID REFERENCES public.material_categories(id),
    unit unit_type NOT NULL,
    base_price DECIMAL(12,2),
    labor_cost DECIMAL(12,2),
    machine_cost DECIMAL(12,2),
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES public.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- BOQ Sections (Bill of Quantities)
CREATE TABLE public.boq_sections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tender_id UUID REFERENCES public.tenders(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES public.boq_sections(id),
    section_number TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    sort_order INTEGER DEFAULT 0,
    level INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- BOQ Positions
CREATE TABLE public.boq_positions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tender_id UUID REFERENCES public.tenders(id) ON DELETE CASCADE,
    section_id UUID REFERENCES public.boq_sections(id) ON DELETE CASCADE,
    position_number TEXT NOT NULL,
    material_id UUID REFERENCES public.materials(id),
    work_id UUID REFERENCES public.works(id),
    custom_name TEXT,
    unit unit_type NOT NULL,
    quantity DECIMAL(12,3) NOT NULL,
    unit_price DECIMAL(12,2),
    total_price DECIMAL(15,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
    markup_percentage DECIMAL(5,2) DEFAULT 15.00,
    commercial_cost DECIMAL(15,2),
    notes TEXT,
    status position_status DEFAULT 'draft',
    sort_order INTEGER DEFAULT 0,
    created_by UUID REFERENCES public.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT either_material_or_work CHECK (
        (material_id IS NOT NULL AND work_id IS NULL) OR
        (material_id IS NULL AND work_id IS NOT NULL) OR
        (material_id IS NULL AND work_id IS NULL AND custom_name IS NOT NULL)
    )
);

-- Tender participants
CREATE TABLE public.tender_participants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tender_id UUID REFERENCES public.tenders(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.users(id),
    role TEXT NOT NULL,
    can_edit BOOLEAN DEFAULT false,
    can_approve BOOLEAN DEFAULT false,
    assigned_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audit log
CREATE TABLE public.audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    table_name TEXT NOT NULL,
    record_id UUID,
    action TEXT NOT NULL,
    old_values JSONB,
    new_values JSONB,
    user_id UUID REFERENCES public.users(id),
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Comments
CREATE TABLE public.comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tender_id UUID REFERENCES public.tenders(id) ON DELETE CASCADE,
    position_id UUID REFERENCES public.boq_positions(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES public.comments(id),
    content TEXT NOT NULL,
    user_id UUID REFERENCES public.users(id),
    is_resolved BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- INDEXES
-- =============================================

CREATE INDEX idx_tenders_status ON public.tenders(status);
CREATE INDEX idx_tenders_organization ON public.tenders(organization_id);
CREATE INDEX idx_boq_sections_tender ON public.boq_sections(tender_id);
CREATE INDEX idx_boq_positions_tender ON public.boq_positions(tender_id);
CREATE INDEX idx_boq_positions_section ON public.boq_positions(section_id);
CREATE INDEX idx_materials_category ON public.materials(category_id);
CREATE INDEX idx_works_category ON public.works(category_id);
CREATE INDEX idx_audit_log_table ON public.audit_log(table_name, record_id);

-- =============================================
-- VIEWS
-- =============================================

-- Tender summary view
CREATE OR REPLACE VIEW public.v_tender_summary AS
SELECT
    t.id,
    t.number,
    t.name,
    t.status,
    t.start_date,
    t.end_date,
    o.name as organization_name,
    u.full_name as created_by_name,
    COUNT(DISTINCT bp.id) as position_count,
    SUM(bp.total_price) as total_amount,
    t.created_at,
    t.updated_at
FROM public.tenders t
LEFT JOIN public.organizations o ON t.organization_id = o.id
LEFT JOIN public.users u ON t.created_by = u.id
LEFT JOIN public.boq_positions bp ON bp.tender_id = t.id
GROUP BY t.id, o.name, u.full_name;

-- =============================================
-- FUNCTIONS
-- =============================================

-- Update commercial costs function
CREATE OR REPLACE FUNCTION update_commercial_costs(
    p_position_id UUID
) RETURNS VOID AS $$
BEGIN
    UPDATE public.boq_positions
    SET commercial_cost = total_price * (1 + markup_percentage / 100)
    WHERE id = p_position_id;
END;
$$ LANGUAGE plpgsql;

-- Recalculate tender total
CREATE OR REPLACE FUNCTION recalculate_tender_total(
    p_tender_id UUID
) RETURNS DECIMAL AS $$
DECLARE
    v_total DECIMAL(15,2);
BEGIN
    SELECT COALESCE(SUM(commercial_cost), 0) INTO v_total
    FROM public.boq_positions
    WHERE tender_id = p_tender_id
    AND status = 'approved';

    UPDATE public.tenders
    SET total_amount = v_total
    WHERE id = p_tender_id;

    RETURN v_total;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- TRIGGERS
-- =============================================

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to all tables with updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON public.organizations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_tenders_updated_at BEFORE UPDATE ON public.tenders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_materials_updated_at BEFORE UPDATE ON public.materials
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_works_updated_at BEFORE UPDATE ON public.works
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_boq_sections_updated_at BEFORE UPDATE ON public.boq_sections
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_boq_positions_updated_at BEFORE UPDATE ON public.boq_positions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Audit trigger
CREATE OR REPLACE FUNCTION audit_trigger()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.audit_log(
        table_name,
        record_id,
        action,
        old_values,
        new_values,
        user_id
    ) VALUES (
        TG_TABLE_NAME,
        COALESCE(NEW.id, OLD.id),
        TG_OP,
        CASE WHEN TG_OP != 'INSERT' THEN to_jsonb(OLD) ELSE NULL END,
        CASE WHEN TG_OP != 'DELETE' THEN to_jsonb(NEW) ELSE NULL END,
        current_setting('app.current_user_id', true)::UUID
    );
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Apply audit to critical tables
CREATE TRIGGER audit_tenders AFTER INSERT OR UPDATE OR DELETE ON public.tenders
    FOR EACH ROW EXECUTE FUNCTION audit_trigger();
CREATE TRIGGER audit_boq_positions AFTER INSERT OR UPDATE OR DELETE ON public.boq_positions
    FOR EACH ROW EXECUTE FUNCTION audit_trigger();

-- =============================================
-- RLS POLICIES (Row Level Security)
-- =============================================
-- Note: RLS is currently disabled per CLAUDE.MD
-- These policies are included for future activation

-- ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.tenders ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.boq_positions ENABLE ROW LEVEL SECURITY;

-- =============================================
-- INITIAL DATA
-- =============================================

-- Insert default material categories
INSERT INTO public.material_categories (name, code, sort_order) VALUES
    ('Строительные материалы', 'SM', 100),
    ('Электротехническое оборудование', 'EL', 200),
    ('Сантехническое оборудование', 'SAN', 300),
    ('Отделочные материалы', 'OM', 400)
ON CONFLICT DO NOTHING;

-- =============================================
-- GRANTS (Adjust based on Supabase requirements)
-- =============================================

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO authenticated;