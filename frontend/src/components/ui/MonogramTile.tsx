import clsx from 'clsx';
import { derivedMonogram, getInsurerByName } from '../../lib/insurerNames';

type MonogramTileProps = {
  name: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
};

const SIZE_CLASSES: Record<string, string> = {
  xs: 'h-6 w-6 text-[10px]',
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-14 w-14 text-base',
};

const MonogramTile = ({ name, size = 'md' }: MonogramTileProps) => {
  const insurer = getInsurerByName(name);
  const monogram = insurer?.monogram ?? derivedMonogram(name);
  const toneBg = insurer?.toneBg ?? 'bg-navy-900';
  const toneText = insurer?.toneText ?? 'text-white';

  return (
    <span
      className={clsx(
        'flex shrink-0 items-center justify-center rounded font-serif font-semibold',
        SIZE_CLASSES[size] ?? SIZE_CLASSES.md,
        toneBg,
        toneText,
      )}
      aria-label={name}
      title={name}
    >
      {monogram}
    </span>
  );
};

export default MonogramTile;
