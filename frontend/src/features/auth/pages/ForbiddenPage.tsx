import { Link } from 'react-router-dom';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import { ROUTES } from '../../../routes/routeConfig';

/**
 * ForbiddenPage (403) — Placeholder cho FE-5.6
 * Hiển thị khi user đã đăng nhập nhưng không có quyền vào route.
 */
const ForbiddenPage = () => {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-50">
        <ShieldAlert size={32} className="text-red-500" />
      </div>
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Truy cập bị từ chối</h1>
        <p className="mt-1 text-sm text-slate-500">
          Bạn không có quyền truy cập trang này.
        </p>
      </div>
      <Link
        to={ROUTES.DASHBOARD}
        className="mt-2 inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
      >
        <ArrowLeft size={16} />
        Về trang chủ
      </Link>
    </div>
  );
};

export default ForbiddenPage;
