/** Tabular score display: "X.X / 5" */
import { getRatingTextClass } from '../../lib/scoring';

type ScoreProps = {
  value: number;
  outOf?: number;
  size?: 'sm' | 'md' | 'lg';
};

const Score = ({ value, outOf = 5, size = 'md' }: ScoreProps) => {
  const sizeClass =
    size === 'sm' ? 'text-sm' : size === 'lg' ? 'text-2xl' : 'text-base';
  const colorClass = getRatingTextClass(value);

  return (
    <span className={`font-data font-medium tabular-nums ${sizeClass} ${colorClass}`}>
      {value.toFixed(1)}
      <span className="text-ink-400">/{outOf}</span>
    </span>
  );
};

export default Score;
