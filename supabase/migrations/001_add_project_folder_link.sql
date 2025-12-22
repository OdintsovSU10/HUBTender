-- Migration: Add project_folder_link field to tenders table
-- Date: 2025-12-22
-- Description: Adds a new text field to store link to project folder

ALTER TABLE public.tenders
ADD COLUMN IF NOT EXISTS project_folder_link text;

COMMENT ON COLUMN public.tenders.project_folder_link IS 'Ссылка на папку с проектом';
