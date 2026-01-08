# 白日梦模块 - 实现文档

## 概述

白日梦模块是一个沉浸式的互动故事体验系统，用户可以创建个性化的白日梦剧情，通过AI生成的故事内容和互动选项，体验独特的故事旅程。

## 功能特性

### 1. 沉浸式设置界面
- **动态背景效果**：渐变色背景 + 浮动动画圆圈
- **四项必填设置**：
  - 我现在的身份是
  - 我的平淡日常是
  - 我想遇到的人是
  - 故事的基调是

### 2. 故事剧情界面
- **顶部进度条**：显示5个章节的进度（日常 → 转机 → 发展 → 高潮 → 结局）
- **中间对话区**：
  - 旁白（灰色背景，斜体）
  - NPC对话（紫粉渐变背景）
  - 用户选择（白色背景，右对齐）
  - 打字机效果逐字显示
- **底部交互区**：
  - 3个智能建议选项（可点击）
  - 自定义输入框（支持手动输入）

## 技术实现

### 核心状态管理

```typescript
interface DreamState {
  setup: DreamSetup;           // 用户设定
  messages: DreamMessage[];    // 聊天历史
  currentOptions: string[];    // 当前选项
  chapterProgress: number;     // 当前章节(1-5)
  status: DreamStatus;         // 状态: idle/loading/typing
}
```

### 工作流程

#### 阶段一：初始化
1. 用户填写设定信息
2. 点击"开始做梦"按钮
3. 调用API生成第一章内容

#### 阶段二：渲染内容
1. 接收API返回的JSON格式数据
2. 使用打字机效果显示旁白和对话
3. 显示3个智能选项供用户选择

#### 阶段三：交互循环
1. 用户选择选项或输入内容
2. 将选择添加到历史记录
3. 调用API生成下一段内容
4. 根据`chapter_end`标志推进章节
5. 重复步骤1-4直到故事结束

### API接口

**端点**: `/api/daydream`

**请求格式**:
```json
{
  "setup": {
    "identity": "一名普通的银行职员",
    "dailyLife": "每天对着电脑处理枯燥的报表",
    "person": "一位神秘的陌生人",
    "tone": "温暖治愈"
  },
  "history": [
    {"role": "narrator", "content": "..."},
    {"role": "user", "content": "..."}
  ],
  "currentChapter": 1,
  "isInitial": true
}
```

**响应格式**:
```json
{
  "narrator": "又是周二。总行的空调开得太冷...",
  "npc_say": "你好，看起来你需要休息一下。",
  "options": [
    "戴上耳机，把音量调到最大",
    "给闺蜜发消息：'我想喝酒！'",
    "深呼吸，继续工作"
  ],
  "chapter_end": false,
  "current_chapter": 1
}
```

## 关键特性

### 1. 打字机效果
- 使用`setInterval`逐字显示文本
- 每个字符间隔30ms
- 显示期间禁止用户输入

### 2. 阻塞机制
- `loading`状态：API请求中，禁用输入
- `typing`状态：打字机播放中，禁用输入
- `idle`状态：等待用户输入，启用输入

### 3. 章节推进
- 共5个章节，每个章节有明确的叙事目标
- AI根据剧情进展返回`chapter_end: true`
- 前端接收后自动更新进度条

### 4. 错误处理
- API失败时返回默认选项
- 超时自动取消请求
- JSON解析失败时降级处理

## 文件结构

```
src/pages/Daydream.tsx          # 主页面组件
api/daydream.ts                 # API端点处理
src/App.tsx                     # 路由配置（添加/daydream路由）
src/pages/You.tsx               # 入口页面（白日梦按钮）
```

## 使用方式

1. 在"你"页面点击"白日梦"按钮
2. 填写4项设定信息
3. 点击"✨ 开始做梦"
4. 跟随故事发展，做出选择
5. 体验完整的5章故事

## 样式特点

- **背景**：浅色渐变 (`from-purple-50 via-pink-50 to-purple-50`) - 与应用整体风格一致
- **玻璃态效果**：`backdrop-blur` + 白色半透明背景 (`bg-white/40`, `bg-white/60`)
- **颜色主题**：
  - 主色：`#9D85BE` 到 `#C5A3D9`（紫色渐变）
  - 文字：`#4A4A4A`（深灰）、`#666`（中灰）、`#999`（浅灰）
  - 边框：白色半透明 (`border-white/50`, `border-white/80`)
