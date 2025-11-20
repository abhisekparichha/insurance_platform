import { SearchSuggestion } from '../types';
import { Clock, Sparkles } from 'lucide-react';

export type SearchSuggestionsProps = {
  isOpen: boolean;
  suggestions: SearchSuggestion[];
  recentSearches: string[];
  isLoading: boolean;
  onSelect: (suggestion: SearchSuggestion | { name: string }) => void;
  onClose: () => void;
};

const SearchSuggestions = ({ isOpen, suggestions, recentSearches, isLoading, onSelect, onClose }: SearchSuggestionsProps) => {
  if (!isOpen) return null;

  const handleSelect = (value: SearchSuggestion | { name: string }) => {
    onSelect(value);
    onClose();
  };

  return (
    <div className="absolute left-0 right-0 top-full z-30 mt-2 rounded-2xl border border-white/10 bg-slate-900/95 p-4 text-white shadow-card">
      {isLoading && <p className="text-sm text-slate-300">Searching…</p>}

      {!isLoading && recentSearches.length > 0 && (
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-400">Recent searches</p>
          <ul className="mt-2 space-y-1">
            {recentSearches.map((search) => (
              <li key={search}>
                <button
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm hover:bg-white/5"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => handleSelect({ name: search })}
                >
                  <Clock className="h-4 w-4 text-slate-400" />
                  {search}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!isLoading && suggestions.length > 0 && (
        <div className="mt-4">
          <p className="text-xs uppercase tracking-wide text-slate-400">Suggestions</p>
          <ul className="mt-2 divide-y divide-white/5">
            {suggestions.map((suggestion) => (
              <li key={suggestion.id}>
                <button
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-white/5"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => handleSelect(suggestion)}
                >
                  <div>
                    <p className="font-medium">{suggestion.name}</p>
                    <p className="text-xs text-slate-400">{suggestion.categoryLabel}</p>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-brand-light">
                    <Sparkles className="h-3.5 w-3.5" />
                    {suggestion.rating.toFixed(1)}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default SearchSuggestions;
