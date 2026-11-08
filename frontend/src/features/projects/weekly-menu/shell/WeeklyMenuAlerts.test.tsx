import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { WeeklyMenuAlerts } from './WeeklyMenuAlerts';

describe('WeeklyMenuAlerts state ownership', () => {
  it('does not duplicate the catalog query error owned by QueryViewBoundary', () => {
    render(<WeeklyMenuAlerts
      invalidBomTierCount={0}
      menuFeedback={null}
      purchaseFeedback={null}
      isCatalogLoading={false}
      isCatalogError
      isCatalogEmpty={false}
      isCommittedMenuFetching={false}
      hasSelectedCustomer
    />);

    expect(screen.queryByText('Chưa tải được danh mục món ăn')).not.toBeInTheDocument();
  });
});
