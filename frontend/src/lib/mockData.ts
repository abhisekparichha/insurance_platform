import {
  Category,
  Insurer,
  ProductCollectionResponse,
  ProductDetail,
  ProductQuery,
  Review,
  SearchSuggestion
} from '../types';

const delay = (ms = 180) => new Promise((resolve) => setTimeout(resolve, ms));

const insurers: Insurer[] = [
  { id: 'care-health', name: 'Care Health Insurance Ltd', rating: 4.6, totalProducts: 7 },
  { id: 'star-health', name: 'Star Health and Allied Insurance Co Ltd', rating: 4.4, totalProducts: 6 },
  { id: 'niva-bupa', name: 'Niva Bupa Health Insurance Company Ltd', rating: 4.5, totalProducts: 5 },
  { id: 'hdfc-ergo', name: 'HDFC ERGO General Insurance Co Ltd', rating: 4.3, totalProducts: 8 },
  { id: 'bajaj-allianz-general', name: 'Bajaj Allianz General Insurance Co Ltd', rating: 4.2, totalProducts: 9 },
  { id: 'hdfc-life', name: 'HDFC Life Insurance Company Ltd', rating: 4.8, totalProducts: 5 },
  { id: 'icici-prudential-life', name: 'ICICI Prudential Life Insurance Company Ltd', rating: 4.6, totalProducts: 6 },
  { id: 'max-life', name: 'Max Life Insurance Company Ltd', rating: 4.5, totalProducts: 4 },
  { id: 'sbi-life', name: 'SBI Life Insurance Company Ltd', rating: 4.3, totalProducts: 5 },
  { id: 'lic', name: 'Life Insurance Corporation of India', rating: 4.1, totalProducts: 12 },
  { id: 'tata-aig', name: 'Tata AIG General Insurance Company Ltd', rating: 4.5, totalProducts: 7 },
  { id: 'icici-lombard', name: 'ICICI Lombard General Insurance Co Ltd', rating: 4.4, totalProducts: 8 },
  { id: 'new-india', name: 'The New India Assurance Company Ltd', rating: 4.0, totalProducts: 10 },
  { id: 'oriental', name: 'Oriental Insurance Company Ltd', rating: 3.9, totalProducts: 7 },
  { id: 'reliance-general', name: 'Reliance General Insurance Company Ltd', rating: 3.8, totalProducts: 5 },
];

const categories: Category[] = [
  { id: 'health_base', label: 'Retail Health', icon: 'Stethoscope', productCount: 0 },
  { id: 'health_topup', label: 'Top-up Plans', icon: 'Shield', productCount: 0 },
  { id: 'life_term', label: 'Term Life', icon: 'LifeBuoy', productCount: 0 },
  { id: 'life_savings', label: 'Savings / Endowment', icon: 'PiggyBank', productCount: 0 },
  { id: 'motor_pvt_car', label: 'Private Car', icon: 'Car', productCount: 0 },
  { id: 'motor_two_wheeler', label: 'Two Wheeler', icon: 'Bike', productCount: 0 },
  { id: 'travel', label: 'Travel', icon: 'Plane', productCount: 0 },
  { id: 'fire', label: 'Fire & Perils', icon: 'Flame', productCount: 0 },
  { id: 'home', label: 'Home Insurance', icon: 'Home', productCount: 0 },
];

const reviewPool: Record<string, Review[]> = {
  'care-shield': [
    {
      id: 'care-review-1',
      rating: 5,
      title: 'Zero room rent anxiety',
      content: 'Cashless approvals in <24h and policy wording is very clear about room upgrades.',
      author: 'Minal P.',
      createdAt: '2024-12-01'
    },
    {
      id: 'care-review-2',
      rating: 4,
      title: 'Great for families',
      content: 'Restoration kicks in automatically and OPD benefits are easy to claim.',
      author: 'S. Krishnan',
      createdAt: '2024-11-18'
    }
  ],
  'care-elevate': [
    {
      id: 'care-elevate-review-1',
      rating: 4,
      title: 'Solid top-up',
      content: 'Deductible flexibility plus global care add-on works for travel.',
      author: 'Neha R',
      createdAt: '2024-10-05'
    }
  ],
  'star-supreme': [
    {
      id: 'star-review-1',
      rating: 3,
      title: 'Need better digital journey',
      content: 'Policy is comprehensive but PDF is 180 pages without anchors.',
      author: 'Vikram C',
      createdAt: '2024-08-22'
    }
  ],
  'hdfc-life-protect': [
    {
      id: 'hdfc-review-1',
      rating: 5,
      title: 'Transparent term cover',
      content: 'Medical questionnaire mapped 1:1 with underwriting notes in policy wording.',
      author: 'Rashmi B',
      createdAt: '2024-07-12'
    }
  ]
};

const basePolicySections = [
  {
    id: 'coverage',
    title: 'Coverage Highlights',
    content:
      'Covers hospitalization, day-care, domiciliary, ambulance, and wellness benefits. Includes hospital cash with no room rent sub-limits and modern treatment coverage.',
    anchors: [
      { id: 'coverage-hospital', label: 'Hospitalization' },
      { id: 'coverage-daycare', label: 'Day care' },
      { id: 'coverage-modern', label: 'Modern medicine' }
    ]
  },
  {
    id: 'exclusions',
    title: 'Key Exclusions',
    content:
      'First 30 days waiting period, specific 2/4-year waiting periods, and permanent exclusions for cosmetic, fertility, and experimental treatments. Full list available in Annexure II.',
    anchors: [
      { id: 'exclusion-waiting', label: 'Waiting periods' },
      { id: 'exclusion-permanent', label: 'Permanent exclusions' }
    ]
  }
];

