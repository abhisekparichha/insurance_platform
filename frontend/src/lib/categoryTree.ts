export type SubCategory = {
  id: string;
  label: string;
  description: string;
  icon: string;
};

export type CategoryGroup = {
  id: string;
  label: string;
  icon: string;
  gradient: string;
  borderActive: string;
  accentText: string;
  description: string;
  subcategories: SubCategory[];
  /** DB category values that belong to this group */
  dbCategories: string[];
};

export const CATEGORY_TREE: CategoryGroup[] = [
  {
    id: 'health',
    label: 'Health Insurance',
    icon: '🏥',
    gradient: 'from-emerald-500/20 to-emerald-800/5',
    borderActive: 'border-emerald-500/50',
    accentText: 'text-emerald-400',
    description: 'Hospitalisation, OPD & top-up covers',
    dbCategories: ['health', 'health_base', 'health_topup'],
    subcategories: [
      { id: 'health', label: 'Base / Indemnity', description: 'Comprehensive hospitalisation & daycare cover', icon: '🏥' },
      { id: 'health_topup', label: 'Top-up Plans', description: 'Extend your existing cover at low cost', icon: '⬆️' },
    ],
  },
  {
    id: 'life',
    label: 'Life Insurance',
    icon: '🛡️',
    gradient: 'from-blue-500/20 to-blue-800/5',
    borderActive: 'border-blue-500/50',
    accentText: 'text-blue-400',
    description: 'Term life, savings, endowment & ULIP',
    dbCategories: ['life_term', 'life_savings', 'life_ulip'],
    subcategories: [
      { id: 'life_term', label: 'Term Life', description: 'Pure protection at the lowest premiums', icon: '🛡️' },
      { id: 'life_savings', label: 'Savings / Endowment', description: 'Life cover + guaranteed returns', icon: '💰' },
      { id: 'life_ulip', label: 'ULIP', description: 'Market-linked investment with life cover', icon: '📈' },
    ],
  },
  {
    id: 'motor',
    label: 'Motor Insurance',
    icon: '🚗',
    gradient: 'from-amber-500/20 to-amber-800/5',
    borderActive: 'border-amber-500/50',
    accentText: 'text-amber-400',
    description: 'Car, two-wheeler & commercial vehicles',
    dbCategories: ['motor', 'motor_pvt_car', 'motor_two_wheeler'],
    subcategories: [
      { id: 'motor', label: 'Private Car', description: 'Comprehensive & third-party covers', icon: '🚗' },
      { id: 'motor_two_wheeler', label: 'Two Wheeler', description: 'Bike & scooter insurance', icon: '🏍️' },
    ],
  },
  {
    id: 'others',
    label: 'Other Insurance',
    icon: '📋',
    gradient: 'from-purple-500/20 to-purple-800/5',
    borderActive: 'border-purple-500/50',
    accentText: 'text-purple-400',
    description: 'Travel, fire, home & speciality covers',
    dbCategories: ['other', 'travel', 'fire', 'home'],
    subcategories: [
      { id: 'travel', label: 'Travel', description: 'Domestic & international trip cover', icon: '✈️' },
      { id: 'fire', label: 'Fire & Perils', description: 'Property damage protection', icon: '🔥' },
      { id: 'home', label: 'Home Insurance', description: 'Structure & contents cover', icon: '🏠' },
    ],
  },
];

export function getGroupById(id: string): CategoryGroup | undefined {
  return CATEGORY_TREE.find(g => g.id === id);
}

export function getGroupForCategory(categoryId: string): CategoryGroup | undefined {
  return CATEGORY_TREE.find(g => g.dbCategories.includes(categoryId));
}

/** Returns the first DB category in the group that has live products, or falls back to the first. */
export function getDefaultCategoryForGroup(
  group: CategoryGroup,
  liveIds: string[]
): string {
  return group.dbCategories.find(id => liveIds.includes(id)) ?? group.dbCategories[0];
}
