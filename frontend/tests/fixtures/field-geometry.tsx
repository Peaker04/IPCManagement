import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import '@/styles/index.css';
import '@/styles/components/tables.css';
import { FieldRow, SearchField } from '@/components/common';
import { Input } from '@/components/ui/input';
import { QuotationIngredientSelector } from '@/features/purchasing/quotation/SupplierQuotationSection';

export function Fixture() {
  const [showError, setShowError] = useState(false);
  return (
    <main className="space-y-8 p-8">
      <button type="button" onClick={() => setShowError((value) => !value)}>Đổi trạng thái lỗi</button>

      <section className="grid gap-4" aria-label="Anatomy chuẩn">
        <SearchField id="search-description" label="Tìm nguyên liệu" description="Tìm theo mã hoặc tên nguyên liệu" />
        <FieldRow label="Số lượng" htmlFor="quantity" description="Nhập số lượng theo đơn vị chuẩn" error={showError ? 'Số lượng không hợp lệ' : undefined} errorId="quantity-error">
          <Input id="quantity" aria-describedby={showError ? 'quantity-error' : undefined} aria-invalid={showError || undefined} />
        </FieldRow>
      </section>

      <section aria-label="Cặp trường báo giá">
        <QuotationIngredientSelector
          search=""
          selectedIngredientId="ingredient-1"
          ingredients={[{ ingredientId: 'ingredient-1', ingredientCode: 'NL-01', ingredientName: 'Gạo thơm' }]}
          error={showError ? { title: 'Thiếu nguyên liệu', message: 'Cần chọn nguyên liệu' } : undefined}
          onSearchChange={() => undefined}
          onSelectIngredient={() => undefined}
        />
      </section>

      <section className="w-[420px] max-w-full" aria-label="Nhãn dài">
        <div data-wrapped-row className="grid grid-cols-2 gap-3">
          <FieldRow className="min-w-0" label="Nguyên liệu có định mức áp dụng cho khách hàng trong tuần đang chọn" htmlFor="long-label" description="Thông tin hướng dẫn dài vẫn phải nằm trong đúng cột và không chồng lên trường kế tiếp">
            <Input id="long-label" />
          </FieldRow>
          <FieldRow className="min-w-0" label="Ghi chú kiểm tra" htmlFor="long-note">
            <Input id="long-note" />
          </FieldRow>
        </div>
        <FieldRow className="mt-3" label="Trường ở hàng kế tiếp" htmlFor="next-row">
          <Input id="next-row" />
        </FieldRow>
      </section>

      <section className="flex items-center gap-3" aria-label="Thanh công cụ tìm kiếm">
        <SearchField id="toolbar-search" label="Tìm dòng nguyên liệu" hideLabel width="compact" />
        <span>Kết quả</span>
      </section>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(<Fixture />);
