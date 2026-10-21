import { Layers } from 'lucide-react';

interface NavbarProps {
  username: string;
  onLogout: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ username, onLogout }) => {
  return (
    <header className="border-b border-slate-200 bg-white/90 backdrop-blur sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-blue-50 rounded-lg text-blue-600 border border-blue-100">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              DataBridge
            </h1>
            <p className="text-xs text-slate-500">Automated Data Migration Platform</p>
          </div>
        </div>
        <div className="flex items-center gap-4 text-xs text-slate-500">
          <span className="hidden text-sm font-medium text-slate-700 sm:inline">{username}</span>
          <button type="button" onClick={onLogout} className="font-semibold text-slate-600 hover:text-slate-950" title="Sign out">
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
};
