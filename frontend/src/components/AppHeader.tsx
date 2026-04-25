import { useState } from 'react';
import { Search } from 'lucide-react';
import { SearchSuggestion } from '../types';
import SearchSuggestionsList from './SearchSuggestions';

export type AppHeaderProps = {
  searchTerm: string;
  onSearchChange: (term: string) => void;
  onSearchSubmit: () => void;
  suggestions: SearchSuggestion[];
  recentSearches: string[];
  isSuggestionsLoading: boolean;
  onSuggestionSelect: (suggestion: SearchSuggestion | { name: string }) => void;
};

const AppHeader = ({
  searchTerm,
  onSearchChange,
  onSearchSubmit,
  suggestions,
  recentSearches,
  isSuggestionsLoading,
  onSuggestionSelect,
}: AppHeaderProps) => {
  const [isSuggestionOpen, setSuggestionOpen] = useState(false);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSuggestionOpen(false);
    onSearchSubmit();
  };

  return (
    <header className="flex flex-col gap-6 lg:flex-row lg:items-center">
      {/* Branding */}
      <div className="shrink-0">
        <p className="text-xs font-semibold uppercase tracking-[0.4em] text-brand-light">InsureIQ</p>
        <h1 className="text-2xl font-bold text-white">Find the right insurance plan</h1>
        <p className="mt-1 text-sm text-white/50">
          Compare policy wordings · Surface key clauses · Cut through the jargon
        </p>
      </div>

      {/* Search */}
      <div className="relative flex-1">
        <form onSubmit={handleSubmit}>
          <label htmlFor="global-search" className="sr-only">Search insurance products</label>
          <div className="flex items-center gap-3 rounded-2xl border border-white/15 bg-white/8 px-5 py-4 focus-within:border-brand-light transition-colors">
            <Search className="h-5 w-5 shrink-0 text-brand-light" aria-hidden />
            <input
              id="global-search"
              name="search"
              placeholder="Search plans, insurers or benefits…"
              value={searchTerm}
              onChange={e => { onSearchChange(e.target.value); setSuggestionOpen(true); }}
              onFocus={() => setSuggestionOpen(true)}
              className="w-full bg-transparent text-white placeholder:text-white/40 focus:outline-none"
              autoComplete="off"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => { onSearchChange(''); setSuggestionOpen(false); }}
                className="shrink-0 text-xs text-white/40 hover:text-white/70"
              >
                Clear
              </button>
            )}
            <button
              type="submit"
              className="shrink-0 rounded-xl bg-brand px-5 py-2 text-sm font-semibold text-white hover:bg-brand-dark transition-colors"
            >
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
          onSelect={s => { onSuggestionSelect(s); setSuggestionOpen(false); }}
        />
      </div>
    </header>
  );
};

export default AppHeader;
