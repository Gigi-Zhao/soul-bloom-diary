-- Add new fields to ai_roles table for character customization
ALTER TABLE ai_roles
ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS mbti_type text,
ADD COLUMN IF NOT EXISTS catchphrase text;