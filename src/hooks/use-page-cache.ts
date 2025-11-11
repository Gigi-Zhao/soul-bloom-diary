import { useContext } from 'react';
import { CacheContext } from '../lib/cache-context';

export const usePageCache = () => {
  const context = useContext(CacheContext);
  if (!context) {
    throw new Error('usePageCache must be used within CacheProvider');
  }
  return context;
};
