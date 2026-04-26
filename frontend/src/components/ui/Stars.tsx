/** Gold star rating: renders 0–5 filled/empty stars, supports half-stars */
type StarsProps = {
  value: number; // 0–5 float
  size?: 'xs' | 'sm' | 'md';
  showValue?: boolean;
};

const Stars = ({ value, size = 'sm', showValue = false }: StarsProps) => {
  const sizePx = size === 'xs' ? 10 : size === 'md' ? 18 : 14;

  return (
    <span className="inline-flex items-center gap-1" aria-label={`${value.toFixed(1)} out of 5 stars`}>
      <span className="inline-flex gap-0.5" aria-hidden>
        {Array.from({ length: 5 }, (_, i) => {
          const filled = value - i;
          const pct = Math.min(100, Math.max(0, Math.round(filled * 100)));
          const id = `star-clip-${i}-${Math.round(value * 10)}`;
          return (
            <svg
              key={i}
              width={sizePx}
              height={sizePx}
              viewBox="0 0 20 20"
              xmlns="http://www.w3.org/2000/svg"
            >
              <defs>
                <clipPath id={id}>
                  <rect x="0" y="0" width={`${pct}%`} height="100%" />
                </clipPath>
              </defs>
              {/* Empty star */}
              <path
                d="M10 1l2.39 4.84 5.34.78-3.87 3.77.91 5.32L10 13.27l-4.77 2.44.91-5.32L2.27 6.62l5.34-.78z"
                fill="var(--border)"
              />
              {/* Filled star clipped */}
              <path
                d="M10 1l2.39 4.84 5.34.78-3.87 3.77.91 5.32L10 13.27l-4.77 2.44.91-5.32L2.27 6.62l5.34-.78z"
                fill="var(--accent)"
                clipPath={`url(#${id})`}
              />
            </svg>
          );
        })}
      </span>
      {showValue && (
        <span className="font-data text-xs font-medium text-ink-600">{value.toFixed(1)}</span>
      )}
    </span>
  );
};

export default Stars;
