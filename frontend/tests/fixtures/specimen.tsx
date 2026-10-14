import React from 'react';
import { createRoot } from 'react-dom/client';
import '@/styles/index.css';
import DesignSystemSpecimenHarness from './DesignSystemSpecimenHarness';

const rootEl = document.getElementById('root');
if (rootEl) {
  createRoot(rootEl).render(<DesignSystemSpecimenHarness />);
}
