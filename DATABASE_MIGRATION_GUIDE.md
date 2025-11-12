# 数据库 Migration 执行指南

## 🚨 当前问题

你的 Supabase 远程数据库还没有执行最新的 migrations，导致：
1. ❌ 对话标题更新失败（唯一约束冲突）
2. ❌ AI 角色仍使用旧的 minimax 模型

## ✅ 解决步骤

### 方法 1：通过 Supabase Dashboard（推荐）

1. 登录 [Supabase Dashboard](https://supabase.com/dashboard)
2. 选择你的项目
3. 点击左侧菜单 **SQL Editor**
4. 创建新查询，复制粘贴以下 SQL 并执行：

```sql
-- 1. 删除对话表的唯一约束（允许同一用户和 AI 有多个对话）
ALTER TABLE public.conversations
DROP CONSTRAINT IF EXISTS conversations_user_id_ai_role_id_title_key;

-- 添加索引以提升查询性能
CREATE INDEX IF NOT EXISTS idx_conversations_user_ai_updated 
ON public.conversations(user_id, ai_role_id, updated_at DESC);

-- 2. 更新 AI 角色模型（从 minimax 改为可用模型）
ALTER TABLE public.ai_roles 
ALTER COLUMN model SET DEFAULT 'meituan/longcat-flash-chat:free';

UPDATE public.ai_roles 
SET model = 'meituan/longcat-flash-chat:free'
WHERE model = 'minimax/minimax-m2:free';
```

5. 点击 **Run** 执行

### 方法 2：使用 Supabase CLI

如果你有本地开发环境：

```bash
# 推送所有 migrations 到远程数据库
supabase db push

# 或者链接到远程项目后推送
supabase link --project-ref your-project-ref
supabase db push
```

## 🔍 验证是否成功

执行后，在 SQL Editor 中运行以下查询验证：

```sql
-- 检查约束是否已删除（应该没有结果）
SELECT constraint_name 
FROM information_schema.table_constraints 
WHERE table_name = 'conversations' 
AND constraint_name = 'conversations_user_id_ai_role_id_title_key';

-- 检查 AI 角色的模型是否已更新
SELECT name, model FROM public.ai_roles;
```

## 📝 预期结果

- ✅ 第一个查询应该返回 0 行（约束已删除）
- ✅ 第二个查询应该显示所有 AI 角色使用 `meituan/longcat-flash-chat:free` 模型

执行完成后，刷新前端应用，对话标题生成和 AI 对话应该就能正常工作了！
