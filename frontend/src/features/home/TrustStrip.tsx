const stats = [
  { value: '46+', label: 'IRDAI-registered insurers tracked' },
  { value: '200+', label: 'Insurance products analysed' },
  { value: '₹0', label: 'Commission from insurers' },
  { value: '24h', label: 'Response on policy queries' },
];

const TrustStrip = () => (
  <section className="bg-navy-900 py-10" aria-label="Trust statistics">
    <div className="mx-auto max-w-7xl px-4">
      <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="text-center">
            <p className="font-serif text-3xl font-semibold text-gold">{stat.value}</p>
            <p className="mt-1 text-sm text-ink-onmuted">{stat.label}</p>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default TrustStrip;
