import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, Menu, X, ChevronDown, Columns2 } from 'lucide-react';
import clsx from 'clsx';
import BrandMark from './BrandMark';
import { useDisplayVariant } from '../../hooks/useDisplayVariant';
import { useSearchContext } from '../../context/SearchContext';
import { CATEGORY_TREE } from '../../lib/categoryTree';

const TopBar = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const { cycleVariant, variantLabel } = useDisplayVariant();
  const { compareIds } = useSearchContext();
  const navigate = useNavigate();

  const [localSearch, setLocalSearch] = useState('');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (localSearch.trim()) {
      navigate(`/search?q=${encodeURIComponent(localSearch.trim())}`);
      setLocalSearch('');
      setSearchOpen(false);
    }
  };

  return (
    <>
      {/* Info strip */}
      <div className="bg-navy-900 px-4 py-1.5 text-center text-[11px] text-ink-onmuted">
        Regulated by IRDAI · Web Aggregator License No. XXXXXX · Zero commission from insurers
      </div>

      {/* Main nav bar */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-navy-900 shadow-card-navy">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3">
          {/* Brand */}
          <BrandMark tone="light" size="md" />

          {/* Desktop nav links */}
          <nav className="ml-6 hidden items-center gap-1 lg:flex" aria-label="Main navigation">
            {CATEGORY_TREE.map((group) => (
              <Link
                key={group.id}
                to={`/c/${group.id}`}
                className="flex items-center gap-1 rounded px-3 py-1.5 text-sm text-ink-on/80 transition-colors hover:bg-white/10 hover:text-ink-on"
              >
                <span aria-hidden>{group.icon}</span>
                {group.label.replace(' Insurance', '')}
              </Link>
            ))}
            <Link
              to="/methodology"
              className="flex items-center gap-1 rounded px-3 py-1.5 text-sm text-ink-on/80 transition-colors hover:bg-white/10 hover:text-ink-on"
            >
              Methodology
            </Link>
          </nav>

          <div className="flex-1" />

          {/* Search toggle */}
          <button
            onClick={() => setSearchOpen((v) => !v)}
            className="rounded p-2 text-ink-on/70 transition-colors hover:bg-white/10 hover:text-ink-on"
            aria-label="Search"
          >
            <Search className="h-4 w-4" />
          </button>

          {/* Compare badge */}
          {compareIds.length > 0 && (
            <Link
              to="/compare"
              className="flex items-center gap-1.5 rounded-full bg-gold px-3 py-1.5 text-xs font-semibold text-navy-900 transition-opacity hover:opacity-90"
              aria-label={`Compare ${compareIds.length} products`}
            >
              <Columns2 className="h-3.5 w-3.5" />
              Compare ({compareIds.length})
            </Link>
          )}

          {/* Display variant toggle */}
          <button
            onClick={cycleVariant}
            className="hidden items-center gap-1 rounded border border-white/20 px-2.5 py-1 text-xs text-ink-on/60 transition-colors hover:border-white/40 hover:text-ink-on md:flex"
            title="Cycle display variant"
          >
            Display: {variantLabel}
            <ChevronDown className="h-3 w-3" />
          </button>

          {/* Sign in / Get advice */}
          <div className="hidden items-center gap-2 lg:flex">
            <button className="rounded px-3 py-1.5 text-sm text-ink-on/70 transition-colors hover:text-ink-on">
              Sign in
            </button>
            <button className="rounded-full bg-gold px-4 py-1.5 text-sm font-semibold text-navy-900 transition-opacity hover:opacity-90">
              Get advice
            </button>
          </div>

          {/* Mobile hamburger */}
          <button
            className="rounded p-2 text-ink-on/70 transition-colors hover:bg-white/10 lg:hidden"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {/* Search bar (slide-down) */}
        {searchOpen && (
          <div className="border-t border-white/10 bg-navy-800 px-4 py-3">
            <form onSubmit={handleSearch} className="mx-auto flex max-w-2xl items-center gap-3">
              <Search className="h-4 w-4 shrink-0 text-ink-on/50" />
              <input
                autoFocus
                value={localSearch}
                onChange={(e) => setLocalSearch(e.target.value)}
                placeholder="Search plans, insurers, or benefits…"
                className="flex-1 bg-transparent text-sm text-ink-on placeholder:text-ink-on/40 focus:outline-none"
              />
              <button type="submit" className="shrink-0 rounded-full bg-gold px-4 py-1.5 text-xs font-semibold text-navy-900">
                Search
              </button>
              <button type="button" onClick={() => setSearchOpen(false)} className="shrink-0 text-ink-on/50 hover:text-ink-on">
                <X className="h-4 w-4" />
              </button>
            </form>
          </div>
        )}

        {/* Mobile menu */}
        {mobileOpen && (
          <nav className="border-t border-white/10 bg-navy-900 px-4 py-4 lg:hidden" aria-label="Mobile navigation">
            <div className="flex flex-col gap-1">
              {CATEGORY_TREE.map((group) => (
                <Link
                  key={group.id}
                  to={`/c/${group.id}`}
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-2 rounded px-3 py-2.5 text-sm text-ink-on/80 transition-colors hover:bg-white/10"
                >
                  <span aria-hidden>{group.icon}</span>
                  {group.label}
                </Link>
              ))}
              <Link
                to="/methodology"
                onClick={() => setMobileOpen(false)}
                className="rounded px-3 py-2.5 text-sm text-ink-on/80 transition-colors hover:bg-white/10"
              >
                Methodology
              </Link>
              <div className="mt-3 flex items-center gap-3 border-t border-white/10 pt-3">
                <button className="text-sm text-ink-on/70">Sign in</button>
                <button className="rounded-full bg-gold px-4 py-1.5 text-sm font-semibold text-navy-900">
                  Get advice
                </button>
                <button
                  onClick={cycleVariant}
                  className={clsx(
                    'ml-auto rounded border border-white/20 px-2.5 py-1 text-xs text-ink-on/60'
                  )}
                >
                  {variantLabel}
                </button>
              </div>
            </div>
          </nav>
        )}
      </header>
    </>
  );
};

export default TopBar;
