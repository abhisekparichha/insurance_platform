import { useQueryClient } from '@tanstack/react-query';
import { fetchProductDetail } from '../lib/api';

export function usePrefetchProduct() {
  const queryClient = useQueryClient();

  return (productId: string | null) => {
    if (!productId) return;
    queryClient.prefetchQuery({
      queryKey: ['product-detail', productId],
      queryFn: () => fetchProductDetail(productId),
      staleTime: 1000 * 60 * 5
    });
  };
}
