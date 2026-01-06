-- Create weekly_letters table for weekly summary letters
CREATE TABLE public.weekly_letters (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start_date DATE NOT NULL,
  week_end_date DATE NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, week_start_date)
);

-- Enable Row Level Security
ALTER TABLE public.weekly_letters ENABLE ROW LEVEL SECURITY;

-- Users can view their own letters
CREATE POLICY "Users can view their own weekly letters"
ON public.weekly_letters
FOR SELECT
USING (auth.uid() = user_id);

-- Users can create their own letters
CREATE POLICY "Users can create their own weekly letters"
ON public.weekly_letters
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own letters
CREATE POLICY "Users can update their own weekly letters"
ON public.weekly_letters
FOR UPDATE
USING (auth.uid() = user_id);

-- Users can delete their own letters
CREATE POLICY "Users can delete their own weekly letters"
ON public.weekly_letters
FOR DELETE
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_weekly_letters_updated_at
BEFORE UPDATE ON public.weekly_letters
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- Create index for faster queries by user and date
CREATE INDEX idx_weekly_letters_user_date ON public.weekly_letters(user_id, week_start_date DESC);
