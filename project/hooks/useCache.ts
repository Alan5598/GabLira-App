import { useState, useRef, useCallback } from 'react';

interface CacheItem<T> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
}

interface Cache {
  [key: string]: CacheItem<any>;
}

export function useCache() {
  const [cache, setCache] = useState<Cache>({});
  const cacheRef = useRef<Cache>({});

  const get = useCallback(<T>(key: string): T | null => {
    const item = cacheRef.current[key];
    if (!item) return null;

    const now = Date.now();
    if (now - item.timestamp > item.ttl) {
      // Cache expired
      delete cacheRef.current[key];
      setCache({ ...cacheRef.current });
      return null;
    }

    return item.data;
  }, []);

  const set = useCallback(<T>(key: string, data: T, ttl: number = 5 * 60 * 1000) => {
    const item: CacheItem<T> = {
      data,
      timestamp: Date.now(),
      ttl,
    };

    cacheRef.current[key] = item;
    setCache({ ...cacheRef.current });
  }, []);

  const remove = useCallback((key: string) => {
    delete cacheRef.current[key];
    setCache({ ...cacheRef.current });
  }, []);

  const clear = useCallback(() => {
    cacheRef.current = {};
    setCache({});
  }, []);

  const isExpired = useCallback((key: string): boolean => {
    const item = cacheRef.current[key];
    if (!item) return true;

    const now = Date.now();
    return now - item.timestamp > item.ttl;
  }, []);

  return {
    get,
    set,
    remove,
    clear,
    isExpired,
    cache,
  };
}