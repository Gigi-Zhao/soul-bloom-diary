-- Update model references from minimax to available models
-- The minimax model is no longer available on OpenRouter

-- Update the default model for ai_roles table
ALTER TABLE public.ai_roles 
ALTER COLUMN model SET DEFAULT 'meituan/longcat-flash-chat:free';

-- Update existing AI roles that use the old minimax model
UPDATE public.ai_roles 
SET model = 'meituan/longcat-flash-chat:free'
WHERE model = 'minimax/minimax-m2:free';
