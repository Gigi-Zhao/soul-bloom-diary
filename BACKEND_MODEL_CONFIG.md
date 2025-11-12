# 后端 AI 模型配置说明

## 📋 概述

本系统支持在后端统一配置 AI 模型，所有 API 调用会自动使用配置的模型。用户无需知道，你可以随时在后端更换模型。

## 🔧 如何更换模型

### 配置文件位置

**对话模型**：`api/chat.ts` 
**图片解析模型**：`api/analyze-character.ts`

### 配置方式

在每个文件的顶部修改对应的常量：

#### 对话模型（api/chat.ts）
```typescript
/**
 * 模型配置
 * 修改此处的常量来更换使用的模型
 */
const DEFAULT_CHAT_MODEL = 'meituan/longcat-flash-chat:free';
```

#### 图片解析模型（api/analyze-character.ts）
```typescript
/**
 * 模型配置
 * 修改此处的常量来更换使用的图片解析模型
 */
const DEFAULT_VISION_MODEL = 'mistralai/mistral-small-3.2-24b-instruct:free';
```

### 更换步骤

1. 打开对应的 API 文件（`api/chat.ts` 或 `api/analyze-character.ts`）
2. 找到文件顶部的 `DEFAULT_CHAT_MODEL` 或 `DEFAULT_VISION_MODEL` 常量
3. 修改常量的值为你想使用的模型
4. 保存文件
5. 提交并推送到 GitHub（会自动触发 Vercel 重新部署）

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

### 对话模型 (在 `api/chat.ts` 中配置)
- AI 角色对话
- 标题生成
- 所有文本生成场景

### 图片解析模型 (在 `api/analyze-character.ts` 中配置)
- 角色图片识别
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
