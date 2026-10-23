import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/button';
import { useAuth } from '../../store/useAuth';

export function ForbiddenPage() {
  const navigate = useNavigate();
  const { landingPath } = useAuth();

  return (
    <div className="flex h-full w-full flex-col items-center justify-center p-8 text-center bg-white">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-50 text-amber-600 font-bold text-2xl border border-amber-200">
        403
      </div>
      <h1 className="text-base font-bold text-slate-900 mb-1">Truy cập bị từ chối</h1>
      <p className="text-xs text-slate-500 max-w-sm mb-6 leading-relaxed">
        Tài khoản của bạn không có đủ thẩm quyền truy cập vào phân hệ này. Vui lòng liên hệ quản trị viên nếu cần cấp quyền.
      </p>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
          Quay lại
        </Button>
        <Button variant="default" size="sm" onClick={() => navigate(landingPath)}>
          Về bàn điều hành
        </Button>
      </div>
    </div>
  );
}
