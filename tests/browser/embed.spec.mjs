import { test, expect } from '@playwright/test';
for (const width of [1280, 390]) {
  test(`npm lifecycle, scoped host API, keyboard and live config at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto('/tests/fixtures/host.html');
    await page.evaluate(() => window.mountEditor());
    const frame = page.frameLocator('iframe');
    await expect(frame.getByRole('textbox', { name: 'Edit email' })).toBeVisible();
    expect(await page.evaluate(() => window.instance.exportHTML())).toMatchObject({ html: '<p>Hello</p>' });
    expect(await page.evaluate(() => window.instance.flushAutosave())).toEqual({ draft: null });
    await page.evaluate(() => window.instance.updateConfig({ locale: 'fr', theme: { mode: 'dark' }, enableEmailAudit: false }));
    await expect.poll(() => frame.locator('body').evaluate(() => window.config.locale)).toBe('fr');
    await expect.poll(() => frame.locator('body').evaluate(() => window.config.enableEmailAudit)).toBe(false);
    await page.evaluate(() => window.instance.updateConfig({ enableEmailAudit: true }));
    await expect.poll(() => frame.locator('body').evaluate(() => window.config.enableEmailAudit)).toBe(true);
    await expect(page.locator('iframe')).toHaveCount(1);
    await page.route('**/editors/ek_test/templates?**', async route => {
      const request = route.request(); const url = new URL(request.url());
      expect(url.searchParams.get('userId')).toBe('user'); expect(url.searchParams.get('organizationId')).toBe('org');
      expect(url.searchParams.has('tenantId')).toBe(false);
      await route.fulfill({ json: { templates: [] } });
    });
    await frame.locator('body').evaluate(() => window.send({ type: 'weavour:template-request', id: 'templates-1', path: 'templates', method: 'GET', query: { userId: 'attacker', tenantId: 'attacker' } }));
    await expect.poll(() => frame.locator('body').evaluate(() => window.templateResult?.result)).toEqual({ templates: [] });
    await page.getByRole('textbox', { name: 'Before editor' }).focus();
    for (let step = 0; step < 3; step++) {
      await page.keyboard.press('Tab');
      if (await frame.getByRole('textbox', { name: 'Edit email' }).evaluate(el => el === document.activeElement && document.hasFocus())) break;
    }
    await expect(frame.getByRole('textbox', { name: 'Edit email' })).toBeFocused();
    for (let step = 0; step < 3; step++) {
      await page.keyboard.press('Tab');
      if (await page.getByRole('textbox', { name: 'After editor' }).evaluate(el => el === document.activeElement)) break;
    }
    await expect(page.getByRole('textbox', { name: 'After editor' })).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.evaluate(() => window.instance.destroy()); await expect(page.locator('iframe')).toHaveCount(0);
    await page.evaluate(() => window.mountEditor()); await expect(page.locator('iframe')).toHaveCount(1);
  });
}
test('classic bundle exposes the same bridge without npm or a framework', async ({ page }) => {
  await page.goto('/tests/fixtures/host.html');
  await page.addScriptTag({ url: '/packages/editor/dist/editor.js' });
  const result = await page.evaluate(async () => {
    const editor = window.Weavour.mount('#editor', { editorKey: 'ek_test', userId: 'u', editorUrl: location.origin + '/tests/fixtures/frame.html' });
    await editor.ready; const exported = await editor.exportHTML(); editor.destroy(); return exported;
  });
  expect(result.html).toBe('<p>Hello</p>');
});
