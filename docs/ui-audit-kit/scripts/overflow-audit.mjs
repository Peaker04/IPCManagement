#!/usr/bin/env node
/**
 * overflow-audit.mjs — Đo lỗi tràn chữ / cắt chữ / vỡ layout bằng số đo thật.
 *
 * Triết lý: ảnh chụp màn hình chỉ nói "cái gì đang hiển thị", không bao giờ nói
 * "cái gì SAI". Script này tạo ra oracle — một chuẩn đúng/sai máy kiểm tra được —
 * để agent không còn tự suy diễn "hiển thị vậy là đúng rồi".
 *
 * Cách dùng:
 *   node scripts/overflow-audit.mjs http://localhost:5173/dashboard
 *   node scripts/overflow-audit.mjs http://localhost:5173/a http://localhost:5173/b
 *   OVERFLOW_WIDTHS=360,768,1280 node scripts/overflow-audit.mjs <url>
 *
 * Thoát với mã 1 nếu có phát hiện => dùng được làm cổng CI.
 * Ghi báo cáo ra artifacts/overflow-report.json
 */
import { chromium } from 'playwright'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

const targets = process.argv.slice(2)
if (targets.length === 0) {
	console.error('Thiếu URL. Ví dụ: node scripts/overflow-audit.mjs http://localhost:5173/dashboard')
	process.exit(2)
}

const WIDTHS = (process.env.OVERFLOW_WIDTHS ?? '1024,1280,1440,1920')
	.split(',')
	.map((w) => Number(w.trim()))
	.filter(Boolean)
const HEIGHT = Number(process.env.OVERFLOW_HEIGHT ?? 900)
const REPORT = process.env.OVERFLOW_REPORT ?? 'artifacts/overflow-report.json'
const MAX_PRINT = 40

/**
 * Hàm này chạy BÊN TRONG trang web. Phải tự túc hoàn toàn — không được tham chiếu
 * biến bên ngoài, vì Playwright serialize hàm rồi eval lại trong browser context.
 */
function probe() {
	const vw = window.innerWidth
	const out = []
	const flagged = new Set()

	// Dựng đường dẫn selector ngắn gọn để agent biết chính xác phải sửa ở đâu.
	const path = (el) => {
		const parts = []
		let n = el
		let depth = 0
		while (n && n.nodeType === 1 && depth < 4) {
			let s = n.tagName.toLowerCase()
			if (n.id) {
				parts.unshift(s + '#' + n.id)
				break
			}
			// SVGElement.className là SVGAnimatedString chứ không phải string,
			// không chặn ở đây thì script sẽ nổ khi gặp icon SVG.
			const cls = typeof n.className === 'string' ? n.className.trim() : ''
			if (cls) s += '.' + cls.split(/\s+/).slice(0, 2).join('.')
			parts.unshift(s)
			n = n.parentElement
			depth += 1
		}
		return parts.join(' > ')
	}

	const hasFlaggedAncestor = (el) => {
		let n = el.parentElement
		while (n) {
			if (flagged.has(n)) return true
			n = n.parentElement
		}
		return false
	}

	// Quy tắc C1: toàn trang không được có thanh cuộn ngang.
	if (document.documentElement.scrollWidth > vw + 1) {
		out.push({
			reason: 'PAGE_H_SCROLL',
			selector: 'html',
			text: '',
			scrollWidth: document.documentElement.scrollWidth,
			clientWidth: vw,
			overflowBy: document.documentElement.scrollWidth - vw,
			viewport: vw,
		})
	}

	for (const el of document.querySelectorAll('body *')) {
		const cs = getComputedStyle(el)
		// Bỏ qua phần tử ẩn — chúng luôn cho số đo vô nghĩa.
		if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') continue
		const r = el.getBoundingClientRect()
		if (r.width === 0 || r.height === 0) continue

		// Phần tử có thanh cuộn riêng thì tràn là có chủ đích, không phải lỗi.
		const scrollable = /auto|scroll/.test(cs.overflowX + cs.overflowY)

		// Ngưỡng > 1: scrollWidth và clientWidth là số nguyên, việc làm tròn subpixel
		// che mất tràn thật (csswg-drafts#4123, mở từ 2019). 1px là vùng nhiễu.
		const clipped =
			!scrollable &&
			(el.scrollWidth - el.clientWidth > 1 || el.scrollHeight - el.clientHeight > 1)

		// Phần tử nằm ngoài khung nhìn — đây là lỗi "chữ tràn màn" kinh điển.
		const outside = r.right > vw + 1 || r.left < -1

		// Trình duyệt KHÔNG có API nào cho biết phần chữ nào đã bị cắt (playwright#14233),
		// nên "cắt có chủ đích" và "cắt do lỗi" nhìn giống hệt nhau. Né tranh cãi đó
		// bằng một quy tắc máy kiểm tra được: cắt chữ mà không có tooltip thì LUÔN là lỗi.
		const silentTruncation =
			cs.textOverflow === 'ellipsis' &&
			el.scrollWidth > el.clientWidth &&
			!el.title &&
			!el.getAttribute('aria-label')

		let reason = null
		if (outside) reason = 'OUT_OF_VIEWPORT'
		else if (silentTruncation) reason = 'TRUNCATED_NO_TOOLTIP'
		else if (clipped) reason = 'CLIPPED'
		if (!reason) continue

		// Gộp nhiễu: con của một phần tử đã gắn cờ thì bỏ qua, vì sửa cha là sửa hết con.
		// Trừ lỗi cắt chữ — mỗi nhãn là một lỗi riêng, cần tooltip riêng.
		if (reason !== 'TRUNCATED_NO_TOOLTIP' && hasFlaggedAncestor(el)) continue
		flagged.add(el)

		out.push({
			reason,
			selector: path(el),
			text: (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 60),
			scrollWidth: el.scrollWidth,
			clientWidth: el.clientWidth,
			overflowBy: el.scrollWidth - el.clientWidth,
			right: Math.round(r.right),
			viewport: vw,
		})
	}

	return out
}

