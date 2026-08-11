import { test, expect } from '@playwright/test'

/**
 * Pixel diff — bắt những gì script đo không diễn đạt được.
 *
 * Script overflow-audit bắt được "tràn 62px". Nó KHÔNG bắt được "badge đổi sang màu
 * khác", "khoảng cách đổi từ 8 sang 12", "icon biến mất". Pixel diff bắt được.
 *
 * Quy tắc: ảnh baseline BẮT BUỘC phải commit vào git. Nếu diễn ra thay đổi có chủ đích,
 * chạy --update-snapshots và review ảnh trong pull request y như review code.
 */

// Các trang cần canh gác. Thêm route của bạn vào đây.
const ROUTES = [
	{ name: 'dashboard', path: '/dashboard' },
	{ name: 'orders', path: '/orders' },
	{ name: 'orders-empty', path: '/orders?mock=empty' },
	{ name: 'orders-worst', path: '/orders?mock=long' },
]

// Vùng có nội dung đổi theo thời gian phải được che, nếu không test sẽ flaky mãi mãi.
const DYNAMIC = [
	'[data-testid="last-updated"]',
	'[data-testid="clock"]',
	'[data-testid="live-count"]',
]

test.describe('visual regression', () => {
	for (const route of ROUTES) {
		test(route.name, async ({ page }) => {
			await page.goto(route.path, { waitUntil: 'networkidle' })
			await page.evaluate(() => document.fonts.ready)

			await expect(page).toHaveScreenshot(route.name + '.png', {
				fullPage: true,
				mask: DYNAMIC.map((s) => page.locator(s)),
			})
		})
	}
})

test.describe('modal', () => {
	/**
	 * Quy tắc M1: mở modal KHÔNG được làm dịch chuyển nội dung phía sau.
	 * Thủ phạm quen thuộc: thanh cuộn biến mất khi đặt overflow:hidden lên body.
	 * Sửa bằng scrollbar-gutter: stable, không phải bằng cách bù padding thủ công.
	 */
	test('mở modal không gây layout shift', async ({ page }) => {
		await page.goto('/orders?mock=long', { waitUntil: 'networkidle' })
		await page.evaluate(() => document.fonts.ready)

		const widthBefore = await page.evaluate(() => document.body.clientWidth)

		await page.getByRole('row').nth(1).getByRole('button', { name: /chi tiết|xem/i }).click()
		await expect(page.getByRole('dialog')).toBeVisible()

		const widthAfter = await page.evaluate(() => document.body.clientWidth)
		expect(widthAfter, 'body đổi chiều rộng khi mở modal, tức là có layout shift').toBe(widthBefore)
	})

	/**
	 * Quy tắc M3.2: chỉ được có MỘT instance modal ở cấp trang.
	 * Render modal bên trong mỗi dòng là nguyên nhân phổ biến nhất khiến bảng 1000 dòng
	 * chậy như rùa — vì có 1000 modal đang ẩn trong DOM.
	 */
	test('chỉ có một instance modal trong DOM', async ({ page }) => {
		await page.goto('/orders?mock=huge', { waitUntil: 'networkidle' })
		const count = await page.locator('[role="dialog"], [data-modal-root]').count()
		expect(count, 'modal đang được render trên từng dòng thay vì một lần ở cấp trang').toBeLessThanOrEqual(1)
	})

	/** Quy tắc M2: modal phải trả focus về đúng nút đã mở nó khi đóng. */
	test('trả focus sau khi đóng modal', async ({ page }) => {
		await page.goto('/orders?mock=long', { waitUntil: 'networkidle' })
		const trigger = page.getByRole('row').nth(1).getByRole('button', { name: /chi tiết|xem/i })
		await trigger.click()
		await expect(page.getByRole('dialog')).toBeVisible()
		await page.keyboard.press('Escape')
		await expect(page.getByRole('dialog')).toBeHidden()
		await expect(trigger).toBeFocused()
	})
})
