# 页面缓存机制说明

## 📋 概述

本项目使用**纯内存缓存（Memory Cache）**来实现页面状态保持和滚动位置恢复，避免了使用 sessionStorage/localStorage 导致的容量超限问题。

## 🔧 缓存系统架构

### 1. 页面组件缓存 (`src/lib/cache.tsx`)

使用 React Context + Map 实现页面组件级别的缓存：

```typescript
// 存储结构
Map<string, { 
  component: ReactNode;      // 缓存的组件树
  scrollPosition: number;    // 滚动位置
}>
```

**特点**：
- ✅ 纯内存存储，无容量限制
- ✅ 自动缓存组件状态和滚动位置
- ✅ 路由切换时保持页面状态

**使用方式**：
```tsx
// 在 App.tsx 中包裹需要缓存的路由
<Route path="/journals" element={<KeepAlive><Journals /></KeepAlive>} />
```

### 2. 状态数据缓存 (`src/hooks/use-cached-state.ts`)

使用独立的 Map 实现状态级别的缓存：

```typescript
// 从 sessionStorage 迁移到内存缓存
const memoryCache = new Map<string, unknown>();
```

**改进**：
- ❌ 旧方案：使用 sessionStorage（容量限制约 5-10MB）
- ✅ 新方案：使用内存缓存（无容量限制，仅受内存限制）

**使用方式**：
```tsx
// 在组件中使用
const [data, setData] = useCachedState('myKey', initialValue);
```

**工具函数**：
```typescript
// 清除所有缓存
clearAllMemoryCache();

// 清除特定键
clearMemoryCache('myKey');

// 获取缓存大小（调试用）
const size = getMemoryCacheSize();
```

## 🚀 优势

### 性能优势
1. **无 I/O 操作**：不需要序列化/反序列化 JSON
2. **访问速度快**：直接内存访问，O(1) 复杂度
3. **无大小限制**：仅受浏览器内存限制（通常几 GB）

### 稳定性优势
1. **避免容量超限**：不会出现 QuotaExceededError
2. **避免序列化错误**：不需要处理循环引用等 JSON 问题
3. **自动清理**：页面刷新后自动清空，避免脏数据

## ⚠️ 注意事项

### 刷新行为
- **页面刷新**：所有内存缓存会清空（这是预期行为）
- **路由切换**：缓存保持，状态不丢失

### 适用场景
✅ **适合**：
- 页面滚动位置
- 表单输入临时状态
- 列表展开/折叠状态
- 筛选条件临时保存

❌ **不适合**：
- 需要持久化的用户设置（应使用数据库）
- 需要跨浏览器标签共享的数据
- 需要刷新后保留的重要数据

### 内存管理
内存缓存会在以下情况自动清理：
1. 页面刷新/关闭
2. 浏览器标签关闭
3. 调用 `clearAllMemoryCache()` 或 `clearMemoryCache(key)`

## 📊 性能对比

| 指标 | sessionStorage | 内存缓存 |
|------|---------------|---------|
| 容量限制 | ~5-10MB | 仅受内存限制 |
| 读取速度 | 较慢（需解析 JSON） | 快（直接访问） |
| 写入速度 | 较慢（需序列化） | 快（直接写入） |
| 刷新保持 | ✅ 保持 | ❌ 清空 |
| 容量错误 | ⚠️ 可能报错 | ✅ 不会 |

## 🔄 迁移说明

从 sessionStorage 到内存缓存的迁移已自动完成，无需额外操作。

旧数据（如果存在于 sessionStorage）会被自动忽略，使用内存缓存重新构建。

## 🛠️ 调试技巧

### 查看缓存状态
```typescript
// 在浏览器控制台
import { getMemoryCacheSize } from '@/hooks/use-cached-state';
console.log('缓存项数量:', getMemoryCacheSize());
```

### 清空缓存测试
```typescript
import { clearAllMemoryCache } from '@/hooks/use-cached-state';
clearAllMemoryCache();
```

## 📚 相关文件

- `src/lib/cache.tsx` - 页面组件缓存实现
- `src/lib/cache-context.ts` - 缓存 Context 定义
- `src/hooks/use-cached-state.ts` - 状态缓存 Hook
- `src/hooks/use-page-cache.ts` - 页面缓存 Hook
- `src/App.tsx` - 缓存 Provider 配置
