import { useEffect, useState, useRef } from 'react';

// In-memory cache store (survives across component remounts within same session)
const memoryCache = new Map<string, unknown>();

// Hook to manage cached data in memory (no storage quota issues)
export const useCachedState = <T,>(key: string, initialValue: T) => {
  const isFirstRender = useRef(true);
  
  // Get cached value from memory on first render
  const getInitialValue = (): T => {
    if (memoryCache.has(key)) {
      const cached = memoryCache.get(key) as T;
      console.log(`[useCachedState] ${key} - loaded from memory cache:`, Array.isArray(cached) ? `${cached.length} items` : typeof cached);
      return cached;
    }
    console.log(`[useCachedState] ${key} - no cache, using initial value`);
    return initialValue;
  };

  const [value, setValue] = useState<T>(() => getInitialValue());

  // Save to memory cache whenever value changes
  useEffect(() => {
    // Skip saving on first render if value is initial value
    if (isFirstRender.current) {
      isFirstRender.current = false;
      // Only save if it's not the initial value (means we loaded from cache or got new data)
      if (value !== initialValue) {
        memoryCache.set(key, value);
      }
      return;
    }

    memoryCache.set(key, value);
    console.log(`[useCachedState] ${key} - saved to memory cache:`, Array.isArray(value) ? `${value.length} items` : typeof value);
  }, [value, key, initialValue]);

  return [value, setValue] as const;
};
