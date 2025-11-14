-- 更新所有 AI 角色的模型回到 meituan
-- 从 mistralai/mistral-small-3.2-24b-instruct:free 迁移回 meituan/longcat-flash-chat:free

-- 更新现有记录
UPDATE ai_roles
SET model = 'meituan/longcat-flash-chat:free'
WHERE model = 'mistralai/mistral-small-3.2-24b-instruct:free';

-- 更新默认值
ALTER TABLE ai_roles
ALTER COLUMN model SET DEFAULT 'meituan/longcat-flash-chat:free';
