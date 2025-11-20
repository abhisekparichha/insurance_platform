import { useMemo, useState } from 'react';
import { BookOpen, FileText, Star, ExternalLink } from 'lucide-react';
import { ProductDetail as ProductDetailType } from '../types';
import PolicyViewer from './PolicyViewer';
import PolicyScoreView from './PolicyScoreView';
import LoadingSkeleton from './LoadingSkeleton';

export type ProductDetailProps = {
  product?: ProductDetailType | null;
  isLoading: boolean;
  searchTerm?: string;
};

const tabs = ['Overview', 'Policy wording', 'Reviews', 'Documents'] as const;

type TabKey = (typeof tabs)[number];

const ProductDetail = ({ product, isLoading, searchTerm }: ProductDetailProps) => {
  const [activeTab, setActiveTab] = useState<TabKey>('Overview');

  const documents = product?.documents ?? [];

  if (isLoading) {
    return (
      <div className="rounded-3xl border border-white/10 bg-slate-950/60 p-6">
        <LoadingSkeleton rows={4} />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="rounded-3xl border border-dashed border-white/15 bg-slate-950/40 p-6 text-white/70">
        Select a product to inspect the policy wording, scorecard, and live reviews.
      </div>
    );
  }

  return (
    <section className="rounded-3xl border border-white/10 bg-slate-950/60 p-6 text-white">
      <header className="flex flex-col gap-4 border-b border-white/10 pb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-white/50">{product.insurer}</p>
            <h2 className="text-2xl font-semibold">{product.name}</h2>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 text-sm">
              <Star className="h-4 w-4 text-amber-400" /> {product.rating.toFixed(1)}
            </span>
            <a
              href={product.policyDocumentUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 rounded-full border border-white/20 px-4 py-2 text-sm"
            >
              Open PDF <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        </div>
        <p className="text-sm text-white/80">{product.description}</p>
        <div className="flex flex-wrap gap-2 text-xs text-white/70">
          <span className="rounded-full border border-white/20 px-3 py-1">{product.coverageAmount}</span>
          <span className="rounded-full border border-white/20 px-3 py-1">₹{product.priceFrom}/month</span>
        </div>
        <div className="flex flex-wrap gap-2 text-xs text-white/70">
          {product.tags.map((tag) => (
            <span key={tag} className="rounded-full bg-white/10 px-3 py-1">
              {tag.replace('-', ' ')}
            </span>
          ))}
        </div>
      </header>

      <nav className="mt-4 flex flex-wrap gap-2 text-sm">
        {tabs.map((tab) => (
          <button
            key={tab}
            className={`rounded-full border px-4 py-1 ${activeTab === tab ? 'border-brand bg-brand/20' : 'border-white/10'}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </nav>

      <div className="mt-4 space-y-6">
        {activeTab === 'Overview' && (
          <div>
            <h3 className="text-lg font-semibold">Key benefits</h3>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-white/80">
              {product.benefits.map((benefit) => (
                <li key={benefit}>{benefit}</li>
              ))}
            </ul>
            <div className="mt-5">
              <PolicyScoreView scores={product.scorecard} />
            </div>
          </div>
        )}

        {activeTab === 'Policy wording' && (
          <PolicyViewer
            excerpt={product.policyExcerpt}
            fullText={product.policyWording}
            sections={product.policySections}
            documents={product.documents}
            searchTerm={searchTerm}
          />
        )}

        {activeTab === 'Reviews' && (
          <div className="space-y-4">
            {product.reviews.map((review) => (
              <article key={review.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center gap-2 text-sm">
                  <Star className="h-4 w-4 text-amber-400" /> {review.rating.toFixed(1)} · {review.author}
                  <span className="text-white/50">{new Date(review.createdAt).toLocaleDateString()}</span>
                </div>
                <h4 className="mt-2 font-semibold">{review.title}</h4>
                <p className="text-sm text-white/80">{review.content}</p>
              </article>
            ))}
          </div>
        )}

        {activeTab === 'Documents' && (
          <div className="space-y-3">
            {documents.map((document) => (
              <a
                key={document.id}
                href={document.url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white"
              >
                <span className="flex items-center gap-2">
                  <BookOpen className="h-4 w-4" />
                  {document.label}
                </span>
                <span className="text-xs uppercase text-white/60">{document.type}</span>
              </a>
            ))}
            {documents.length === 0 && <p className="text-sm text-white/60">No documents published.</p>}
          </div>
        )}
      </div>
    </section>
  );
};

export default ProductDetail;
