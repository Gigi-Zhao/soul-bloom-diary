-- Remove chapter-related fields from daydreams table
ALTER TABLE public.daydreams DROP COLUMN IF EXISTS current_chapter;
