const LoadingSkeleton = ({ rows = 3 }: { rows?: number }) => {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={String(index)} className="h-32 animate-pulse rounded-2xl bg-white/10" />
      ))}
    </div>
  );
};

export default LoadingSkeleton;
