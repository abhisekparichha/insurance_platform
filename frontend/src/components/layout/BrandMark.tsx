import { Link } from 'react-router-dom';

type BrandMarkProps = {
  /** 'light' for dark backgrounds (navy header), 'dark' for light backgrounds */
  tone?: 'light' | 'dark';
  size?: 'sm' | 'md' | 'lg';
};

const BrandMark = ({ tone = 'light', size = 'md' }: BrandMarkProps) => {
  const tileSize = size === 'sm' ? 'h-7 w-7 text-xs' : size === 'lg' ? 'h-12 w-12 text-lg' : 'h-9 w-9 text-sm';
  const nameSize = size === 'sm' ? 'text-sm' : size === 'lg' ? 'text-2xl' : 'text-base';
  const tagSize = size === 'sm' ? 'text-[9px]' : 'text-[10px]';

  const textClass = tone === 'light' ? 'text-ink-on' : 'text-ink-900';
  const tileClass = tone === 'light' ? 'bg-gold text-navy-900' : 'bg-navy-900 text-gold';
  const subtitleClass = tone === 'light' ? 'text-ink-onmuted' : 'text-ink-600';

  return (
    <Link to="/" className="flex items-center gap-2.5 no-underline" aria-label="InsureIQ home">
      {/* Serif monogram tile */}
      <span
        className={`${tileSize} ${tileClass} flex items-center justify-center rounded font-serif font-semibold leading-none`}
        aria-hidden
      >
        II
      </span>

      {/* Word-mark */}
      <span className="flex flex-col leading-none">
        <span className={`${nameSize} ${textClass} font-serif font-semibold tracking-tight`}>
          InsureIQ
        </span>
        <span className={`${tagSize} ${subtitleClass} mt-0.5 uppercase tracking-widest`}>
          Compare · Analyse · Decide
        </span>
      </span>
    </Link>
  );
};

export default BrandMark;
