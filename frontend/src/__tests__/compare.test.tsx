import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, act, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SearchProvider, useSearchContext } from '../context/SearchContext';

// Helper component to expose context values
const CompareConsumer = () => {
  const { compareIds, addToCompare, removeFromCompare, clearCompare, isInCompare } =
    useSearchContext();

  return (
    <div>
      <p data-testid="count">{compareIds.length}</p>
      <p data-testid="ids">{compareIds.join(',')}</p>
      <button onClick={() => addToCompare('p1')}>add-p1</button>
      <button onClick={() => addToCompare('p2')}>add-p2</button>
      <button onClick={() => addToCompare('p3')}>add-p3</button>
      <button onClick={() => addToCompare('p4')}>add-p4</button>
      <button onClick={() => addToCompare('p5')}>add-p5</button>
      <button onClick={() => addToCompare('p6')}>add-p6</button>
      <button onClick={() => removeFromCompare('p1')}>remove-p1</button>
      <button onClick={() => clearCompare()}>clear</button>
      <p data-testid="in-compare">{String(isInCompare('p1'))}</p>
    </div>
  );
};

const renderWithProvider = () =>
  render(
    <SearchProvider>
      <CompareConsumer />
    </SearchProvider>,
  );

describe('compare slice', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  it('starts empty', () => {
    renderWithProvider();
    expect(screen.getByTestId('count')).toHaveTextContent('0');
  });

  it('adds a product to compare', async () => {
    renderWithProvider();
    await userEvent.click(screen.getByText('add-p1'));
    expect(screen.getByTestId('count')).toHaveTextContent('1');
    expect(screen.getByTestId('in-compare')).toHaveTextContent('true');
  });

  it('does not add duplicates', async () => {
    renderWithProvider();
    await userEvent.click(screen.getByText('add-p1'));
    await userEvent.click(screen.getByText('add-p1'));
    expect(screen.getByTestId('count')).toHaveTextContent('1');
  });

  it('caps at 5 products', async () => {
    renderWithProvider();
    await userEvent.click(screen.getByText('add-p1'));
    await userEvent.click(screen.getByText('add-p2'));
    await userEvent.click(screen.getByText('add-p3'));
    await userEvent.click(screen.getByText('add-p4'));
    await userEvent.click(screen.getByText('add-p5'));
    await userEvent.click(screen.getByText('add-p6'));
    expect(screen.getByTestId('count')).toHaveTextContent('5');
    expect(screen.getByTestId('ids')).not.toHaveTextContent('p6');
  });

  it('removes a product from compare', async () => {
    renderWithProvider();
    await userEvent.click(screen.getByText('add-p1'));
    await userEvent.click(screen.getByText('remove-p1'));
    expect(screen.getByTestId('count')).toHaveTextContent('0');
    expect(screen.getByTestId('in-compare')).toHaveTextContent('false');
  });

  it('clears all products', async () => {
    renderWithProvider();
    await userEvent.click(screen.getByText('add-p1'));
    await userEvent.click(screen.getByText('add-p2'));
    await userEvent.click(screen.getByText('clear'));
    expect(screen.getByTestId('count')).toHaveTextContent('0');
  });
});
