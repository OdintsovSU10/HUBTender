-- Таблица для хранения примечаний на странице сравнения объектов
-- Привязка к паре тендеров + категория/детализация

CREATE TABLE IF NOT EXISTS public.comparison_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tender_id_1 UUID NOT NULL REFERENCES tenders(id) ON DELETE CASCADE,
  tender_id_2 UUID NOT NULL REFERENCES tenders(id) ON DELETE CASCADE,
  cost_category_name TEXT NOT NULL,
  detail_category_key TEXT,
  note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(tender_id_1, tender_id_2, cost_category_name, detail_category_key)
);

ALTER TABLE public.comparison_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "comparison_notes_all" ON public.comparison_notes
  FOR ALL USING (true) WITH CHECK (true);
