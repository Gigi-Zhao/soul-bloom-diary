/**
 * Model Configuration for API Routes
 * 后端统一模型配置 - 在此处修改全局使用的模型
 */

// ========================================
// 🔧 模型配置 - 在这里修改使用的模型
// ========================================

/**
 * 对话模型配置
 * 用于：AI 角色对话、心理咨询、标题生成等文本交互场景
 * 
 * 推荐的免费模型：
 * - 'google/gemini-flash-1.5' (推荐) - Google 的高性能对话模型
 * - 'google/gemini-flash-1.5-8b' - 更快的轻量版本
 * - 'meta-llama/llama-3.2-3b-instruct:free' - Meta 的开源模型
 * - 'qwen/qwen-2-7b-instruct:free' - 阿里巴巴通义千问，中文优化
 * - 'microsoft/phi-3-mini-128k-instruct:free' - 微软轻量级模型
 * - 'mistralai/mistral-7b-instruct:free' - Mistral AI 指令模型
 */
export const DEFAULT_CHAT_MODEL = 'meituan/longcat-flash-chat:free';

/**
 * 图片解析模型配置
 * 用于：角色图片识别、头像分析等视觉理解场景
 * 
 * 推荐的免费视觉模型：
 * - 'google/gemini-flash-1.5' (推荐) - 多模态模型，支持图像理解
 * - 'google/gemini-flash-1.5-8b' - 更快的多模态版本
 * - 'meta-llama/llama-3.2-11b-vision-instruct:free' - Meta 视觉模型
 * - 'qwen/qwen-2-vl-7b-instruct:free' - 通义千问视觉版，中文优化
 * - 'mistralai/pixtral-12b:free' - Mistral 多模态模型
 */
export const DEFAULT_VISION_MODEL = 'mistralai/mistral-small-3.2-24b-instruct:free';

// ========================================
// 以下代码无需修改
// ========================================

/**
 * 获取聊天模型（优先使用请求指定的模型，否则使用默认配置）
 */
export const getChatModelForRequest = (requestModel?: string): string => {
  if (requestModel && requestModel.trim()) {
    return requestModel;
  }
  return DEFAULT_CHAT_MODEL;
};

/**
 * 获取视觉模型
 */
export const getVisionModelForRequest = (): string => {
  return DEFAULT_VISION_MODEL;
};
