/** 6 geometric SVG glyphs for insurance categories — no illustrations */
type GlyphType = 'health' | 'life' | 'motor' | 'travel' | 'fire' | 'home';

type CategoryGlyphProps = {
  type: GlyphType;
  size?: number;
  className?: string;
};

const GLYPHS: Record<GlyphType, React.ReactNode> = {
  health: (
    // Cross + circle — medical
    <g>
      <circle cx="12" cy="12" r="10" strokeWidth="1.5" fill="none" stroke="currentColor" />
      <rect x="9" y="7" width="6" height="10" rx="1" fill="currentColor" opacity="0.3" />
      <rect x="7" y="9" width="10" height="6" rx="1" fill="currentColor" opacity="0.3" />
      <path d="M12 9v6M9 12h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </g>
  ),
  life: (
    // Shield with heart
    <g>
      <path
        d="M12 3L5 6.5V12c0 4 3.5 7.5 7 8.5 3.5-1 7-4.5 7-8.5V6.5L12 3z"
        fill="currentColor"
        opacity="0.15"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M9.5 11.5a1.5 1.5 0 013 0c0 2-3 4-3 4s-3-2-3-4a1.5 1.5 0 013 0z"
        fill="currentColor"
        strokeWidth="0"
        transform="translate(0.5 0)"
      />
    </g>
  ),
  motor: (
    // Simplified car top-view
    <g>
      <rect x="5" y="9" width="14" height="8" rx="2" fill="currentColor" opacity="0.15" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 9L9.5 6h5L16 9" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" fill="none" />
      <circle cx="8" cy="17" r="1.5" fill="currentColor" />
      <circle cx="16" cy="17" r="1.5" fill="currentColor" />
    </g>
  ),
  travel: (
    // Plane silhouette
    <g>
      <path
        d="M21 10l-8 5-8-5V8l8 3 8-3v2zm0 0v6M3 10v6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        opacity="0.5"
      />
      <path
        d="M12 4l1.5 5H21l-7.5 4.5L16 20l-4-2.5L8 20l2.5-6.5L3 9h7.5L12 4z"
        fill="currentColor"
        opacity="0.2"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </g>
  ),
  fire: (
    // Flame
    <g>
      <path
        d="M12 2c0 4-4 6-4 10a4 4 0 008 0c0-2-1-3.5-1-5 0 0 0 3-1 3s-1-2-1-3c-1 1-1 3-1 3s-1-2 0-8z"
        fill="currentColor"
        opacity="0.2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M12 14a2 2 0 002-2c0-1-.5-1.5-.5-2.5 0 1-.5 2-1.5 2s-1.5-1.5-1.5-2c-.5 1-.5 1.5-.5 2.5a2 2 0 002 2z"
        fill="currentColor"
        opacity="0.6"
      />
    </g>
  ),
  home: (
    // House outline
    <g>
      <path
        d="M3 12l9-8 9 8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <path
        d="M5 10v8a1 1 0 001 1h4v-4h4v4h4a1 1 0 001-1v-8"
        fill="currentColor"
        opacity="0.15"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </g>
  ),
};

const CategoryGlyph = ({ type, size = 24, className = '' }: CategoryGlyphProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden
  >
    {GLYPHS[type]}
  </svg>
);

export default CategoryGlyph;
