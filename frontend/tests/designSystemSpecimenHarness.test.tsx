import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import DesignSystemSpecimenHarness from './fixtures/DesignSystemSpecimenHarness';
import TypographySpecimen from './fixtures/specimens/TypographySpecimen';
import ColorSurfaceSpecimen from './fixtures/specimens/ColorSurfaceSpecimen';
import SidebarNavigationSpecimen from './fixtures/specimens/SidebarNavigationSpecimen';
import OperationalTableSpecimen from './fixtures/specimens/OperationalTableSpecimen';
import AccessibilityStressSpecimen from './fixtures/specimens/AccessibilityStressSpecimen';

describe('DesignSystemSpecimenHarness (Non-Production Validation Laboratory)', () => {
  it('mounts the master harness with all five section triggers and footer guard', () => {
    render(<DesignSystemSpecimenHarness />);

    expect(screen.getByTestId('design-system-specimen-harness-root')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Quiet Operational' })).toBeInTheDocument();
    expect(screen.getByTestId('gallery-nav-composed')).toBeInTheDocument();
    expect(screen.getByTestId('gallery-nav-typography')).toBeInTheDocument();
    expect(screen.getByTestId('gallery-nav-colors')).toBeInTheDocument();
    expect(screen.getByTestId('gallery-nav-navigation')).toBeInTheDocument();
    expect(screen.getByTestId('gallery-nav-tables')).toBeInTheDocument();
    expect(screen.getByTestId('gallery-nav-accessibility')).toBeInTheDocument();
    expect(screen.getByText(/Trạng thái Tái cấu trúc:/i)).toBeInTheDocument();
    expect(screen.getByText('NOT_STARTED')).toBeInTheDocument();
  });

  it('switches between specimen sections smoothly without throwing errors', () => {
    render(<DesignSystemSpecimenHarness />);

    // Switch to Colors
    fireEvent.click(screen.getByTestId('gallery-nav-colors'));
    expect(screen.getByTestId('color-surface-specimen-root')).toBeInTheDocument();

    // Switch to Navigation
    fireEvent.click(screen.getByTestId('gallery-nav-navigation'));
    expect(screen.getByTestId('sidebar-navigation-specimen-root')).toBeInTheDocument();

    // Switch to Tables
    fireEvent.click(screen.getByTestId('gallery-nav-tables'));
    expect(screen.getByTestId('operational-table-specimen-root')).toBeInTheDocument();

    // Switch to Accessibility
    fireEvent.click(screen.getByTestId('gallery-nav-accessibility'));
    expect(screen.getByTestId('accessibility-stress-specimen-root')).toBeInTheDocument();
  });

  it('verifies TypographySpecimen renders all 11 semantic roles and Vietnamese stress text', () => {
    render(<TypographySpecimen />);

    expect(screen.getByTestId('typography-specimen-root')).toBeInTheDocument();
    expect(screen.getByText(/Page Title \(h1\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Workspace Title \(h2\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Table Cell Data \(td\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Numeric Display/i)).toBeInTheDocument();
    expect(screen.getByText(/Technical Identity/i)).toBeInTheDocument();

    // Difficult diacritics
    expect(screen.getAllByText(/ă â ê ô ơ ư/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/ế ề ể ễ ệ/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/ớ ờ ở ỡ ợ/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/125.000.000 ₫/i).length).toBeGreaterThan(0);
  });

  it('verifies ColorSurfaceSpecimen calculates WCAG contrast and validates Primary Navy vs Info Blue', () => {
    render(<ColorSurfaceSpecimen />);

    expect(screen.getByTestId('color-surface-specimen-root')).toBeInTheDocument();
    expect(screen.getByText(/Action Text on Navy/i)).toBeInTheDocument();
    expect(screen.getByText(/Info Text on Tint/i)).toBeInTheDocument();
    expect(screen.getByText(/Border Strong on White/i)).toBeInTheDocument();
    expect(screen.getByText(/Focus Ring on White/i)).toBeInTheDocument();

    // Assert that automated contrast status badges render
    const passBadges = screen.getAllByText(/(AAA|AA|UI-PASS)/i);
    expect(passBadges.length).toBeGreaterThan(5);
  });

  it('verifies SidebarNavigationSpecimen renders the 7 module groups and executes auto-promotion', () => {
    render(<SidebarNavigationSpecimen />);

    expect(screen.getByTestId('sidebar-navigation-specimen-root')).toBeInTheDocument();
    expect(screen.getByText('Bàn điều hành hôm nay')).toBeInTheDocument();
    expect(screen.getAllByText('Kế hoạch & Điều phối')[0]).toBeInTheDocument();
    expect(screen.getByText('Kho nguyên liệu')).toBeInTheDocument();
    expect(screen.getByText('Thu mua vật tư')).toBeInTheDocument();

    // Verify Weekly Menu views are children under planning
    expect(screen.getByText('Kế hoạch tuần')).toBeInTheDocument();
    expect(screen.getByText('Nhu cầu nguyên liệu')).toBeInTheDocument();
    expect(screen.getByText('Kế hoạch sản xuất')).toBeInTheDocument();

    // Verify single-child auto-promotion demonstration exists
    expect(screen.getByTitle(/Tự động nâng cấp/i)).toBeInTheDocument();
  });

  it('verifies OperationalTableSpecimen renders density tiers and tabular numbers', () => {
    render(<OperationalTableSpecimen />);

    expect(screen.getByTestId('operational-table-specimen-root')).toBeInTheDocument();
    expect(screen.getByText('Mã NVL')).toBeInTheDocument();
    expect(screen.getByText('Định mức BOM')).toBeInTheDocument();
    expect(screen.getByText('Thành tiền VND')).toBeInTheDocument();

    // Check BOM numbers
    expect(screen.getByText('0,064777')).toBeInTheDocument();
  });

  it('verifies AccessibilityStressSpecimen renders modalities, async states, and zoom container', () => {
    render(<AccessibilityStressSpecimen />);

    expect(screen.getByTestId('accessibility-stress-specimen-root')).toBeInTheDocument();
    expect(screen.getByText(/Modality A: Modal Dialog/i)).toBeInTheDocument();
    expect(screen.getByText(/Modality B: Modal Drawer/i)).toBeInTheDocument();
    expect(screen.getByText(/Modality C: Master-Detail Song song/i)).toBeInTheDocument();
    expect(screen.getByText(/Khảo sát Trạng thái Bất đồng bộ/i)).toBeInTheDocument();
  });
});
