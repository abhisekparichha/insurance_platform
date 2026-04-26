import { useEffect, useState } from 'react';

export type DisplayVariant = 'classic' | 'quiet' | 'editorial' | 'dense';

const VARIANTS: DisplayVariant[] = ['classic', 'quiet', 'editorial', 'dense'];
const STORAGE_KEY = 'ip:display-variant';

const VARIANT_LABELS: Record<DisplayVariant, string> = {
  classic: 'Classic',
  quiet: 'Quiet',
  editorial: 'Editorial',
  dense: 'Dense',
};

export function useDisplayVariant() {
  const [variant, setVariantState] = useState<DisplayVariant>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && VARIANTS.includes(stored as DisplayVariant)) {
        return stored as DisplayVariant;
      }
    } catch {
      // ignore
    }
    return 'classic';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-variant', variant);
    try {
      localStorage.setItem(STORAGE_KEY, variant);
    } catch {
      // ignore
    }
  }, [variant]);

  const cycleVariant = () => {
    const idx = VARIANTS.indexOf(variant);
    setVariantState(VARIANTS[(idx + 1) % VARIANTS.length]);
  };

  return {
    variant,
    setVariant: setVariantState,
    cycleVariant,
    variantLabel: VARIANT_LABELS[variant],
    allVariants: VARIANTS,
    variantLabels: VARIANT_LABELS,
  };
}
