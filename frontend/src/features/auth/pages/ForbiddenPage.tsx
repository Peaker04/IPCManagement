import { Link } from 'react-router-dom';
import { ShieldAlert, ArrowLeft, Lock } from 'lucide-react';
import { ROUTES } from '../../../routes/routeConfig';

/**
 * ForbiddenPage (403)
 * Hiển thị khi người dùng đã xác thực nhưng không đủ quyền (Role/Permission) truy cập.
 */
const ForbiddenPage = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[75vh] w-full px-4 animate-in fade-in duration-500">
      <div className="relative flex flex-col items-center max-w-md w-full p-8 text-center bg-white/70 backdrop-blur-xl border border-slate-200/60 shadow-2xl rounded-3xl overflow-hidden">
        
        {/* Background Decorative Glow */}
        <div className="absolute -top-12 -right-12 w-32 h-32 bg-rose-500/10 blur-3xl rounded-full pointer-events-none"></div>
        <div className="absolute -bottom-12 -left-12 w-32 h-32 bg-orange-500/10 blur-3xl rounded-full pointer-events-none"></div>

        <div className="relative flex items-center justify-center w-20 h-20 mb-6 rounded-2xl bg-gradient-to-br from-rose-100 to-orange-50 shadow-inner border border-white">
          <div className="absolute inset-0 bg-white/40 rounded-2xl backdrop-blur-sm"></div>
          <ShieldAlert className="relative w-10 h-10 text-rose-600 drop-shadow-sm" strokeWidth={1.5} />
          <div className="absolute -bottom-2 -right-2 flex items-center justify-center w-8 h-8 rounded-full bg-white shadow-md border border-slate-100">
            <Lock className="w-4 h-4 text-slate-700" strokeWidth={2} />
          </div>
        </div>

        <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight mb-3">
          403 Forbidden
        </h1>
        
        <p className="text-base text-slate-600 mb-8 leading-relaxed">
          Rất tiếc, tài khoản của bạn hiện tại không được cấp quyền để truy cập vào phân hệ này. Vui lòng liên hệ Quản trị viên nếu bạn cần hỗ trợ.
        </p>

        <Link
          to={ROUTES.DASHBOARD}
          className="group relative inline-flex items-center justify-center gap-2 px-6 py-3 font-semibold text-white transition-all duration-300 ease-in-out bg-slate-900 rounded-full hover:bg-slate-800 hover:shadow-lg hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2"
        >
          <ArrowLeft className="w-4 h-4 transition-transform duration-300 group-hover:-translate-x-1" strokeWidth={2.5} />
          <span>Quay về Bảng điều khiển</span>
        </Link>
      </div>
    </div>
  );
};

export default ForbiddenPage;