const baseScorecard = [
  {
    id: 'co-pay',
    label: 'Co-pay & Room Rent',
    status: 'excellent',
    summary: 'Zero co-pay, no room rent capping for sum insured above ₹5L.',
    weight: 0.25
  },
  {
    id: 'claims',
    label: 'Claims & TAT',
    status: 'good',
    summary: 'Average cashless approval time of 2.5 hours, 93% settlement ratio.',
    weight: 0.2
  },
  {
    id: 'wellness',
    label: 'Wellness & OPD',
    status: 'warning',
    summary: 'OPD wallet capped at ₹1,500 per year. Works best as supplement.',
    weight: 0.15
  }
] as const;

type ProductSeed = ProductDetail;

const productSeeds: ProductSeed[] = [
  {
    id: 'care-shield',
    name: 'Care Shield',
    insurer: 'Care Health Insurance Ltd',
    rating: 4.7,
    priceFrom: 842,
    coverageType: 'base-plan',
    coverageAmount: '₹10L - ₹1Cr',
    tags: ['no-room-rent', 'restoration', 'wellness'],
    categoryId: 'health_base',
    policyExcerpt:
      'Unlimited restoration, zero co-pay, and guaranteed single private room eligibility across metro hospitals.',
    policyDocumentUrl: 'https://example.com/documents/care-shield-wording.pdf',
    highlights: ['Unlimited restoration', 'OPD wallet', 'Wellness coach'],
    description:
      'Care Shield is a flagship retail health product with automatic sum insured restoration, global treatment add-ons, and wellness touch points for chronic care.',
    benefits: [
      'Automatic restoration of 100% sum insured up to 3 times',
      'Unlimited teleport doctor consultations',
      'Wellness rewards that convert to premium discounts'
    ],
    policyWording:
      'Section 1. Coverage: Hospitalization, day care, home care, ambulance cover. Section 2. Optional add-ons include global treatment, maternity, and OPD wallet. Full wording anchored for digital navigation.',
    policySections: basePolicySections,
    documents: [
      { id: 'doc-1', label: 'Policy Wordings', url: 'https://example.com/documents/care-shield-wording.pdf', type: 'wording' },
      { id: 'doc-2', label: 'Customer Brochure', url: 'https://example.com/documents/care-shield-brochure.pdf', type: 'brochure' }
    ],
    reviews: reviewPool['care-shield'],
    scorecard: baseScorecard.map((score, index) => ({ ...score, id: `${score.id}-${index}` }))
  },
  {
    id: 'care-elevate',
    name: 'Care Elevate Super Top-up',
    insurer: 'Care Health Insurance Ltd',
    rating: 4.4,
    priceFrom: 312,
    coverageType: 'topup-plan',
    coverageAmount: '₹25L - ₹1Cr',
    tags: ['global', 'deductible-flex'],
    categoryId: 'health_topup',
    policyExcerpt:
      'Pick your deductible and unlock global hospitalization benefits with clear policy wording on exclusions.',
    policyDocumentUrl: 'https://example.com/documents/care-elevate-wording.pdf',
    highlights: ['Flexible deductible', 'Global OPD add-on'],
    description:
      'Care Elevate is a high-sum-insured super top-up with deductible combinations designed for employer + retail stacking.',
    benefits: ['Deductible choices from ₹1L to ₹10L', 'Optional global hospitalization add-on'],
    policyWording:
      'Policy sections mapped to deductible tables, claim examples, and portability notes to avoid surprises when stacking coverage.',
    policySections: basePolicySections,
    documents: [
      { id: 'doc-3', label: 'Policy Wordings', url: 'https://example.com/documents/care-elevate-wording.pdf', type: 'wording' }
    ],
    reviews: reviewPool['care-elevate'],
    scorecard: [
      {
        id: 'deductible-flex',
        label: 'Deductible Flexibility',
        status: 'excellent',
        summary: '9 deductible bands and ability to change on renewal with re-underwriting.',
        weight: 0.3
      },
      ...baseScorecard.filter((score) => score.id !== 'wellness')
    ]
  },
  {
    id: 'star-supreme',
    name: 'Star Health Supreme',
    insurer: 'Star Health and Allied Insurance Co Ltd',
    rating: 4.1,
    priceFrom: 690,
    coverageType: 'base-plan',
    coverageAmount: '₹5L - ₹50L',
    tags: ['hospital-cash', 'maternity'],
    categoryId: 'health_base',
    policyExcerpt:
      'Enhanced hospital cash, modern treatment coverage, and wellness upgrades with detailed annexures.',
    policyDocumentUrl: 'https://example.com/documents/star-supreme-wording.pdf',
    highlights: ['Hospital cash', 'Wellness boosters'],
    description:
      'Star Supreme packs maternity, newborn, and hospital cash benefits with smart triggers for chronic care.',
    benefits: ['Hospital cash up to ₹5K/day', 'Modern treatment coverage'],
    policyWording:
      'Detailed 180-page wording with annexures per benefit bucket and QR anchored glossary for quick lookup.',
    policySections: basePolicySections,
    documents: [
      { id: 'doc-4', label: 'Policy Wordings', url: 'https://example.com/documents/star-supreme-wording.pdf', type: 'wording' }
    ],
    reviews: reviewPool['star-supreme'],
    scorecard: baseScorecard
  },
  {
    id: 'hdfc-life-protect',
    name: 'HDFC Life Protect 3D Plus',
    insurer: 'HDFC Life Insurance Company Ltd',
    rating: 4.9,
    priceFrom: 512,
    coverageType: 'term-plan',
    coverageAmount: '₹50L - ₹5Cr',
    tags: ['term', 'critical-illness'],
    categoryId: 'life_term',
    policyExcerpt:
      'Term plan with whole-life and limited pay options plus clearly-articulated rider wording.',
    policyDocumentUrl: 'https://example.com/documents/hdfc-life-protect.pdf',
    highlights: ['3D rider', 'Whole-life option'],
    description:
      'Term cover with rider stack (critical illness, accidental, waiver) and policy wording referencing scoring cues.',
    benefits: ['Whole-life coverage option', '3D rider covering 36 illnesses'],
    policyWording:
      'Policy includes annexures for underwriting, section-level anchors, and definitions mapped to regulatory clauses.',
    policySections: basePolicySections,
    documents: [
      { id: 'doc-5', label: 'Policy Wordings', url: 'https://example.com/documents/hdfc-life-protect.pdf', type: 'wording' }
    ],
    reviews: reviewPool['hdfc-life-protect'],
    scorecard: baseScorecard
  }
];