- **圆角设计**：统一使用 `rounded-2xl`、`rounded-3xl`、`rounded-full`
- **动画**：
  - 浮动圆圈动画（blob animation）- 浅色版本
  - 淡入淡出效果（fade-in, fade-in-up）
  - 打字光标闪烁（pulse animation）
  - 按钮缩放反馈 (`hover:scale-[1.01]`)
- **响应式**：最大宽度限制在`max-w-3xl`，适配移动端
- **阴影效果**：柔和的阴影 (`shadow-sm`, `shadow-lg`, `shadow-2xl`)
- **一致性**：与应用其他页面（Journals、You、WeeklyLetters）保持相同的视觉语言

## 历史记录功能 (新增 2026-01-08)

### 功能特性

1. **胶囊按钮**：
   - 位置：页面右上角，简洁的胶囊样式
   - 样式：半透明白色背景，History图标 + "梦境记录"文字
   - 同时在设置页和故事页显示

2. **历史记录弹窗**：
   - 显示所有已保存的梦境列表
   - 每条记录包含：
     - 梦境标题（从 oneSentence 截取前20字符）
     - 创建时间
     - 章节进度
     - 消息数量
     - 完成状态标记
   - 支持点击加载历史梦境并继续做梦
   - 支持删除历史记录

3. **保存/放弃提示**：
   - 触发时机：用户点击返回按钮，且有未保存的梦境内容
   - 选项：
     - "保存"：将当前梦境保存到数据库
     - "放弃"：丢弃当前梦境记录
   - 自动保存时机：用户在故事页交互时标记为有未保存更改

4. **梦境加载**：
   - 从历史记录中选择梦境后，完整恢复：
     - 用户设定（setup）
     - 所有历史消息
     - 当前章节进度
   - 可以无缝继续故事

### 数据库设计

**daydreams 表结构**：
```sql
CREATE TABLE public.daydreams (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title text NOT NULL,
    setup jsonb NOT NULL,
    messages jsonb NOT NULL DEFAULT '[]'::jsonb,
    current_chapter integer NOT NULL DEFAULT 1,
    is_completed boolean NOT NULL DEFAULT false,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);
```

### 实现细节

1. **状态管理**：
   - `showHistory`: 控制历史记录弹窗显示
   - `historyRecords`: 存储历史记录列表
   - `currentDreamId`: 当前梦境的数据库ID
   - `hasUnsavedChanges`: 标记是否有未保存的更改
   - `showSaveDialog`: 控制保存对话框显示

2. **核心函数**：
   - `loadHistory()`: 从数据库加载用户的所有梦境记录
   - `saveDream()`: 保存或更新当前梦境到数据库
   - `loadDream(record)`: 加载历史梦境并恢复状态
   - `deleteDream(id)`: 删除指定的梦境记录
   - `handleBack()`: 处理返回按钮，有未保存内容时弹出确认对话框

3. **用户体验优化**：
   - 加载状态提示
   - 空状态提示（没有梦境记录时）
   - 删除确认（点击X按钮）
   - Toast 提示反馈
   - 平滑的动画过渡

### 使用流程

1. 用户开始做梦，在故事页交互
2. 点击返回时，弹出"是否保存这场梦？"对话框
3. 选择"保存"：梦境存储到数据库，可在历史记录中找到
4. 选择"放弃"：当前梦境被丢弃
5. 之后可通过右上角的"梦境记录"按钮查看所有保存的梦境
6. 点击任意历史梦境，即可加载并继续做梦

## 注意事项

1. **API依赖**：需要OpenRouter API密钥配置在环境变量中
2. **模型选择**：使用`model-config.ts`中配置的聊天模型
3. **数据库迁移**：需要先执行 `supabase/migrations/20260108000001_create_daydreams.sql` 创建表
4. **类型定义**：已在 `src/integrations/supabase/types.ts` 中添加 daydreams 表的类型定义
5. **性能优化**：
   - 打字队列避免同时显示多条消息
   - AbortController取消未完成的请求
   - 及时清理定时器和监听器

## 未来优化方向

1. ~~支持保存和加载故事进度~~ ✅ 已完成
2. 添加背景音乐和音效
3. 支持多结局分支
4. 添加故事回放功能
5. 支持分享故事到社交媒体
6. 支持导出梦境为PDF或图片
7. 添加梦境标签和分类功能
