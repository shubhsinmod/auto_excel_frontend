import React, { useState, useEffect, useMemo } from 'react';
import {
  RefreshCw,
  Search,
  UploadCloud,
  FileSpreadsheet,
  AlertCircle
} from 'lucide-react';
import { migrationService } from '../services/migrationService';
import { MigrationHistorySummary, HistoryFileItem } from '../types';

interface HistoryStepProps {
  onUploadNew: () => void;
  onFileCountUpdate?: (count: number) => void;
}

export const HistoryStep: React.FC<HistoryStepProps> = ({ onUploadNew, onFileCountUpdate }) => {
  const [data, setData] = useState<MigrationHistorySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchHistory = async () => {
    setLoading(true);
    setError(null);
    try {
      const summary = await migrationService.getHistory(200);
      setData(summary);
      if (onFileCountUpdate) {
        onFileCountUpdate(summary.totalFiles);
      }
    } catch (err: any) {
      console.error('Failed to load migration history:', err);
      setError(err?.message || 'Failed to load upload history.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchHistory();
  }, []);

  const filteredFiles = useMemo(() => {
    if (!data?.files) return [];
    return data.files.filter((file: HistoryFileItem) => {
      return file.fileName.toLowerCase().includes(searchQuery.toLowerCase());
    });
  }, [data, searchQuery]);

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    try {
      const d = new Date(dateString);
      if (isNaN(d.getTime())) return dateString;
      return d.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateString;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with Title and Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 text-blue-700 rounded-lg">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Upload History</h2>
              <p className="text-sm text-slate-500">
                List of all uploaded Excel and CSV files.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 self-stretch sm:self-auto">
          <button
            type="button"
            onClick={fetchHistory}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 px-3.5 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg shadow-sm hover:bg-slate-50 hover:text-slate-900 disabled:opacity-50 transition-colors"
            title="Refresh history"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-600' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <button
            type="button"
            onClick={onUploadNew}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg shadow-sm hover:bg-blue-700 transition-colors"
          >
            <UploadCloud className="w-4 h-4" />
            <span>Upload New File</span>
          </button>
        </div>
      </div>

      {/* Search Toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by file name..."
            className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 p-1"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="text-sm">
            <span className="font-semibold">Error:</span> {error}
          </div>
        </div>
      )}

      {/* Files Table Card */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        {loading && !data ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3">
            <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
            <p className="text-sm text-slate-600 font-medium">Loading file history...</p>
          </div>
        ) : filteredFiles.length === 0 ? (
          <div className="py-16 px-4 text-center">
            <div className="w-14 h-14 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
              <FileSpreadsheet className="w-7 h-7" />
            </div>
            <h3 className="text-base font-semibold text-slate-800">No files found</h3>
            <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">
              {searchQuery
                ? 'No files match your search criteria. Try a different keyword.'
                : 'No files have been uploaded yet. Upload your first file to start.'}
            </p>
            {searchQuery ? (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="mt-4 px-4 py-2 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
              >
                Clear search
              </button>
            ) : (
              <button
                type="button"
                onClick={onUploadNew}
                className="mt-4 px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors"
              >
                Upload File
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-xs uppercase font-semibold text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4 w-16 text-center">#</th>
                  <th className="py-3 px-4">File Name</th>
                  <th className="py-3 px-4 text-right">Upload Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredFiles.map((file, index) => {
                  const isCsv = file.fileName.toLowerCase().endsWith('.csv');

                  return (
                    <tr
                      key={String(file.fileId || file.uploadId || index)}
                      className="hover:bg-slate-50/80 transition-colors"
                    >
                      {/* Index / ID */}
                      <td className="py-3.5 px-4 font-mono text-xs text-slate-500 text-center">
                        {typeof file.fileId === 'number' ? (
                          <span className="font-semibold text-slate-700">#{file.fileId}</span>
                        ) : (
                          <span className="text-slate-400">#{index + 1}</span>
                        )}
                      </td>

                      {/* File Name */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={`p-2 rounded-lg shrink-0 ${
                              isCsv
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            }`}
                          >
                            <FileSpreadsheet className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900 break-all">{file.fileName}</p>
                            <span className="text-xs text-slate-400">
                              {isCsv ? 'CSV Dataset' : 'Excel Workbook'}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Upload Date */}
                      <td className="py-3.5 px-4 text-xs text-slate-500 text-right whitespace-nowrap">
                        {formatDate(file.uploadedAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer info bar */}
        {data && data.files.length > 0 && (
          <div className="py-3 px-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
            <span>
              Showing {filteredFiles.length} of {data.totalFiles} files
              {searchQuery ? ` matching "${searchQuery}"` : ''}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
