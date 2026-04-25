// Local fixture fallback. The upstream `lovable-agent-playwright-config`
// package is unavailable in this sandbox, so we re-export the standard
// Playwright test/expect directly. The manifest-preview smoke test does
// not depend on any custom fixture behavior.
export { test, expect } from "@playwright/test";
