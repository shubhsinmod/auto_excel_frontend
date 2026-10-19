import React, { useState } from 'react';
import { Navbar } from './components/Navbar';
import { ExcelUploadForm } from './components/ExcelUploadForm';
import { ResultsStep } from './components/ResultsStep';
import { MigrationStep, ExcelAnalysisResponse } from './types';
import { LoginPage } from './components/LoginPage';

export const App: React.FC = () => {
  const [username, setUsername] = useState<string | null>(() => sessionStorage.getItem('migration.username'));
  const [step, setStep] = useState<MigrationStep>('UPLOAD_EXCEL');
  const [excelSession, setExcelSession] = useState<ExcelAnalysisResponse | null>(null);

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
      <Navbar username={username} onLogout={handleLogout} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {step === 'UPLOAD_EXCEL' && (
          <ExcelUploadForm onSuccess={handleExcelUploadSuccess} onBack={() => {}} />
        )}

        {step === 'RESULT' && excelSession && (
          <ResultsStep excelSession={excelSession} onReset={handleReset} />
        )}
      </main>

      <footer className="border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-500">
        Intelligent Excel-to-SQL Data Migration Platform
      </footer>
    </div>
  );
};

export default App;
