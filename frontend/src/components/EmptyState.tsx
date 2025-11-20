import { Compass } from 'lucide-react';

const EmptyState = ({ title, description }: { title: string; description: string }) => (
  <div className="flex flex-col items-center rounded-3xl border border-dashed border-white/20 bg-white/5 px-6 py-10 text-center text-white">
    <Compass className="h-8 w-8 text-white/60" />
    <h3 className="mt-4 text-lg font-semibold">{title}</h3>
    <p className="mt-2 text-sm text-white/70 max-w-xl">{description}</p>
  </div>
);

export default EmptyState;
