import { useSearchParams } from 'react-router-dom';
import { historicalRange, type HistoricalSelection } from '../utils/historicalScope';
import { todayInBusinessTimezone } from '../utils/dates';

export function useHistoricalScope(prefix = '') {
  const [params, setParams] = useSearchParams();
  const selection: HistoricalSelection = {
    period: params.get(`${prefix}period`) || 'ALL',
    year: params.get(`${prefix}year`) || todayInBusinessTimezone().slice(0, 4),
    from: params.get(`${prefix}from`) || '',
    to: params.get(`${prefix}to`) || '',
  };
  const { error, ...range } = historicalRange(selection);
  return {
    selection, range, error, key: JSON.stringify(selection),
    apply: (next: HistoricalSelection) => setParams(current => {
      const updated = new URLSearchParams(current);
      for (const [key, value] of Object.entries(next)) {
        if (value) updated.set(`${prefix}${key}`, value);
        else updated.delete(`${prefix}${key}`);
      }
      updated.delete('page');
      if (!prefix) updated.delete('queuePage');
      updated.delete(`${prefix}page`);
      return updated;
    }),
  };
}
