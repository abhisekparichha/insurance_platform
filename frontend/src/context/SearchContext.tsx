import { createContext, PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react';

export type SearchContextValue = {
  searchTerm: string;
  setSearchTerm: (value: string) => void;
  recentSearches: string[];
  addRecentSearch: (value: string) => void;
  // Compare slice
  compareIds: string[];
  addToCompare: (id: string) => void;
  removeFromCompare: (id: string) => void;
  clearCompare: () => void;
  isInCompare: (id: string) => boolean;
};

const SearchContext = createContext<SearchContextValue | null>(null);

const RECENT_SEARCH_KEY = 'insurance:recent-searches';
const COMPARE_KEY = 'ip:compare';
const MAX_COMPARE = 5;

const loadRecentSearches = (): string[] => {
  if (typeof window === 'undefined') return [];
  try {
    const value = window.localStorage.getItem(RECENT_SEARCH_KEY);
    return value ? (JSON.parse(value) as string[]) : [];
  } catch {
    return [];
  }
};

const loadCompareIds = (): string[] => {
  if (typeof window === 'undefined') return [];
  try {
    const value = window.localStorage.getItem(COMPARE_KEY);
    return value ? (JSON.parse(value) as string[]) : [];
  } catch {
    return [];
  }
};

export function SearchProvider({ children }: PropsWithChildren) {
  const [searchTerm, setSearchTerm] = useState('');
  const [recentSearches, setRecentSearches] = useState<string[]>(() => loadRecentSearches());
  const [compareIds, setCompareIds] = useState<string[]>(() => loadCompareIds());

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(RECENT_SEARCH_KEY, JSON.stringify(recentSearches.slice(0, 6)));
  }, [recentSearches]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(COMPARE_KEY, JSON.stringify(compareIds));
  }, [compareIds]);

  const addRecentSearch = (value: string) => {
    if (!value.trim()) return;
    setRecentSearches((prev) => {
      const next = [value.trim(), ...prev.filter((entry) => entry !== value.trim())];
      return next.slice(0, 6);
    });
  };

  const addToCompare = (id: string) => {
    setCompareIds((prev) => {
      if (prev.includes(id) || prev.length >= MAX_COMPARE) return prev;
      return [...prev, id];
    });
  };

  const removeFromCompare = (id: string) => {
    setCompareIds((prev) => prev.filter((x) => x !== id));
  };

  const clearCompare = () => setCompareIds([]);

  const isInCompare = (id: string) => compareIds.includes(id);

  const value = useMemo<SearchContextValue>(
    () => ({
      searchTerm,
      setSearchTerm,
      recentSearches,
      addRecentSearch,
      compareIds,
      addToCompare,
      removeFromCompare,
      clearCompare,
      isInCompare,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [searchTerm, recentSearches, compareIds],
  );

  return <SearchContext.Provider value={value}>{children}</SearchContext.Provider>;
}

export function useSearchContext() {
  const context = useContext(SearchContext);
  if (!context) {
    throw new Error('useSearchContext must be used within SearchProvider');
  }
  return context;
}
