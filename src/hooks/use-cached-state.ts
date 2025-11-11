import { useEffect, useState } from 'react';

// Hook to manage cached data for specific pages
export const useCachedState = <T,>(key: string, initialValue: T) => {
  const storageKey = `page-cache-${key}`;
  
  // Try to get cached value from sessionStorage
  const getCachedValue = (): T => {
    try {
      const cached = sessionStorage.getItem(storageKey);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (error) {
      console.error('Error reading from cache:', error);
    }
    return initialValue;
  };

  const [value, setValue] = useState<T>(getCachedValue);

  // Save to sessionStorage whenever value changes
  useEffect(() => {
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(value));
    } catch (error) {
      console.error('Error saving to cache:', error);
    }
  }, [value, storageKey]);

  return [value, setValue] as const;
};
