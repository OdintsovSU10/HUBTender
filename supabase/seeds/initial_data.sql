-- =============================================
-- Initial Development Data
-- Начальные данные для разработки
-- =============================================

-- Тестовые пользователи (пароли должны быть заданы через Supabase Auth)
INSERT INTO public.users (id, email, full_name, role, phone, company) VALUES
    ('11111111-1111-1111-1111-111111111111'::uuid, 'admin@tenderhub.ru', 'Администратор Системы', 'administrator', '+7 900 123-45-67', 'TenderHub'),
    ('22222222-2222-2222-2222-222222222222'::uuid, 'engineer@tenderhub.ru', 'Иванов Иван Иванович', 'engineer', '+7 900 234-56-78', 'СтройПроект'),
    ('33333333-3333-3333-3333-333333333333'::uuid, 'manager@tenderhub.ru', 'Петров Петр Петрович', 'manager', '+7 900 345-67-89', 'СтройПроект')
ON CONFLICT (id) DO NOTHING;

-- Тестовая организация
INSERT INTO public.organizations (name, inn, kpp, legal_address, phone, email, created_by) VALUES
    ('ООО "СтройПроект"', '7707123456', '770701001',
     'г. Москва, ул. Строителей, д. 1',
     '+7 495 123-45-67',
     'info@stroyproject.ru',
     '11111111-1111-1111-1111-111111111111'::uuid)
ON CONFLICT DO NOTHING;

-- Дополнительные категории материалов
INSERT INTO public.material_categories (name, code, parent_id, sort_order) VALUES
    ('Бетон и растворы', 'SM-01', (SELECT id FROM public.material_categories WHERE code = 'SM'), 110),
    ('Кирпич и блоки', 'SM-02', (SELECT id FROM public.material_categories WHERE code = 'SM'), 120),
    ('Металлопрокат', 'SM-03', (SELECT id FROM public.material_categories WHERE code = 'SM'), 130),
    ('Кабельная продукция', 'EL-01', (SELECT id FROM public.material_categories WHERE code = 'EL'), 210),
    ('Светильники', 'EL-02', (SELECT id FROM public.material_categories WHERE code = 'EL'), 220),
    ('Трубы', 'SAN-01', (SELECT id FROM public.material_categories WHERE code = 'SAN'), 310),
    ('Арматура', 'SAN-02', (SELECT id FROM public.material_categories WHERE code = 'SAN'), 320)
ON CONFLICT DO NOTHING;

-- Примеры материалов
INSERT INTO public.materials (code, name, category_id, unit, base_price, description) VALUES
    ('MAT-001', 'Бетон B25 M350',
     (SELECT id FROM public.material_categories WHERE code = 'SM-01'),
     'м3', 4500.00, 'Бетон класса B25, марка M350'),

    ('MAT-002', 'Кирпич керамический М150',
     (SELECT id FROM public.material_categories WHERE code = 'SM-02'),
     'шт', 12.50, 'Кирпич керамический полнотелый, марка М150'),

    ('MAT-003', 'Арматура А500С d12',
     (SELECT id FROM public.material_categories WHERE code = 'SM-03'),
     'т', 65000.00, 'Арматура рифленая А500С, диаметр 12мм'),

    ('MAT-004', 'Кабель ВВГнг 3x2.5',
     (SELECT id FROM public.material_categories WHERE code = 'EL-01'),
     'м', 85.00, 'Кабель силовой ВВГнг 3x2.5 мм²'),

    ('MAT-005', 'Светильник LED 36W',
     (SELECT id FROM public.material_categories WHERE code = 'EL-02'),
     'шт', 1250.00, 'Светильник светодиодный потолочный 36W, 4000K'),

    ('MAT-006', 'Труба ПНД ПЭ100 d110',
     (SELECT id FROM public.material_categories WHERE code = 'SAN-01'),
     'м', 320.00, 'Труба полиэтиленовая ПНД ПЭ100, диаметр 110мм'),

    ('MAT-007', 'Кран шаровой d20',
     (SELECT id FROM public.material_categories WHERE code = 'SAN-02'),
     'шт', 450.00, 'Кран шаровой латунный, диаметр 20мм')
ON CONFLICT (code) DO NOTHING;

-- Примеры работ
INSERT INTO public.works (code, name, category_id, unit, base_price, labor_cost, machine_cost, description) VALUES
    ('WRK-001', 'Укладка бетона в конструкции',
     (SELECT id FROM public.material_categories WHERE code = 'SM-01'),
     'м3', 1200.00, 800.00, 400.00, 'Укладка бетонной смеси в конструкции с уплотнением'),

    ('WRK-002', 'Кладка стен из кирпича',
     (SELECT id FROM public.material_categories WHERE code = 'SM-02'),
     'м3', 3500.00, 2800.00, 700.00, 'Кладка стен из керамического кирпича с расшивкой швов'),

    ('WRK-003', 'Монтаж арматурного каркаса',
     (SELECT id FROM public.material_categories WHERE code = 'SM-03'),
     'т', 12000.00, 10000.00, 2000.00, 'Монтаж арматурного каркаса с вязкой'),

    ('WRK-004', 'Прокладка кабеля в гофре',
     (SELECT id FROM public.material_categories WHERE code = 'EL-01'),
     'м', 120.00, 100.00, 20.00, 'Прокладка кабеля в гофрированной трубе'),

    ('WRK-005', 'Монтаж светильников',
     (SELECT id FROM public.material_categories WHERE code = 'EL-02'),
     'шт', 350.00, 300.00, 50.00, 'Монтаж и подключение потолочных светильников'),

    ('WRK-006', 'Прокладка трубопроводов',
     (SELECT id FROM public.material_categories WHERE code = 'SAN-01'),
     'м', 280.00, 200.00, 80.00, 'Прокладка трубопроводов с креплением'),

    ('WRK-007', 'Установка запорной арматуры',
     (SELECT id FROM public.material_categories WHERE code = 'SAN-02'),
     'шт', 450.00, 400.00, 50.00, 'Установка и подключение запорной арматуры')
ON CONFLICT (code) DO NOTHING;