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
  {
    id: 'care-health',
    name: 'Care Health Insurance',
    logoUrl: 'https://dummyimage.com/64x64/1d4ed8/ffffff&text=CH',
    rating: 4.6,
    totalProducts: 7
  },
  {
    id: 'star-health',
    name: 'Star Health & Allied',
    logoUrl: 'https://dummyimage.com/64x64/f97316/ffffff&text=SH',
    rating: 4.4,
    totalProducts: 6
  },
  {
    id: 'hdfc-life',
    name: 'HDFC Life',
    logoUrl: 'https://dummyimage.com/64x64/22c55e/ffffff&text=HL',
    rating: 4.8,
    totalProducts: 5
  },
  {
    id: 'tata-aig',
    name: 'Tata AIG',
    logoUrl: 'https://dummyimage.com/64x64/6366f1/ffffff&text=TA',
    rating: 4.5,
    totalProducts: 4
  }
];

const categories: Category[] = [
  { id: 'health_base', label: 'Retail Health', icon: 'Stethoscope', productCount: 0 },
  { id: 'health_topup', label: 'Top-up & Super Top-up', icon: 'Shield', productCount: 0 },
  { id: 'life_term', label: 'Term Life', icon: 'LifeBuoy', productCount: 0 },
  { id: 'motor', label: 'Motor', icon: 'Car', productCount: 0 }
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
    insurer: 'Care Health Insurance',
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
    insurer: 'Care Health Insurance',
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
    insurer: 'Star Health & Allied',
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
    insurer: 'HDFC Life',
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
  return productSeeds.filter((product) => {
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
  return productSeeds
    .filter((product) => product.name.toLowerCase().includes(normalized))
    .slice(0, 6)
    .map((product) => ({
      id: product.id,
      name: product.name,
      categoryLabel: categories.find((cat) => cat.id === product.categoryId)?.label ?? 'All',
      rating: product.rating
    }));
}
