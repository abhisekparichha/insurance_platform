import { createContext, PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react';

export type SearchContextValue = {
  searchTerm: string;
  setSearchTerm: (value: string) => void;
  recentSearches: string[];
  addRecentSearch: (value: string) => void;
};

const SearchContext = createContext<SearchContextValue | null>(null);

const RECENT_SEARCH_KEY = 'insurance:recent-searches';

const loadRecentSearches = (): string[] => {
  if (typeof window === 'undefined') return [];
  try {
    const value = window.localStorage.getItem(RECENT_SEARCH_KEY);
    return value ? (JSON.parse(value) as string[]) : [];
  } catch (error) {
    console.warn('Unable to read search history', error);
    return [];
  }
};

export function SearchProvider({ children }: PropsWithChildren) {
  const [searchTerm, setSearchTerm] = useState('');
  const [recentSearches, setRecentSearches] = useState<string[]>(() => loadRecentSearches());

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(RECENT_SEARCH_KEY, JSON.stringify(recentSearches.slice(0, 6)));
  }, [recentSearches]);

  const addRecentSearch = (value: string) => {
    if (!value.trim()) return;
    setRecentSearches((prev) => {
      const next = [value.trim(), ...prev.filter((entry) => entry !== value.trim())];
      return next.slice(0, 6);
    });
  };

  const value = useMemo<SearchContextValue>(
    () => ({ searchTerm, setSearchTerm, recentSearches, addRecentSearch }),
    [searchTerm, recentSearches]
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
