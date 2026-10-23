import React from 'react';
import { Layers, UploadCloud, History } from 'lucide-react';
import { MigrationStep } from '../types';

interface NavbarProps {
  username: string;
  currentStep: MigrationStep;
  onNavigate: (step: MigrationStep) => void;
  fileCount?: number;
  onLogout: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  username,
  currentStep,
  onNavigate,
  fileCount,
  onLogout
}) => {
  const isUploadActive = currentStep === 'UPLOAD_EXCEL' || currentStep === 'RESULT' || currentStep === 'PROCESSING';
  const isHistoryActive = currentStep === 'HISTORY';

  return (
    <header className="border-b border-slate-200 bg-white/90 backdrop-blur sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center space-x-6">
          <div
            onClick={() => onNavigate('UPLOAD_EXCEL')}
            className="flex items-center space-x-3 cursor-pointer select-none"
            title="Go to Upload"
          >
            <div className="p-2 bg-blue-50 rounded-lg text-blue-600 border border-blue-100">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                DataBridge
              </h1>
              <p className="text-xs text-slate-500 hidden sm:block">Automated Data Migration Platform</p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onNavigate('UPLOAD_EXCEL')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                isUploadActive
                  ? 'bg-blue-50 text-blue-700 font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <UploadCloud className="w-4 h-4" />
              <span>Upload & Migrate</span>
            </button>

            <button
              type="button"
              onClick={() => onNavigate('HISTORY')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                isHistoryActive
                  ? 'bg-blue-50 text-blue-700 font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <History className="w-4 h-4" />
              <span>File History</span>
              {typeof fileCount === 'number' && fileCount > 0 && (
                <span
                  className={`px-2 py-0.5 text-xs rounded-full font-semibold ${
                    isHistoryActive
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-200 text-slate-700'
                  }`}
                  title={`${fileCount} files in history`}
                >
                  {fileCount}
                </span>
              )}
            </button>
          </nav>
        </div>

        <div className="flex items-center gap-4 text-xs text-slate-500">
          <span className="hidden text-sm font-medium text-slate-700 sm:inline">{username}</span>
          <button
            type="button"
            onClick={onLogout}
            className="font-semibold text-slate-600 hover:text-slate-950 px-2 py-1 rounded hover:bg-slate-100"
            title="Sign out"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
};

