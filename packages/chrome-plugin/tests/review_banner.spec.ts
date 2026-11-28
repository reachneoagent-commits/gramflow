import { expect, test } from './fixtures';

test.describe('review banner', () => {
	test.skip(({ browserName }) => browserName === 'firefox', 'Review prompt disabled in Firefox');

	test('review request hidden before 14 days', async ({ context, page }) => {
		test.slow();
		const background = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
		const extensionId = background.url().split('/')[2];

		const popupUrl = `chrome-extension://${extensionId}/popup.html`;
		await page.goto(popupUrl);

		await page.getByText("Let's start writing").click();

		await expect(page.getByRole('button', { name: /^Turn Gramflow (on|off)/ })).toBeVisible();
		await expect(page.getByText(/A quick review helps a lot/)).toHaveCount(0);
	});

	// Gramflow's popup has no review banner, so it must stay hidden even after 14 days.
	test('review request hidden after 14 days', async ({ context, page }) => {
		test.slow();
		const background = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
		const extensionId = background.url().split('/')[2];

		const popupUrl = `chrome-extension://${extensionId}/popup.html`;
		await background.evaluate(() =>
			chrome.storage.local.set({
				installedOn: new Date(Date.now() - 15 * 86400000).toISOString(),
			}),
		);
		await page.goto(popupUrl);

		await page.getByText("Let's start writing").click();

		await expect(page.getByRole('button', { name: /^Turn Gramflow (on|off)/ })).toBeVisible();
		await expect(page.getByText(/A quick review helps a lot/)).toHaveCount(0);
	});
});
