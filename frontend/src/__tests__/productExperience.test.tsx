import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { SearchProvider } from '../context/SearchContext';
import CategoryPage from '../features/category/CategoryPage';
import SearchResults from '../features/search/SearchResults';

const renderCategoryPage = (categoryId = 'health') => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <SearchProvider>
        <MemoryRouter initialEntries={[`/c/${categoryId}`]}>
          <Routes>
            <Route path="/c/:categoryId" element={<CategoryPage />} />
          </Routes>
        </MemoryRouter>
      </SearchProvider>
    </QueryClientProvider>,
  );
};

const renderSearch = (query: string) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <SearchProvider>
        <MemoryRouter initialEntries={[`/search?q=${encodeURIComponent(query)}`]}>
          <Routes>
            <Route path="/search" element={<SearchResults />} />
          </Routes>
        </MemoryRouter>
      </SearchProvider>
    </QueryClientProvider>,
  );
};

describe('Category page', () => {
  it('shows Health Insurance heading', async () => {
    renderCategoryPage('health');
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /health insurance/i })).toBeInTheDocument(),
    );
  });

  it('shows product rows for health category', async () => {
    renderCategoryPage('health');
    await waitFor(() =>
      expect(screen.getByText(/Care Shield/i)).toBeInTheDocument(),
    );
  });
});

describe('Search results', () => {
  it('shows matching results for "Care"', async () => {
    renderSearch('Care');
    await waitFor(() =>
      expect(screen.getByText(/Care Shield/i)).toBeInTheDocument(),
    );
  });

  it('shows empty state for unrecognised query', async () => {
    renderSearch('xyznonexistent123');
    await waitFor(() =>
      expect(screen.getByText(/No results found/i)).toBeInTheDocument(),
    );
  });
});

describe('Typeahead debounce', () => {
  it('useDebouncedValue respects 300ms debounce', async () => {
    const { default: useDebouncedValue } = await import('../hooks/useDebouncedValue');
    const { renderHook, act } = await import('@testing-library/react');

    const { result } = renderHook(() => {
      const [value, setValue] = require('react').useState('');
      const debounced = useDebouncedValue(value, 300);
      return { value, setValue, debounced };
    });

    act(() => result.current.setValue('test'));
    // Before debounce fires, debounced should still be ''
    expect(result.current.debounced).toBe('');
  });
});
