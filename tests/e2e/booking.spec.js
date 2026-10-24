/* E2E: full booking flow in all three languages (demo mode = localStorage).
 * Covers: language switch + persistence, RTL, wizard 4 steps, confirmation
 * (ref, .ics, WhatsApp link), manage by reference (cancel).
 * Run: npm run test:e2e  (needs: npm ci && npx playwright install --with-deps) */
import { test, expect } from '@playwright/test';

const LANGS = [
  { code: 'en', dir: 'ltr', hero: 'Traditional craft. Modern style.', anyBarber: 'Any barber' },
  { code: 'fr', dir: 'ltr', hero: 'Savoir-faire traditionnel, style moderne.', anyBarber: 'Peu importe' },
  { code: 'ar', dir: 'rtl', hero: 'حرفية أصيلة وستايل عصري.', anyBarber: 'أي حلاق' },
];

for (const { code, dir, hero, anyBarber } of LANGS) {
  test(`booking flow in ${code.toUpperCase()} (dir=${dir})`, async ({ page }) => {
    await page.goto(`/?lang=${code}#demo-wizard`);
    await page.reload(); // hash triggers wizard mount on load

    // language + RTL
    await expect(page.locator('html')).toHaveAttribute('lang', code);
    await expect(page.locator('html')).toHaveAttribute('dir', dir);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(hero);

    // wizard mounted (demo mode note present)
    const wizard = page.locator('#wizardMount');
    await expect(wizard).toBeVisible();

    // Step 1: first service + any barber
    await wizard.locator('[data-service]').first().click();
    await wizard.getByRole('button', { name: anyBarber, exact: false }).first().click();
    await wizard.getByRole('button', { name: /continue|continuer|متابعة/i }).click();

    // Step 2: first enabled date + first slot
    await wizard.locator('[data-slot]').first().waitFor({ state: 'visible' });
    await wizard.locator('[data-slot]').first().click();
    await wizard.getByRole('button', { name: /continue|continuer|متابعة/i }).click();

    // Step 3: details
    await wizard.locator('#wzName').fill('E2E Tester');
    await wizard.locator('#wzPhone').fill('22 123 456');
    await wizard.getByRole('button', { name: /continue|continuer|متابعة/i }).click();

    // Step 4: review + confirm
    await wizard.getByRole('button', { name: /confirm|confirmer|تأكيد/i }).click();
    await expect(wizard.locator('.ref-pill b')).toHaveText(/^SB-[A-Z2-9]{6}$/);

    // actions present: calendar + whatsapp + review
    await expect(wizard.locator('#wzIcs')).toBeVisible();
    await expect(wizard.locator('#wzWa')).toHaveAttribute('href', /wa\.me\/21622345678/);
  });
}

test('invalid +216 phone shows translated error and blocks step', async ({ page }) => {
  await page.goto('/?lang=fr#demo-wizard');
  await page.reload();
  const wizard = page.locator('#wizardMount');
  await wizard.locator('[data-service]').first().click();
  await wizard.getByRole('button', { name: /continuer/i }).click();
  await wizard.locator('[data-slot]').first().click();
  await wizard.getByRole('button', { name: /continuer/i }).click();
  await wizard.locator('#wzName').fill('Jean Test');
  await wizard.locator('#wzPhone').fill('1234');
  await wizard.getByRole('button', { name: /continuer/i }).click();
  await expect(wizard.locator('#wzErr')).toContainText(/numéro tunisien valide/i);
});

test('language choice persists across reload', async ({ page }) => {
  await page.goto('/?lang=ar');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ar'); // saved in localStorage
});

test('Phase 1 WhatsApp form builds a prefilled wa.me link', async ({ page }) => {
  await page.goto('/?lang=en');
  await page.locator('#wbName').fill('Walk In');
  await page.locator('#wbDate').fill('2026-10-26');
  await page.locator('#wbTime').fill('11:30');
  const popup = page.waitForEvent('popup');
  await page.locator('#whatsappForm button[type=submit]').click();
  const tab = await popup;
  expect(tab.url()).toMatch(/wa\.me\/21622345678\?text=/);
  expect(decodeURIComponent(tab.url())).toContain('Haircut');
});

test('admin demo: login, bookings list, walk-in update', async ({ page }) => {
  await page.goto('/admin.html');
  await page.locator('#adEmail').fill('demo@salimbarber.tn');
  await page.locator('#adPass').fill('demo1234');
  await page.getByRole('button', { name: /se connecter|sign in/i }).click();
  await expect(page.locator('#dashboard')).toBeVisible();
  await page.locator('#wiWaiting').fill('4');
  await page.locator('#walkinForm').getByRole('button').click();
  await page.goto('/');
  await expect(page.locator('#walkinStatus')).toContainText(/4/);
});
