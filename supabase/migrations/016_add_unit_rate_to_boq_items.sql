-- Add unit_rate field to boq_items
ALTER TABLE public.boq_items ADD COLUMN IF NOT EXISTS unit_rate numeric(18,2) DEFAULT 0.00;
COMMENT ON COLUMN public.boq_items.unit_rate IS 'Цена за единицу';
