import React, { useState, useEffect } from 'react';
import TypographySpecimen from './specimens/TypographySpecimen';
import ColorSurfaceSpecimen from './specimens/ColorSurfaceSpecimen';
import SidebarNavigationSpecimen from './specimens/SidebarNavigationSpecimen';
import OperationalTableSpecimen from './specimens/OperationalTableSpecimen';
import AccessibilityStressSpecimen from './specimens/AccessibilityStressSpecimen';
import IconographySpecimen from './specimens/IconographySpecimen';
import MotionSpecimen from './specimens/MotionSpecimen';
import MaterialDemandWorkspaceSpecimen from './specimens/MaterialDemandWorkspaceSpecimen';
import EvidenceLaboratorySpecimen from './specimens/EvidenceLaboratorySpecimen';
import {
  Type,
  Palette,
  Layout,
  Table as TableIcon,
  ShieldCheck,
  Sparkles,
  Layers,
  Activity,
  Cpu,
  Eye,
} from 'lucide-react';

export type SpecimenSection =
  | 'composed'
  | 'typography'
  | 'colors'
  | 'icons'
  | 'tables'
  | 'navigation'
  | 'accessibility'
  | 'motion';

export type HarnessSurface = 'gallery' | 'lab';

export function DesignSystemSpecimenHarness() {
  // Read initial surface and section from URL params if running in browser
  const [surface, setSurface] = useState<HarnessSurface>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('surface') === 'lab' || params.get('view') === 'lab') {
        return 'lab';
      }
    }
    return 'gallery';
  });

  // Default landing section is now Overview / Composed Workspace ('composed')
  const [activeSection, setActiveSection] = useState<SpecimenSection>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get('tab') as SpecimenSection;
      if (tab && ['composed', 'typography', 'colors', 'icons', 'tables', 'navigation', 'accessibility', 'motion'].includes(tab)) {
        return tab;
      }
    }
    return 'composed';
  });

  // Keep URL in sync without triggering page reload
  useEffect(() => {
    if (typeof window !== 'undefined' && window.history?.replaceState) {
      const url = new URL(window.location.href);
      url.searchParams.set('surface', surface);
      if (surface === 'gallery') {
        url.searchParams.set('tab', activeSection);
      } else {
        url.searchParams.delete('tab');
      }
      window.history.replaceState({}, '', url.toString());
    }
  }, [surface, activeSection]);

  const galleryTabs = [
    { key: 'composed', label: 'Overview', icon: Layers, testId: 'gallery-nav-composed' },
    { key: 'typography', label: 'Typography', icon: Type, testId: 'gallery-nav-typography' },
    { key: 'colors', label: 'Colors', icon: Palette, testId: 'gallery-nav-colors' },
    { key: 'icons', label: 'Icons', icon: Sparkles, testId: 'gallery-nav-icons' },
    { key: 'tables', label: 'Tables', icon: TableIcon, testId: 'gallery-nav-tables' },
    { key: 'navigation', label: 'Navigation', icon: Layout, testId: 'gallery-nav-navigation' },
    { key: 'accessibility', label: 'Interaction', icon: ShieldCheck, testId: 'gallery-nav-accessibility' },
    { key: 'motion', label: 'Motion', icon: Activity, testId: 'gallery-nav-motion' },
  ] as const;

  return (
    <main
      data-testid="design-system-specimen-harness-root"
      className="min-h-screen bg-[#f1f5f9] text-[#0f172a] antialiased p-4 sm:p-6 lg:p-8"
      style={{
        fontFamily: '"Inter Variable", "Segoe UI", Roboto, system-ui, sans-serif',
      }}
    >
      <div className="max-w-7xl mx-auto space-y-6">
        {/* REFINED GALLERY SHELL HEADER */}
        <header className="bg-white border border-[#cbd5e1] rounded-[3px] p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-xs font-semibold text-[#475569] uppercase tracking-wider">
                IPC Design System
              </span>
              <span className="text-slate-300">/</span>
              <span className="text-xs text-[#164e87] font-medium">
                Visual Standards
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-[#0f172a] tracking-tight">
              Quiet Operational
            </h1>
            <p className="text-xs text-[#475569] mt-0.5 max-w-2xl leading-relaxed">
              Industrial workstation standards: high-density tables, diacritic-safe Vietnamese typography,
              and restrained operational interaction.
            </p>
          </div>

          {/* DUAL-SURFACE TOGGLE */}
          <div className="flex items-center gap-2 self-start md:self-center">
            <div className="inline-flex rounded-[3px] bg-slate-100 p-0.5 text-xs font-medium border border-slate-200">
              <button
                type="button"
                data-testid="toggle-surface-gallery"
                onClick={() => setSurface('gallery')}
                className={`px-3 py-1.5 rounded-[2px] transition-colors flex items-center gap-1.5 cursor-pointer ${
                  surface === 'gallery'
                    ? 'bg-white text-[#164e87] font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Eye size={13} />
                <span>Gallery</span>
              </button>
              <button
                type="button"
                data-testid="toggle-surface-lab"
                onClick={() => setSurface('lab')}
                className={`px-3 py-1.5 rounded-[2px] transition-colors flex items-center gap-1.5 cursor-pointer ${
                  surface === 'lab'
                    ? 'bg-slate-900 text-white font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Cpu size={13} />
                <span>Evidence Lab</span>
              </button>
            </div>
          </div>
        </header>

        {/* SURFACE 1: DESIGN SYSTEM GALLERY */}
        {surface === 'gallery' && (
          <>
            {/* GALLERY NAVIGATION BAR */}
            <nav
              aria-label="Gallery Sections"
              className="flex flex-wrap items-center gap-1 bg-white border border-[#cbd5e1] rounded-[3px] p-1.5"
            >
              {galleryTabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeSection === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    aria-current={isActive ? 'page' : undefined}
                    data-testid={tab.testId}
                    data-section={tab.key}
                    onClick={() => setActiveSection(tab.key)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-[2px] transition-colors flex items-center gap-1.5 cursor-pointer ${
                      isActive
                        ? 'bg-[#164e87] text-white font-semibold'
                        : 'text-[#334155] hover:bg-slate-100'
                    }`}
                  >
                    <Icon size={14} />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </nav>

            {/* GALLERY ACTIVE SPECIMEN VIEWPORT */}
            <div
              data-testid="gallery-active-specimen"
              data-active-section={activeSection}
              className="space-y-6"
            >
              {activeSection === 'composed' && <MaterialDemandWorkspaceSpecimen />}
              {activeSection === 'typography' && <TypographySpecimen />}
              {activeSection === 'colors' && <ColorSurfaceSpecimen />}
              {activeSection === 'icons' && <IconographySpecimen />}
              {activeSection === 'tables' && <OperationalTableSpecimen />}
              {activeSection === 'navigation' && <SidebarNavigationSpecimen />}
              {activeSection === 'accessibility' && <AccessibilityStressSpecimen />}
              {activeSection === 'motion' && <MotionSpecimen />}
            </div>
          </>
        )}

        {/* SURFACE 2: TECHNICAL EVIDENCE LABORATORY */}
        {surface === 'lab' && (
          <EvidenceLaboratorySpecimen />
        )}

        {/* MASTER FOOTER GUARD */}
        <footer className="bg-white border border-[#cbd5e1] rounded-[3px] p-3 px-4 text-xs text-[#64748b] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Sparkles className="size-3.5 text-[#164e87]" />
            <span>IPC Design System — Quiet Operational Specimen</span>
          </div>
          <div>
            <span>Trạng thái Tái cấu trúc: <strong>NOT_STARTED</strong> (Dừng lại sau kiểm định mẫu phẩm)</span>
          </div>
        </footer>
      </div>
    </main>
  );
}

export default DesignSystemSpecimenHarness;
