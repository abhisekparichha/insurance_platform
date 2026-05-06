import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, ExternalLink } from 'lucide-react';
import Stars from '../../components/ui/Stars';
import Score from '../../components/ui/Score';
import KVBlock from '../../components/ui/KVBlock';
import MonogramTile from '../../components/ui/MonogramTile';
import Tabs from '../../components/ui/Tabs';
import ProductRow from '../category/ProductRow';
import LoadingSkeleton from '../../components/LoadingSkeleton';
import { fetchInsurerProfile, fetchInsurerProducts } from '../../lib/api';
import { getInsurerById } from '../../lib/insurerNames';

const TABS = [
  { key: 'products', label: 'Products' },
  { key: 'about', label: 'About' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

const InsurerProfile = () => {
  const { insurerId } = useParams<{ insurerId: string }>();
  const [activeTab, setActiveTab] = useState<TabKey>('products');

  const { data: insurer, isLoading } = useQuery({
    queryKey: ['insurer', insurerId],
    queryFn: () => fetchInsurerProfile(insurerId!),
    enabled: Boolean(insurerId),
  });

  const { data: products } = useQuery({
    queryKey: ['insurer-products', insurerId],
    queryFn: () => fetchInsurerProducts(insurerId!),
    enabled: Boolean(insurerId),
  });

  const registry = insurerId ? getInsurerById(insurerId) : undefined;

  if (isLoading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-12">
        <LoadingSkeleton rows={5} />
      </div>
    );
  }

  if (!insurer) {
    return (
      <div className="py-24 text-center text-sm text-ink-400">
        Insurer not found.{' '}
        <Link to="/" className="font-semibold text-navy-900 underline">
          Go home
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper">
      {/* Hero */}
      <div className="bg-navy-900 py-10">
        <div className="mx-auto max-w-5xl px-4">
          <nav className="flex items-center gap-1 text-xs text-ink-onmuted">
            <Link to="/" className="hover:text-ink-on">Home</Link>
            <ChevronRight className="h-3 w-3" />
            <span className="text-gold">{insurer.name}</span>
          </nav>

          <div className="mt-5 flex flex-wrap items-center gap-5">
            <MonogramTile name={insurer.name} size="lg" />
            <div>
              <h1 className="font-serif text-3xl font-semibold text-ink-on">{insurer.name}</h1>
              {registry && (
                <p className="mt-1 text-xs text-ink-onmuted italic">{registry.legalName}</p>
              )}
              <div className="mt-3 flex flex-wrap gap-6">
                <KVBlock label="Overall rating" value={
                  <div className="flex items-center gap-2">
                    <Score value={insurer.rating} size="sm" />
                    <Stars value={insurer.rating} size="xs" />
                  </div>
                } />
                <KVBlock label="Products tracked" value={insurer.totalProducts} />
              </div>
            </div>
            {registry?.website && (
              <a
                href={registry.website}
                target="_blank"
                rel="noreferrer"
                className="ml-auto flex items-center gap-1.5 rounded-full border border-white/20 px-4 py-2 text-xs text-ink-onmuted transition-colors hover:border-white/40 hover:text-ink-on"
              >
                Official website <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Stat strip */}
      <div className="border-b border-paper-strong bg-paper-surface">
        <div className="mx-auto flex max-w-5xl flex-wrap gap-8 px-4 py-6">
          <KVBlock label="IRDAI Registered" value="Yes" />
          <KVBlock label="Claim settlement ratio" value="~93%" />
          <KVBlock label="Network hospitals" value="10,000+" />
          <KVBlock label="Solvency ratio" value=">1.5x" />
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-5xl px-4 py-8">
        <Tabs tabs={[...TABS]} activeTab={activeTab} onChange={setActiveTab} />

        <div className="mt-6">
          {activeTab === 'products' && (
            <div className="space-y-3">
              {(products?.items ?? []).map((p) => (
                <ProductRow key={p.id} product={p} />
              ))}
              {(products?.items ?? []).length === 0 && (
                <p className="py-8 text-center text-sm text-ink-400">
                  No products tracked yet for this insurer.
                </p>
              )}
            </div>
          )}

          {activeTab === 'about' && (
            <div className="max-w-2xl">
              <p className="leading-relaxed text-ink-600">
                {insurer.name} is an IRDAI-registered insurance company operating in India.
                InsureIQ tracks their products, policy wordings, and claims data to provide
                unbiased ratings and comparisons.
              </p>
              <p className="mt-4 leading-relaxed text-ink-600">
                All ratings are computed from 6 weighted dimensions including coverage breadth,
                claims turnaround time, and policy transparency. See our{' '}
                <Link to="/methodology" className="font-medium text-navy-900 underline">
                  rating methodology
                </Link>{' '}
                for full details.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default InsurerProfile;
