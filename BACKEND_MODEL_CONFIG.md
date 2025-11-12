# 后端 AI 模型配置说明

## 📋 概述

本系统支持在后端统一配置 AI 模型，所有 API 调用会自动使用配置的模型。用户无需知道，你可以随时在后端更换模型。

## 🔧 如何更换模型

### 配置文件位置
`api/model-config.ts`

### 配置内容

```typescript
// 对话模型配置（用于聊天、对话生成等）
export const DEFAULT_CHAT_MODEL = 'google/gemini-flash-1.5';

// 图片解析模型配置（用于角色图片识别）
export const DEFAULT_VISION_MODEL = 'google/gemini-flash-1.5';
```

### 更换步骤

1. 打开 `api/model-config.ts`
2. 修改 `DEFAULT_CHAT_MODEL` 或 `DEFAULT_VISION_MODEL` 的值
3. 保存文件
4. 重新部署应用（如果已部署）

## 🤖 可用的免费模型

### 对话模型选项
- `google/gemini-flash-1.5` (推荐) - Google 高性能对话模型
- `google/gemini-flash-1.5-8b` - 更快的轻量版本
- `meta-llama/llama-3.2-3b-instruct:free` - Meta 开源模型
- `qwen/qwen-2-7b-instruct:free` - 阿里巴巴通义千问，中文优化
- `microsoft/phi-3-mini-128k-instruct:free` - 微软轻量级模型
- `mistralai/mistral-7b-instruct:free` - Mistral AI 指令模型

### 图片解析模型选项
- `google/gemini-flash-1.5` (推荐) - 多模态模型，支持图像理解
- `google/gemini-flash-1.5-8b` - 更快的多模态版本
- `meta-llama/llama-3.2-11b-vision-instruct:free` - Meta 视觉模型
- `qwen/qwen-2-vl-7b-instruct:free` - 通义千问视觉版，中文优化
- `mistralai/pixtral-12b:free` - Mistral 多模态模型

## 📍 使用的地方

### 对话模型 (`DEFAULT_CHAT_MODEL`)
- `api/chat.ts` - AI 角色对话
- 标题生成
- 所有文本生成场景

### 图片解析模型 (`DEFAULT_VISION_MODEL`)
- `api/analyze-character.ts` - 角色图片识别
- 头像分析

## ⚠️ 注意事项

1. **用户无感知**：用户看不到模型配置，只会使用你设定的模型
2. **全局生效**：更改后所有新的请求都会使用新模型
3. **历史不变**：已有的对话记录不受影响
4. **免费限制**：免费模型可能有速率限制
5. **部署更新**：如果应用已部署，修改后需要重新部署才能生效

## 🔍 验证模型配置

查看日志中的模型使用情况：
- API 调用时会在 console 中输出使用的模型名称
- 可以通过 Vercel/服务器日志查看实际使用的模型

## 📚 更多信息

- [OpenRouter 模型列表](https://openrouter.ai/models)
- [OpenRouter 文档](https://openrouter.ai/docs)
