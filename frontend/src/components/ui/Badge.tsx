import clsx from 'clsx';

type BadgeVariant = 'editors-pick' | 'irdai' | 'csr' | 'verified' | 'neutral' | 'gold';

type BadgeProps = {
  variant?: BadgeVariant;
  children: React.ReactNode;
  size?: 'xs' | 'sm';
};

const VARIANT_STYLES: Record<BadgeVariant, string> = {
  'editors-pick': 'bg-gold-soft text-gold-dark border border-gold/40',
  irdai: 'bg-emerald-50 text-emerald-800 border border-emerald-200',
  csr: 'bg-blue-50 text-blue-800 border border-blue-200',
  verified: 'bg-teal-50 text-teal-800 border border-teal-200',
  neutral: 'bg-paper-raised text-ink-600 border border-paper-strong',
  gold: 'bg-gold text-navy-900 border border-gold',
};

const Badge = ({ variant = 'neutral', children, size = 'xs' }: BadgeProps) => {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded-full font-medium',
        size === 'xs' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs',
        VARIANT_STYLES[variant],
      )}
    >
      {children}
    </span>
  );
};

export default Badge;