// ── Additional product seeds (Phases 5-8) ────────────────────────────────

const additionalSeeds: ProductSeed[] = [
  // ── Health Base ─────────────────────────────────────────────────────────
  {
    id: 'niva-bupa-reassure',
    name: 'Niva Bupa ReAssure 2.0',
    insurer: 'Niva Bupa Health Insurance Company Ltd',
    rating: 4.6,
    priceFrom: 780,
    coverageType: 'base-plan',
    coverageAmount: '₹5L - ₹1Cr',
    tags: ['unlimited-restoration', 'no-room-rent', 'direct-claim'],
    categoryId: 'health_base',
    policyExcerpt: 'Unlimited restoration with no sub-limits, direct claim settlement and pan-India cashless network across 10,000+ hospitals.',
    policyDocumentUrl: 'https://example.com/documents/niva-bupa-reassure.pdf',
    highlights: ['Unlimited restoration', 'No room rent cap', 'Direct claim by insurer'],
    description: 'ReAssure 2.0 sets the benchmark for cashless approvals with a 30-minute guarantee on pre-auth and pan-India network coverage.',
    benefits: ['Unlimited restoration of SI on any illness', 'Cashless pre-authorisation in 30 minutes', 'OPD tele-consultations included', 'Annual health check-up covered'],
    policyWording: 'Section A: In-patient Hospitalisation. Section B: Pre & Post Hospitalisation (60/180 days). Section C: Day Care Procedures. Section D: Restoration Benefit. Section E: Wellness Program.',
    policySections: basePolicySections,
    documents: [{ id: 'doc-nb-1', label: 'Policy Wordings', url: 'https://example.com/documents/niva-bupa-reassure.pdf', type: 'wording' }],
    reviews: [{ id: 'nb-r1', rating: 5, title: 'Fastest cashless I have seen', content: 'Pre-auth for planned surgery came in under 20 minutes at a tier-2 city hospital.', author: 'Rohit M.', createdAt: '2024-09-12' }],
    scorecard: [...baseScorecard],
  },
  {
    id: 'hdfc-ergo-optima',
    name: 'HDFC ERGO Optima Restore',
    insurer: 'HDFC ERGO General Insurance Co Ltd',
    rating: 4.3,
    priceFrom: 650,
    coverageType: 'base-plan',
    coverageAmount: '₹3L - ₹50L',
    tags: ['restore', 'multiplier', 'wellness'],
    categoryId: 'health_base',
    policyExcerpt: 'Automatic restore of 100% SI once per policy year plus a multiplier benefit doubling cover by year 2.',
    policyDocumentUrl: 'https://example.com/documents/hdfc-ergo-optima.pdf',
    highlights: ['Auto restore', 'Cover multiplier', 'Wellness rewards'],
    description: 'Optima Restore combines a guaranteed multiplier with automatic restoration, making it a value pick for long-term policyholders.',
    benefits: ['100% SI restored once per year', 'Cover doubles by second renewal', 'Wellness programme with OPD discounts'],
    policyWording: 'Restore Benefit triggers after any single claim exhausts 100% of sum insured. Multiplier adds 50% per claim-free year, capped at 100%.',
    policySections: basePolicySections,
    documents: [{ id: 'doc-he-1', label: 'Policy Wordings', url: 'https://example.com/documents/hdfc-ergo-optima.pdf', type: 'wording' }],
    reviews: [{ id: 'he-r1', rating: 4, title: 'Good multiplier benefit', content: 'Second year cover doubled automatically. Claims process needs improvement.', author: 'Anjali S.', createdAt: '2024-08-05' }],
    scorecard: [...baseScorecard],
  },
  {
    id: 'bajaj-health-guard',
    name: 'Bajaj Allianz Health Guard',
    insurer: 'Bajaj Allianz General Insurance Co Ltd',
    rating: 4.0,
    priceFrom: 540,
    coverageType: 'base-plan',
    coverageAmount: '₹1.5L - ₹50L',
    tags: ['affordable', 'family-floater', 'maternity'],
    categoryId: 'health_base',
    policyExcerpt: 'Budget-friendly family floater with maternity cover and organ donor expenses included from year one.',
    policyDocumentUrl: 'https://example.com/documents/bajaj-health-guard.pdf',
    highlights: ['Maternity cover', 'Organ donor expenses', 'Family floater'],
    description: 'Health Guard is the entry-level floater from Bajaj Allianz, suited for first-time buyers seeking broad coverage at competitive premiums.',
    benefits: ['Maternity cover after 2-year waiting period', 'Organ donor treatment covered', 'Ambulance up to ₹2,500 per trip'],
    policyWording: 'Family floater basis. SI applies to entire family per policy year. Room rent capped at 1% of SI per day.',
    policySections: basePolicySections,
    documents: [{ id: 'doc-baj-1', label: 'Policy Wordings', url: 'https://example.com/documents/bajaj-health-guard.pdf', type: 'wording' }],
    reviews: [{ id: 'baj-r1', rating: 3, title: 'Room rent cap is restrictive', content: 'Policy is affordable but 1% room rent cap caused out-of-pocket expenses.', author: 'Deepak R.', createdAt: '2024-07-20' }],
    scorecard: [...baseScorecard],
  },
  // ── Health Top-up ────────────────────────────────────────────────────────
  {
    id: 'star-extra-protect',
    name: 'Star Extra Protect Add-on',
    insurer: 'Star Health and Allied Insurance Co Ltd',
    rating: 4.2,
    priceFrom: 280,
    coverageType: 'topup-plan',
    coverageAmount: '₹5L - ₹25L deductible options',
    tags: ['super-topup', 'affordable', 'aggregate-deductible'],
    categoryId: 'health_topup',
    policyExcerpt: 'Aggregate deductible super top-up that pools multiple hospitalisation claims before the deductible kicks in.',
    policyDocumentUrl: 'https://example.com/documents/star-extra-protect.pdf',
    highlights: ['Aggregate deductible', 'Multiple claim coverage', 'Low premium'],
    description: 'Extra Protect uses an aggregate deductible model so multiple smaller claims during the policy year collectively exhaust the deductible.',
    benefits: ['Aggregate deductible over policy year', 'Cover above ₹3L deductible', 'Works with employer group cover'],
    policyWording: 'Deductible is aggregate for all hospitalisation claims in a policy year. Policy triggers once aggregate exceeds chosen deductible amount.',
    policySections: basePolicySections,
    documents: [{ id: 'doc-sep-1', label: 'Policy Wordings', url: 'https://example.com/documents/star-extra-protect.pdf', type: 'wording' }],
    reviews: [{ id: 'sep-r1', rating: 4, title: 'Smart top-up structure', content: 'Aggregate deductible made more sense given my frequent minor hospitalisations.', author: 'Priya K.', createdAt: '2024-11-01' }],
    scorecard: baseScorecard.filter((s) => s.id !== 'wellness'),
  },
  // ── Life Term ────────────────────────────────────────────────────────────
  {
    id: 'icici-iprotect',
    name: 'ICICI Prudential iProtect Smart',
    insurer: 'ICICI Prudential Life Insurance Company Ltd',
    rating: 4.7,
    priceFrom: 480,
    coverageType: 'term-plan',
    coverageAmount: '₹50L - ₹10Cr',
    tags: ['term', 'critical-illness', 'waiver'],
    categoryId: 'life_term',
    policyExcerpt: 'Comprehensive term plan with optional accidental death benefit, critical illness payout and premium waiver riders.',
    policyDocumentUrl: 'https://example.com/documents/icici-iprotect.pdf',
    highlights: ['34 critical illnesses', 'Premium waiver', 'Accidental death benefit'],
    description: 'iProtect Smart bundles life cover with critical illness, accidental disability and premium waiver at competitive online rates.',
    benefits: ['34 critical illnesses lump sum payout', 'Premium waiver on CI or disability', 'Accidental total permanent disability cover', 'Return of premium variant available'],
    policyWording: 'Section 1: Death Benefit. Section 2: Critical Illness Rider (34 conditions listed in Annexure). Section 3: Accidental Death Benefit Rider. Section 4: Premium Waiver Rider.',
    policySections: basePolicySections,
    documents: [{ id: 'doc-ip-1', label: 'Policy Wordings', url: 'https://example.com/documents/icici-iprotect.pdf', type: 'wording' }],
    reviews: [
      { id: 'ip-r1', rating: 5, title: 'Very clear claim process', content: 'Claim settlement was seamless. Documents listed clearly in policy.', author: 'Kavitha N.', createdAt: '2024-10-14' },
      { id: 'ip-r2', rating: 4, title: 'Good rider options', content: 'Bundling CI rider made sense for my age. Underwriting was quick online.', author: 'Arjun T.', createdAt: '2024-09-28' },
    ],
    scorecard: [...baseScorecard],
  },
  {
    id: 'max-life-smart',
    name: 'Max Life Smart Secure Plus',
    insurer: 'Max Life Insurance Company Ltd',
    rating: 4.5,
    priceFrom: 420,
    coverageType: 'term-plan',
    coverageAmount: '₹25L - ₹5Cr',
    tags: ['term', 'whole-life-option', 'joint-life'],
    categoryId: 'life_term',
    policyExcerpt: 'Flexible term plan with joint life cover, optional whole-life payout and critical illness add-on.',
    policyDocumentUrl: 'https://example.com/documents/max-life-smart.pdf',
    highlights: ['Joint life cover', 'Whole-life option', 'Critical illness add-on'],
    description: 'Smart Secure Plus is a versatile term plan enabling couples to cover both lives under one policy with a seamless joint-life claim payout.',
    benefits: ['Joint life cover for spouses', 'Whole-life maturity payout option', 'Critical illness lump sum', 'Monthly income variant'],
    policyWording: 'Joint life payout: first death triggers the benefit. Survivor can opt for extended cover or lump sum settlement.',
    policySections: basePolicySections,
    documents: [{ id: 'doc-ml-1', label: 'Policy Wordings', url: 'https://example.com/documents/max-life-smart.pdf', type: 'wording' }],
    reviews: [{ id: 'ml-r1', rating: 5, title: 'Joint life is a great feature', content: 'Covering my wife and myself on one policy saved premium compared to two separate policies.', author: 'Sachin V.', createdAt: '2024-08-18' }],
    scorecard: [...baseScorecard],
  },
  {
    id: 'sbi-eshield',
    name: 'SBI Life eShield Next',
    insurer: 'SBI Life Insurance Company Ltd',
    rating: 4.2,
    priceFrom: 390,
    coverageType: 'term-plan',
    coverageAmount: '₹50L - ₹5Cr',
    tags: ['term', 'increasing-cover', 'level-cover'],
    categoryId: 'life_term',
    policyExcerpt: 'Online term plan with level or increasing sum assured option and spouse cover via endorsement.',
    policyDocumentUrl: 'https://example.com/documents/sbi-eshield.pdf',
    highlights: ['Increasing cover option', 'Spouse add-on', 'Online discounts'],
    description: 'eShield Next is SBI Life\'s flagship digital term plan with a uniquely flexible cover structure and attractive online premiums.',
    benefits: ['Level or increasing sum assured', 'Increasing option: 5% per year', 'Spouse cover via endorsement', 'Accidental death benefit rider'],
    policyWording: 'Cover increases at 5% simple rate per year under the Increasing Cover option, capped at 200% of original SI.',
    policySections: basePolicySections,
    documents: [{ id: 'doc-sbi-1', label: 'Policy Wordings', url: 'https://example.com/documents/sbi-eshield.pdf', type: 'wording' }],
    reviews: [{ id: 'sbi-r1', rating: 4, title: 'Increasing cover is logical', content: 'As my liabilities grow, so does my cover. Really simple to understand.', author: 'Meena P.', createdAt: '2024-07-05' }],
    scorecard: [...baseScorecard],
  },
  // ── Life Savings ─────────────────────────────────────────────────────────
  {
    id: 'lic-jeevan-anand',
    name: 'LIC Jeevan Anand',
    insurer: 'Life Insurance Corporation of India',
    rating: 4.0,
    priceFrom: 1240,
    coverageType: 'endowment-plan',
    coverageAmount: '₹2L - ₹20L',
    tags: ['endowment', 'bonus', 'whole-life'],
    categoryId: 'life_savings',
    policyExcerpt: 'Traditional participating endowment with guaranteed death benefit equal to sum assured throughout life, plus accrued bonuses.',
    policyDocumentUrl: 'https://example.com/documents/lic-jeevan-anand.pdf',
    highlights: ['Whole-life death benefit', 'Participating bonuses', 'Loan facility'],
    description: 'Jeevan Anand combines the savings discipline of an endowment with a whole-life death benefit, popular for legacy and estate planning.',
    benefits: ['Sum assured + bonuses on maturity', 'Whole-life cover after maturity', 'Loan against policy after 3 years', 'Accident benefit rider available'],
    policyWording: 'On maturity, sum assured + accumulated bonuses paid. Death benefit equals sum assured throughout the insured\'s lifetime regardless of maturity.',
    policySections: basePolicySections,
    documents: [{ id: 'doc-lic-1', label: 'Policy Wordings', url: 'https://example.com/documents/lic-jeevan-anand.pdf', type: 'wording' }],
    reviews: [{ id: 'lic-r1', rating: 4, title: 'Reliable and trusted', content: 'Returns are modest but the trust in LIC brand is unmatched in my family.', author: 'Lakshmi G.', createdAt: '2024-06-22' }],
    scorecard: [...baseScorecard],
  },
  // ── Motor Private Car ────────────────────────────────────────────────────
  {
    id: 'bajaj-car-comprehensive',
    name: 'Bajaj Allianz Comprehensive Car',
    insurer: 'Bajaj Allianz General Insurance Co Ltd',
    rating: 4.3,
    priceFrom: 820,
    coverageType: 'motor-comprehensive',
    coverageAmount: 'IDV-based',
    tags: ['zero-depreciation', 'engine-protection', 'roadside-assist'],
    categoryId: 'motor_pvt_car',
    policyExcerpt: 'Comprehensive motor policy with zero-depreciation add-on, engine protection and 24x7 roadside assistance.',
    policyDocumentUrl: 'https://example.com/documents/bajaj-car.pdf',
    highlights: ['Zero depreciation', 'Engine protection', '24x7 RSA'],
    description: 'Bajaj Allianz comprehensive car insurance bundles essential add-ons at competitive premiums with a wide network of cashless garages.',
    benefits: ['Zero depreciation on parts', 'Engine and gearbox protection', '24x7 roadside assistance', 'Return to invoice cover available'],
    policyWording: 'Own damage covers loss or damage to insured vehicle. Third-party liability as per Motor Vehicles Act. Add-on covers detailed in endorsements.',
    policySections: basePolicySections,
    documents: [{ id: 'doc-bajcar-1', label: 'Policy Wordings', url: 'https://example.com/documents/bajaj-car.pdf', type: 'wording' }],
    reviews: [{ id: 'bajcar-r1', rating: 4, title: 'Quick claim settlement', content: 'Cashless claim at authorised garage was hassle-free. No delays.', author: 'Rahul B.', createdAt: '2024-10-08' }],
    scorecard: [...baseScorecard],
  },
  {
    id: 'icici-lombard-car',
    name: 'ICICI Lombard Private Car',
    insurer: 'ICICI Lombard General Insurance Co Ltd',
    rating: 4.4,
    priceFrom: 870,
    coverageType: 'motor-comprehensive',
    coverageAmount: 'IDV-based',
    tags: ['instant-policy', 'digital-inspection', 'cashless-garages'],
    categoryId: 'motor_pvt_car',
    policyExcerpt: 'Instant digital car insurance with self-inspection option and access to 12,000+ cashless garages nationwide.',
    policyDocumentUrl: 'https://example.com/documents/icici-lombard-car.pdf',
    highlights: ['Self-inspection', '12,000+ garages', 'Instant policy'],
    description: 'ICICI Lombard private car policy features a fully digital journey including self-inspection for quick issuance and broad add-on choice.',
    benefits: ['Self-inspection for instant cover', 'Spot claim settlement via app', 'Consumable cover add-on', 'Personal accident cover for passengers'],
    policyWording: 'Inspection via mobile app. Claim intimation within 24 hours mandatory. IDV is agreed value at inception subject to depreciation schedule.',
    policySections: basePolicySections,
    documents: [{ id: 'doc-ilcar-1', label: 'Policy Wordings', url: 'https://example.com/documents/icici-lombard-car.pdf', type: 'wording' }],
    reviews: [{ id: 'ilcar-r1', rating: 5, title: 'App experience is great', content: 'Self-inspection and instant policy issuance made renewing effortless.', author: 'Pooja M.', createdAt: '2024-09-03' }],
    scorecard: [...baseScorecard],
  },
  {
    id: 'tata-aig-car',
    name: 'Tata AIG Comprehensive Car',
    insurer: 'Tata AIG General Insurance Company Ltd',
    rating: 4.2,
    priceFrom: 800,
    coverageType: 'motor-comprehensive',
    coverageAmount: 'IDV-based',
    tags: ['new-car-replacement', 'daily-allowance', 'zero-dep'],
    categoryId: 'motor_pvt_car',
    policyExcerpt: 'Tata AIG car policy with new car replacement benefit for total loss within first year and daily car allowance.',
    policyDocumentUrl: 'https://example.com/documents/tata-aig-car.pdf',
    highlights: ['New car replacement', 'Daily allowance', 'Zero dep'],
    description: 'Tata AIG comprehensive car insurance offers new vehicle replacement for total-loss claims in the first policy year and wide add-on selection.',
    benefits: ['New car replacement for year-1 total loss', 'Daily transportation allowance', 'Consumable cover', 'Zero depreciation optional'],
    policyWording: 'Total Loss definition: repair cost exceeds 75% of IDV. New vehicle replacement triggers if total loss declared within 12 months of first registration.',
    policySections: basePolicySections,
    documents: [{ id: 'doc-tacar-1', label: 'Policy Wordings', url: 'https://example.com/documents/tata-aig-car.pdf', type: 'wording' }],
    reviews: [{ id: 'tacar-r1', rating: 4, title: 'New car replacement valuable', content: 'Total loss claim was handled well and new vehicle replacement was honoured promptly.', author: 'Vivek C.', createdAt: '2024-08-14' }],
    scorecard: [...baseScorecard],
  },
  // ── Motor Two Wheeler ─────────────────────────────────────────────────────
  {
    id: 'hdfc-ergo-bike',
    name: 'HDFC ERGO Two Wheeler',
    insurer: 'HDFC ERGO General Insurance Co Ltd',
    rating: 4.1,
    priceFrom: 380,
    coverageType: 'motor-comprehensive',
    coverageAmount: 'IDV-based',
    tags: ['two-wheeler', 'zero-dep', 'pa-cover'],
    categoryId: 'motor_two_wheeler',
    policyExcerpt: 'Two-wheeler comprehensive policy with zero depreciation, personal accident cover and 24x7 roadside assistance.',
    policyDocumentUrl: 'https://example.com/documents/hdfc-ergo-bike.pdf',
    highlights: ['Zero depreciation', 'PA cover', 'Roadside assistance'],
    description: 'HDFC ERGO two-wheeler insurance covers both own damage and third-party liability with a digital-first claim experience.',
    benefits: ['Zero depreciation on plastic and rubber parts', 'Personal accident cover ₹15L', 'Roadside assistance 24x7', 'EMI protection cover'],
    policyWording: 'Two-wheeler IDV depreciation schedule applies. Zero dep endorsement removes depreciation deduction on parts claims.',
    policySections: basePolicySections,
    documents: [{ id: 'doc-hebike-1', label: 'Policy Wordings', url: 'https://example.com/documents/hdfc-ergo-bike.pdf', type: 'wording' }],
    reviews: [{ id: 'hebike-r1', rating: 4, title: 'Good for daily commuters', content: 'Roadside assistance saved me twice this year. Worth every rupee.', author: 'Rajan T.', createdAt: '2024-07-30' }],
    scorecard: [...baseScorecard],
  },
  // ── Travel ───────────────────────────────────────────────────────────────
  {
    id: 'icici-travel-intl',
    name: 'ICICI Lombard International Travel',
    insurer: 'ICICI Lombard General Insurance Co Ltd',
    rating: 4.4,
    priceFrom: 210,
    coverageType: 'travel-plan',
    coverageAmount: 'USD 100,000 medical',
    tags: ['international', 'medical-evac', 'trip-cancellation'],
    categoryId: 'travel',
    policyExcerpt: 'International travel insurance with USD 100,000 medical cover, medical evacuation and trip cancellation benefits.',
    policyDocumentUrl: 'https://example.com/documents/icici-travel.pdf',
    highlights: ['USD 100K medical', 'Trip cancellation', 'Medical evacuation'],
    description: 'ICICI Lombard international travel plan covers emergency hospitalisation abroad, evacuation and trip interruption in one compact policy.',
    benefits: ['Emergency hospitalisation up to USD 100,000', 'Medical evacuation and repatriation', 'Trip cancellation and curtailment', 'Baggage loss and delay cover'],
    policyWording: 'Pre-existing conditions excluded unless specifically endorsed. Trip cancellation triggers on illness, death of immediate family or natural disaster.',
    policySections: basePolicySections,
    documents: [{ id: 'doc-ilt-1', label: 'Policy Wordings', url: 'https://example.com/documents/icici-travel.pdf', type: 'wording' }],
    reviews: [{ id: 'ilt-r1', rating: 5, title: 'Cashless at Dubai hospital', content: 'Got cashless treatment at a Dubai hospital. ICICI team was very responsive.', author: 'Sneha R.', createdAt: '2024-11-15' }],
    scorecard: [...baseScorecard],
  },
  {
    id: 'bajaj-travel-elite',
    name: 'Bajaj Allianz Travel Elite',
    insurer: 'Bajaj Allianz General Insurance Co Ltd',
    rating: 4.1,
    priceFrom: 180,
    coverageType: 'travel-plan',
    coverageAmount: 'USD 100,000 medical',
    tags: ['international', 'adventure-sports', 'student-cover'],
    categoryId: 'travel',
    policyExcerpt: 'Travel Elite includes adventure sports cover and a student variant for those studying abroad up to one year.',
    policyDocumentUrl: 'https://example.com/documents/bajaj-travel.pdf',
    highlights: ['Adventure sports cover', 'Student variant', 'Schengen compliant'],
    description: 'Bajaj Allianz Travel Elite is ideal for active travellers and students with adventure sports coverage and Schengen visa compliance.',
    benefits: ['Adventure sports accident cover', 'Student plan up to 365 days', 'Schengen visa compliance', 'Emergency cash advance'],
    policyWording: 'Adventure sports cover excludes motor sports, extreme altitude activities above 6,500m, and professional sports.',
    policySections: basePolicySections,
    documents: [{ id: 'doc-bjt-1', label: 'Policy Wordings', url: 'https://example.com/documents/bajaj-travel.pdf', type: 'wording' }],
    reviews: [{ id: 'bjt-r1', rating: 4, title: 'Adventure sports covered', content: 'Trekking in Nepal was covered. Policy wording was clear on what counts as adventure.', author: 'Aditya P.', createdAt: '2024-10-22' }],
    scorecard: [...baseScorecard],
  },
  // ── Fire ──────────────────────────────────────────────────────────────────
  {
    id: 'new-india-fire',
    name: 'New India Standard Fire Policy',
    insurer: 'The New India Assurance Company Ltd',
    rating: 3.9,
    priceFrom: 1200,
    coverageType: 'fire-policy',
    coverageAmount: 'As per declared value',
    tags: ['fire', 'perils', 'reinstatement'],
    categoryId: 'fire',
    policyExcerpt: 'Standard Fire and Special Perils policy covering buildings and contents against fire, lightning, explosions and allied perils.',
    policyDocumentUrl: 'https://example.com/documents/new-india-fire.pdf',
    highlights: ['All standard perils', 'Reinstatement value', 'Business interruption add-on'],
    description: 'New India Standard Fire policy follows IRDAI\'s Standard Fire and Special Perils tariff covering 11 named perils with reinstatement value basis.',
    benefits: ['Fire, lightning, explosion cover', 'Flood and inundation cover', 'Riot, strike, malicious damage', 'Reinstatement value basis available'],
    policyWording: '11 standard perils covered: fire, lightning, explosion/implosion, aircraft damage, riot, storm/tempest/flood/inundation/hurricane/cyclone/typhoon/tornado, impact, subsidence, bursting/overflowing water tanks, missile testing, bush fire.',
    policySections: basePolicySections,
    documents: [{ id: 'doc-nif-1', label: 'Policy Wordings', url: 'https://example.com/documents/new-india-fire.pdf', type: 'wording' }],
    reviews: [{ id: 'nif-r1', rating: 4, title: 'Reliable PSU insurer', content: 'Claim was settled at reinstatement value without dispute. Good experience.', author: 'Prakash A.', createdAt: '2024-06-10' }],
    scorecard: [...baseScorecard],
  },
  {
    id: 'oriental-fire',
    name: 'Oriental Standard Fire & Special Perils',
    insurer: 'Oriental Insurance Company Ltd',
    rating: 3.8,
    priceFrom: 1100,
    coverageType: 'fire-policy',
    coverageAmount: 'As per declared value',
    tags: ['fire', 'earthquake-add-on', 'industrial'],
    categoryId: 'fire',
    policyExcerpt: 'Oriental Fire policy with optional earthquake cover and industrial risk endorsements for commercial properties.',
    policyDocumentUrl: 'https://example.com/documents/oriental-fire.pdf',
    highlights: ['Earthquake add-on', 'Industrial endorsements', 'Consequential loss cover'],
    description: 'Oriental Insurance Standard Fire policy offers comprehensive peril cover for industrial and commercial properties with flexible endorsement options.',
    benefits: ['Standard 11 perils covered', 'Earthquake cover by endorsement', 'Machinery breakdown floater option', 'Business interruption extension'],
    policyWording: 'Earthquake cover available as add-on at additional premium. Industrial risks subject to inspection and survey report.',
    policySections: basePolicySections,
    documents: [{ id: 'doc-orif-1', label: 'Policy Wordings', url: 'https://example.com/documents/oriental-fire.pdf', type: 'wording' }],
    reviews: [{ id: 'orif-r1', rating: 3, title: 'Claim process slow', content: 'Coverage is comprehensive but the claim process took 3 months.', author: 'Suresh K.', createdAt: '2024-05-14' }],
    scorecard: [...baseScorecard],
  },
  // ── Home ─────────────────────────────────────────────────────────────────
  {
    id: 'reliance-home-protect',
    name: 'Reliance Home ProtectPlus',
    insurer: 'Reliance General Insurance Company Ltd',
    rating: 3.9,
    priceFrom: 950,
    coverageType: 'home-policy',
    coverageAmount: 'Building + contents declared value',
    tags: ['home', 'contents', 'burglary', 'electronic-equipment'],
    categoryId: 'home',
    policyExcerpt: 'Comprehensive home insurance covering structure and contents including burglary, electronic equipment and personal accident.',
    policyDocumentUrl: 'https://example.com/documents/reliance-home.pdf',
    highlights: ['Structure + contents', 'Burglary cover', 'Electronic equipment'],
    description: 'Reliance Home ProtectPlus covers your home comprehensively — from structural damage to contents theft — under a single annual premium.',
    benefits: ['Building structure cover', 'Contents including valuables', 'Burglary and housebreaking cover', 'Electronic equipment all-risk cover'],
    policyWording: 'Building cover on reinstatement basis. Contents at market value at time of loss. Valuables subject to separate declaration and limit.',
    policySections: basePolicySections,
    documents: [{ id: 'doc-rh-1', label: 'Policy Wordings', url: 'https://example.com/documents/reliance-home.pdf', type: 'wording' }],
    reviews: [{ id: 'rh-r1', rating: 4, title: 'Good contents coverage', content: 'Burglary claim for stolen electronics was settled promptly.', author: 'Harsha N.', createdAt: '2024-09-19' }],
    scorecard: [...baseScorecard],
  },
];

