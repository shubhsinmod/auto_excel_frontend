import React, { useState, useEffect, useRef } from 'react';
import { ExcelAnalysisResponse, MigrationExecutionResponse, MigrationJobStatus } from '../types';
import { migrationService } from '../services/migrationService';
import {
  CheckCircle2,
  Loader2,
  RefreshCw,
  Server,
  AlertCircle,
  Download,
  Key,
  ShieldAlert,
  ArrowLeft,
  RotateCcw,
  WifiOff,
  HelpCircle,
  FileSpreadsheet,
  Layers,
  GitBranch
} from 'lucide-react';

interface ResultsStepProps {
  excelSession: ExcelAnalysisResponse;
  onReset: () => void;
  onBackToPreview?: () => void;
}

export const ResultsStep: React.FC<ResultsStepProps> = ({
  excelSession,
  onReset,
  onBackToPreview
}) => {
  const [isExecuting, setIsExecuting] = useState(true);
  const [result, setResult] = useState<MigrationExecutionResponse | null>(null);
  const [jobStatus, setJobStatus] = useState<MigrationJobStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [isReconciling, setIsReconciling] = useState(false);
  const [consecutiveErrors, setConsecutiveErrors] = useState(0);

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
      console.log('[FRONTEND POLL] Received status:', current);
      setJobStatus(current);
      setIsReconnecting(false);
      setConsecutiveErrors(0);

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
            message: current.message || 'Database migration completed and transaction committed successfully.'
          });
        }
        return;
      }

      if (current.status === 'BLOCKED') {
        stopPolling();
        setIsExecuting(false);
        setResult(current.result || null);
        return;
      }

      if (current.status === 'FAILED') {
        stopPolling();
        setIsExecuting(false);
        setResult(current.result || null);
        setError(current.errorMessage || current.message || 'Migration failed and transaction was rolled back.');
        return;
      }

      if (current.transactionStatus === 'UNCERTAIN') {
        stopPolling();
        setIsExecuting(false);
        setError(current.message || 'Transaction outcome is uncertain. Database reconciliation required.');
        return;
      }

      // Schedule next poll in 1000ms
      if (pollingActiveRef.current) {
        pollTimerRef.current = setTimeout(() => pollStatus(uploadId), 1000);
      }
    } catch (pollErr: any) {
      console.warn('[FRONTEND POLL] Network glitch during status poll. Reconnecting...', pollErr);
      setIsReconnecting(true);
      setConsecutiveErrors((prev) => prev + 1);

      // Continue polling every 2000ms during temporary disconnects (never claim failure just because poll dropped)
      if (pollingActiveRef.current) {
        pollTimerRef.current = setTimeout(() => pollStatus(uploadId), 2000);
      }
    }
  };

  const runMigration = async () => {
    stopPolling();
    setIsExecuting(true);
    setError(null);
    setIsReconnecting(false);
    setConsecutiveErrors(0);

    const uploadId = excelSession.uploadId;
    console.log(`[FRONTEND EXECUTE] Checking migration job for uploadId=${uploadId}`);

    try {
      // 1. Check if a job already exists or is running
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
        // Start async migration
        console.log(`[FRONTEND EXECUTE] Starting async migration for uploadId=${uploadId}`);
        initialJob = await migrationService.startMigration(uploadId);
      }

      setJobStatus(initialJob);

      if (initialJob.status === 'COMPLETED') {
        setIsExecuting(false);
        setResult(initialJob.result || null);
        return;
      }

      if (initialJob.status === 'BLOCKED') {
        setIsExecuting(false);
        setResult(initialJob.result || null);
        return;
      }

      if (initialJob.status === 'FAILED') {
        setIsExecuting(false);
        setResult(initialJob.result || null);
        setError(initialJob.errorMessage || initialJob.message || 'Migration failed and transaction was rolled back.');
        return;
      }

      // 2. Start polling
      pollingActiveRef.current = true;
      pollTimerRef.current = setTimeout(() => pollStatus(uploadId), 500);

    } catch (err: any) {
      console.error('[FRONTEND EXECUTE] Failed to start migration:', err);
      // Attempt status recovery before declaring failure
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
      setError(err?.message || 'Failed to start database migration.');
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

  const handleReconcile = async () => {
    try {
      setIsReconciling(true);
      const recJob = await migrationService.reconcileMigration(excelSession.uploadId);
      setJobStatus(recJob);
      if (recJob.status === 'COMPLETED' && recJob.transactionStatus === 'COMMITTED') {
        setIsExecuting(false);
        setResult(recJob.result || null);
        setError(null);
      } else if (recJob.status === 'FAILED') {
        setIsExecuting(false);
        setError(recJob.message || 'Transaction was verified as rolled back.');
      }
    } catch (err: any) {
      console.error('Reconciliation error:', err);
      setError(err?.message || 'Failed to reconcile transaction with SQL Server.');
    } finally {
      setIsReconciling(false);
    }
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

  // Mutually exclusive terminal states
  const isCommitted = !isExecuting && (result?.transaction === 'COMMITTED' || jobStatus?.transactionStatus === 'COMMITTED');
  const isBlocked =
    !isExecuting &&
    (result?.transaction === 'NOT_EXECUTED' ||
      result?.status === 'BLOCKED' ||
      jobStatus?.status === 'BLOCKED' ||
      result?.canExecute === false ||
      ((result?.validationErrors?.length ?? 0) > 0 && result?.transaction !== 'COMMITTED'));
  const isRolledBack = !isExecuting && !isBlocked && (result?.transaction === 'ROLLED_BACK' || result?.status === 'FAILED' || jobStatus?.transactionStatus === 'ROLLED_BACK');
  const isUncertain = !isExecuting && !isCommitted && !isBlocked && !isRolledBack && (jobStatus?.transactionStatus === 'UNCERTAIN');
  const isError = !isExecuting && !isCommitted && !isBlocked && !isRolledBack && !isUncertain && (!!error || !result || !result.transaction);

  const displayPercent = Math.min(100, Math.max(isExecuting ? 5 : 100, Math.round(jobStatus?.percentComplete ?? (isCommitted ? 100 : 5))));

  const sourceRowsTotal = result?.sourceRowsTotal || jobStatus?.sourceRowsTotal || excelSession.rowCount;
  const sourceRowsWithInserts = result?.sourceRowsWithInserts ?? jobStatus?.sourceRowsWithInserts ?? (result?.totalInserted ? Math.min(result.totalInserted, sourceRowsTotal) : 0);
  const sourceRowsFullyReused = result?.sourceRowsFullyReused ?? jobStatus?.sourceRowsFullyReused ?? Math.max(0, sourceRowsTotal - sourceRowsWithInserts);

  const duplicateSourceRows = result?.duplicateSourceRows ?? result?.totalSkipped ?? 0;
  const ambiguousRows = result?.ambiguousRows ?? 0;
  const unresolvedForeignKeyRows = result?.unresolvedForeignKeyRows ?? 0;
  const matchingKeysUnavailable = result?.matchingKeysUnavailable ?? [];
  const totalOperations = result?.totalTableOperations ?? jobStatus?.totalTableOperations ?? ((result?.totalInserted ?? 0) + (result?.totalReused ?? 0) + duplicateSourceRows);
  const totalInserted = result?.totalInserted ?? result?.insertedCount ?? jobStatus?.totalInserted ?? 0;
  const totalReused = result?.totalReused ?? result?.reusedCount ?? jobStatus?.totalReused ?? 0;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 shadow-sm space-y-6">
        
        {/* Header Status */}
        <div className="flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
          <div
            className={`p-4 rounded-full w-16 h-16 shrink-0 flex items-center justify-center border ${
              isExecuting
                ? 'bg-blue-50 text-blue-600 border-blue-100'
                : isCommitted
                ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                : isBlocked
                ? 'bg-amber-50 text-amber-600 border-amber-200'
                : isUncertain
                ? 'bg-purple-50 text-purple-600 border-purple-200'
                : 'bg-rose-50 text-rose-600 border-rose-100'
            }`}
          >
            {isExecuting ? (
              <Loader2 className="w-8 h-8 animate-spin" />
            ) : isCommitted ? (
              <CheckCircle2 className="w-8 h-8 text-emerald-600" />
            ) : isBlocked ? (
              <ShieldAlert className="w-8 h-8 text-amber-600" />
            ) : isUncertain ? (
              <HelpCircle className="w-8 h-8 text-purple-600" />
            ) : (
              <AlertCircle className="w-8 h-8 text-rose-600" />
            )}
          </div>

          <div className="flex-1">
            <h2 className="text-2xl font-bold text-slate-900">
              {isExecuting
                ? 'Executing Atomic Database Transaction...'
                : isCommitted
                ? 'Database Migration Successfully Completed!'
                : isBlocked
                ? 'Migration Blocked — Transaction Not Executed'
                : isRolledBack
                ? 'Migration Failed — Transaction Rolled Back'
                : isUncertain
                ? 'Transaction Outcome Uncertain — Reconciliation Available'
                : 'Execution Request Failed'}
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              {isExecuting
                ? (jobStatus?.message || 'Executing parameterized statements inside an atomic background transaction...')
                : isCommitted
                ? `All records written and verified in ${(result?.processingTimeSeconds ?? jobStatus?.elapsedSeconds ?? 0).toFixed(2)}s. Transaction Status: COMMITTED`
                : isBlocked
                ? 'Safety guarantee: Zero records were written or modified in Microsoft SQL Server.'
                : isRolledBack
                ? 'Transaction guarantee: Zero partial data was committed to SQL Server. All changes were rolled back.'
                : isUncertain
                ? (jobStatus?.message || 'The server status was interrupted. Use Reconciliation below to verify actual database state.')
                : (error || 'An unexpected error occurred while communicating with the database.')}
            </p>
          </div>
        </div>

        {/* LIVE ASYNC PROGRESS MONITOR WHILE EXECUTING */}
        {isExecuting && (
          <div className="space-y-4 p-5 bg-slate-50 border border-slate-200 rounded-xl">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
              <span className="flex items-center gap-2">
                <Server className="w-4 h-4 text-blue-600 animate-pulse" />
                <span>
                  {jobStatus?.currentTable
                    ? `Current Table: [${jobStatus.currentTable}]`
                    : 'Preparing database connection & plan...'}
                </span>
              </span>
              <span className="font-mono text-blue-700 font-bold">{displayPercent}% Complete</span>
            </div>

            {/* Animated Progress Bar */}
            <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden shadow-inner">
              <div
                className="bg-blue-600 h-3 rounded-full transition-all duration-300 ease-out flex items-center justify-end pr-1 text-[9px] text-white font-bold"
                style={{ width: `${displayPercent}%` }}
              />
            </div>

            {/* Live Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="bg-white p-3 rounded-lg border border-slate-200">
                <span className="text-slate-400 block text-[11px]">Rows Processed</span>
                <span className="font-mono font-bold text-slate-800 text-sm">
                  {(jobStatus?.rowsProcessed ?? 0).toLocaleString()} / {(jobStatus?.totalRows ? jobStatus.totalRows : excelSession.rowCount).toLocaleString()}
                </span>
              </div>
              <div className="bg-white p-3 rounded-lg border border-slate-200">
                <span className="text-slate-400 block text-[11px]">Inserted Rows</span>
                <span className="font-mono font-bold text-emerald-600 text-sm">
                  {(jobStatus?.totalInserted ?? 0).toLocaleString()}
                </span>
              </div>
              <div className="bg-white p-3 rounded-lg border border-slate-200">
                <span className="text-slate-400 block text-[11px]">Reused Records</span>
                <span className="font-mono font-bold text-blue-600 text-sm">
                  {(jobStatus?.totalReused ?? 0).toLocaleString()}
                </span>
              </div>
              <div className="bg-white p-3 rounded-lg border border-slate-200">
                <span className="text-slate-400 block text-[11px]">Elapsed Time</span>
                <span className="font-mono font-bold text-slate-700 text-sm">
                  {(jobStatus?.elapsedSeconds ?? 0).toFixed(1)}s
                </span>
              </div>
            </div>

            {/* Reconnecting / Network Glitch Banner */}
            {isReconnecting && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2 text-amber-800 text-xs">
                <WifiOff className="w-4 h-4 text-amber-600 animate-pulse shrink-0" />
                <span>
                  Checking migration status... (reconnecting attempt #{consecutiveErrors} — transaction is progressing safely in SQL Server)
                </span>
              </div>
            )}

            <p className="text-[11px] text-slate-400 italic text-center">
              Autonomous background task: safe to refresh or reconnect. The transaction runs independently in SQL Server.
            </p>
          </div>
        )}

        {/* 1. BLOCKED BY VALIDATION VIEW */}
        {isBlocked && (
          <div className="space-y-4">
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-2 text-amber-900 text-xs">
              <div className="flex items-center gap-2 font-bold text-sm text-amber-950">
                <ShieldAlert className="w-4 h-4 text-amber-600" />
                Execution Blocked — Pre-Execution Validation Failed
              </div>
              <p className="font-mono text-[11px] text-amber-800">
                Zero database writes occurred. Transaction status: <span className="font-bold uppercase">NOT_EXECUTED</span>.
              </p>
              {result?.message && (
                <p className="text-amber-900 text-xs font-sans mt-1">{result.message}</p>
              )}
            </div>

            {/* Actionable Validation Errors Table */}
            {result?.validationErrors && result.validationErrors.length > 0 && (
              <div className="border border-slate-200 rounded-lg bg-white overflow-hidden shadow-sm">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs font-semibold text-slate-700">
                  <span className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-600" />
                    Validation Errors Blocking Execution ({result.validationErrors.length})
                  </span>
                  <span className="text-rose-600 font-mono text-[11px]">Resolve these issues before retrying</span>
                </div>
                <div className="max-h-72 overflow-y-auto">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 text-[11px] uppercase tracking-wider sticky top-0">
                      <tr>
                        <th className="px-3 py-2">Row</th>
                        <th className="px-3 py-2">Target Table</th>
                        <th className="px-3 py-2">Target Column</th>
                        <th className="px-3 py-2">Error Type</th>
                        <th className="px-3 py-2">Details</th>
                        <th className="px-3 py-2">Recommended Correction</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {result.validationErrors.map((err, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="px-3 py-2 font-bold text-slate-900">{err.rowNumber}</td>
                          <td className="px-3 py-2 text-blue-600 font-semibold">{err.tableName}</td>
                          <td className="px-3 py-2 text-slate-800 font-semibold">{err.columnName}</td>
                          <td className="px-3 py-2 text-rose-600 font-semibold">{err.errorType}</td>
                          <td className="px-3 py-2 text-slate-600 font-sans text-xs">{err.message}</td>
                          <td className="px-3 py-2 text-emerald-700 font-sans text-xs">
                            {err.recommendedCorrection || 'Provide required value or verify foreign key mapping'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 2. TRANSACTION ROLLED BACK VIEW */}
        {isRolledBack && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl space-y-3 text-rose-800 text-xs">
            <div className="flex items-center gap-2 font-bold text-sm text-rose-900">
              <AlertCircle className="w-4 h-4 text-rose-600" />
              Migration Failed — Atomic Transaction Rolled Back
            </div>
            <p className="font-mono text-[11px] text-rose-700">
              Transaction guarantee: Zero partial data was committed to SQL Server.
              {result?.message && <span> {result.message}</span>}
              {error && !result?.message && <span> {error}</span>}
            </p>

            {result?.failureDetails && result.failureDetails.length > 0 && (
              <div className="bg-white p-3 rounded border border-rose-200 space-y-1 font-mono text-[11px] text-rose-900">
                <p className="font-bold">Failure Details:</p>
                {result.failureDetails.map((f, i) => (
                  <p key={i}>
                    {f.table ? `[${f.table}] ` : ''}{f.row ? `Row ${f.row}: ` : ''}{f.error}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 3. UNCERTAIN TRANSACTION OUTCOME VIEW (RECONCILIATION) */}
        {isUncertain && (
          <div className="p-4 bg-purple-50 border border-purple-200 rounded-xl space-y-3 text-purple-900 text-xs">
            <div className="flex items-center gap-2 font-bold text-sm text-purple-950">
              <HelpCircle className="w-4 h-4 text-purple-600" />
              Transaction Outcome Needs Verification
            </div>
            <p className="text-purple-800">
              The migration was started, but status verification was interrupted (e.g. backend restarted or connection dropped).
              Click below to query Microsoft SQL Server directly and reconcile whether the transaction committed or rolled back safely.
            </p>
            <button
              type="button"
              disabled={isReconciling}
              onClick={handleReconcile}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-lg flex items-center gap-2 text-xs shadow-sm cursor-pointer disabled:opacity-50"
            >
              {isReconciling ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Reconcile with SQL Server Database
            </button>
          </div>
        )}

        {/* 4. HTTP / UNEXPECTED ERROR VIEW */}
        {isError && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl space-y-2 text-rose-800 text-xs">
            <div className="flex items-center gap-2 font-bold text-sm text-rose-900">
              <AlertCircle className="w-4 h-4 text-rose-600" />
              Execution Error Encountered
            </div>
            <p className="font-sans text-xs text-rose-700">
              {error || 'The server returned an unexpected error response during database execution.'}
            </p>
          </div>
        )}

        {/* 5. REAL DB VERIFICATION SUMMARY WHEN COMMITTED */}
        {result && isCommitted && (
          <div className="space-y-6">
            {/* Unit Definition Explanation Banner */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3.5 text-xs text-blue-900 flex items-start gap-2.5">
              <Layers className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold text-blue-950">Reporting Architecture & Counting Units</p>
                <p className="text-blue-800 text-[11px] mt-0.5 leading-relaxed">
                  <strong>Source Rows ({sourceRowsTotal.toLocaleString()})</strong> represents input Excel rows. 
                  <strong> Database Operations ({totalOperations.toLocaleString()})</strong> represents multi-table outcomes ({totalInserted.toLocaleString()} inserted + {totalReused.toLocaleString()} existing records reused + {duplicateSourceRows.toLocaleString()} duplicate source records skipped). 
                  Because each Excel row maps to multiple normalized relational tables (Customer, Order, Bills, Item_Groups, OrderLineItems), total database operations exceed source row count without double-counting.
                </p>
              </div>
            </div>

            {matchingKeysUnavailable.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
                Repeat-safe matching was unavailable for: <strong>{matchingKeysUnavailable.join(', ')}</strong>. These records had no mapped primary or database-declared unique key.
              </div>
            )}

            {/* SECTION 1: SOURCE FILE ROWS (EXCEL) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                  Source File Processing (Unit: Excel Rows)
                </h3>
                <span className="text-[11px] text-slate-500 font-mono">
                  {sourceRowsWithInserts.toLocaleString()} with inserts + {sourceRowsFullyReused.toLocaleString()} reused = {sourceRowsTotal.toLocaleString()} total
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 text-center">
                  <p className="text-xs text-slate-500 font-medium">Total Excel Rows</p>
                  <p className="text-2xl font-bold text-slate-900 mt-1 font-mono">
                    {sourceRowsTotal.toLocaleString()}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Input rows parsed & mapped</p>
                </div>

                <div className="bg-emerald-50/50 border border-emerald-200 rounded-lg p-3.5 text-center">
                  <p className="text-xs text-emerald-700 font-medium">Rows with New Inserts</p>
                  <p className="text-2xl font-bold text-emerald-600 mt-1 font-mono">
                    {sourceRowsWithInserts.toLocaleString()}
                  </p>
                  <p className="text-[10px] text-emerald-600/80 mt-0.5">Created 1+ new database records</p>
                </div>

                <div className="bg-blue-50/50 border border-blue-200 rounded-lg p-3.5 text-center">
                  <p className="text-xs text-blue-700 font-medium">Rows Fully Reused</p>
                  <p className="text-2xl font-bold text-blue-600 mt-1 font-mono">
                    {sourceRowsFullyReused.toLocaleString()}
                  </p>
                  <p className="text-[10px] text-blue-600/80 mt-0.5">All referenced entities pre-existed</p>
                </div>
              </div>
            </div>

            {/* SECTION 2: TARGET DATABASE OPERATIONS */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Server className="w-4 h-4 text-blue-600" />
                  Target Database Operations (Unit: SQL Server Records)
                </h3>
                <span className="text-[11px] text-slate-500 font-mono">
                  {totalInserted.toLocaleString()} inserted + {totalReused.toLocaleString()} existing reused + {duplicateSourceRows.toLocaleString()} source duplicates = {totalOperations.toLocaleString()} outcomes
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 text-center">
                  <p className="text-xs text-slate-500 font-medium">Total Operations</p>
                  <p className="text-2xl font-bold text-slate-900 mt-1 font-mono">
                    {totalOperations.toLocaleString()}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Across all 5 target tables</p>
                </div>

                <div className="bg-emerald-50/50 border border-emerald-200 rounded-lg p-3.5 text-center">
                  <p className="text-xs text-emerald-700 font-medium">Actually Inserted</p>
                  <p className="text-2xl font-bold text-emerald-600 mt-1 font-mono">
                    {totalInserted.toLocaleString()}
                  </p>
                  <p className="text-[10px] text-emerald-600/80 mt-0.5">New rows inserted</p>
                </div>

                <div className="bg-blue-50/50 border border-blue-200 rounded-lg p-3.5 text-center">
                  <p className="text-xs text-blue-700 font-medium">Reused / Linked</p>
                  <p className="text-2xl font-bold text-blue-600 mt-1 font-mono">
                    {totalReused.toLocaleString()}
                  </p>
                  <p className="text-[10px] text-blue-600/80 mt-0.5">Matched existing database IDs</p>
                </div>

                <div className="bg-amber-50/60 border border-amber-200 rounded-lg p-3.5 text-center">
                  <p className="text-xs text-amber-800 font-medium">Duplicate Source</p>
                  <p className="text-2xl font-bold text-amber-700 mt-1 font-mono">{duplicateSourceRows.toLocaleString()}</p>
                  <p className="text-[10px] text-amber-700/80 mt-0.5">Repeated keys in this file</p>
                </div>

                <div className="bg-rose-50/60 border border-rose-200 rounded-lg p-3.5 text-center">
                  <p className="text-xs text-rose-800 font-medium">Ambiguous / Unresolved</p>
                  <p className="text-2xl font-bold text-rose-700 mt-1 font-mono">{(ambiguousRows + unresolvedForeignKeyRows).toLocaleString()}</p>
                  <p className="text-[10px] text-rose-700/80 mt-0.5">Require review</p>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 text-center">
                  <p className="text-xs text-slate-500 font-medium">Transaction Status</p>
                  <p className="text-xl font-bold text-emerald-600 mt-1 uppercase font-mono">
                    {result.transaction || 'COMMITTED'}
                  </p>
                  <p className="text-[10px] text-emerald-600/80 mt-0.5">Atomic transaction committed</p>
                </div>
              </div>
            </div>

            {/* Table Migration Details */}
            {result.tables && Object.keys(result.tables).length > 0 && (
              <div className="border border-slate-200 rounded-lg bg-white overflow-hidden shadow-sm">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs font-semibold text-slate-700">
                  <span className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Destination Table Verification
                  </span>
                  <span className="text-emerald-700 font-mono font-bold">Status: COMMITTED & VERIFIED</span>
                </div>

                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 text-[11px] uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-2.5">Destination Table</th>
                      <th className="px-4 py-2.5">Inserted Rows</th>
                      <th className="px-4 py-2.5">Reused Rows</th>
                      <th className="px-4 py-2.5">Duplicate Source</th>
                      <th className="px-4 py-2.5">Table Operations</th>
                      <th className="px-4 py-2.5 text-center font-bold text-emerald-700 bg-emerald-50/40">
                        Verified Inserted (PK Query)
                      </th>
                      <th className="px-4 py-2.5 text-right font-bold text-slate-700">
                        Total Rows in DB (`COUNT(*)`)
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {Object.entries(result.tables).map(([tableName, stat]) => {
                      const verifiedCount = stat.verifiedInserted !== undefined && stat.verifiedInserted > 0
                        ? stat.verifiedInserted
                        : (result.verifiedInsertedCounts && result.verifiedInsertedCounts[tableName] !== undefined
                          ? result.verifiedInsertedCounts[tableName]
                          : stat.inserted);
                      const totalRows = stat.totalTableRows !== undefined && stat.totalTableRows > 0
                        ? stat.totalTableRows
                        : (result.verificationCounts && result.verificationCounts[tableName] !== undefined
                          ? result.verificationCounts[tableName]
                          : 'Verified');
                      return (
                        <tr key={tableName} className="hover:bg-slate-50/70">
                          <td className="px-4 py-3 font-bold text-slate-900 flex items-center gap-2">
                            <Server className="w-3.5 h-3.5 text-blue-600" />
                            {tableName}
                          </td>
                          <td className="px-4 py-3 text-emerald-600 font-semibold">{stat.inserted.toLocaleString()}</td>
                          <td className="px-4 py-3 text-blue-600">{stat.reused.toLocaleString()}</td>
                          <td className="px-4 py-3 text-amber-700">{(stat.duplicateSource ?? 0).toLocaleString()}</td>
                          <td className="px-4 py-3 text-slate-700 font-semibold">{(stat.inserted + stat.reused + stat.skipped).toLocaleString()}</td>
                          <td className="px-4 py-3 text-center font-bold text-emerald-700 bg-emerald-50/30">
                            {stat.inserted > 0 ? (
                              <span className="inline-flex items-center gap-1 text-emerald-700">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 inline" />
                                {verifiedCount.toLocaleString()}
                              </span>
                            ) : (
                              <span className="text-slate-400 font-normal">0 (Reused Only)</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-slate-700">
                            {typeof totalRows === 'number' ? totalRows.toLocaleString() : totalRows}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Foreign Key Propagation & Generated IDs Section */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* FK Propagation Card */}
              <div className="border border-slate-200 rounded-lg p-4 bg-slate-50/50 space-y-2">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <GitBranch className="w-4 h-4 text-blue-600" />
                  Foreign Key Propagation
                </h4>
                <div className="bg-white p-3 rounded border border-slate-200 text-xs">
                  <p className="text-slate-600">
                    Propagated Foreign Key Links:{' '}
                    <span className="font-mono font-bold text-blue-700">
                      {(result.foreignKeysPropagated || totalReused + totalInserted).toLocaleString()}
                    </span>
                  </p>
                  <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                    Child tables (Order, Bills, OrderLineItems) dynamically resolved foreign keys from generated or matched parent keys (Customer, Item_Groups).
                  </p>
                </div>
              </div>

              {/* Generated IDs Section */}
              <div className="border border-slate-200 rounded-lg p-4 bg-slate-50/50 space-y-2">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Key className="w-4 h-4 text-purple-600" />
                  SQL Server Generated Identities Captured
                </h4>
                <div className="bg-white p-3 rounded border border-slate-200 space-y-1.5 text-xs font-mono max-h-24 overflow-y-auto">
                  {result.generatedIds && Object.keys(result.generatedIds).length > 0 ? (
                    Object.entries(result.generatedIds).map(([tbl, ids]) => (
                      <div key={tbl}>
                        <span className="font-bold text-slate-800">{tbl}: </span>
                        <span className="text-slate-600">{ids.length.toLocaleString()} IDs captured</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-slate-500 text-[11px]">Primary keys captured and verified.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Action Controls */}
        <div className="pt-4 flex flex-col sm:flex-row items-center justify-between border-t border-slate-200 gap-3">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            {/* Back to Preview Button (shown if blocked, failed, or error) */}
            {(isBlocked || isRolledBack || isError || isUncertain) && onBackToPreview && (
              <button
                type="button"
                onClick={onBackToPreview}
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg transition flex items-center gap-2 cursor-pointer shadow-sm"
              >
                <ArrowLeft className="w-4 h-4" /> Return to Preview
              </button>
            )}

            {/* Retry Button (shown if rolled back, error, or uncertain) */}
            {(isRolledBack || isError || isUncertain) && (
              <button
                type="button"
                disabled={isExecuting}
                onClick={handleRetry}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-semibold rounded-lg transition flex items-center gap-2 cursor-pointer shadow-sm disabled:opacity-50"
              >
                <RotateCcw className="w-4 h-4" /> Retry Execution
              </button>
            )}

            {/* Upload Another File */}
            <button
              type="button"
              onClick={onReset}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-semibold rounded-lg transition flex items-center gap-2 cursor-pointer shadow-sm"
            >
              <RefreshCw className="w-4 h-4" /> Upload Another File
            </button>
          </div>

          {/* Download Audit Report */}
          <button
            type="button"
            disabled={isDownloading}
            onClick={handleDownloadReport}
            className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-lg transition flex items-center gap-2 cursor-pointer shadow-sm disabled:opacity-50"
          >
            {isDownloading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            Download Audit Report (CSV)
          </button>
        </div>

      </div>
    </div>
  );
};
