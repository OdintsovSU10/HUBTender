-- Создать таблицу статусов тендеров
CREATE TABLE IF NOT EXISTS public.tender_statuses (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    name text NOT NULL UNIQUE,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT tender_statuses_pkey PRIMARY KEY (id)
);

COMMENT ON TABLE public.tender_statuses IS 'Статусы тендеров';

-- Вставить начальные статусы
INSERT INTO public.tender_statuses (name) VALUES
('В работе'),
('Ожидаем тендерный пакет')
ON CONFLICT (name) DO NOTHING;

-- Создать таблицу объемов строительства
CREATE TABLE IF NOT EXISTS public.construction_scopes (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    name text NOT NULL UNIQUE,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT construction_scopes_pkey PRIMARY KEY (id)
);

COMMENT ON TABLE public.construction_scopes IS 'Объемы строительства';

-- Вставить начальные объемы строительства
INSERT INTO public.construction_scopes (name) VALUES
('Генподряд'),
('Коробка'),
('Монолит'),
('Монолит+нулевой цикл')
ON CONFLICT (name) DO NOTHING;

-- Создать основную таблицу реестра тендеров
CREATE TABLE IF NOT EXISTS public.tender_registry (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    title text NOT NULL,
    client_name text NOT NULL,
    construction_scope_id uuid,
    area numeric(12,2),
    submission_date timestamp with time zone,
    construction_start_date timestamp with time zone,
    site_visit_photo_url text,
    site_visit_date timestamp with time zone,
    has_tender_package boolean DEFAULT false,
    invitation_date timestamp with time zone,
    status_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    created_by uuid,
    CONSTRAINT tender_registry_pkey PRIMARY KEY (id),
    CONSTRAINT tender_registry_status_id_fkey FOREIGN KEY (status_id) REFERENCES public.tender_statuses(id),
    CONSTRAINT tender_registry_construction_scope_id_fkey FOREIGN KEY (construction_scope_id) REFERENCES public.construction_scopes(id),
    CONSTRAINT tender_registry_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id)
);

COMMENT ON TABLE public.tender_registry IS 'Реестр тендеров для страницы Тендеры';
COMMENT ON COLUMN public.tender_registry.title IS 'Наименование тендера';
COMMENT ON COLUMN public.tender_registry.client_name IS 'Заказчик';
COMMENT ON COLUMN public.tender_registry.construction_scope_id IS 'ID объема строительства';
COMMENT ON COLUMN public.tender_registry.area IS 'Площадь (м²)';
COMMENT ON COLUMN public.tender_registry.submission_date IS 'Дата подачи КП';
COMMENT ON COLUMN public.tender_registry.construction_start_date IS 'Дата выхода на строительную площадку';
COMMENT ON COLUMN public.tender_registry.site_visit_photo_url IS 'Ссылка на фото посещения площадки';
COMMENT ON COLUMN public.tender_registry.site_visit_date IS 'Дата посещения площадки';
COMMENT ON COLUMN public.tender_registry.has_tender_package IS 'Наличие тендерного пакета';
COMMENT ON COLUMN public.tender_registry.invitation_date IS 'Дата приглашения';
COMMENT ON COLUMN public.tender_registry.status_id IS 'ID статуса тендера';

-- Создать индексы
CREATE INDEX IF NOT EXISTS idx_tender_registry_status_id ON public.tender_registry(status_id);
CREATE INDEX IF NOT EXISTS idx_tender_registry_construction_scope_id ON public.tender_registry(construction_scope_id);
CREATE INDEX IF NOT EXISTS idx_tender_registry_client_name ON public.tender_registry(client_name);
CREATE INDEX IF NOT EXISTS idx_tender_registry_created_at ON public.tender_registry(created_at DESC);

-- Триггер для автоматического обновления updated_at
CREATE TRIGGER set_tender_registry_updated_at
    BEFORE UPDATE ON public.tender_registry
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
