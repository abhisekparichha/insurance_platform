import { Link } from 'react-router-dom';
import { ArrowRight, PlusCircle, CheckCircle2 } from 'lucide-react';
import Stars from '../../components/ui/Stars';
import Score from '../../components/ui/Score';
import Badge from '../../components/ui/Badge';
import KVBlock from '../../components/ui/KVBlock';
import MonogramTile from '../../components/ui/MonogramTile';
import { ProductSummary } from '../../types';
import { useSearchContext } from '../../context/SearchContext';

type ProductRowProps = {
  product: ProductSummary;
  rank?: number;
};

const ProductRow = ({ product, rank }: ProductRowProps) => {
  const { addToCompare, removeFromCompare, isInCompare, compareIds } = useSearchContext();
  const inCompare = isInCompare(product.id);
  const compareFull = compareIds.length >= 5 && !inCompare;

  return (
    <article className="flex items-center gap-4 rounded-lg border border-paper-strong bg-paper-surface px-5 py-4 transition-all hover:border-navy-900/30 hover:shadow-card">
      {/* Rank */}
      {rank !== undefined && (
        <span className="hidden w-6 shrink-0 text-center font-data text-sm font-medium text-ink-400 sm:block">
          {rank === 1 ? (
            <span className="inline-block h-6 w-6 rounded-full bg-gold text-center text-xs leading-6 text-navy-900 font-semibold">1</span>
          ) : (
            rank
          )}
        </span>
      )}

      {/* Monogram */}
      <MonogramTile name={product.insurer} size="md" />

      {/* Name + chips + excerpt */}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to={`/p/${product.id}`}
            className="font-serif text-base font-semibold text-ink-900 hover:text-navy-900 hover:underline"
          >
            {product.name}
          </Link>
          {rank === 1 && (
            <Badge variant="editors-pick">Editor's pick</Badge>
          )}
        </div>
        <p className="mt-0.5 text-xs text-ink-400">{product.insurer}</p>
        <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-ink-600">
          {product.policyExcerpt}
        </p>
        <div className="mt-2 flex flex-wrap gap-3">
          <KVBlock label="Coverage" value={product.coverageAmount} />
          <KVBlock label="From" value={`₹${product.priceFrom}/mo`} />
          <KVBlock label="Type" value={product.coverageType.replace(/-/g, ' ')} />
        </div>
      </div>

      {/* Rating block */}
      <div className="hidden shrink-0 flex-col items-end gap-1.5 sm:flex">
        <Score value={product.rating} size="md" />
        <Stars value={product.rating} size="xs" />
      </div>

      {/* CTAs */}
      <div className="flex shrink-0 flex-col items-end gap-2">
        <Link
          to={`/p/${product.id}`}
          className="flex items-center gap-1.5 rounded-full bg-navy-900 px-4 py-2 text-xs font-semibold text-ink-on transition-opacity hover:opacity-90"
        >
          View <ArrowRight className="h-3.5 w-3.5" />
        </Link>
        <button
          onClick={() => inCompare ? removeFromCompare(product.id) : addToCompare(product.id)}
          disabled={compareFull}
          title={
            compareFull
              ? 'Compare list is full (max 5)'
              : inCompare
              ? 'Remove from compare'
              : 'Add to compare'
          }
          className="flex items-center gap-1 text-[11px] font-medium text-ink-400 transition-colors hover:text-gold disabled:cursor-not-allowed disabled:opacity-40"
        >
          {inCompare ? (
            <CheckCircle2 className="h-3.5 w-3.5 text-gold" />
          ) : (
            <PlusCircle className="h-3.5 w-3.5" />
          )}
          {inCompare ? 'In compare' : 'Compare'}
        </button>
      </div>
    </article>
  );
};

export default ProductRow;
