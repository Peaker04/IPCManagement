import { defineConfig, devices } from '@playwright/test'

/**
 * Cấu hình cho pixel diff (visual regression).
 *
 * Ảnh baseline nằm trong tests/visual/__screenshots__ và BẮT BUỘC phải commit vào git.
 * Lần chạy đầu tiên chỉ tạo baseline; từ lần thứ hai trở đi mới là kiểm tra thật.
 *
 * Cập nhật baseline khi thay đổi có chủ đích:
 *   npx playwright test --update-snapshots
 */
export default defineConfig({
	testDir: './tests/visual',
	snapshotDir: './tests/visual/__screenshots__',
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 1 : 0,
	reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',

	use: {
		baseURL: process.env.BASE_URL ?? 'http://localhost:5173',
		trace: 'on-first-retry',
		// Cố định deviceScaleFactor để ảnh không đổi theo máy của từng người.
		deviceScaleFactor: 1,
	},

	expect: {
		toHaveScreenshot: {
			// Ngưỡng nhiễu render giữa các máy. Đặt quá cao sẽ nuốt mất lỗi thật.
			maxDiffPixelRatio: 0.01,
			// Tắt animation, nếu không ảnh sẽ flaky vĩnh viễn.
			animations: 'disabled',
			// Ẩn con trỏ nhấp nháy trong ô nhập liệu.
			caret: 'hide',
			scale: 'css',
		},
	},

	projects: [
		{ name: 'w1280', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } } },
		{ name: 'w1920', use: { ...devices['Desktop Chrome'], viewport: { width: 1920, height: 900 } } },
	],

	// Tự khởi động dev server khi chạy ở máy cá nhân.
	// Ở CI thì trỏ BASE_URL vào bản build sẵn cho sát production hơn.
	webServer: process.env.BASE_URL
		? undefined
		: {
				command: 'npm run dev',
				url: 'http://localhost:5173',
				reuseExistingServer: !process.env.CI,
				timeout: 120_000,
			},
})