const browser = await chromium.launch()
const findings = []

for (const target of targets) {
	for (const width of WIDTHS) {
		const page = await browser.newPage({ viewport: { width, height: HEIGHT } })
		try {
			await page.goto(target, { waitUntil: 'networkidle', timeout: 30_000 })
			// Chờ font tải xong mới đo, nếu không sẽ đo nhầm kích thước của font dự phòng.
			await page.evaluate(() => document.fonts && document.fonts.ready)
			await page.waitForTimeout(250)
			const rows = await page.evaluate(probe)
			for (const row of rows) findings.push({ url: target, ...row })
		} catch (err) {
			findings.push({
				url: target,
				viewport: width,
				reason: 'LOAD_FAILED',
				selector: '-',
				text: String(err && err.message).slice(0, 140),
			})
		} finally {
			await page.close()
		}
	}
}

await browser.close()

const byReason = {}
for (const f of findings) byReason[f.reason] = (byReason[f.reason] ?? 0) + 1

const report = {
	generatedAt: new Date().toISOString(),
	targets,
	widths: WIDTHS,
	total: findings.length,
	byReason,
	findings,
}

mkdirSync(dirname(REPORT), { recursive: true })
writeFileSync(REPORT, JSON.stringify(report, null, 2))

if (findings.length === 0) {
	console.log('PASS — không phát hiện tràn hoặc cắt chữ ở ' + WIDTHS.join('px, ') + 'px')
	process.exit(0)
}

console.log('FAIL — ' + findings.length + ' phát hiện')
console.log(JSON.stringify(byReason, null, 2))
console.log('')

for (const f of findings.slice(0, MAX_PRINT)) {
	console.log('[' + f.reason + '] ' + f.viewport + 'px  ' + f.selector)
	console.log('    "' + f.text + '"  scroll=' + f.scrollWidth + ' client=' + f.clientWidth)
}
if (findings.length > MAX_PRINT) {
	console.log('... và ' + (findings.length - MAX_PRINT) + ' phát hiện nữa.')
}

console.log('\nBáo cáo đầy đủ (đưa FILE NÀY cho agent, không đưa ảnh): ' + REPORT)
process.exit(1)
