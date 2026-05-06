/** 6 px animated horizontal progress bar */
import { getRatingBarClass } from '../../lib/scoring';

type MeterProps = {
  value: number; // 0–5 or 0–100 based on `max`
  max?: number;
  colorClass?: string; // override auto color
  height?: number;
  animated?: boolean;
};

const Meter = ({ value, max = 5, colorClass, height = 6, animated = true }: MeterProps) => {
  const pct = Math.round((value / max) * 100);
  const autoColor = max === 5 ? getRatingBarClass(value) : 'bg-gold';
  const barColor = colorClass ?? autoColor;

  return (
    <div
      className="overflow-hidden rounded-full bg-paper-raised"
      style={{ height }}
      role="progressbar"
      aria-valuenow={value}
      aria-valuemax={max}
      aria-valuemin={0}
    >
      <div
        className={`h-full rounded-full ${barColor} ${animated ? 'meter-bar' : ''} transition-none`}
        style={
          animated
            ? ({ '--meter-width': `${pct}%` } as React.CSSProperties)
            : { width: `${pct}%` }
        }
      />
    </div>
  );
};

export default Meter;
