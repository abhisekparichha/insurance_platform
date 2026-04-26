import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import clsx from 'clsx';
import CategoryGrid from './CategoryGrid';
import Kicker from '../../components/ui/Kicker';
import { CATEGORY_TREE } from '../../lib/categoryTree';

type HeroTab = 'browse' | 'search';

const Hero = () => {
  const [activeTab, setActiveTab] = useState<HeroTab>('browse');
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  return (
    <section className="bg-navy-900 py-16 md:py-24" aria-labelledby="hero-heading">
      <div className="mx-auto max-w-7xl px-4">
        {/* Heading */}
        <div className="max-w-2xl">
          <Kicker className="text-gold">India's insurance comparison platform</Kicker>
          <h1
            id="hero-heading"
            className="mt-4 font-serif text-4xl font-semibold leading-tight text-ink-on md:text-5xl"
          >
            Find the right insurance.
            <br />
            <span className="text-gold">Read the fine print.</span>
          </h1>
          <p className="mt-4 max-w-lg text-base leading-relaxed text-ink-onmuted">
            Compare policy wordings, surface key exclusions, and choose from 200+ IRDAI-regulated
            products — without bias, without commission.
          </p>
        </div>

        {/* Tab switcher */}
        <div className="mt-10">
          <div className="mb-6 flex gap-1 rounded-full border border-white/20 bg-white/5 p-1 w-fit">
            {(['browse', 'search'] as HeroTab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={clsx(
                  'rounded-full px-5 py-2 text-sm font-medium capitalize transition-all',
                  activeTab === tab
                    ? 'bg-gold text-navy-900 shadow-sm'
                    : 'text-ink-onmuted hover:text-ink-on',
                )}
              >
                {tab === 'browse' ? 'Browse categories' : 'Search plans'}
              </button>
            ))}
          </div>

          {activeTab === 'browse' && (
            <div className="animate-[fade-in_0.2s_ease-out]">
              <CategoryGrid />
            </div>
          )}

          {activeTab === 'search' && (
            <div className="max-w-xl">
              <form onSubmit={handleSearch} className="flex items-center gap-3 rounded-lg border border-white/20 bg-white/8 px-5 py-4">
                <Search className="h-5 w-5 shrink-0 text-gold" aria-hidden />
                <input
                  autoFocus
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="e.g. Care Shield, term life, zero dep motor…"
                  className="flex-1 bg-transparent text-sm text-ink-on placeholder:text-ink-on/40 focus:outline-none"
                />
                <button
                  type="submit"
                  className="shrink-0 rounded-full bg-gold px-5 py-2 text-sm font-semibold text-navy-900 transition-opacity hover:opacity-90"
                >
                  Search
                </button>
              </form>

              <div className="mt-4 flex flex-wrap gap-2">
                <span className="text-xs text-ink-onmuted">Popular:</span>
                {CATEGORY_TREE.slice(0, 4).map((group) => (
                  <button
                    key={group.id}
                    onClick={() => navigate(`/c/${group.id}`)}
                    className="rounded-full border border-white/20 px-3 py-1 text-xs text-ink-onmuted transition-colors hover:border-gold hover:text-gold"
                  >
                    {group.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default Hero;
