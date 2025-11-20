export type Category = {
  id: string;
  label: string;
  icon: string;
  productCount: number;
};

export type Insurer = {
  id: string;
  name: string;
  logoUrl?: string;
  rating: number;
  totalProducts: number;
};

export type Review = {
  id: string;
  rating: number;
  title: string;
  content: string;
  author: string;
  createdAt: string;
};

export type PolicySection = {
  id: string;
  title: string;
  content: string;
  anchors?: Array<{ id: string; label: string }>;
};

export type PolicyDocument = {
  id: string;
  label: string;
  url: string;
  type: 'wording' | 'brochure' | 'faq';
};

export type PolicyScore = {
  id: string;
  label: string;
  status: 'excellent' | 'good' | 'warning' | 'critical';
  summary: string;
  weight: number;
};

export type ProductSummary = {
  id: string;
  name: string;
  insurer: string;
  rating: number;
  priceFrom: number;
  coverageType: string;
  coverageAmount: string;
  tags: string[];
  categoryId: string;
  policyExcerpt: string;
  policyDocumentUrl: string;
  highlights: string[];
  lastReview?: Review;
};

export type ProductDetail = ProductSummary & {
  description: string;
  benefits: string[];
  policyWording: string;
  policySections: PolicySection[];
  documents: PolicyDocument[];
  reviews: Review[];
  scorecard: PolicyScore[];
};

export type ProductQuery = {
  categoryId?: string;
  search?: string;
  insurers?: string[];
  coverageTypes?: string[];
  tags?: string[];
  sort?: 'relevance' | 'price_low' | 'price_high' | 'rating';
  page?: number;
  pageSize?: number;
};

export type ProductCollectionResponse = {
  items: ProductSummary[];
  total: number;
  page: number;
  pageSize: number;
};

export type SearchSuggestion = {
  id: string;
  name: string;
  categoryLabel: string;
  rating: number;
};
