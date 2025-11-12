import { useEffect, useState, useRef } from 'react';

// 内存缓存存储
const memoryCache = new Map<string, unknown>();

// Hook to manage cached data for specific pages using memory cache
// 避免 sessionStorage 容量超限问题
export const useCachedState = <T,>(key: string, initialValue: T) => {
  const cacheKey = `page-cache-${key}`;
  
  // 从内存缓存获取值
  const getCachedValue = (): T => {
    try {
      if (memoryCache.has(cacheKey)) {
        return memoryCache.get(cacheKey) as T;
      }
    } catch (error) {
      console.error('Error reading from memory cache:', error);
    }
    return initialValue;
  };

  const [value, setValue] = useState<T>(getCachedValue);
  const isInitialMount = useRef(true);

  // 保存到内存缓存
  useEffect(() => {
    // 跳过初始挂载，避免不必要的缓存写入
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    try {
      memoryCache.set(cacheKey, value);
    } catch (error) {
      console.error('Error saving to memory cache:', error);
    }
  }, [value, cacheKey]);

  return [value, setValue] as const;
};

// 清除所有内存缓存的工具函数
export const clearAllMemoryCache = () => {
  memoryCache.clear();
};

// 清除特定键的内存缓存
export const clearMemoryCache = (key: string) => {
  const cacheKey = `page-cache-${key}`;
  memoryCache.delete(cacheKey);
};

// 获取缓存大小（用于调试）
export const getMemoryCacheSize = () => {
  return memoryCache.size;
};
