-- Добавить поле markup_tactic_id в таблицу tenders для привязки тактики наценок к конкретному тендеру
ALTER TABLE public.tenders
ADD COLUMN IF NOT EXISTS markup_tactic_id uuid REFERENCES public.markup_tactics(id) ON DELETE SET NULL;

-- Добавить комментарий к колонке
COMMENT ON COLUMN public.tenders.markup_tactic_id IS 'Ссылка на тактику наценок для данного тендера';

-- Создать глобальную тактику "Текущая тактика" (если ещё не существует)
INSERT INTO public.markup_tactics (name, is_global, sequences, base_costs)
SELECT
  'Текущая тактика',
  true,
  '{"мат": [], "раб": [], "суб-мат": [], "суб-раб": [], "мат-комп.": [], "раб-комп.": []}'::jsonb,
  '{"мат": 0, "раб": 0, "суб-мат": 0, "суб-раб": 0, "мат-комп.": 0, "раб-комп.": 0}'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM public.markup_tactics WHERE name = 'Текущая тактика' AND is_global = true
);

-- Обновить существующие тендеры, привязав их к глобальной тактике "Текущая тактика"
UPDATE public.tenders
SET markup_tactic_id = (
  SELECT id FROM public.markup_tactics WHERE name = 'Текущая тактика' AND is_global = true LIMIT 1
)
WHERE markup_tactic_id IS NULL;
