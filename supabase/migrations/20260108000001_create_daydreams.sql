-- Create daydreams table for storing dream history
CREATE TABLE IF NOT EXISTS public.daydreams (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    title text NOT NULL,
    
    -- 梦境设定
    setup jsonb NOT NULL,
    
    -- 消息历史
    messages jsonb NOT NULL DEFAULT '[]'::jsonb,
    
    -- 当前章节进度
    current_chapter integer NOT NULL DEFAULT 1,
    
    -- 是否已完成
    is_completed boolean NOT NULL DEFAULT false,
    
    -- 时间戳
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 创建索引
CREATE INDEX IF NOT EXISTS daydreams_user_id_idx ON public.daydreams(user_id);
CREATE INDEX IF NOT EXISTS daydreams_created_at_idx ON public.daydreams(created_at DESC);

-- 启用 RLS
ALTER TABLE public.daydreams ENABLE ROW LEVEL SECURITY;

-- RLS 策略：用户只能查看自己的梦境
CREATE POLICY "Users can view own daydreams"
    ON public.daydreams
    FOR SELECT
    USING (auth.uid() = user_id);

-- RLS 策略：用户可以创建自己的梦境
CREATE POLICY "Users can create own daydreams"
    ON public.daydreams
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- RLS 策略：用户可以更新自己的梦境
CREATE POLICY "Users can update own daydreams"
    ON public.daydreams
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- RLS 策略：用户可以删除自己的梦境
CREATE POLICY "Users can delete own daydreams"
    ON public.daydreams
    FOR DELETE
    USING (auth.uid() = user_id);

-- 创建更新时间戳触发器
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_daydreams_updated_at
    BEFORE UPDATE ON public.daydreams
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();
