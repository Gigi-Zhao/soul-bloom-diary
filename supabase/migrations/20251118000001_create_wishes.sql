-- Create wishes table to store user wishes/goals
CREATE TABLE public.wishes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  todo_list TEXT[] DEFAULT ARRAY[]::TEXT[],
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.wishes ENABLE ROW LEVEL SECURITY;

-- Users can view their own wishes
CREATE POLICY "Users can view their own wishes"
ON public.wishes
FOR SELECT
USING (auth.uid() = user_id);

-- Users can create their own wishes
CREATE POLICY "Users can create their own wishes"
ON public.wishes
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own wishes
CREATE POLICY "Users can update their own wishes"
ON public.wishes
FOR UPDATE
USING (auth.uid() = user_id);

-- Users can delete their own wishes
CREATE POLICY "Users can delete their own wishes"
ON public.wishes
FOR DELETE
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_wishes_updated_at
BEFORE UPDATE ON public.wishes
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- Create index for faster queries by user
CREATE INDEX idx_wishes_user_id ON public.wishes(user_id, created_at DESC);

