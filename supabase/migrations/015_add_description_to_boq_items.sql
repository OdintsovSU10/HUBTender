-- Add description field to boq_items
ALTER TABLE public.boq_items ADD COLUMN IF NOT EXISTS description text;
COMMENT ON COLUMN public.boq_items.description IS 'Примечание к элементу позиции';
