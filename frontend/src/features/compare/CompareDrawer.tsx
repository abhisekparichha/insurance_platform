import { Link } from 'react-router-dom';
import { X, Columns2, ChevronRight } from 'lucide-react';
import { useSearchContext } from '../../context/SearchContext';

const CompareDrawer = () => {
  const { compareIds, removeFromCompare, clearCompare } = useSearchContext();

  if (compareIds.length === 0) return null;

  return (
    <div
      className="fixed bottom-0 inset-x-0 z-50 animate-slide-up border-t-2 border-gold bg-navy-900 shadow-[0_-4px_24px_-4px_rgba(12,35,64,0.4)]"
      role="region"
      aria-label="Compare tray"
    >
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3">
        {/* Icon + count */}
        <span className="flex shrink-0 items-center gap-2 text-sm font-semibold text-gold">
          <Columns2 className="h-4 w-4" />
          Compare ({compareIds.length}/5)
        </span>

        {/* ID pills */}
        <div className="flex flex-1 flex-wrap gap-2">
          {compareIds.map((id) => (
            <span
              key={id}
              className="flex items-center gap-1.5 rounded-full border border-white/20 bg-white/8 px-3 py-1 text-xs text-ink-on"
            >
              <span className="max-w-[120px] truncate font-medium">{id}</span>
              <button
                onClick={() => removeFromCompare(id)}
                className="text-ink-onmuted transition-colors hover:text-ink-on"
                aria-label={`Remove ${id} from compare`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>

        {/* Actions */}
        <div className="flex shrink-0 items-center gap-3">
          <button
            onClick={clearCompare}
            className="text-xs text-ink-onmuted transition-colors hover:text-ink-on"
          >
            Clear all
          </button>
          <Link
            to={`/compare?ids=${compareIds.join(',')}`}
            className="flex items-center gap-1.5 rounded-full bg-gold px-5 py-2 text-sm font-semibold text-navy-900 transition-opacity hover:opacity-90"
          >
            Compare now <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
};

export default CompareDrawer;
