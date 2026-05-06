import {
  Category,
  ProductCollectionResponse,
  ProductDetail,
  ProductQuery,
  SearchSuggestion,
  Insurer
} from '../types';
import {
  mockFetchCategories,
  mockFetchInsurers,
  mockFetchProductDetail,
  mockFetchProducts,
  mockFetchSearchSuggestions,
  mockFetchInsurerProfile,
  mockFetchInsurerProducts,
  mockFetchAllInsurers,
} from './mockData';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';
const FORCE_MOCKS = import.meta.env.VITE_USE_MOCKS === 'true';
const useMocks = FORCE_MOCKS || import.meta.env.VITE_API_BASE_URL === undefined;

async function request<T>(path: string, init?: RequestInit): Promise<T> {

  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json'
    },
    ...init
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || 'Unable to fetch data');
  }

  return response.json() as Promise<T>;
}

function buildQueryString(query: ProductQuery = {}): string {
  const params = new URLSearchParams();

  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    if (Array.isArray(value)) {
      value.forEach((entry) => params.append(key, entry));
    } else {
      params.set(key, String(value));
    }
  });

  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export async function fetchCategories(): Promise<Category[]> {
  if (useMocks) return mockFetchCategories();
  return request<Category[]>('/categories');
}

export async function fetchInsurers(): Promise<Insurer[]> {
  if (useMocks) return mockFetchInsurers();
  return request<Insurer[]>('/insurers');
}

export async function fetchProducts(query: ProductQuery = {}): Promise<ProductCollectionResponse> {
  if (useMocks) return mockFetchProducts(query);
  return request<ProductCollectionResponse>(`/products${buildQueryString(query)}`);
}

export async function fetchProductDetail(productId: string): Promise<ProductDetail> {
  if (useMocks) return mockFetchProductDetail(productId);
  return request<ProductDetail>(`/products/${productId}`);
}

export async function fetchSearchSuggestions(term: string): Promise<SearchSuggestion[]> {
  if (useMocks) return mockFetchSearchSuggestions(term);
  return request<SearchSuggestion[]>(`/search/suggestions${buildQueryString({ search: term })}`);
}

export async function fetchInsurerProfile(insurerId: string) {
  if (useMocks) return mockFetchInsurerProfile(insurerId);
  return request<{ id: string; name: string; rating: number; totalProducts: number } | null>(`/insurers/${insurerId}`);
}

export async function fetchInsurerProducts(insurerId: string): Promise<ProductCollectionResponse> {
  if (useMocks) return mockFetchInsurerProducts(insurerId);
  return request<ProductCollectionResponse>(`/insurers/${insurerId}/products`);
}

export async function fetchAllInsurers() {
  if (useMocks) return mockFetchAllInsurers();
  return request<{ id: string; name: string; rating: number; totalProducts: number }[]>('/insurers');
}

export const apiConfig = {
  useMocks,
  baseUrl: API_BASE_URL ?? 'mock'
};
