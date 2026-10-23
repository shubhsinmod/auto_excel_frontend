import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { ExcelUploadForm } from './components/ExcelUploadForm';
import { ResultsStep } from './components/ResultsStep';
import { HistoryStep } from './components/HistoryStep';
import { MigrationStep, ExcelAnalysisResponse } from './types';
import { LoginPage } from './components/LoginPage';
import { migrationService } from './services/migrationService';

export const App: React.FC = () => {
  const [username, setUsername] = useState<string | null>(() => sessionStorage.getItem('migration.username'));
  const [step, setStep] = useState<MigrationStep>('UPLOAD_EXCEL');
  const [excelSession, setExcelSession] = useState<ExcelAnalysisResponse | null>(null);
  const [fileCount, setFileCount] = useState<number | undefined>(undefined);

  // Load initial file count for the Navbar badge
  useEffect(() => {
    if (username) {
      migrationService.getHistory(1)
        .then((summary) => setFileCount(summary.totalFiles))
        .catch(() => {});
    }
  }, [username, step]);

  const handleLogin = (signedInUsername: string) => {
    sessionStorage.setItem('migration.username', signedInUsername);
    setUsername(signedInUsername);
  };

  const handleLogout = () => {
    sessionStorage.removeItem('migration.username');
    setUsername(null);
    setExcelSession(null);
    setStep('UPLOAD_EXCEL');
  };

  const handleExcelUploadSuccess = (session: ExcelAnalysisResponse) => {
    setExcelSession(session);
    // Skip the preview/mapping screen. ResultsStep starts the migration and
    // displays progress followed by the final report.
    setStep('RESULT');
  };

  const handleReset = () => {
    setExcelSession(null);
    setStep('UPLOAD_EXCEL');
  };

  if (!username) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 font-sans">
      <Navbar
        username={username}
        currentStep={step}
        onNavigate={(newStep) => setStep(newStep)}
        fileCount={fileCount}
        onLogout={handleLogout}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {step === 'UPLOAD_EXCEL' && (
          <div className="space-y-6">
            <div className="text-center sm:text-left">
              <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Move data. Preserve relationships.</h2>
              <p className="mt-1 text-sm text-slate-500">
                Clean, validate, map, and migrate spreadsheet data into relational databases with reliable foreign-key resolution and source-file tracking.
              </p>
            </div>
            <ExcelUploadForm onSuccess={handleExcelUploadSuccess} onBack={() => {}} />
          </div>
        )}

        {step === 'RESULT' && excelSession && (
          <ResultsStep excelSession={excelSession} onReset={handleReset} />
        )}

        {step === 'HISTORY' && (
          <HistoryStep
            onUploadNew={() => setStep('UPLOAD_EXCEL')}
            onFileCountUpdate={(count) => setFileCount(count)}
          />
        )}
      </main>

      <footer className="border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-500">
        DataBridge - Automated Data Migration Platform
      </footer>
    </div>
  );
};

export default App;
