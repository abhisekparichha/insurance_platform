/** IRDAI legal names, short forms, and brand tones for all registered insurers */

export type InsurerRecord = {
  id: string;
  legalName: string;
  shortName: string;
  /** 2-letter monogram for MonogramTile */
  monogram: string;
  /** Tailwind bg class for monogram tile — uses fixed colors independent of variant */
  toneBg: string;
  toneText: string;
  website?: string;
};

export const INSURER_REGISTRY: InsurerRecord[] = [
  // ── Health Insurers ──────────────────────────────────────────────────────
  {
    id: 'care-health',
    legalName: 'Care Health Insurance Ltd',
    shortName: 'Care Health',
    monogram: 'CH',
    toneBg: 'bg-emerald-700',
    toneText: 'text-white',
  },
  {
    id: 'star-health',
    legalName: 'Star Health and Allied Insurance Co Ltd',
    shortName: 'Star Health',
    monogram: 'SH',
    toneBg: 'bg-red-700',
    toneText: 'text-white',
  },
  {
    id: 'niva-bupa',
    legalName: 'Niva Bupa Health Insurance Company Ltd',
    shortName: 'Niva Bupa',
    monogram: 'NB',
    toneBg: 'bg-blue-700',
    toneText: 'text-white',
  },
  {
    id: 'hdfc-ergo-health',
    legalName: 'HDFC ERGO General Insurance Co Ltd',
    shortName: 'HDFC ERGO',
    monogram: 'HE',
    toneBg: 'bg-indigo-700',
    toneText: 'text-white',
  },
  {
    id: 'bajaj-allianz-general',
    legalName: 'Bajaj Allianz General Insurance Co Ltd',
    shortName: 'Bajaj Allianz',
    monogram: 'BA',
    toneBg: 'bg-amber-700',
    toneText: 'text-white',
  },
  // ── Life Insurers ────────────────────────────────────────────────────────
  {
    id: 'hdfc-life',
    legalName: 'HDFC Life Insurance Company Ltd',
    shortName: 'HDFC Life',
    monogram: 'HL',
    toneBg: 'bg-sky-700',
    toneText: 'text-white',
  },
  {
    id: 'icici-prudential-life',
    legalName: 'ICICI Prudential Life Insurance Company Ltd',
    shortName: 'ICICI Prudential',
    monogram: 'IP',
    toneBg: 'bg-orange-700',
    toneText: 'text-white',
  },
  {
    id: 'max-life',
    legalName: 'Max Life Insurance Company Ltd',
    shortName: 'Max Life',
    monogram: 'ML',
    toneBg: 'bg-violet-700',
    toneText: 'text-white',
  },
  {
    id: 'sbi-life',
    legalName: 'SBI Life Insurance Company Ltd',
    shortName: 'SBI Life',
    monogram: 'SL',
    toneBg: 'bg-blue-800',
    toneText: 'text-white',
  },
  {
    id: 'lic',
    legalName: 'Life Insurance Corporation of India',
    shortName: 'LIC',
    monogram: 'LI',
    toneBg: 'bg-yellow-700',
    toneText: 'text-white',
  },
  {
    id: 'kotak-life',
    legalName: 'Kotak Mahindra Life Insurance Company Ltd',
    shortName: 'Kotak Life',
    monogram: 'KL',
    toneBg: 'bg-red-800',
    toneText: 'text-white',
  },
  // ── General Insurers ─────────────────────────────────────────────────────
  {
    id: 'tata-aig',
    legalName: 'Tata AIG General Insurance Company Ltd',
    shortName: 'Tata AIG',
    monogram: 'TA',
    toneBg: 'bg-teal-700',
    toneText: 'text-white',
  },
  {
    id: 'icici-lombard',
    legalName: 'ICICI Lombard General Insurance Co Ltd',
    shortName: 'ICICI Lombard',
    monogram: 'IL',
    toneBg: 'bg-orange-800',
    toneText: 'text-white',
  },
  {
    id: 'new-india',
    legalName: 'The New India Assurance Company Ltd',
    shortName: 'New India',
    monogram: 'NI',
    toneBg: 'bg-green-800',
    toneText: 'text-white',
  },
  {
    id: 'united-india',
    legalName: 'United India Insurance Company Ltd',
    shortName: 'United India',
    monogram: 'UI',
    toneBg: 'bg-cyan-800',
    toneText: 'text-white',
  },
  {
    id: 'oriental',
    legalName: 'Oriental Insurance Company Ltd',
    shortName: 'Oriental',
    monogram: 'OI',
    toneBg: 'bg-purple-800',
    toneText: 'text-white',
  },
  {
    id: 'national-insurance',
    legalName: 'National Insurance Company Ltd',
    shortName: 'National',
    monogram: 'NI',
    toneBg: 'bg-rose-800',
    toneText: 'text-white',
  },
  {
    id: 'reliance-general',
    legalName: 'Reliance General Insurance Company Ltd',
    shortName: 'Reliance',
    monogram: 'RG',
    toneBg: 'bg-blue-900',
    toneText: 'text-white',
  },
];

/** Look up an insurer by its ID */
export function getInsurerById(id: string): InsurerRecord | undefined {
  return INSURER_REGISTRY.find((r) => r.id === id);
}

/** Look up an insurer by its short name (case-insensitive) */
export function getInsurerByName(name: string): InsurerRecord | undefined {
  const normalized = name.toLowerCase();
  return INSURER_REGISTRY.find(
    (r) =>
      r.shortName.toLowerCase() === normalized ||
      r.legalName.toLowerCase().includes(normalized),
  );
}

/** Derive a monogram from any string (fallback if not in registry) */
export function derivedMonogram(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}
