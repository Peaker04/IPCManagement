import production from './playwright.config'
import { defineConfig } from '@playwright/test'

export default defineConfig({
  ...production,
  webServer: undefined,
})
