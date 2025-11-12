import React, { useRef, ReactNode } from 'react';
import { CacheContext } from './cache-context';

export const CacheProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const cacheRef = useRef(new Map<string, { component: ReactNode; scrollPosition: number }>());

  const setCache = (key: string, component: ReactNode, scrollPosition: number) => {
    cacheRef.current.set(key, { component, scrollPosition });
  };

  const getCache = (key: string) => {
    return cacheRef.current.get(key);
  };

  const clearCache = (key?: string) => {
    if (key) {
      cacheRef.current.delete(key);
    } else {
      cacheRef.current.clear();
    }
  };

  return (
    <CacheContext.Provider value={{ cache: cacheRef.current, setCache, getCache, clearCache }}>
      {children}
    </CacheContext.Provider>
  );
};

// KeepAlive 现在在 App.tsx 中实现，这里保留接口以保持兼容性
interface KeepAliveProps {
  children: ReactNode;
  cacheKey?: string;
}

export const KeepAlive: React.FC<KeepAliveProps> = ({ children }) => {
  return <>{children}</>;
};

