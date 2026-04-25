import { test, expect } from "../../playwright-fixture";

/**
 * Smoke test for /manifest-preview.
 *
 * Verifies the core review flow: load the bundled sample, see the
 * "Manifest is valid" confirmation, see the section nav, then open
 * the diff panel.
 *
 * No backend, auth, or DB interaction — the page is fully client-side.
 */
test.describe("/manifest-preview", () => {
  test("loads sample, validates, and opens diff panel", async ({ page }) => {
    await page.goto("/manifest-preview");

    // Empty state header
    await expect(
      page.getByRole("heading", { name: /manifest preview/i, level: 1 }),
    ).toBeVisible();

    // Load the bundled sample
    await page.getByRole("button", { name: /load sample manifest/i }).click();

    // Validation succeeds
    await expect(page.getByText(/manifest is valid/i)).toBeVisible({
      timeout: 5000,
    });

    // Section nav is rendered
    await expect(
      page.getByRole("heading", { name: /^sections$/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /^Jump to Patient \(/ }),
    ).toBeVisible();

    // Diff panel toggles open
    await page.getByRole("button", { name: /diff vs sample/i }).click();
    await expect(
      page.getByRole("heading", { name: /diff vs sample/i }),
    ).toBeVisible();
    // Diff summary appears next to the heading. We don't assert "identical"
    // here because the live diff against the bundled sample may legitimately
    // contain entries (e.g. when reformatting widens types). We just confirm
    // the panel rendered a summary line in one of its two valid shapes:
    //   - "Identical"                                   (zero diff)
    //   - "+<added> · ~<changed> · −<removed>"          (non-zero diff)
    await expect(
      page.getByText(/identical|^\s*\+\d+\s*·\s*~\d+\s*·\s*−\d+\s*$/i).first(),
    ).toBeVisible();
  });
});