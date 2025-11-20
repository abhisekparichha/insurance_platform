import { useState } from 'react';
import { ChevronDown, Search, SlidersHorizontal } from 'lucide-react';
import { Category, SearchSuggestion } from '../types';
import SearchSuggestionsList from './SearchSuggestions';
import clsx from 'clsx';

export type AppHeaderProps = {
  categories: Category[];
  activeCategory: string | null;
  onCategoryChange: (categoryId: string | null) => void;
  searchTerm: string;
  onSearchChange: (term: string) => void;
  onSearchSubmit: () => void;
  suggestions: SearchSuggestion[];
  recentSearches: string[];
  isSuggestionsLoading: boolean;
  onSuggestionSelect: (suggestion: SearchSuggestion | { name: string }) => void;
};

const AppHeader = ({
  categories,
  activeCategory,
  onCategoryChange,
  searchTerm,
  onSearchChange,
  onSearchSubmit,
  suggestions,
  recentSearches,
  isSuggestionsLoading,
  onSuggestionSelect
}: AppHeaderProps) => {
  const [isSuggestionOpen, setSuggestionOpen] = useState(false);
  const [isCategoryOpen, setCategoryOpen] = useState(false);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSuggestionOpen(false);
    onSearchSubmit();
  };

  return (
    <header className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-3xl p-6 shadow-card">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-brand-light">Insurance explorer</p>
          <h1 className="text-2xl font-semibold text-white">Discover policy wording clarity in seconds</h1>
          <p className="text-slate-300 text-sm">
            Browse categories, compare coverages, and surface the exact clause from the policy wording plus freshest reviews.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <button
              className="flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-white text-sm"
              aria-haspopup="listbox"
              aria-expanded="false"
            >
              <SlidersHorizontal className="h-4 w-4" />
              Guided Mode
            </button>
          </div>
        </div>
      </div>
      <div className="mt-6 flex flex-col gap-4 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <form onSubmit={handleSubmit}>
            <label htmlFor="global-search" className="sr-only">
              Search products
            </label>
            <div className="flex items-center gap-3 rounded-2xl border border-white/15 bg-white/10 px-5 py-3 focus-within:border-brand-light">
              <Search className="h-5 w-5 text-brand-light" aria-hidden />
              <input
                id="global-search"
                name="search"
                placeholder="Search plans, benefits, keywords…"
                value={searchTerm}
                onChange={(event) => {
                  onSearchChange(event.target.value);
                  setSuggestionOpen(true);
                }}
                onFocus={() => setSuggestionOpen(true)}
                className="w-full bg-transparent text-white placeholder:text-white/60 focus:outline-none"
                autoComplete="off"
              />
              <button type="submit" className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white">
                Search
              </button>
            </div>
          </form>
          <SearchSuggestionsList
            isOpen={isSuggestionOpen && (suggestions.length > 0 || recentSearches.length > 0 || isSuggestionsLoading)}
            suggestions={suggestions}
            recentSearches={recentSearches}
            isLoading={isSuggestionsLoading}
            onClose={() => setSuggestionOpen(false)}
            onSelect={(suggestion) => {
              onSuggestionSelect(suggestion);
              setSuggestionOpen(false);
            }}
          />
        </div>
        <div
          className="relative min-w-[240px]"
          onMouseLeave={() => setCategoryOpen(false)}
        >
          <label className="text-xs uppercase text-slate-300">Category</label>
          <button
            className="mt-1 flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white"
            aria-haspopup="listbox"
            aria-expanded={isCategoryOpen}
            onClick={() => setCategoryOpen((prev) => !prev)}
          >
            <span className="text-sm font-medium">
              {categories.find((category) => category.id === activeCategory)?.label ?? 'All categories'}
            </span>
            <ChevronDown className="h-4 w-4" aria-hidden />
          </button>
          {isCategoryOpen && (
            <ul
              role="listbox"
              className="scroll-area absolute left-0 right-0 top-full z-20 mt-2 max-h-60 overflow-y-auto rounded-2xl border border-white/10 bg-slate-900/95 backdrop-blur"
            >
              {categories.map((category) => (
                <li key={category.id}>
                  <button
                    role="option"
                    aria-selected={category.id === activeCategory}
                    className={clsx(
                      'flex w-full items-center justify-between px-4 py-3 text-left text-sm text-white hover:bg-white/5',
                      category.id === activeCategory && 'bg-brand/40'
                    )}
                    onClick={() => {
                      onCategoryChange(category.id);
                      setCategoryOpen(false);
                    }}
                  >
                    <span>{category.label}</span>
                    <span className="text-xs text-white/60">{category.productCount}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </header>
  );
};

export default AppHeader;
