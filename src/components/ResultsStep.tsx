import React, { useState, useEffect, useRef } from 'react';
import { ExcelAnalysisResponse, MigrationExecutionResponse, MigrationJobStatus } from '../types';
import { migrationService } from '../services/migrationService';
import {
  CheckCircle2,
  Loader2,
  RefreshCw,
  AlertCircle,
  Download,
  RotateCcw
} from 'lucide-react';

interface ResultsStepProps {
  excelSession: ExcelAnalysisResponse;
  onReset: () => void;
  onBackToPreview?: () => void;
}

export const ResultsStep: React.FC<ResultsStepProps> = ({
  excelSession,
  onReset
}) => {
  const [isExecuting, setIsExecuting] = useState(true);
  const [result, setResult] = useState<MigrationExecutionResponse | null>(null);
  const [jobStatus, setJobStatus] = useState<MigrationJobStatus | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [maxPercent, setMaxPercent] = useState<number>(5);

  const pollingActiveRef = useRef(false);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopPolling = () => {
    pollingActiveRef.current = false;
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  };

  const pollStatus = async (uploadId: string) => {
    if (!pollingActiveRef.current) return;

    try {
      const current = await migrationService.getMigrationStatus(uploadId);
      setJobStatus(current);

      if (current.status === 'COMPLETED') {
        stopPolling();
        setIsExecuting(false);
        if (current.result) {
          setResult(current.result);
        } else {
          setResult({
            uploadId,
            status: 'COMPLETED',
            transaction: 'COMMITTED',
            transactionStatus: 'COMMITTED',
            canExecute: true,
            tables: {},
            totalInserted: current.totalInserted,
            totalReused: current.totalReused,
            verificationCounts: {},
            processingTimeSeconds: current.elapsedSeconds,
            message: 'Database migration completed successfully.'
          });
        }
        return;
      }

      if (current.status === 'BLOCKED' || current.status === 'FAILED') {
        stopPolling();
        setIsExecuting(false);
        setResult(current.result || null);
        return;
      }

      if (current.transactionStatus === 'UNCERTAIN') {
        stopPolling();
        setIsExecuting(false);
        return;
      }

      // Schedule next poll in 1000ms
      if (pollingActiveRef.current) {
        pollTimerRef.current = setTimeout(() => pollStatus(uploadId), 1000);
      }
    } catch (pollErr: any) {
      console.warn('Temporary network issue during status poll. Reconnecting...', pollErr);
      if (pollingActiveRef.current) {
        pollTimerRef.current = setTimeout(() => pollStatus(uploadId), 2000);
      }
    }
  };

  const runMigration = async () => {
    stopPolling();
    setIsExecuting(true);

    const uploadId = excelSession.uploadId;

    try {
      let initialJob: MigrationJobStatus | null = null;
      try {
        initialJob = await migrationService.getMigrationStatus(uploadId);
      } catch {
        // Not started yet
      }

      if (!initialJob || initialJob.status === 'PENDING' || initialJob.transactionStatus === 'NOT_EXECUTED') {
        if (initialJob?.status === 'BLOCKED') {
          setJobStatus(initialJob);
          setResult(initialJob.result || null);
          setIsExecuting(false);
          return;
        }
        initialJob = await migrationService.startMigration(uploadId);
      }

      setJobStatus(initialJob);

      if (initialJob.status === 'COMPLETED') {
        setIsExecuting(false);
        setResult(initialJob.result || null);
        return;
      }

      if (initialJob.status === 'BLOCKED' || initialJob.status === 'FAILED') {
        setIsExecuting(false);
        setResult(initialJob.result || null);
        return;
      }

      pollingActiveRef.current = true;
      pollTimerRef.current = setTimeout(() => pollStatus(uploadId), 500);

    } catch (err: any) {
      console.error('Failed to start migration:', err);
      try {
        const fallback = await migrationService.getMigrationStatus(uploadId);
        if (fallback) {
          setJobStatus(fallback);
          pollingActiveRef.current = true;
          pollTimerRef.current = setTimeout(() => pollStatus(uploadId), 1000);
          return;
        }
      } catch {}
      setIsExecuting(false);
    }
  };

  useEffect(() => {
    runMigration();
    return () => {
      stopPolling();
    };
  }, [excelSession.uploadId]);

  const handleRetry = () => {
    if (isExecuting) return;
    setResult(null);
    runMigration();
  };

  const handleDownloadReport = async () => {
    try {
      setIsDownloading(true);
      await migrationService.downloadReport(excelSession.uploadId);
    } catch (err) {
      console.error('Failed to download report', err);
    } finally {
      setIsDownloading(false);
    }
  };

  // Safe determination of completion
  const isCommitted =
    !isExecuting &&
    (result?.transaction === 'COMMITTED' ||
      jobStatus?.transactionStatus === 'COMMITTED' ||
      result?.status === 'COMPLETED' ||
      jobStatus?.status === 'COMPLETED');

  useEffect(() => {
    if (jobStatus?.percentComplete !== undefined && jobStatus.percentComplete !== null) {
      const current = Math.round(jobStatus.percentComplete);
      setMaxPercent(prev => Math.min(100, Math.max(prev, current)));
    }
  }, [jobStatus?.percentComplete]);

  useEffect(() => {
    if (isCommitted) {
      setMaxPercent(100);
    }
  }, [isCommitted]);

  const displayPercent = isCommitted ? 100 : Math.max(5, maxPercent);

  return (
    <div className="max-w-2xl mx-auto py-4">
      {/* 1. MIGRATION IN PROGRESS SCREEN */}
      {isExecuting && (
        <div className="bg-white border border-slate-200 rounded-xl p-8 sm:p-10 shadow-sm text-center space-y-6">
          <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto border border-blue-100">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>

          <div>
            <h2 className="text-2xl font-bold text-slate-900">
              Migration in progress
            </h2>
            <p className="text-slate-600 mt-2 text-sm sm:text-base">
              Your Excel data is being processed and saved. Please wait...
            </p>
          </div>

          <div className="space-y-2 pt-2">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-600 px-1">
              <span>Progress</span>
              <span className="font-mono text-blue-600 font-bold">{displayPercent}%</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden shadow-inner">
              <div
                className="bg-blue-600 h-3 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${displayPercent}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* 2. SIMPLE SUCCESS SCREEN */}
      {!isExecuting && isCommitted && (
        <div className="bg-white border border-slate-200 rounded-xl p-8 sm:p-12 shadow-sm text-center space-y-6">
          <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto border border-emerald-100">
            <CheckCircle2 className="w-10 h-10 text-emerald-600" />
          </div>

          <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">
              Migration Completed Successfully!
            </h2>
            <p className="text-slate-600 mt-2 text-sm sm:text-base">
              Your Excel data has been processed and saved successfully.
            </p>
          </div>

          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              type="button"
              onClick={onReset}
              className="w-full sm:w-auto px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm rounded-lg transition-colors flex items-center justify-center gap-2 shadow-sm cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              Upload Another File
            </button>

            <button
              type="button"
              disabled={isDownloading}
              onClick={handleDownloadReport}
              className="w-full sm:w-auto px-6 py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 font-medium text-sm rounded-lg transition-colors flex items-center justify-center gap-2 shadow-sm cursor-pointer disabled:opacity-50"
            >
              {isDownloading ? (
                <Loader2 className="w-4 h-4 animate-spin text-slate-600" />
              ) : (
                <Download className="w-4 h-4 text-slate-600" />
              )}
              Download Report
            </button>
          </div>
        </div>
      )}

      {/* 3. SIMPLE ERROR / FAILED SCREEN */}
      {!isExecuting && !isCommitted && (
        <div className="bg-white border border-slate-200 rounded-xl p-8 sm:p-12 shadow-sm text-center space-y-6">
          <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto border border-rose-100">
            <AlertCircle className="w-10 h-10 text-rose-600" />
          </div>

          <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">
              Migration Failed
            </h2>
            <p className="text-slate-600 mt-2 text-sm sm:text-base">
              Migration failed. Please try again or contact support.
            </p>
          </div>

          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              type="button"
              onClick={handleRetry}
              className="w-full sm:w-auto px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm rounded-lg transition-colors flex items-center justify-center gap-2 shadow-sm cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              Retry Migration
            </button>

            <button
              type="button"
              onClick={onReset}
              className="w-full sm:w-auto px-6 py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 font-medium text-sm rounded-lg transition-colors flex items-center justify-center gap-2 shadow-sm cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              Upload Another File
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
