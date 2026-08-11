/**
 * worstCase.ts — Dữ liệu xấu nhất để ép lỗi layout LỘ RA.
 *
 * Lý do tồn tại: với dữ liệu đẹp thì KHÔNG CÓ lỗi nào xuất hiện để mà đo.
 * Phần lớn lỗi tràn chữ sống sót được chỉ vì không ai test bằng tên dài 80 ký tự.
 *
 * Cách dùng:
 *   import { getMockProfile } from '@/mocks/worstCase'
 *   const rows = getMockProfile() ?? realRows
 */

export type Row = {
	id: string
	code: string
	partner: string
	owner: string
	status: string
	quantity: number
	amount: number
	note: string
	updatedAt: string
}

// Tiếng Việt có dấu chiếm nhiều chiều ngang hơn tiếng Anh với cùng số ký tự,
// và dấu trên/dưới còn làm tăng chiều cao dòng. Bắt buộc test bằng tiếng Việt thật.
const LONG_VI =
	'Nguyễn Trần Thị Hoàng Yến Nhi — Phòng Kế hoạch Sản xuất & Điều độ Vật tư Miền Nam'
const LONG_PARTNER =
	'Công ty TNHH Một thành viên Thương mại Dịch vụ Xuất nhập khẩu Hoàng Gia Phát Đạt'
const LONG_CODE = 'RCP-PO-99999999-999999-ABCDEF0123456789-REV12'
const LONG_NOTE =
	'Ghi chú dài bất thường để kiểm tra xem ô có xuống dòng hay tràn ra ngoài, có tooltip khi bị cắt hay không, và có làm vỡ chiều cao dòng hay không.'

// Nhãn trạng thái dài nhất — badge phải đặt min-width cố định theo cái này (quy tắc S1).
export const LONGEST_STATUS = 'Chờ phê duyệt cấp 2'

export const STATUSES = [
	'Mới',
	'Đang xử lý',
	LONGEST_STATUS,
	'Từ chối',
	'Hoàn thành',
]

const mk = (i: number, over: Partial<Row> = {}): Row => ({
	id: String(i),
	code: 'PO-' + String(i).padStart(6, '0'),
	partner: 'Đối tác ' + i,
	owner: 'Người dùng ' + i,
	status: STATUSES[i % STATUSES.length],
	quantity: 1,
	amount: 1000,
	note: '—',
	updatedAt: '2026-08-11T09:00:00+07:00',
	...over,
})

/** Mỗi dòng ép một loại lỗi khác nhau. Đọc comment để biết đang săn gì. */
export const worstCaseRows: Row[] = [
	// Tên và đối tác dài — săn lỗi tràn chữ trong ô.
	mk(1, { owner: LONG_VI, partner: LONG_PARTNER }),
	// Mã dài — cột cố định chiều rộng sẽ cắt mà không có tooltip.
	mk(2, { code: LONG_CODE }),
	// Số lớn — cột số phải căn phải và dùng tabular-nums, nếu không sẽ nhảy cột.
	mk(3, { quantity: 999_999_999, amount: 999_999_999_999 }),
	// Số âm và số không — hay bị định dạng sai.
	mk(4, { quantity: -1, amount: 0 }),
	// Nhãn trạng thái dài nhất — badge đổi chiều rộng thì cả cột sẽ xê dịch.
	mk(5, { status: LONGEST_STATUS }),
	// Ghi chú dài — săn lỗi vỡ chiều cao dòng.
	mk(6, { note: LONG_NOTE }),
	// Chuỗi không có khoảng trắng — không thể xuống dòng, chắc chắn tràn nếu thiếu word-break.
	mk(7, { note: 'A'.repeat(120), code: 'X'.repeat(60) }),
	// Giá trị rỗng — phải ra ký hiệu thay thế, không được ra chữ "undefined".
	mk(8, { owner: '', partner: '', note: '', status: '' }),
	// Ký tự đặc biệt và emoji — ảnh hưởng chiều cao dòng, kiểm tra luôn việc escape.
	mk(9, { note: '<script>alert(1)</script> & "trích dẫn" — ✅ ⚠️ 🔥' }),
	// Tất cả cùng dài một lúc — trường hợp tệ nhất.
	mk(10, {
		code: LONG_CODE,
		partner: LONG_PARTNER,
		owner: LONG_VI,
		status: LONGEST_STATUS,
		quantity: 999_999_999,
		amount: 999_999_999_999,
		note: LONG_NOTE,
	}),
]

/** Bảng rỗng — phải có empty state, không được là một khung trắng (quy tắc E). */
export const emptyRows: Row[] = []

/** 10.000 dòng — bắt buộc phải virtualize, đo INP khi cuộn (quy tắc T và F). */
export const hugeRows: Row[] = Array.from({ length: 10_000 }, (_, i) =>
	mk(i + 1, i % 50 === 0 ? { owner: LONG_VI, status: LONGEST_STATUS } : {}),
)

/** Một dòng duy nhất — bắt lỗi layout chỉ đúng khi có nhiều dòng. */
export const singleRow: Row[] = [worstCaseRows[0]]

export const MOCK_PROFILES: Record<string, Row[]> = {
	long: worstCaseRows,
	empty: emptyRows,
	huge: hugeRows,
	single: singleRow,
}

/** Đọc profile từ ?mock=... hoặc VITE_MOCK_PROFILE. Trả về null nếu không bật. */
export function getMockProfile(): Row[] | null {
	if (typeof window === 'undefined') return null
	const fromUrl = new URLSearchParams(window.location.search).get('mock')
	const key = fromUrl ?? (import.meta as { env?: Record<string, string> }).env?.VITE_MOCK_PROFILE
	return key ? (MOCK_PROFILES[key] ?? null) : null
}