const productSeeds2: ProductSeed[] = [...productSeeds.slice(0, -1), ...productSeeds.slice(-1), ...additionalSeeds];

const mapToSummary = (product: ProductDetail) => ({
  id: product.id,
  name: product.name,
  insurer: product.insurer,
  rating: product.rating,
  priceFrom: product.priceFrom,
  coverageType: product.coverageType,
  coverageAmount: product.coverageAmount,
  tags: product.tags,
  categoryId: product.categoryId,
  policyExcerpt: product.policyExcerpt,
  policyDocumentUrl: product.policyDocumentUrl,
  highlights: product.highlights,
  lastReview: product.reviews[0]
});

const filterProducts = (query: ProductQuery): ProductDetail[] => {
  const { categoryId, search, insurers: insurerFilters, coverageTypes, tags } = query;
  return productSeeds2.filter((product) => {
    if (categoryId && product.categoryId !== categoryId) return false;
    if (insurerFilters?.length && !insurerFilters.includes(product.insurer)) return false;
    if (coverageTypes?.length && !coverageTypes.includes(product.coverageType)) return false;
    if (tags?.length && !tags.some((tag) => product.tags.includes(tag))) return false;
    if (search) {
      const normalized = search.toLowerCase();
      const haystack = [
        product.name,
        product.insurer,
        product.policyExcerpt,
        product.policyWording,
        product.tags.join(' ')
      ]
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(normalized)) return false;
    }
    return true;
  });
};

