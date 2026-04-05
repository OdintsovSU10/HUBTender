-- Migration: Remove tender_notes rows with empty/whitespace-only text
-- Date: 2026-04-05

DELETE FROM public.tender_notes WHERE trim(note_text) = '';
