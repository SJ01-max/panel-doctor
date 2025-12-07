export default function Header() {
  return (
    <header className="backdrop-blur-xl bg-white/80 border-b border-slate-200/50 fixed top-0 left-0 right-0 z-50 shadow-sm">
      <div className="w-full px-6">
        <div className="flex items-center justify-between h-16">
          {/* 로고 */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-violet-600 to-purple-600 rounded-lg flex items-center justify-center shadow-md">
              <i className="ri-dashboard-3-line text-white text-lg"></i>
            </div>
            <span className="font-bold text-slate-800 text-lg tracking-tight">Panel System</span>
          </div>
        </div>
      </div>
    </header>
  );
}
