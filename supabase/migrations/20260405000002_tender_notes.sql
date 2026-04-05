-- Migration: Create tender_notes table for per-tender user notes
-- Date: 2026-04-05

CREATE TABLE IF NOT EXISTS public.tender_notes (
  id          uuid        DEFAULT uuid_generate_v4() PRIMARY KEY,
  tender_id   uuid        NOT NULL REFERENCES public.tenders(id) ON DELETE CASCADE,
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  note_text   text        NOT NULL DEFAULT '',
  created_at  timestamptz DEFAULT now() NOT NULL,
  updated_at  timestamptz DEFAULT now() NOT NULL,
  UNIQUE (tender_id, user_id)
);

COMMENT ON TABLE  public.tender_notes               IS 'Заметки пользователей, привязанные к конкретному тендеру';
COMMENT ON COLUMN public.tender_notes.tender_id     IS 'ID тендера (включает версию — каждая версия отдельная запись в tenders)';
COMMENT ON COLUMN public.tender_notes.user_id       IS 'ID пользователя-автора заметки';
COMMENT ON COLUMN public.tender_notes.note_text     IS 'Текст заметки';

-- Автоматическое обновление updated_at
CREATE OR REPLACE TRIGGER tender_notes_updated_at
  BEFORE UPDATE ON public.tender_notes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Индекс для быстрой выборки всех заметок по тендеру
CREATE INDEX IF NOT EXISTS idx_tender_notes_tender_id ON public.tender_notes(tender_id);
CREATE INDEX IF NOT EXISTS idx_tender_notes_user_id   ON public.tender_notes(user_id);

-- RLS
ALTER TABLE public.tender_notes ENABLE ROW LEVEL SECURITY;

-- Пользователь видит свою заметку.
-- Привилегированные роли (администратор, разработчик, руководитель, ведущий инженер) видят все заметки тендера.
CREATE POLICY "tender_notes_select" ON public.tender_notes
FOR SELECT USING (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
      AND role_code IN ('administrator', 'developer', 'director', 'senior_group', 'veduschiy_inzhener', 'general_director')
  )
);

-- Вставлять и обновлять может только сам пользователь
CREATE POLICY "tender_notes_insert" ON public.tender_notes
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "tender_notes_update" ON public.tender_notes
FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "tender_notes_delete" ON public.tender_notes
FOR DELETE USING (auth.uid() = user_id);
