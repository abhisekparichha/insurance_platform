/** Small uppercase label above a heading — e.g. "Health Insurance" */
type KickerProps = {
  children: React.ReactNode;
  className?: string;
};

const Kicker = ({ children, className = '' }: KickerProps) => (
  <p className={`text-[11px] font-semibold uppercase tracking-[0.3em] text-gold ${className}`}>
    {children}
  </p>
);

export default Kicker;
