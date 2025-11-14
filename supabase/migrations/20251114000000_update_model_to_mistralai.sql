-- 更新所有 AI 角色的模型为 mistralai
-- 从 meituan/longcat-flash-chat:free 迁移到 mistralai/mistral-small-3.2-24b-instruct:free

-- 更新现有记录
UPDATE ai_roles
SET model = 'mistralai/mistral-small-3.2-24b-instruct:free'
WHERE model = 'meituan/longcat-flash-chat:free';

-- 更新默认值
ALTER TABLE ai_roles
ALTER COLUMN model SET DEFAULT 'mistralai/mistral-small-3.2-24b-instruct:free';
