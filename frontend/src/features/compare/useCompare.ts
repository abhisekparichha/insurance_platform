import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useSearchContext } from '../../context/SearchContext';

/**
 * Syncs compareIds with the ?ids= URL parameter on the /compare page.
 * On mount, seeds compareIds from the URL; when compareIds change, updates the URL.
 */
export function useCompare() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { compareIds, addToCompare, clearCompare } = useSearchContext();

  // On mount: seed from URL
  useEffect(() => {
    const idsParam = searchParams.get('ids');
    if (idsParam) {
      const ids = idsParam.split(',').filter(Boolean).slice(0, 5);
      clearCompare();
      ids.forEach((id) => addToCompare(id));
    }
    // Only run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When compareIds change: update URL
  useEffect(() => {
    if (compareIds.length === 0) {
      setSearchParams({}, { replace: true });
    } else {
      setSearchParams({ ids: compareIds.join(',') }, { replace: true });
    }
  }, [compareIds, setSearchParams]);

  return { compareIds };
}
