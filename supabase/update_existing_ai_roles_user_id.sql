-- 更新现有 AI 角色的 user_id
-- 这个脚本会将所有 user_id 为 NULL 的 AI 角色分配给指定的用户

-- 方式1：如果你只有一个用户，将所有 AI 角色分配给该用户
-- 替换 'YOUR_USER_ID_HERE' 为你的实际用户 ID
UPDATE public.ai_roles
SET user_id = 'YOUR_USER_ID_HERE'
WHERE user_id IS NULL;

-- 方式2：自动分配给数据库中的第一个用户（如果只有一个用户）
-- UPDATE public.ai_roles
-- SET user_id = (SELECT id FROM auth.users LIMIT 1)
-- WHERE user_id IS NULL;

-- 方式3：查看当前所有用户及其 ID（先执行这个查询看看有哪些用户）
-- SELECT id, email, created_at FROM auth.users;

-- 执行后验证结果
-- SELECT id, name, user_id FROM public.ai_roles;
