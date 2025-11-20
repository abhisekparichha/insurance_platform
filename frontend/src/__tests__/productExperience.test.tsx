import { describe, it, expect } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from '../App';
import { SearchProvider } from '../context/SearchContext';

const renderApp = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false }
    }
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <SearchProvider>
        <App />
      </SearchProvider>
    </QueryClientProvider>
  );
};

describe('Product experience', () => {
  it('shows categories and default products', async () => {
    renderApp();
    await waitFor(() => expect(screen.getByText(/Retail Health/i)).toBeVisible());
    const regions = await screen.findAllByLabelText(/Product results/i);
    const resultsRegion = regions.at(-1)!;
    await within(resultsRegion).findByText(/Care Shield/i);
  });

  it('filters products when searching', async () => {
    const user = userEvent.setup();
    renderApp();
    const [searchInput] = await screen.findAllByPlaceholderText(/Search plans/i);
    await user.clear(searchInput);
    await user.type(searchInput, 'Star Supreme');

    const regions = await screen.findAllByLabelText(/Product results/i);
    const resultsRegion = regions.at(-1)!;
    await within(resultsRegion).findByText(/Star Health Supreme/i);
    await waitFor(() => expect(within(resultsRegion).queryByText(/Care Shield/i)).toBeNull());
  });
});