const sortProducts = (products: ProductDetail[], sort?: ProductQuery['sort']) => {
  if (!sort || sort === 'relevance') return products;
  const sorted = [...products];
  switch (sort) {
    case 'price_low':
      sorted.sort((a, b) => a.priceFrom - b.priceFrom);
      break;
    case 'price_high':
      sorted.sort((a, b) => b.priceFrom - a.priceFrom);
      break;
    case 'rating':
      sorted.sort((a, b) => b.rating - a.rating);
      break;
    default:
      break;
  }
  return sorted;
};

export async function mockFetchInsurerProfile(insurerId: string): Promise<Insurer | null> {
  await delay();
  return insurers.find((i) => i.id === insurerId) ?? null;
}

export async function mockFetchInsurerProducts(insurerId: string): Promise<ProductCollectionResponse> {
  await delay();
  const name = insurers.find((i) => i.id === insurerId)?.name ?? '';
  const items = productSeeds2
    .filter((p) => p.insurer === name)
    .map(mapToSummary);
  return { items, total: items.length, page: 1, pageSize: items.length };
}

export async function mockFetchCategories(): Promise<Category[]> {
  await delay();
  return categories.map((category) => ({
    ...category,
    productCount: productSeeds.filter((product) => product.categoryId === category.id).length
  }));
}

