/** Key-value display block — label above value */
type KVBlockProps = {
  label: string;
  value: React.ReactNode;
  size?: 'sm' | 'md';
  className?: string;
};

const KVBlock = ({ label, value, size = 'sm', className = '' }: KVBlockProps) => (
  <div className={`flex flex-col gap-0.5 ${className}`}>
    <dt className="text-[10px] font-medium uppercase tracking-widest text-ink-400">{label}</dt>
    <dd className={`font-medium text-ink-900 ${size === 'sm' ? 'text-sm' : 'text-base'}`}>
      {value}
    </dd>
  </div>
);

export default KVBlock;
