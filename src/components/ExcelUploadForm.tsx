import React, { useRef, useState } from 'react';
import { excelService } from '../services/excelService';
import { ExcelAnalysisResponse } from '../types';
import { UploadCloud, AlertCircle, Loader2 } from 'lucide-react';

interface ExcelUploadFormProps {
  onSuccess: (session: ExcelAnalysisResponse) => void;
  onBack?: () => void;
}

export const ExcelUploadForm: React.FC<ExcelUploadFormProps> = ({ onSuccess }) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingText, setLoadingText] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = async (file: File) => {
    setError(null);
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!ext) {
      setError('Unsupported file type. Please upload a file with an extension.');
      return;
    }
    if (file.size === 0) {
      setError('The selected file is empty. Please upload a valid file.');
      return;
    }

    setIsLoading(true);
    setLoadingText('Uploading and validating file...');
    try {
      // Backend checks exact-content duplicates before analyzing or migrating.
      const session = await excelService.uploadExcel(file);
      setLoadingText('Starting migration...');
      onSuccess(session);
    } catch (err: any) {
      setError(err?.message || 'Failed to upload file.');
    } finally {
      setIsLoading(false);
      setLoadingText('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragOver(false);
    const file = event.dataTransfer.files?.[0];
    if (file) void processFile(file);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 flex items-start gap-3" role="alert">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="text-sm"><span className="font-semibold">Upload stopped:</span> {error}</div>
        </div>
      )}

      <div
        onDragOver={(event) => { event.preventDefault(); setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        onClick={() => !isLoading && fileInputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-xl p-10 text-center transition-all ${isLoading ? 'pointer-events-none opacity-70' : 'cursor-pointer'} ${isDragOver ? 'border-blue-500 bg-blue-50' : 'border-slate-300 bg-white hover:bg-slate-50 hover:border-slate-400 shadow-sm'}`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,.xlsm,.xlsb,.csv,.tsv,.txt,.json,.xml,.parquet"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void processFile(file);
          }}
          className="hidden"
          disabled={isLoading}
        />
        {isLoading ? (
          <div className="py-6 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
            <p className="text-sm font-medium text-slate-800">{loadingText}</p>
            <p className="text-xs text-slate-500">Please wait. Duplicate files are stopped automatically.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="w-16 h-16 rounded-full bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center mx-auto shadow-sm">
              <UploadCloud className="w-8 h-8" />
            </div>
            <div>
              <p className="text-base font-semibold text-slate-800">Upload Excel / CSV File</p>
              <p className="text-xs text-slate-500 mt-2">Drag and drop your file here, or click to browse.</p>
            </div>
            <span className="inline-flex px-5 py-2.5 bg-blue-600 text-white font-medium text-sm rounded-lg shadow-sm">Browse File</span>
            <p className="text-xs text-slate-500">After upload, migration runs automatically and only the final result is shown.</p>
          </div>
        )}
      </div>
    </div>
  );
};
