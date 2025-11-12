-- =====================================================
-- 完整数据库修复 SQL
-- 在 Supabase Dashboard 的 SQL Editor 中执行此文件
-- =====================================================

-- 1. 删除对话表的唯一约束
-- 这个约束导致更新对话标题时出现冲突
ALTER TABLE public.conversations
DROP CONSTRAINT IF EXISTS conversations_user_id_ai_role_id_title_key;

-- 添加索引以提升查询性能
CREATE INDEX IF NOT EXISTS idx_conversations_user_ai_updated 
ON public.conversations(user_id, ai_role_id, updated_at DESC);

-- 2. 更新 AI 角色模型配置
-- 将不可用的 minimax 模型改为可用的模型
ALTER TABLE public.ai_roles 
ALTER COLUMN model SET DEFAULT 'meituan/longcat-flash-chat:free';

UPDATE public.ai_roles 
SET model = 'meituan/longcat-flash-chat:free'
WHERE model = 'minimax/minimax-m2:free';

-- =====================================================
-- 验证查询（可选）
-- =====================================================

-- 检查约束是否已删除（应该返回 0 行）
-- SELECT constraint_name 
-- FROM information_schema.table_constraints 
-- WHERE table_name = 'conversations' 
-- AND constraint_name = 'conversations_user_id_ai_role_id_title_key';

-- 检查 AI 角色的模型（应该都是新模型）
-- SELECT name, model FROM public.ai_roles;
