import React, { useRef, ReactNode, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { CacheContext } from './cache-context';
import { usePageCache } from '@/hooks/use-page-cache';

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

interface KeepAliveProps {
  children: ReactNode;
  cacheKey?: string;
  exclude?: string[];
}

export const KeepAlive: React.FC<KeepAliveProps> = ({
  children,
  cacheKey,
  exclude = [],
}) => {
  const location = useLocation();
  const key = cacheKey || location.pathname;
  const { getCache, setCache } = usePageCache();
  const containerRef = useRef<HTMLDivElement>(null);

  const shouldCache = !exclude.some(pattern => {
    if (pattern.includes('*')) {
      const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
      return regex.test(key);
    }
    return key === pattern;
  });

  const cached = getCache(key);

  useEffect(() => {
    if (!shouldCache) return;

    const container = containerRef.current;

    return () => {
      if (container) {
        const scrollTop = container.scrollTop || window.scrollY;
        if (!getCache(key)) { // Check again before setting cache
          setCache(key, children, scrollTop);
        }
      }
    };
  }, [key, children, setCache, shouldCache, getCache]);

  useEffect(() => {
    if (!shouldCache || !cached) return;

    const restoreScroll = () => {
      if (containerRef.current) {
        containerRef.current.scrollTop = cached.scrollPosition;
      } else {
        window.scrollTo(0, cached.scrollPosition);
      }
    };

    setTimeout(restoreScroll, 0);
  }, [cached, shouldCache]);

  if (!shouldCache) {
    return <>{children}</>;
  }

  return (
    <div ref={containerRef} style={{ height: '100%', overflow: 'auto' }}>
      {cached ? cached.component : children}
    </div>
  );
};

