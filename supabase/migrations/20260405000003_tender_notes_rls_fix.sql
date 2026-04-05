-- Migration: Fix tender_notes RLS — general_director не видит чужие заметки
-- Date: 2026-04-05

DROP POLICY IF EXISTS "tender_notes_select" ON public.tender_notes;

CREATE POLICY "tender_notes_select" ON public.tender_notes
FOR SELECT USING (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
      AND role_code IN ('administrator', 'developer', 'director', 'senior_group', 'veduschiy_inzhener')
  )
);
