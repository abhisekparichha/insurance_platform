import clsx from 'clsx';
import { Star, ArrowUpRight, BookOpenCheck } from 'lucide-react';
import { ProductSummary } from '../types';
import { getHighlightSegments } from '../lib/highlightMatch';

export type ProductCardProps = {
  product: ProductSummary;
  selected?: boolean;
  onSelect: (productId: string) => void;
  onHover?: (productId: string) => void;
  searchTerm?: string;
};

const ProductCard = ({ product, selected, onSelect, onHover, searchTerm }: ProductCardProps) => {
  const highlight = getHighlightSegments(product.policyExcerpt, searchTerm);

  return (
    <article
      className={clsx(
        'rounded-3xl border p-5 transition-all hover:-translate-y-0.5 hover:shadow-card',
        selected ? 'border-brand bg-brand/10' : 'border-white/10 bg-white/5'
      )}
      onMouseEnter={() => onHover?.(product.id)}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-white/60">{product.insurer}</p>
          <h3 className="text-lg font-semibold text-white">{product.name}</h3>
        </div>
        <div className="flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 text-xs text-white">
          <Star className="h-3.5 w-3.5 text-amber-400" />
          {product.rating.toFixed(1)}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-white/70">
        <span className="rounded-full border border-white/20 px-2 py-0.5 capitalize">{product.coverageType.replace('-', ' ')}</span>
        <span className="rounded-full border border-white/20 px-2 py-0.5">{product.coverageAmount}</span>
        <span className="rounded-full border border-white/20 px-2 py-0.5">₹{product.priceFrom}/month</span>
      </div>
      <p className="mt-3 text-sm text-white/90">
        {highlight.map((segment, index) => (
          <span key={`${segment.text}-${index}`} className={segment.match ? 'bg-brand/40 px-0.5' : undefined}>
            {segment.text}
          </span>
        ))}
      </p>
      <div className="mt-4 flex flex-wrap gap-2 text-xs">
        {product.highlights.map((highlightItem) => (
          <span key={highlightItem} className="rounded-full bg-white/10 px-3 py-1 text-white/80">
            {highlightItem}
          </span>
        ))}
      </div>
      {product.lastReview && (
        <div className="mt-4 rounded-2xl border border-white/10 bg-slate-900/40 p-3 text-xs text-white/80">
          <p className="flex items-center gap-1 font-semibold text-white">
            <BookOpenCheck className="h-3.5 w-3.5" /> Latest review
          </p>
          <p className="mt-1 line-clamp-2">“{product.lastReview.content}”</p>
        </div>
      )}
      <button
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-white/90 px-4 py-3 text-sm font-semibold text-slate-900"
        onClick={() => onSelect(product.id)}
        aria-pressed={selected}
      >
        View policy wording
        <ArrowUpRight className="h-4 w-4" />
      </button>
    </article>
  );
};

export default ProductCard;
