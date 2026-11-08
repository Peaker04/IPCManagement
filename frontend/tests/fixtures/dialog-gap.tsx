import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import '@/styles/index.css';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

function StandardFixture() {
  return (
    <>
      <Dialog open onOpenChange={() => undefined}>
        <DialogContent aria-label="Khoảng cách dialog chuẩn">
          <DialogHeader data-region="header"><DialogTitle>Dialog chuẩn</DialogTitle></DialogHeader>
          <div data-region="body">Nội dung biểu mẫu</div>
          <div data-region="error" role="alert">Thông báo lỗi biểu mẫu</div>
          <DialogFooter data-region="footer"><Button type="button">Lưu</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmDialog open title="Xác nhận không có nội dung bổ sung" ariaLabel="Xác nhận không có nội dung bổ sung" description="Mô tả xác nhận" confirmLabel="Xác nhận" onConfirm={() => undefined} onOpenChange={() => undefined} />
      <ConfirmDialog open title="Xác nhận có nội dung bổ sung" ariaLabel="Xác nhận có nội dung bổ sung" description="Mô tả xác nhận" confirmLabel="Xác nhận" onConfirm={() => undefined} onOpenChange={() => undefined}>
        <div data-confirm-body>Nội dung bổ sung</div>
      </ConfirmDialog>
    </>
  );
}

function LongFixture() {
  return (
    <Dialog open onOpenChange={() => undefined}>
      <DialogContent aria-label="Dialog nội dung dài" className="max-h-64">
        <DialogHeader data-region="header"><DialogTitle>Dialog nội dung dài</DialogTitle></DialogHeader>
        <div data-region="body">{Array.from({ length: 30 }, (_, index) => <p key={index}>Dòng nội dung dài {index + 1}</p>)}</div>
        <div role="alert">Lỗi ở cuối biểu mẫu</div>
        <DialogFooter data-region="footer"><Button type="button">Hoàn tất</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Generic consumer that owns both inter-region spacing and its body scroll; this is not a Weekly Editor production fixture.
function ManagedFixture() {
  return (
    <Dialog open onOpenChange={() => undefined}>
      <DialogContent aria-label="Dialog tự quản bố cục" className="h-[70vh] max-h-[70vh] gap-0 !overflow-hidden !p-0">
        <DialogHeader data-region="header" className="shrink-0 border-b px-6 py-3"><DialogTitle>Dialog tự quản bố cục</DialogTitle></DialogHeader>
        <div data-region="managed-body" className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          {Array.from({ length: 40 }, (_, index) => <p key={index}>Dòng trình soạn thảo {index + 1}</p>)}
        </div>
        <DialogFooter data-region="footer" className="shrink-0 border-t px-6 py-3"><Button type="button">Đóng</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NestedFixture() {
  const [childOpen, setChildOpen] = useState(false);
  return (
    <Dialog open onOpenChange={() => undefined}>
      <DialogContent aria-label="Dialog cha">
        <DialogHeader><DialogTitle>Dialog cha</DialogTitle></DialogHeader>
        <Button type="button" onClick={() => setChildOpen(true)}>Mở dialog con</Button>
        <Dialog open={childOpen} onOpenChange={setChildOpen}>
          <DialogContent aria-label="Dialog con">
            <DialogHeader><DialogTitle>Dialog con</DialogTitle></DialogHeader>
            <div>Nội dung con</div>
            <DialogFooter><Button type="button" onClick={() => setChildOpen(false)}>Đóng dialog con</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}

export function Fixture() {
  const mode = new URLSearchParams(location.search).get('mode') ?? 'standard';
  return <main>{mode === 'long' ? <LongFixture /> : mode === 'managed' ? <ManagedFixture /> : mode === 'nested' ? <NestedFixture /> : <StandardFixture />}</main>;
}

createRoot(document.getElementById('root')!).render(<Fixture />);
