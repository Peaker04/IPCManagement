import { bomApi } from '../api/bomApi';
import { useWorkbenchQuery } from './useWorkbenchQuery';

export function useSupportedPriceTiers(enabled = true) {
  const query = useWorkbenchQuery<number[]>({
    scopeKey: 'bom_price_tiers',
    cacheKey: 'bom_price_tiers',
    enabled,
    queryFn: async () => {
      const tiers = await bomApi.getSupportedPriceTiers();
      if (!Array.isArray(tiers) || tiers.length === 0 || tiers.some((tier) => !Number.isFinite(tier) || tier <= 0)) {
        throw new Error('Chưa có danh sách mốc giá BOM hợp lệ. Vui lòng tải lại.');
      }
      return tiers;
    },
  });

  return {
    tiers: query.data ?? [],
    isLoading: enabled && query.data === null && query.stateProps.error === null,
    error: query.stateProps.error,
    retry: () => query.refetch(true),
  };
}