export async function mockFetchInsurers(): Promise<Insurer[]> {
  await delay();
  return insurers;
}

export async function mockFetchProducts(query: ProductQuery = {}): Promise<ProductCollectionResponse> {
  await delay();
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 8;
  const filtered = sortProducts(filterProducts(query), query.sort);
  const start = (page - 1) * pageSize;
  const items = filtered.slice(start, start + pageSize).map(mapToSummary);

  return {
    items,
    total: filtered.length,
    page,
    pageSize
  };
}

export async function mockFetchProductDetail(productId: string): Promise<ProductDetail> {
  await delay();
  const product = productSeeds.find((entry) => entry.id === productId);
  if (!product) {
    throw new Error('Product not found');
  }
  return JSON.parse(JSON.stringify(product));
}

export async function mockFetchSearchSuggestions(term: string): Promise<SearchSuggestion[]> {
  await delay(120);
  if (!term) return [];
  const normalized = term.toLowerCase();
  return productSeeds2
    .filter((product) => product.name.toLowerCase().includes(normalized) || product.insurer.toLowerCase().includes(normalized))
    .slice(0, 6)
    .map((product) => ({
      id: product.id,
      name: product.name,
      categoryLabel: categories.find((cat) => cat.id === product.categoryId)?.label ?? 'All',
      rating: product.rating
    }));
}

export async function mockFetchAllInsurers(): Promise<Insurer[]> {
  await delay();
  return insurers;
}
