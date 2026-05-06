import Stars from '../../components/ui/Stars';
import Badge from '../../components/ui/Badge';
import type { Review } from '../../types';

type ReviewCardsProps = {
  reviews: Review[];
};

const ReviewCards = ({ reviews }: ReviewCardsProps) => {
  if (reviews.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-ink-400">
        No reviews yet for this product.
      </p>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {reviews.map((review) => (
        <article
          key={review.id}
          className="rounded-lg border border-paper-strong bg-paper-surface p-4"
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <Stars value={review.rating} size="xs" />
              <h4 className="mt-2 font-serif text-sm font-semibold text-ink-900">
                {review.title}
              </h4>
            </div>
            <Badge variant="verified">Verified policyholder</Badge>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-ink-600">
            &ldquo;{review.content}&rdquo;
          </p>
          <p className="mt-3 text-[11px] text-ink-400">
            — {review.author} &middot;{' '}
            {new Date(review.createdAt).toLocaleDateString('en-IN', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            })}
          </p>
        </article>
      ))}
    </div>
  );
};

export default ReviewCards;
