/** Very small label above body text — quieter than Kicker */
type EyebrowProps = {
  children: React.ReactNode;
  className?: string;
};

const Eyebrow = ({ children, className = '' }: EyebrowProps) => (
  <p className={`text-[10px] font-medium uppercase tracking-widest text-ink-400 ${className}`}>
    {children}
  </p>
);

export default Eyebrow;
