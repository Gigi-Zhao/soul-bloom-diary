import { createContext, ReactNode } from 'react';

export interface CacheContextType {
  cache: Map<string, { component: ReactNode; scrollPosition: number }>;
  setCache: (key: string, component: ReactNode, scrollPosition: number) => void;
  getCache: (key: string) => { component: ReactNode; scrollPosition: number } | undefined;
  clearCache: (key?: string) => void;
}

export const CacheContext = createContext<CacheContextType | null>(null);
