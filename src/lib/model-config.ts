/**
 * Model Configuration for API Routes
 * 后端统一模型配置 - 在此处修改全局使用的模型
 */

// ========================================
// 🔧 模型配置 - 在这里修改使用的模型
// ========================================

/**
 * 对话模型列表
 * 系统将按顺序尝试使用列表中的模型，直到成功生成内容
 * 
 * 推荐的免费模型：
 * - 'google/gemini-flash-1.5' (推荐) - Google 的高性能对话模型
 * - 'google/gemini-flash-1.5-8b' - 更快的轻量版本
 * - 'meta-llama/llama-3.2-3b-instruct:free' - Meta 的开源模型
 * - 'qwen/qwen-2-7b-instruct:free' - 阿里巴巴通义千问，中文优化
 * - 'microsoft/phi-3-mini-128k-instruct:free' - 微软轻量级模型
 * - 'mistralai/mistral-7b-instruct:free' - Mistral AI 指令模型
 */
export const CHAT_MODELS = [
  'mistralai/devstral-2512:free',
  'xiaomi/mimo-v2-flash:free'
];

/**
 * 图片解析模型列表
 * 系统将按顺序尝试使用列表中的模型，直到成功生成内容
 * 
 * 推荐的免费视觉模型：
 * - 'google/gemini-flash-1.5' (推荐) - 多模态模型，支持图像理解
 * - 'google/gemini-flash-1.5-8b' - 更快的多模态版本
 * - 'meta-llama/llama-3.2-11b-vision-instruct:free' - Meta 视觉模型
 * - 'qwen/qwen-2-vl-7b-instruct:free' - 通义千问视觉版，中文优化
 * - 'mistralai/pixtral-12b:free' - Mistral 多模态模型
 */
export const VISION_MODELS = [
  'mistralai/mistral-small-3.1-24b-instruct:free',
  'nvidia/nemotron-nano-12b-v2-vl:free'
];

// ========================================
// 以下代码无需修改
// ========================================

/**
 * 获取聊天模型列表（优先使用请求指定的模型作为首选）
 */
export const getChatModelsForRequest = (): string[] => {
  return CHAT_MODELS;
};

/**
 * 获取视觉模型列表
 */
export const getVisionModelsForRequest = (): string[] => {
  return VISION_MODELS;
};
