import { useNavigate } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { useAuth } from '../../store/useAuth';

export function ForbiddenPage() {
  const navigate = useNavigate();
  const { landingPath, operationalMode, hasRole } = useAuth();
  const isAdmin = hasRole(['Admin', 'ADMIN', 'Quản trị viên']);

  return (
    <div className="flex h-full w-full flex-col items-center justify-center p-8 text-center bg-white">
      <div className="mb-4 flex flex-col items-center justify-center gap-1.5">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-600 border border-amber-200">
          <ShieldAlert className="size-6 text-amber-600" aria-hidden="true" />
        </div>
        <span className="font-mono text-xs font-bold text-amber-700 bg-amber-100/80 px-2 py-0.5 rounded border border-amber-200/80">
          403
        </span>
      </div>
      <h1 className="text-base font-bold text-slate-900 mb-1">Truy cập bị từ chối</h1>
      <p className="text-xs text-slate-500 max-w-sm mb-6 leading-relaxed">
        Tài khoản của bạn không có đủ thẩm quyền truy cập vào phân hệ này, hoặc phân hệ không thuộc chế độ vận hành hiện tại. Hiện đang ở chế độ: <strong className="text-slate-700">{operationalMode === 'MATERIAL_RECONCILIATION' ? 'Đối soát MRX' : 'Mặc định (DEFAULT)'}</strong>.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
          Quay lại
        </Button>
        {isAdmin && (
          <Button variant="outline" size="sm" onClick={() => navigate('/settings/advanced?view=mode')}>
            Cấu hình chế độ vận hành
          </Button>
        )}
        <Button variant="default" size="sm" onClick={() => navigate(landingPath)}>
          Về bàn điều hành
        </Button>
      </div>
    </div>
  );
}
