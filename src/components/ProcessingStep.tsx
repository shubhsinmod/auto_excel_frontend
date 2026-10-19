import React, { useState, useEffect, useRef } from 'react';
import {
  ExcelAnalysisResponse,
  Step3ProcessingResponse,
  BusinessConcept,
  ValueOverrideItem
} from '../types';
import { migrationService } from '../services/migrationService';
import {
  FileSpreadsheet,
  CheckCircle2,
  ArrowRight,
  Loader2,
  Table,
  Link2,
  Layers,
  AlertTriangle,
  XCircle,
  ShieldCheck,
  Eye,
  Info,
  Search,
  Filter,
  BookOpen,
  Plus,
  Sparkles
} from 'lucide-react';

interface ProcessingStepProps {
  excelSession: ExcelAnalysisResponse;
  onBack: () => void;
  onComplete?: () => void;
}

export type Step2Lifecycle =
  | 'IDLE'
  | 'PROCESSING'
  | 'PREVIEW_READY'
  | 'VALIDATION_FAILED'
  | 'REQUEST_FAILED';

export const ProcessingStep: React.FC<ProcessingStepProps> = ({
  excelSession,
  onBack,
  onComplete,
}) => {
  const [lifecycle, setLifecycle] = useState<Step2Lifecycle>('IDLE');
  const [resultData, setResultData] = useState<Step3ProcessingResponse | null>(null);
  const [activeTab, setActiveTab] = useState<'PREVIEW' | 'DEPENDENCIES' | 'VALIDATION' | 'COLUMNS' | 'VALUES'>('PREVIEW');
  const [error, setError] = useState<string | null>(null);
  const [selectedErrorType, setSelectedErrorType] = useState<string>('ALL');

  const isProcessing = lifecycle === 'PROCESSING';

  // Preview filtering & pagination
  const [filterTable, setFilterTable] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const rowsPerPage = 12;

  // Review confirmation modal
  const [showReviewModal, setShowReviewModal] = useState(false);

  // Column override & revalidation state
  const [selectedCandidates, setSelectedCandidates] = useState<Record<string, { table: string; column: string; action?: string }>>({});
  const [learnRulesForColumns, setLearnRulesForColumns] = useState<Record<string, boolean>>({});
  const [isSavingMappings, setIsSavingMappings] = useState(false);
  const [mappingMessage, setMappingMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Synonyms Dictionary Modal state
  const [showSynonymsModal, setShowSynonymsModal] = useState(false);
  const [synonymsList, setSynonymsList] = useState<BusinessConcept[]>([]);
  const [loadingSynonyms, setLoadingSynonyms] = useState(false);
  const [newSynonymInput, setNewSynonymInput] = useState<Record<string, string>>({});
  const [synonymActionMsg, setSynonymActionMsg] = useState<string | null>(null);

  // Value Mapping overrides & review state
  const [selectedValueCandidates, setSelectedValueCandidates] = useState<Record<string, string>>({});
  const [cacheValueMappings, setCacheValueMappings] = useState<Record<string, boolean>>({});
  const [isSavingValues, setIsSavingValues] = useState(false);
  const [valueActionMsg, setValueActionMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Value synonyms modal state
  const [showValueSynonymsModal, setShowValueSynonymsModal] = useState(false);
  const [valueSynonymsDict, setValueSynonymsDict] = useState<Record<string, Record<string, string[]>>>({});
  const [newValueSynonymInput, setNewValueSynonymInput] = useState<Record<string, string>>({});
  const [loadingValueSynonyms, setLoadingValueSynonyms] = useState(false);

  // Refs for tracking active uploadId and in-flight fetch safely across React 18 Strict Mode
  const activeUploadIdRef = useRef<string>(excelSession.uploadId);
  const lastFetchedUploadIdRef = useRef<string | null>(null);
  const isFetchingRef = useRef<boolean>(false);

  const fetchPreview = async (uploadId: string, forceRefresh = false) => {
    if (!uploadId) return;
    if (isFetchingRef.current && !forceRefresh) return;

    isFetchingRef.current = true;
    setLifecycle('PROCESSING');
    setError(null);

    console.log(`[ProcessingStep] Request START | uploadId=${uploadId} | forceRefresh=${forceRefresh}`);

    try {
      const result = await migrationService.processStep3(uploadId);

      // Stale response guard
      if (activeUploadIdRef.current !== uploadId) {
        console.warn(`[ProcessingStep] Discarding stale response for ${uploadId}; current is ${activeUploadIdRef.current}`);
        return;
      }

      if (!result || !Array.isArray(result.columnMappings)) {
        throw new Error('Backend returned an unexpected or malformed preview structure.');
      }

      const formattedResult: Step3ProcessingResponse = {
        ...result,
        tablesProcessed: Array.isArray(result.tablesProcessed) ? result.tablesProcessed : [],
        columnMappings: result.columnMappings || [],
        valueResolutions: result.valueResolutions || [],
        valueMappings: result.valueMappings || [],
        previewRows: result.previewRows || [],
        dependencyPlan: result.dependencyPlan || [],
        validationSummary: result.validationSummary,
        plannedOperations: result.plannedOperations,
        canExecute: result.canExecute ?? result.validationSummary?.canExecute ?? true,
        statement: result.statement || "This preview has not written any data to the database.",
      };

      setResultData(formattedResult);

      const errorsCount = formattedResult.validationSummary?.errors?.length ?? 0;
      const canExec = formattedResult.canExecute;

      if (!canExec || errorsCount > 0) {
        console.log(`[ProcessingStep] Preview loaded with ${errorsCount} validation errors. Transition -> VALIDATION_FAILED`);
        setLifecycle('VALIDATION_FAILED');
      } else {
        console.log(`[ProcessingStep] Preview loaded cleanly with 0 errors. Transition -> PREVIEW_READY`);
        setLifecycle('PREVIEW_READY');
      }
    } catch (err: unknown) {
      if (activeUploadIdRef.current === uploadId) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to generate migration preview.';
        console.error(`[ProcessingStep] Preview request FAILED for ${uploadId}:`, err);
        setError(errorMsg);
        setLifecycle('REQUEST_FAILED');
      }
    } finally {
      isFetchingRef.current = false;
    }
  };

  useEffect(() => {
    activeUploadIdRef.current = excelSession.uploadId;
    const uploadId = excelSession.uploadId;

    if (!uploadId) return;

    // React 18 Strict Mode and deduplication guard
    if (lastFetchedUploadIdRef.current === uploadId && (resultData || isFetchingRef.current)) {
      return;
    }

    lastFetchedUploadIdRef.current = uploadId;
    fetchPreview(uploadId);
  }, [excelSession.uploadId]);

  const handleRetry = () => {
    lastFetchedUploadIdRef.current = null;
    fetchPreview(excelSession.uploadId, true);
  };

  const handleSelectCandidate = (excelCol: string, candidateStr: string) => {
    if (!candidateStr) {
      setSelectedCandidates((prev) => {
        const next = { ...prev };
        delete next[excelCol];
        return next;
      });
      return;
    }
    if (candidateStr === 'DO_NOT_MIGRATE') {
      setSelectedCandidates((prev) => ({
        ...prev,
        [excelCol]: { table: 'DO_NOT_MIGRATE', column: 'DO_NOT_MIGRATE', action: 'DO_NOT_MIGRATE' },
      }));
      return;
    }
    const [table, column] = candidateStr.split(':::');
    setSelectedCandidates((prev) => ({
      ...prev,
      [excelCol]: { table, column, action: 'MAP' },
    }));
  };

  const handleToggleLearnRule = (excelCol: string) => {
    setLearnRulesForColumns((prev) => ({
      ...prev,
      [excelCol]: !prev[excelCol],
    }));
  };

  const handleOpenSynonymsModal = async () => {
    setShowSynonymsModal(true);
    setLoadingSynonyms(true);
    setSynonymActionMsg(null);
    try {
      const data = await migrationService.getSynonyms(resultData?.schema.database_name);
      setSynonymsList(data);
    } catch (err) {
      console.error('Failed to load synonyms:', err);
    } finally {
      setLoadingSynonyms(false);
    }
  };

  const handleAddSynonym = async (conceptId: string) => {
    const syn = (newSynonymInput[conceptId] || '').trim();
    if (!syn) return;
    try {
      await migrationService.addSynonym(conceptId, syn, resultData?.schema.database_name);
      setNewSynonymInput((prev) => ({ ...prev, [conceptId]: '' }));
      const data = await migrationService.getSynonyms(resultData?.schema.database_name);
      setSynonymsList(data);
      setSynonymActionMsg(`Added "${syn}" successfully.`);
    } catch (err: unknown) {
      setSynonymActionMsg(`Error: ${err instanceof Error ? err.message : 'Failed to add synonym'}`);
    }
  };

  const handleDeleteSynonym = async (conceptId: string, syn: string) => {
    try {
      await migrationService.deleteSynonym(conceptId, syn, resultData?.schema.database_name);
      const data = await migrationService.getSynonyms(resultData?.schema.database_name);
      setSynonymsList(data);
      setSynonymActionMsg(`Removed "${syn}".`);
    } catch (err: unknown) {
      setSynonymActionMsg(`Error: ${err instanceof Error ? err.message : 'Failed to remove synonym'}`);
    }
  };

  const handleSaveAndRevalidateMappings = async () => {
    if (!resultData) return;
    setIsSavingMappings(true);
    setMappingMessage(null);
    try {
      const overrides: Array<{
        excelColumn: string;
        databaseTable: string;
        databaseColumn: string;
        action?: string;
        businessConcept?: string;
        saveRule?: boolean;
      }> = [];

      for (const m of resultData.columnMappings) {
        if (selectedCandidates[m.excelColumn]) {
          const sel = selectedCandidates[m.excelColumn];
          overrides.push({
            excelColumn: m.excelColumn,
            databaseTable: sel.table,
            databaseColumn: sel.column,
            action: sel.action || 'MAP',
            businessConcept: m.businessConcept,
            saveRule: Boolean(learnRulesForColumns[m.excelColumn]),
          });
        } else if (m.status === 'MATCHED' && m.databaseTable !== 'UNKNOWN' && m.databaseColumn !== 'UNKNOWN') {
          overrides.push({
            excelColumn: m.excelColumn,
            databaseTable: m.databaseTable,
            databaseColumn: m.databaseColumn,
            action: 'MAP',
            businessConcept: m.businessConcept,
            saveRule: Boolean(learnRulesForColumns[m.excelColumn]),
          });
        }
      }

      const updated = await migrationService.updateMappings(excelSession.uploadId, overrides);
      const errorsCount = updated.validationSummary?.errors?.length ?? 0;
      const canExec = updated.canExecute ?? updated.validationSummary?.canExecute ?? true;

      setResultData({
        ...updated,
        canExecute: canExec,
      });

      if (!canExec || errorsCount > 0) {
        setLifecycle('VALIDATION_FAILED');
      } else {
        setLifecycle('PREVIEW_READY');
      }

      setSelectedCandidates({});
      setLearnRulesForColumns({});
      setMappingMessage({
        text: `Successfully saved column mappings! Revalidated dataset across ${updated.validationSummary?.totalRows ?? 0} rows.`,
        type: 'success',
      });
    } catch (err: unknown) {
      setMappingMessage({
        text: err instanceof Error ? err.message : 'Failed to update mappings.',
        type: 'error',
      });
    } finally {
      setIsSavingMappings(false);
    }
  };

  const handleSelectValueCandidate = (excelCol: string, excelVal: string, targetVal: string) => {
    const key = `${excelCol}::${excelVal}`;
    setSelectedValueCandidates((prev) => ({
      ...prev,
      [key]: targetVal,
    }));
  };

  const handleToggleCacheValue = (excelCol: string, excelVal: string) => {
    const key = `${excelCol}::${excelVal}`;
    setCacheValueMappings((prev) => ({
      ...prev,
      [key]: !(prev[key] ?? true),
    }));
  };

  const handleSaveValueMappings = async () => {
    if (!resultData?.valueMappings || !excelSession.uploadId) return;
    setIsSavingValues(true);
    setValueActionMsg(null);

    try {
      const overridesToSave: ValueOverrideItem[] = [];
      resultData.valueMappings.forEach((vm) => {
        const key = `${vm.excelColumn}::${vm.excelValue}`;
        const chosen = selectedValueCandidates[key] || vm.targetValue;
        const shouldCache = cacheValueMappings[key] ?? true;
        if (chosen) {
          overridesToSave.push({
            excelColumn: vm.excelColumn,
            databaseTable: vm.databaseTable,
            databaseColumn: vm.databaseColumn,
            excelValue: vm.excelValue,
            targetValue: chosen,
            saveCache: shouldCache,
          });
        }
      });

      if (overridesToSave.length === 0) {
        setValueActionMsg({ text: 'No target values selected to save.', type: 'error' });
        setIsSavingValues(false);
        return;
      }

      const updated = await migrationService.updateValueMappings(excelSession.uploadId, overridesToSave);
      setResultData(updated);

      const errorsCount = updated.validationSummary?.errors?.length ?? 0;
      const canExec = updated.canExecute ?? updated.validationSummary?.canExecute ?? true;
      if (!canExec || errorsCount > 0) {
        setLifecycle('VALIDATION_FAILED');
      } else {
        setLifecycle('PREVIEW_READY');
      }

      setValueActionMsg({
        text: `Successfully applied and cached ${overridesToSave.length} value mappings! Preview refreshed and re-validated.`,
        type: 'success',
      });
    } catch (err: unknown) {
      setValueActionMsg({
        text: err instanceof Error ? err.message : 'Failed to save value mappings.',
        type: 'error',
      });
    } finally {
      setIsSavingValues(false);
    }
  };

  const loadValueSynonyms = async () => {
    setLoadingValueSynonyms(true);
    try {
      const data = await migrationService.getValueSynonyms();
      setValueSynonymsDict(data);
    } catch (err) {
      console.error('Failed to load value synonyms:', err);
    } finally {
      setLoadingValueSynonyms(false);
    }
  };

  const handleAddValueSynonym = async (category: string, targetValue: string) => {
    const key = `${category}::${targetValue}`;
    const syn = newValueSynonymInput[key]?.trim();
    if (!syn) return;
    try {
      await migrationService.addValueSynonym(category, targetValue, syn);
      setNewValueSynonymInput((prev) => ({ ...prev, [key]: '' }));
      loadValueSynonyms();
    } catch (err) {
      console.error('Failed to add value synonym:', err);
    }
  };

  const handleDeleteValueSynonym = async (category: string, targetValue: string, syn: string) => {
    try {
      await migrationService.deleteValueSynonym(category, targetValue, syn);
      loadValueSynonyms();
    } catch (err) {
      console.error('Failed to delete value synonym:', err);
    }
  };

  // Filter preview rows
  const allPreviewRows = resultData?.previewRows || [];
  const filteredPreviewRows = allPreviewRows.filter((item) => {
    const matchesTable = filterTable === 'ALL' || item.targetTable === filterTable;
    const matchesSearch =
      searchQuery.trim() === '' ||
      item.targetColumn.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.sourceColumn && item.sourceColumn.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (item.sourceValue && item.sourceValue.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (item.finalValue && item.finalValue.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesTable && matchesSearch;
  });

  const totalPreviewPages = Math.max(1, Math.ceil(filteredPreviewRows.length / rowsPerPage));
  const displayedPreviewRows = filteredPreviewRows.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
  );

  const canExecute = resultData?.canExecute ?? resultData?.validationSummary?.canExecute ?? false;
  const validationSummary = resultData?.validationSummary;
  const plannedOps = resultData?.plannedOperations;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 shadow-sm space-y-6">
        
        {/* Header Title & Lifecycle State */}
        <div className="flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
          <div className={`p-4 rounded-full w-16 h-16 shrink-0 flex items-center justify-center border ${
            lifecycle === 'PROCESSING'
              ? 'bg-blue-50 text-blue-600 border-blue-100'
              : lifecycle === 'VALIDATION_FAILED'
              ? 'bg-amber-50 text-amber-600 border-amber-200'
              : lifecycle === 'REQUEST_FAILED'
              ? 'bg-rose-50 text-rose-600 border-rose-200'
              : 'bg-emerald-50 text-emerald-600 border-emerald-200'
          }`}>
            {lifecycle === 'PROCESSING' ? (
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            ) : lifecycle === 'REQUEST_FAILED' ? (
              <XCircle className="w-8 h-8 text-rose-600" />
            ) : lifecycle === 'VALIDATION_FAILED' ? (
              <AlertTriangle className="w-8 h-8 text-amber-600" />
            ) : (
              <ShieldCheck className="w-8 h-8 text-emerald-600" />
            )}
          </div>

          <div className="flex-1">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h2 className="text-2xl font-bold text-slate-900">Step 2 — Safe Migration Preview & Validation Plan</h2>
              {/* Lifecycle status pill */}
              <span className={`self-center sm:self-auto px-2.5 py-1 rounded-full text-xs font-bold border tracking-wide font-sans ${
                lifecycle === 'PROCESSING'
                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                  : lifecycle === 'VALIDATION_FAILED'
                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                  : lifecycle === 'REQUEST_FAILED'
                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                  : 'bg-emerald-50 text-emerald-700 border-emerald-200'
              }`}>
                {lifecycle === 'PROCESSING' && 'PROCESSING PREVIEW'}
                {lifecycle === 'VALIDATION_FAILED' && `VALIDATION FAILED (${validationSummary?.errors.length ?? 0} ERRORS)`}
                {lifecycle === 'REQUEST_FAILED' && 'REQUEST FAILED'}
                {lifecycle === 'PREVIEW_READY' && 'PREVIEW READY'}
                {lifecycle === 'IDLE' && 'IDLE'}
              </span>
            </div>

            <p className="text-sm text-slate-500 mt-1">
              {lifecycle === 'PROCESSING'
                ? 'Validating dataset, resolving foreign key dependencies, and generating row-level migration preview...'
                : lifecycle === 'VALIDATION_FAILED'
                ? `Preview generated in ${(resultData?.processingTimeSeconds ?? 0).toFixed(3)}s. Migration execution is blocked due to ${validationSummary?.errors.length ?? 0} validation errors.`
                : lifecycle === 'REQUEST_FAILED'
                ? 'Failed to fetch migration preview from server. Click Retry to re-run analysis.'
                : `Preview generated and entire dataset validated in ${(resultData?.processingTimeSeconds ?? 0).toFixed(3)}s. Zero writes performed.`}
            </p>
          </div>
        </div>

        {/* Request Failure Alert & Retry Button */}
        {lifecycle === 'REQUEST_FAILED' && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold flex items-center gap-1.5 text-rose-900">
                <XCircle className="w-4 h-4 text-rose-600" /> Preview Request Failed
              </span>
              <button
                type="button"
                onClick={handleRetry}
                className="px-3 py-1 bg-white border border-rose-300 rounded text-rose-700 hover:bg-rose-100 font-semibold cursor-pointer shadow-sm transition"
              >
                Retry Analysis
              </button>
            </div>
            <p className="font-mono">{error || 'An unexpected error occurred while communicating with the server.'}</p>
            <p className="text-[11px] text-slate-500 font-mono">Upload ID: {excelSession.uploadId}</p>
          </div>
        )}

        {/* Read-Only Guarantee Notice */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3.5 flex items-center gap-3 text-amber-800 text-xs">
          <Info className="w-4 h-4 shrink-0 text-amber-600" />
          <div>
            <span className="font-semibold uppercase tracking-wide">Read-Only Safety Guarantee:</span>{' '}
            {resultData?.statement || 'This preview has not written any data to the database.'}
          </div>
        </div>

        {/* Schema & File Info Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-left">
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold text-emerald-600 uppercase tracking-wider">
                <Layers className="w-4 h-4" /> Target Schema & Tables
              </div>
              {resultData?.schema && (
                <span className="text-[10px] px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-semibold font-mono">
                  {resultData.schema.database_name || 'MSSQL'}
                </span>
              )}
            </div>

            {resultData ? (
              <div className="space-y-1">
                <p className="text-sm font-bold text-slate-800">
                  {resultData.tablesProcessed.length} Target Tables Selected{' '}
                  <span className="text-xs font-normal text-slate-500">
                    (from {resultData.schema?.tables?.length ?? 46} database tables)
                  </span>
                </p>
                <p className="text-xs text-slate-600 font-mono truncate" title={resultData.tablesProcessed.join(', ')}>
                  {resultData.tablesProcessed.join(', ')}
                </p>
                {resultData.executionOrder && resultData.executionOrder.length > 0 && (
                  <p className="text-[11px] text-slate-500 font-mono truncate pt-0.5" title={`Execution DAG: ${resultData.executionOrder.join(' → ')}`}>
                    <span className="font-semibold text-slate-700">Planned Execution Order:</span>{' '}
                    {resultData.executionOrder.join(' → ')}
                  </p>
                )}
              </div>
            ) : isProcessing ? (
              <div className="space-y-1">
                <p className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" /> Discovering Schema & Entities...
                </p>
                <p className="text-xs text-slate-500">
                  Introspecting Microsoft SQL Server tables, constraints, and relationships...
                </p>
              </div>
            ) : lifecycle === 'REQUEST_FAILED' ? (
              <div className="space-y-1">
                <p className="text-sm font-bold text-rose-700 flex items-center gap-1.5">
                  <XCircle className="w-3.5 h-3.5 text-rose-600" /> Schema Loading / Preview Error
                </p>
                <p className="text-xs text-rose-600">
                  {error || 'Unable to load schema metadata or complete preview.'}
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                <p className="text-sm font-bold text-slate-800">Schema Discovery</p>
                <p className="text-xs text-slate-500">No schema loaded</p>
              </div>
            )}
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-blue-600 uppercase tracking-wider">
              <FileSpreadsheet className="w-4 h-4" /> Uploaded Source Dataset
            </div>
            <p className="text-sm font-bold text-slate-800 truncate">{excelSession.fileName}</p>
            <p className="text-xs text-slate-500">
              {excelSession.rowCount.toLocaleString()} rows • {excelSession.columnCount} columns
              {resultData?.processingTimeSeconds ? ` • Analyzed in ${resultData.processingTimeSeconds.toFixed(3)}s` : ''}
            </p>
          </div>
        </div>

        {/* Statistical Cards */}
        {resultData && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-center">
              <p className="text-[11px] text-slate-500 font-medium">Planned Inserts</p>
              <p className="text-lg font-bold text-emerald-600 mt-0.5">
                {plannedOps?.totalPlannedInserts ?? 0}
              </p>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-center">
              <p className="text-[11px] text-slate-500 font-medium">Existing Records</p>
              <p className="text-lg font-bold text-blue-600 mt-0.5">
                {plannedOps?.existingRowsSkipped ?? 0}
              </p>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-center">
              <p className="text-[11px] text-slate-500 font-medium">Duplicate Source</p>
              <p className="text-lg font-bold text-amber-700 mt-0.5">
                {plannedOps?.duplicateSourceRows ?? 0}
              </p>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-center">
              <p className="text-[11px] text-slate-500 font-medium">Validation Status</p>
              <p className={`text-sm font-bold mt-1 ${canExecute ? 'text-emerald-600' : 'text-rose-600'}`}>
                {canExecute ? '✓ ALL VALID' : `⚠ ${validationSummary?.invalidRows ?? 0} INVALID ROWS`}
              </p>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-center">
              <p className="text-[11px] text-slate-500 font-medium">FK Resolutions</p>
              <p className="text-lg font-bold text-purple-600 mt-0.5">
                {resultData.dependencyPlan?.length ?? resultData.valueResolutions?.length ?? 0}
              </p>
            </div>
          </div>
        )}

        {plannedOps?.matchingKeysUnavailable && plannedOps.matchingKeysUnavailable.length > 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
            Safe repeat matching is unavailable for {plannedOps.matchingKeysUnavailable.join(', ')} because no mapped primary or database-declared unique key is available.
          </div>
        )}

        {/* Value Resolution Metrics (7 Counters) */}
        {resultData && resultData.valueResolutionSummary && (
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" /> Value Resolution & Key Verification
              </span>
              <span className="text-[11px] text-slate-500 font-mono">
                Preserves exact casing, leading zeros & identifiers
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
              <div className="bg-white border border-slate-200 rounded p-2 text-center">
                <p className="text-[10px] text-slate-500 font-medium truncate">Inspected</p>
                <p className="text-sm font-bold text-slate-800 font-mono mt-0.5">
                  {resultData.valueResolutionSummary.valuesInspected.toLocaleString()}
                </p>
              </div>
              <div className="bg-white border border-slate-200 rounded p-2 text-center">
                <p className="text-[10px] text-slate-500 font-medium truncate">Matched Existing</p>
                <p className="text-sm font-bold text-emerald-600 font-mono mt-0.5">
                  {resultData.valueResolutionSummary.valuesMatchedExisting.toLocaleString()}
                </p>
              </div>
              <div className="bg-white border border-slate-200 rounded p-2 text-center">
                <p className="text-[10px] text-slate-500 font-medium truncate">Resolved Confirmed</p>
                <p className="text-sm font-bold text-blue-600 font-mono mt-0.5">
                  {resultData.valueResolutionSummary.valuesResolvedConfirmed.toLocaleString()}
                </p>
              </div>
              <div className="bg-white border border-slate-200 rounded p-2 text-center">
                <p className="text-[10px] text-slate-500 font-medium truncate">New Parents</p>
                <p className="text-sm font-bold text-indigo-600 font-mono mt-0.5">
                  {resultData.valueResolutionSummary.valuesRequiringNewParent.toLocaleString()}
                </p>
              </div>
              <div className="bg-white border border-slate-200 rounded p-2 text-center">
                <p className="text-[10px] text-slate-500 font-medium truncate">Unresolved FKs</p>
                <p className={`text-sm font-bold font-mono mt-0.5 ${resultData.valueResolutionSummary.unresolvedForeignKeys > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
                  {resultData.valueResolutionSummary.unresolvedForeignKeys.toLocaleString()}
                </p>
              </div>
              <div className="bg-white border border-slate-200 rounded p-2 text-center">
                <p className="text-[10px] text-slate-500 font-medium truncate">Ambiguous</p>
                <p className={`text-sm font-bold font-mono mt-0.5 ${resultData.valueResolutionSummary.ambiguousValues > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
                  {resultData.valueResolutionSummary.ambiguousValues.toLocaleString()}
                </p>
              </div>
              <div className="bg-white border border-slate-200 rounded p-2 text-center">
                <p className="text-[10px] text-slate-500 font-medium truncate">Rejected Valid.</p>
                <p className={`text-sm font-bold font-mono mt-0.5 ${resultData.valueResolutionSummary.valuesRejectedValidation > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                  {resultData.valueResolutionSummary.valuesRejectedValidation.toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Inspection Tabs */}
        {resultData && (
          <div className="space-y-4 pt-2">
            <div className="flex border-b border-slate-200 gap-3 overflow-x-auto text-xs">
              <button
                type="button"
                onClick={() => setActiveTab('PREVIEW')}
                className={`pb-2.5 font-bold transition flex items-center gap-1.5 border-b-2 whitespace-nowrap ${
                  activeTab === 'PREVIEW'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Eye className="w-3.5 h-3.5" /> Migration Preview Plan ({allPreviewRows.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('DEPENDENCIES')}
                className={`pb-2.5 font-bold transition flex items-center gap-1.5 border-b-2 whitespace-nowrap ${
                  activeTab === 'DEPENDENCIES'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Link2 className="w-3.5 h-3.5" /> Dependency & FK Plan ({(resultData.dependencyPlan ?? []).length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('VALIDATION')}
                className={`pb-2.5 font-bold transition flex items-center gap-1.5 border-b-2 whitespace-nowrap ${
                  activeTab === 'VALIDATION'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" /> Dataset Validation ({validationSummary?.totalRows ?? 0} rows)
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('COLUMNS')}
                className={`pb-2.5 font-bold transition flex items-center gap-1.5 border-b-2 whitespace-nowrap ${
                  activeTab === 'COLUMNS'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Table className="w-3.5 h-3.5" /> Column Mappings ({(resultData.columnMappings ?? []).length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('VALUES')}
                className={`pb-2.5 font-bold transition flex items-center gap-1.5 border-b-2 whitespace-nowrap ${
                  activeTab === 'VALUES'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" /> Value Mappings ({(resultData.valueMappings ?? []).length})
              </button>
            </div>

            {/* TAB 1: Complete Migration Preview (Row Plan) */}
            {activeTab === 'PREVIEW' && (
              <div className="space-y-3">
                {/* Filters */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <Filter className="w-3.5 h-3.5 text-slate-400" />
                    <select
                      value={filterTable}
                      onChange={(e) => {
                        setFilterTable(e.target.value);
                        setCurrentPage(1);
                      }}
                      className="px-2.5 py-1.5 border border-slate-200 rounded-md bg-white text-slate-700 text-xs focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="ALL">All Target Tables ({resultData.tablesProcessed.length})</option>
                      {resultData.tablesProcessed.map((tbl) => (
                        <option key={tbl} value={tbl}>{tbl}</option>
                      ))}
                    </select>
                  </div>

                  <div className="relative w-full sm:w-64">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search column or value..."
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setCurrentPage(1);
                      }}
                      className="w-full pl-8 pr-3 py-1.5 border border-slate-200 rounded-md text-xs focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto border border-slate-200 rounded-lg bg-white shadow-sm">
                  <table className="w-full text-left text-[11px] font-mono">
                    <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                      <tr>
                        <th className="px-3 py-2 text-center w-12">Row #</th>
                        <th className="px-3 py-2">Target Table</th>
                        <th className="px-3 py-2">Target Column</th>
                        <th className="px-3 py-2">Source Col & Val</th>
                        <th className="px-3 py-2 font-bold text-slate-900">Final SQL Server Value</th>
                        <th className="px-3 py-2 text-center">Value Source</th>
                        <th className="px-3 py-2">Constraints</th>
                        <th className="px-3 py-2 text-right">Validation</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {displayedPreviewRows.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="px-3 py-6 text-center text-slate-400 font-sans text-xs">
                            No preview records match the selected filter.
                          </td>
                        </tr>
                      ) : (
                        displayedPreviewRows.map((item, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/80">
                            <td className="px-3 py-2 text-center text-slate-400 font-bold">{item.sourceRow}</td>
                            <td className="px-3 py-2 text-blue-600 font-semibold">
                              {item.targetSchema ? `${item.targetSchema}.${item.targetTable}` : item.targetTable}
                            </td>
                            <td className="px-3 py-2 text-purple-700 font-medium">{item.targetColumn}</td>
                            <td className="px-3 py-2 text-slate-500">
                              {item.sourceColumn ? (
                                <span>
                                  <span className="text-slate-800 font-medium">{item.sourceColumn}:</span>{' '}
                                  <span className="italic">{item.sourceValue ?? 'null'}</span>
                                </span>
                              ) : (
                                <span className="text-slate-400 italic">—</span>
                              )}
                            </td>
                            <td className="px-3 py-2 font-bold text-slate-900">
                              {item.finalValue ?? <span className="text-slate-400 italic">NULL</span>}
                            </td>
                            <td className="px-3 py-2 text-center">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-semibold tracking-wider ${
                                  item.valueSource === 'IDENTITY'
                                    ? 'bg-purple-50 text-purple-700 border border-purple-200'
                                    : item.valueSource === 'DATABASE_LOOKUP'
                                    ? 'bg-teal-50 text-teal-700 border border-teal-200 font-bold'
                                    : item.valueSource === 'FOREIGN_KEY'
                                    ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                    : item.valueSource === 'EXCEL'
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : item.valueSource === 'DATABASE_DEFAULT'
                                    ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                    : 'bg-slate-100 text-slate-600 border border-slate-200'
                                }`}
                              >
                                {item.valueSource}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-center">
                              {(() => {
                                const req = item.requirementType || (
                                  item.isIdentity ? 'AUTO_GENERATED' :
                                  item.hasDefault ? 'DATABASE_DEFAULT' :
                                  item.isRequired ? 'MANDATORY' :
                                  'OPTIONAL'
                                );
                                const colorClass =
                                  req === 'MANDATORY'
                                    ? 'bg-rose-50 text-rose-700 border-rose-200 font-bold'
                                    : req === 'AUTO_GENERATED'
                                    ? 'bg-purple-50 text-purple-700 border-purple-200 font-semibold'
                                    : req === 'DATABASE_DEFAULT'
                                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                                    : req === 'FOREIGN_KEY'
                                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                                    : req === 'UNRESOLVED'
                                    ? 'bg-red-100 text-red-800 border-red-300 font-bold'
                                    : 'bg-slate-50 text-slate-600 border-slate-200';
                                return (
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-sans border inline-block whitespace-nowrap ${colorClass}`}>
                                    {req.replace('_', ' ')}
                                  </span>
                                );
                              })()}
                            </td>
                            <td className="px-3 py-2 text-right">
                              {item.validationStatus === 'VALID' ? (
                                <span className="text-emerald-600 font-semibold font-sans text-[10px]">✓ Valid</span>
                              ) : (
                                <span className="text-rose-600 font-semibold font-sans text-[10px] bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200" title={item.validationMessage || ''}>
                                  ⚠ {item.validationStatus}
                                </span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Controls */}
                <div className="flex items-center justify-between text-xs text-slate-500 pt-1 font-sans">
                  <span>
                    Showing {Math.min(filteredPreviewRows.length, (currentPage - 1) * rowsPerPage + 1)} -{' '}
                    {Math.min(filteredPreviewRows.length, currentPage * rowsPerPage)} of {filteredPreviewRows.length} entries
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={currentPage <= 1}
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      className="px-2 py-1 border border-slate-200 rounded disabled:opacity-40 hover:bg-slate-50 cursor-pointer"
                    >
                      Previous
                    </button>
                    <span className="px-2 font-medium text-slate-700">
                      Page {currentPage} of {totalPreviewPages}
                    </span>
                    <button
                      type="button"
                      disabled={currentPage >= totalPreviewPages}
                      onClick={() => setCurrentPage((p) => Math.min(totalPreviewPages, p + 1))}
                      className="px-2 py-1 border border-slate-200 rounded disabled:opacity-40 hover:bg-slate-50 cursor-pointer"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: Dynamic Foreign-Key & Name-to-ID Resolution Plan */}
            {activeTab === 'DEPENDENCIES' && (
              <div className="space-y-3">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-800 flex items-center gap-1.5">
                      <Link2 className="w-4 h-4 text-purple-600" />
                      Dynamic Foreign-Key & Name-to-ID Resolution
                    </span>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Resolves missing foreign-key IDs dynamically from SQL Server using available business names in Excel.
                    </p>
                  </div>
                  <span className="text-[11px] font-mono px-2 py-0.5 bg-blue-100 text-blue-800 rounded font-semibold">
                    {(resultData.dependencyPlan || []).length} Relationships
                  </span>
                </div>

                <div className="overflow-x-auto border border-slate-200 rounded-lg bg-white shadow-sm">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                      <tr>
                        <th className="px-3 py-2">Child Column</th>
                        <th className="px-3 py-2">Referenced DB Column</th>
                        <th className="px-3 py-2">Excel Name</th>
                        <th className="px-3 py-2">Matched DB Name</th>
                        <th className="px-3 py-2">Resolved ID</th>
                        <th className="px-3 py-2 text-center">Value Source</th>
                        <th className="px-3 py-2 text-center">Validation</th>
                        <th className="px-3 py-2 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {(resultData.dependencyPlan || []).length === 0 ? (
                        <tr>
                          <td colSpan={8} className="px-3 py-6 text-center text-slate-400 font-sans text-xs">
                            No foreign key relationships required for mapped target tables.
                          </td>
                        </tr>
                      ) : (
                        resultData.dependencyPlan!.map((item, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/80">
                            <td className="px-3 py-2 text-purple-700 font-bold">
                              {item.childTable}.{item.childColumn}
                            </td>
                            <td className="px-3 py-2 text-blue-600 font-semibold">
                              {item.parentTable}.{item.parentColumn}
                            </td>
                            <td className="px-3 py-2 font-bold text-slate-900">
                              {item.sourceBusinessKey ?? <span className="text-slate-400 italic">None</span>}
                            </td>
                            <td className="px-3 py-2 text-slate-700">
                              {item.matchedDatabaseName ? (
                                <span className="font-semibold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                                  {item.matchedDatabaseName}
                                </span>
                              ) : item.existingParentFound ? (
                                <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-[11px] font-semibold border border-emerald-200">
                                  ✓ Found in DB
                                </span>
                              ) : (
                                <span className="text-slate-400 italic">—</span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-blue-700 font-bold">
                              {item.resolvedId ? (
                                <span className="bg-blue-50 text-blue-800 px-2 py-0.5 rounded border border-blue-200 font-mono">
                                  {item.resolvedId}
                                </span>
                              ) : item.generatedIdPending ? (
                                <span className="text-purple-600 italic">Pending SQL Server Output</span>
                              ) : (
                                <span className="text-slate-400 italic">Unresolved</span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-center">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-semibold tracking-wider ${
                                  (item.valueSource || (item.existingParentFound ? 'DATABASE_LOOKUP' : 'GENERATED_ID')) === 'DATABASE_LOOKUP'
                                    ? 'bg-teal-50 text-teal-700 border border-teal-200 font-bold'
                                    : (item.valueSource || '') === 'EXISTING_DATABASE'
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : (item.valueSource || '') === 'GENERATED_ID'
                                    ? 'bg-purple-50 text-purple-700 border border-purple-200'
                                    : 'bg-slate-100 text-slate-600 border border-slate-200'
                                }`}
                              >
                                {item.valueSource || (item.existingParentFound ? 'DATABASE_LOOKUP' : item.generatedIdPending ? 'GENERATED_ID' : 'PENDING')}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-center">
                              {item.status === 'MATCHED' || item.status === 'PENDING' ? (
                                <span className="text-emerald-600 font-semibold font-sans text-[10px]">✓ Valid</span>
                              ) : item.status === 'AMBIGUOUS' ? (
                                <span className="text-amber-700 font-semibold font-sans text-[10px] bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                                  ⚠ Ambiguous
                                </span>
                              ) : (
                                <span className="text-rose-600 font-semibold font-sans text-[10px] bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
                                  ✕ Unresolved
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-right">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  item.status === 'MATCHED'
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : item.status === 'PENDING'
                                    ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                    : item.status === 'AMBIGUOUS'
                                    ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                    : 'bg-rose-50 text-rose-700 border border-rose-200'
                                }`}
                              >
                                {item.status}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 3: Entire Dataset Validation Summary */}
            {activeTab === 'VALIDATION' && validationSummary && (
              <div className="space-y-4">
                {/* Summary Stat Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-center">
                    <p className="text-[11px] text-slate-500 font-medium">Total Rows Checked</p>
                    <p className="text-lg font-bold text-slate-800 mt-0.5">{validationSummary.totalRows}</p>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-center">
                    <p className="text-[11px] text-slate-500 font-medium">Valid Source Rows</p>
                    <p className="text-lg font-bold text-emerald-600 mt-0.5">{validationSummary.validRows}</p>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-center">
                    <p className="text-[11px] text-slate-500 font-medium">Invalid Source Rows</p>
                    <p className={`text-lg font-bold mt-0.5 ${validationSummary.invalidRows > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                      {validationSummary.invalidRows}
                    </p>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-center">
                    <p className="text-[11px] text-slate-500 font-medium">Unresolved Foreign Keys</p>
                    <p className={`text-lg font-bold mt-0.5 ${validationSummary.unresolvedForeignKeysCount > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
                      {validationSummary.unresolvedForeignKeysCount}
                    </p>
                  </div>
                </div>

                {/* Circular Dependencies Alert if any */}
                {validationSummary.circularDependencies && validationSummary.circularDependencies.length > 0 && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 space-y-1">
                    <p className="font-semibold flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-amber-600" /> Circular Dependency Detected:
                    </p>
                    {validationSummary.circularDependencies.map((c, i) => (
                      <p key={i} className="font-mono text-[11px]">{c}</p>
                    ))}
                  </div>
                )}

                {/* Row-Level Errors List */}
                {validationSummary.errors.length > 0 ? (
                  <div className="border border-rose-200 bg-rose-50/40 rounded-lg p-4 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <h4 className="text-xs font-bold text-rose-800 uppercase tracking-wide flex items-center gap-1.5">
                        <XCircle className="w-4 h-4 text-rose-600" />
                        Validation Errors ({validationSummary.errors.length}) — Execution Blocked
                      </h4>
                      <span className="text-[11px] text-rose-600 font-mono">
                        {validationSummary.invalidRows} affected row(s)
                      </span>
                    </div>

                    {/* Category Filter Pills */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setSelectedErrorType('ALL')}
                        className={`px-2.5 py-1 rounded text-[11px] font-semibold transition cursor-pointer ${
                          selectedErrorType === 'ALL'
                            ? 'bg-rose-600 text-white shadow-sm'
                            : 'bg-white border border-rose-200 text-rose-700 hover:bg-rose-50'
                        }`}
                      >
                        All Errors ({validationSummary.errors.length})
                      </button>
                      {Object.entries(
                        validationSummary.errors.reduce((acc: Record<string, number>, e) => {
                          acc[e.errorType] = (acc[e.errorType] || 0) + 1;
                          return acc;
                        }, {})
                      ).map(([errType, count]) => (
                        <button
                          key={errType}
                          type="button"
                          onClick={() => setSelectedErrorType(errType)}
                          className={`px-2.5 py-1 rounded text-[11px] font-semibold transition cursor-pointer ${
                            selectedErrorType === errType
                              ? 'bg-rose-600 text-white shadow-sm'
                              : 'bg-white border border-rose-200 text-rose-700 hover:bg-rose-50'
                          }`}
                        >
                          {errType.replace(/_/g, ' ')} ({count})
                        </button>
                      ))}
                    </div>

                    <div className="max-h-60 overflow-y-auto space-y-1.5 font-mono text-[11px]">
                      {validationSummary.errors
                        .filter((err) => selectedErrorType === 'ALL' || err.errorType === selectedErrorType)
                        .map((err, i) => (
                          <div key={i} className="bg-white border border-rose-200 p-2.5 rounded text-rose-700 space-y-1">
                            <div className="flex items-start justify-between gap-2">
                              <span className="font-bold text-rose-900 shrink-0">
                                Row {err.rowNumber} [{err.tableName}.{err.columnName}]:
                              </span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 font-semibold font-sans">
                                {err.errorType}
                              </span>
                            </div>
                            <div className="text-slate-800">{err.message}</div>
                            {(err.invalidValue !== undefined && err.invalidValue !== null && err.invalidValue !== "") && (
                              <div className="text-[10px] text-slate-500">
                                <span className="font-semibold text-rose-600">Offending value:</span> "{err.invalidValue}"
                                {err.sourceColumn && <span> (from source column '{err.sourceColumn}')</span>}
                              </div>
                            )}
                            {err.recommendedCorrection && (
                              <div className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-1 rounded border border-emerald-200 font-sans">
                                <span className="font-semibold">Recommended Fix:</span> {err.recommendedCorrection}
                              </div>
                            )}
                          </div>
                        ))}
                    </div>
                  </div>
                ) : (
                  <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    <span>All {validationSummary.totalRows.toLocaleString()} source rows passed dataset validation checks! No blocking errors found.</span>
                  </div>
                )}
              </div>
            )}

            {/* TAB 4: Column Mappings */}
            {activeTab === 'COLUMNS' && (
              <div className="space-y-3">
                {/* Save and revalidate action bar */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-2 p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs">
                  <div>
                    <span className="font-bold text-slate-800 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-amber-500" />
                      Synonym-Based Intelligent Column Matcher (6-Layer Strategy)
                    </span>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Exact, normalized, synonym dictionary, token similarity, and business context matching. Guards against amount/rate & text/numeric mismatches.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleOpenSynonymsModal}
                      className="px-3 py-1.5 rounded font-semibold text-xs transition flex items-center gap-1.5 bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 cursor-pointer shadow-sm"
                    >
                      <BookOpen className="w-3.5 h-3.5 text-blue-600" />
                      Synonym Dictionary
                    </button>
                    {Object.keys(selectedCandidates).length > 0 && (
                      <span className="text-[11px] text-amber-600 font-semibold">
                        {Object.keys(selectedCandidates).length} override(s) pending
                      </span>
                    )}
                    <button
                      type="button"
                      disabled={isSavingMappings || Object.keys(selectedCandidates).length === 0}
                      onClick={handleSaveAndRevalidateMappings}
                      className={`px-3 py-1.5 rounded font-semibold text-xs transition flex items-center gap-1.5 ${
                        Object.keys(selectedCandidates).length > 0 && !isSavingMappings
                          ? 'bg-blue-600 hover:bg-blue-500 text-white cursor-pointer shadow-sm'
                          : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                      }`}
                    >
                      {isSavingMappings ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Revalidating...
                        </>
                      ) : (
                        'Save Mappings & Revalidate'
                      )}
                    </button>
                  </div>
                </div>

                {mappingMessage && (
                  <div className={`p-2.5 rounded text-xs border ${
                    mappingMessage.type === 'success'
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      : 'bg-rose-50 text-rose-800 border-rose-200'
                  }`}>
                    {mappingMessage.text}
                  </div>
                )}

                <div className="overflow-x-auto border border-slate-200 rounded-lg bg-white shadow-sm">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                      <tr>
                        <th className="px-3 py-2">Source Column</th>
                        <th className="px-3 py-2">Normalized Source</th>
                        <th className="px-3 py-2">Business Concept</th>
                        <th className="px-3 py-2">Target Table & Column</th>
                        <th className="px-3 py-2">Target Data Type</th>
                        <th className="px-3 py-2">Match Type & Score</th>
                        <th className="px-3 py-2">Explanation</th>
                        <th className="px-3 py-2">Status</th>
                        <th className="px-3 py-2 text-center">Requirement</th>
                        <th className="px-3 py-2 text-right">Candidate Assignment & Rule</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {resultData.columnMappings.map((m, idx) => {
                        const hasSelected = Boolean(selectedCandidates[m.excelColumn]);
                        const isIgnored = selectedCandidates[m.excelColumn]?.action === 'DO_NOT_MIGRATE' || m.status === 'DO_NOT_MIGRATE';
                        const currentCandidateVal = hasSelected
                          ? selectedCandidates[m.excelColumn].action === 'DO_NOT_MIGRATE'
                            ? 'DO_NOT_MIGRATE'
                            : `${selectedCandidates[m.excelColumn].table}:::${selectedCandidates[m.excelColumn].column}`
                          : '';
                        const learnChecked = Boolean(learnRulesForColumns[m.excelColumn]);

                        return (
                          <tr key={idx} className={`hover:bg-slate-50/70 ${m.status === 'AMBIGUOUS' ? 'bg-amber-50/30' : isIgnored ? 'opacity-60 bg-slate-50/50' : ''}`}>
                            <td className="px-3 py-2 font-bold text-slate-900">
                              <div>{m.excelColumn}</div>
                              {m.sourceDataType && (
                                <span className="text-[10px] text-slate-400 font-normal">[{m.sourceDataType}]</span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-slate-500 text-[11px]">
                              {m.normalizedSourceName || m.excelColumn.toLowerCase()}
                            </td>
                            <td className="px-3 py-2">
                              {m.businessConcept ? (
                                <span className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded text-[10px] font-sans font-semibold inline-block whitespace-nowrap">
                                  {m.businessConcept}
                                </span>
                              ) : (
                                <span className="text-slate-400 italic text-[11px]">—</span>
                              )}
                            </td>
                            <td className="px-3 py-2">
                              {isIgnored ? (
                                <span className="text-slate-400 italic font-semibold">DO_NOT_MIGRATE</span>
                              ) : hasSelected ? (
                                <span className="text-blue-600 font-bold">
                                  {selectedCandidates[m.excelColumn].table}.{selectedCandidates[m.excelColumn].column}*
                                </span>
                              ) : m.status === 'MATCHED' ? (
                                <span>
                                  <span className="text-blue-600 font-medium">{m.databaseTable}</span>.
                                  <span className="text-purple-600 font-medium">{m.databaseColumn}</span>
                                </span>
                              ) : (
                                <span className="text-slate-400 italic">Unassigned</span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-slate-600 text-[11px]">
                              {m.targetDataType || '-'}
                            </td>
                            <td className="px-3 py-2 text-slate-600 text-[11px]">
                              <span className={`font-semibold ${
                                m.matchType === 'EXACT' ? 'text-emerald-700' :
                                m.matchType === 'NORMALIZED' ? 'text-blue-700' :
                                m.matchType === 'SYNONYM' ? 'text-indigo-700' :
                                m.matchType === 'USER_OVERRIDE' || m.matchType === 'APPROVED_RULE' ? 'text-purple-700' :
                                'text-slate-700'
                              }`}>{m.matchType}</span> ({Math.round(m.confidence * 100)}%)
                            </td>
                            <td className="px-3 py-2 text-[11px] text-slate-500 max-w-xs truncate" title={m.explanation || ''}>
                              {m.explanation || '-'}
                            </td>
                            <td className="px-3 py-2">
                              {isIgnored ? (
                                <span className="px-2 py-0.5 bg-slate-100 text-slate-600 border border-slate-300 rounded text-[10px] font-semibold">
                                  IGNORED
                                </span>
                              ) : m.status === 'MATCHED' ? (
                                <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded text-[10px] font-semibold">
                                  ✓ MATCHED
                                </span>
                              ) : m.status === 'AMBIGUOUS' ? (
                                <span className="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded text-[10px] font-semibold">
                                  ? AMBIGUOUS
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 bg-rose-50 text-rose-700 border border-rose-200 rounded text-[10px] font-semibold">
                                  ⚠ UNMATCHED
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-center">
                              {(() => {
                                const req = m.requirementType || (m.isRequired ? 'MANDATORY' : 'OPTIONAL');
                                const colorClass =
                                  req === 'MANDATORY'
                                    ? 'bg-rose-50 text-rose-700 border-rose-200 font-bold'
                                    : req === 'AUTO_GENERATED'
                                    ? 'bg-purple-50 text-purple-700 border-purple-200 font-semibold'
                                    : req === 'DATABASE_DEFAULT'
                                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                                    : req === 'FOREIGN_KEY'
                                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                                    : req === 'UNRESOLVED'
                                    ? 'bg-red-100 text-red-800 border-red-300 font-bold'
                                    : 'bg-slate-50 text-slate-600 border-slate-200';
                                return (
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-sans border inline-block whitespace-nowrap ${colorClass}`}>
                                    {req.replace('_', ' ')}
                                  </span>
                                );
                              })()}
                            </td>
                            <td className="px-3 py-2 text-right">
                              <div className="flex flex-col items-end gap-1">
                                <select
                                  value={currentCandidateVal}
                                  onChange={(e) => handleSelectCandidate(m.excelColumn, e.target.value)}
                                  className="text-[11px] font-sans px-2 py-1 border border-slate-300 rounded bg-white text-slate-800 max-w-[240px] focus:ring-1 focus:ring-blue-500"
                                >
                                  <option value="">
                                    {m.status === 'MATCHED' ? `Keep current (${m.databaseTable}.${m.databaseColumn})` : '-- Select Candidate --'}
                                  </option>
                                  {(m.candidates || []).map((cand, cIdx) => (
                                    <option key={cIdx} value={`${cand.databaseTable}:::${cand.databaseColumn}`}>
                                      {cand.databaseTable}.{cand.databaseColumn} ({Math.round(cand.confidence * 100)}% - {cand.matchMethod || cand.matchType})
                                    </option>
                                  ))}
                                  <option value="DO_NOT_MIGRATE">-- Ignore Column (DO_NOT_MIGRATE) --</option>
                                </select>
                                <label className="text-[10px] font-sans text-slate-500 flex items-center gap-1 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={learnChecked}
                                    onChange={() => handleToggleLearnRule(m.excelColumn)}
                                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-3 h-3"
                                  />
                                  <span>Learn rule for DB</span>
                                </label>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 5: Intelligent Value Matching */}
            {activeTab === 'VALUES' && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <div>
                    <h4 className="font-bold text-slate-800 flex items-center gap-1.5 text-sm">
                      <Sparkles className="w-4 h-4 text-blue-600" /> Intelligent Cell Value Matching & Normalization
                    </h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Matches Excel values against valid target column values (Exact, Normalized, Synonyms, and Ambiguous review).
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        loadValueSynonyms();
                        setShowValueSynonymsModal(true);
                      }}
                      className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded text-xs font-semibold flex items-center gap-1.5 shadow-sm cursor-pointer transition"
                    >
                      <BookOpen className="w-3.5 h-3.5 text-blue-600" />
                      Value Synonyms
                    </button>
                    <button
                      type="button"
                      disabled={isSavingValues || (resultData.valueMappings || []).length === 0}
                      onClick={handleSaveValueMappings}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-semibold flex items-center gap-1.5 shadow-sm cursor-pointer transition disabled:bg-slate-300 disabled:cursor-not-allowed"
                    >
                      {isSavingValues ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5" /> Save Value Mappings
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {valueActionMsg && (
                  <div
                    className={`p-3 text-xs rounded-lg border flex items-center gap-2 ${
                      valueActionMsg.type === 'success'
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        : 'bg-rose-50 text-rose-800 border-rose-200'
                    }`}
                  >
                    {valueActionMsg.type === 'success' ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    )}
                    <span>{valueActionMsg.text}</span>
                  </div>
                )}

                {/* Highlight Ambiguous Values Alert Banner */}
                {(resultData.valueMappings || []).some((vm) => vm.status === 'AMBIGUOUS') && (
                  <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-lg text-xs text-amber-900 space-y-1">
                    <div className="font-bold flex items-center gap-1.5 text-amber-800">
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                      Action Required: Ambiguous Value Matching Detected
                    </div>
                    <p className="text-[11px] text-amber-800">
                      Values such as <code className="bg-amber-100 px-1 py-0.5 rounded font-mono font-semibold">Delivery(Parcel)</code> match multiple valid database candidates (<code className="bg-amber-100 px-1 py-0.5 rounded font-mono font-semibold">Parcel</code> and <code className="bg-amber-100 px-1 py-0.5 rounded font-mono font-semibold">Home Delivery</code>). Please review and select the desired candidate from the dropdown, then click "Save Value Mappings".
                    </p>
                  </div>
                )}

                {/* Value Mappings Table */}
                <div className="overflow-x-auto border border-slate-200 rounded-lg max-h-[500px]">
                  <table className="w-full text-left text-xs text-slate-600 divide-y divide-slate-200">
                    <thead className="bg-slate-50 text-slate-500 font-semibold sticky top-0 z-10 text-[11px] uppercase tracking-wider">
                      <tr>
                        <th className="px-3 py-2.5">Target Column / Excel Column</th>
                        <th className="px-3 py-2.5">Original Excel Value</th>
                        <th className="px-3 py-2.5">Target Database Value</th>
                        <th className="px-3 py-2.5">Match Type</th>
                        <th className="px-3 py-2.5">Status</th>
                        <th className="px-3 py-2.5 text-center">Rows</th>
                        <th className="px-3 py-2.5">Candidate Selector / Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono text-[11px] bg-white">
                      {(resultData.valueMappings || []).length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-3 py-8 text-center text-slate-400 font-sans text-xs">
                            No categorical or enum value columns detected in this dataset.
                          </td>
                        </tr>
                      ) : (
                        (resultData.valueMappings || []).map((vm, idx) => {
                          const key = `${vm.excelColumn}::${vm.excelValue}`;
                          const selectedCandidate = selectedValueCandidates[key] || vm.targetValue || '';
                          const cacheChecked = cacheValueMappings[key] ?? true;

                          return (
                            <tr
                              key={idx}
                              className={`hover:bg-slate-50/80 transition ${
                                vm.status === 'AMBIGUOUS' ? 'bg-amber-50/30' : vm.status === 'UNMATCHED' ? 'bg-rose-50/20' : ''
                              }`}
                            >
                              <td className="px-3 py-2">
                                <span className="font-semibold text-slate-900">{vm.databaseTable}.{vm.databaseColumn}</span>
                                <span className="block text-[10px] text-slate-400 font-sans">
                                  Source: {vm.excelColumn}
                                </span>
                              </td>
                              <td className="px-3 py-2 font-bold text-slate-800">
                                <span className="px-1.5 py-0.5 bg-slate-100 rounded border border-slate-200">
                                  {vm.excelValue}
                                </span>
                              </td>
                              <td className="px-3 py-2">
                                {selectedCandidate ? (
                                  <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded font-bold">
                                    {selectedCandidate}
                                  </span>
                                ) : (
                                  <span className="text-slate-400 italic">None selected</span>
                                )}
                              </td>
                              <td className="px-3 py-2 font-sans">
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border ${
                                    vm.matchType === 'EXACT'
                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                      : vm.matchType === 'NORMALIZED'
                                      ? 'bg-blue-50 text-blue-700 border-blue-200'
                                      : vm.matchType === 'SYNONYM'
                                      ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                      : vm.matchType === 'APPROVED' || vm.matchType === 'USER_OVERRIDE'
                                      ? 'bg-purple-50 text-purple-700 border-purple-200'
                                      : vm.matchType === 'AMBIGUOUS'
                                      ? 'bg-amber-50 text-amber-700 border-amber-300'
                                      : 'bg-rose-50 text-rose-700 border-rose-200'
                                  }`}
                                >
                                  {vm.matchType} ({Math.round(vm.confidence * 100)}%)
                                </span>
                              </td>
                              <td className="px-3 py-2 font-sans">
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                                    vm.status === 'MATCHED'
                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                      : vm.status === 'SUGGESTED'
                                      ? 'bg-blue-50 text-blue-700 border-blue-200'
                                      : vm.status === 'AMBIGUOUS'
                                      ? 'bg-amber-100 text-amber-800 border-amber-300'
                                      : 'bg-rose-100 text-rose-800 border-rose-300'
                                  }`}
                                >
                                  {vm.status}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-center font-bold text-slate-700">
                                {vm.occurrenceCount.toLocaleString()}
                              </td>
                              <td className="px-3 py-2 font-sans">
                                <div className="flex flex-col gap-1">
                                  <select
                                    value={selectedCandidate}
                                    onChange={(e) => handleSelectValueCandidate(vm.excelColumn, vm.excelValue, e.target.value)}
                                    className={`text-[11px] px-2 py-1 border rounded bg-white text-slate-800 max-w-[220px] focus:ring-1 focus:ring-blue-500 ${
                                      vm.status === 'AMBIGUOUS' ? 'border-amber-400 bg-amber-50/50' : 'border-slate-300'
                                    }`}
                                  >
                                    <option value="">-- Choose Candidate --</option>
                                    {(vm.candidates || []).map((cand, cIdx) => (
                                      <option key={cIdx} value={cand.value}>
                                        {cand.value} ({Math.round(cand.confidence * 100)}% - {cand.reason || 'candidate'})
                                      </option>
                                    ))}
                                    {vm.targetValue && !(vm.candidates || []).some((c) => c.value === vm.targetValue) && (
                                      <option value={vm.targetValue}>{vm.targetValue} (Suggested)</option>
                                    )}
                                  </select>
                                  <label className="text-[10px] text-slate-500 flex items-center gap-1 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={cacheChecked}
                                      onChange={() => handleToggleCacheValue(vm.excelColumn, vm.excelValue)}
                                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-3 h-3"
                                    />
                                    <span>Cache for future imports</span>
                                  </label>
                                  {vm.explanation && (
                                    <span className="text-[10px] text-slate-400 truncate max-w-[220px]" title={vm.explanation}>
                                      {vm.explanation}
                                    </span>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded text-xs text-rose-700 text-left font-mono">
            Error: {error}
          </div>
        )}

        {/* Action Controls & Confirmation */}
        <div className="pt-4 flex flex-col sm:flex-row items-center justify-between border-t border-slate-200 gap-3">
          <button
            type="button"
            onClick={onBack}
            className="text-xs text-blue-600 hover:text-blue-700 hover:underline font-medium"
          >
            ← Back to File Upload
          </button>

          {resultData && (
            <div className="flex items-center gap-3">
              {/* Review Migration Button */}
              <button
                type="button"
                onClick={() => setShowReviewModal(true)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg shadow-sm transition flex items-center gap-1.5 cursor-pointer border border-slate-200"
              >
                <Eye className="w-3.5 h-3.5 text-slate-600" />
                Review Migration Plan
              </button>

              {/* Execute Migration Button */}
              <button
                type="button"
                disabled={!canExecute || lifecycle === 'VALIDATION_FAILED' || lifecycle === 'REQUEST_FAILED'}
                onClick={onComplete}
                className={`px-6 py-2.5 text-xs font-semibold rounded-lg shadow-sm transition flex items-center gap-2 ${
                  canExecute && lifecycle === 'PREVIEW_READY'
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer'
                    : 'bg-slate-100 border border-slate-200 text-slate-400 cursor-not-allowed'
                }`}
                title={
                  canExecute && lifecycle === 'PREVIEW_READY'
                    ? 'Execute migration inside database transaction'
                    : `Execution disabled: ${validationSummary?.errors.length ?? 0} validation error(s) must be resolved first`
                }
              >
                Execute Migration <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Review Plan Modal */}
      {showReviewModal && resultData && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-xl w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
              Review Migration Confirmation
            </h3>

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
              {resultData.statement}
            </div>

            <div className="space-y-2 text-xs text-slate-700 font-mono bg-slate-50 p-3 rounded-lg border border-slate-200">
              <p className="font-bold text-slate-900 font-sans">Planned Operations Summary:</p>
              <div className="flex justify-between py-1 border-b border-slate-200">
                <span>Total Planned Inserts:</span>
                <span className="font-bold text-emerald-600">{plannedOps?.totalPlannedInserts ?? 0} rows</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200">
                <span>Master Records Reused (Skipped):</span>
                <span className="font-bold text-blue-600">{plannedOps?.totalPlannedSkips ?? 0} rows</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200">
                <span>Transaction Rollback Policy:</span>
                <span className="font-bold text-purple-700">Atomic Rollback on Any Error</span>
              </div>
              <div className="flex justify-between py-1">
                <span>Validation Errors Remaining:</span>
                <span className={`font-bold ${canExecute ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {validationSummary?.errors.length ?? 0}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowReviewModal(false)}
                className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                Close Review
              </button>
              <button
                type="button"
                disabled={!canExecute || lifecycle === 'VALIDATION_FAILED' || lifecycle === 'REQUEST_FAILED'}
                onClick={() => {
                  setShowReviewModal(false);
                  if (onComplete) onComplete();
                }}
                className={`px-5 py-2 rounded-lg text-xs font-semibold transition ${
                  canExecute && lifecycle === 'PREVIEW_READY'
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer'
                    : 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                }`}
              >
                Confirm & Proceed to Execution
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Synonym Dictionary Management Modal */}
      {showSynonymsModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-3xl w-full max-h-[85vh] flex flex-col p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-blue-600" />
                  Configurable Business Concepts & Synonym Dictionary
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Database Scope: {resultData?.schema.database_name || 'All Databases'} | Maps domain concepts to table attributes
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowSynonymsModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {synonymActionMsg && (
              <div className="p-2 text-xs bg-blue-50 border border-blue-200 text-blue-800 rounded">
                {synonymActionMsg}
              </div>
            )}

            <div className="flex-1 overflow-y-auto space-y-3 pr-1 text-xs">
              {loadingSynonyms ? (
                <div className="p-8 text-center text-slate-400 flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                  Loading concepts and synonyms...
                </div>
              ) : (
                synonymsList.map((concept) => (
                  <div key={concept.id} className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-800">{concept.name}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200 text-slate-600 font-mono">
                          {concept.expected_type || 'TEXT'}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono">ID: {concept.id}</span>
                    </div>
                    {concept.description && (
                      <p className="text-[11px] text-slate-500">{concept.description}</p>
                    )}

                    {/* Synonym badges */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      {concept.synonyms.map((syn, sIdx) => (
                        <span
                          key={sIdx}
                          className="px-2 py-0.5 bg-white border border-slate-300 rounded text-[11px] font-mono text-slate-700 flex items-center gap-1"
                        >
                          {syn}
                          <button
                            type="button"
                            onClick={() => handleDeleteSynonym(concept.id, syn)}
                            className="text-slate-400 hover:text-rose-600 cursor-pointer ml-0.5 font-bold"
                            title={`Remove synonym ${syn}`}
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>

                    {/* Add new synonym input */}
                    <div className="flex items-center gap-2 pt-1">
                      <input
                        type="text"
                        placeholder="Add new synonym (e.g. mobile_no)..."
                        value={newSynonymInput[concept.id] || ''}
                        onChange={(e) => setNewSynonymInput({ ...newSynonymInput, [concept.id]: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleAddSynonym(concept.id);
                        }}
                        className="px-2.5 py-1 text-xs border border-slate-300 rounded bg-white text-slate-800 flex-1 focus:ring-1 focus:ring-blue-500 font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => handleAddSynonym(concept.id)}
                        className="px-2.5 py-1 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded font-medium flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-3 h-3" /> Add
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="border-t border-slate-200 pt-3 flex justify-end">
              <button
                type="button"
                onClick={() => setShowSynonymsModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Value Synonyms Management Modal */}
      {showValueSynonymsModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-3xl w-full max-h-[85vh] flex flex-col p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-blue-600" />
                  Configurable Value Synonyms Dictionary
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Maps cell values (e.g. Dinning, TakeAway, HomeDelivery) to target database values (Dine In, Take Away, Home Delivery)
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowValueSynonymsModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pr-1 text-xs">
              {loadingValueSynonyms ? (
                <div className="p-8 text-center text-slate-400 flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                  Loading value synonyms...
                </div>
              ) : (
                Object.entries(valueSynonymsDict).map(([category, targets]) => (
                  <div key={category} className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
                    <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider text-blue-700">
                      Category: {category}
                    </h4>
                    <div className="space-y-3">
                      {Object.entries(targets).map(([targetVal, synList]) => {
                        const inputKey = `${category}::${targetVal}`;
                        return (
                          <div key={targetVal} className="p-2.5 bg-white border border-slate-200 rounded-md space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-slate-800 text-xs">
                                Target Value: <span className="text-emerald-700 font-mono bg-emerald-50 px-1.5 py-0.5 rounded">{targetVal}</span>
                              </span>
                              <span className="text-[10px] text-slate-400">{synList.length} synonyms</span>
                            </div>
                            <div className="flex flex-wrap items-center gap-1.5">
                              {synList.map((syn, sIdx) => (
                                <span
                                  key={sIdx}
                                  className="px-2 py-0.5 bg-slate-50 border border-slate-300 rounded text-[11px] font-mono text-slate-700 flex items-center gap-1"
                                >
                                  {syn}
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteValueSynonym(category, targetVal, syn)}
                                    className="text-slate-400 hover:text-rose-600 cursor-pointer ml-0.5 font-bold"
                                    title={`Remove synonym ${syn}`}
                                  >
                                    ×
                                  </button>
                                </span>
                              ))}
                            </div>
                            <div className="flex items-center gap-2 pt-1">
                              <input
                                type="text"
                                placeholder={`Add synonym for ${targetVal} (e.g. ${targetVal.toLowerCase()})...`}
                                value={newValueSynonymInput[inputKey] || ''}
                                onChange={(e) =>
                                  setNewValueSynonymInput((prev) => ({ ...prev, [inputKey]: e.target.value }))
                                }
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleAddValueSynonym(category, targetVal);
                                }}
                                className="px-2.5 py-1 text-xs border border-slate-300 rounded bg-white text-slate-800 flex-1 focus:ring-1 focus:ring-blue-500 font-mono"
                              />
                              <button
                                type="button"
                                onClick={() => handleAddValueSynonym(category, targetVal)}
                                className="px-2.5 py-1 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded font-medium flex items-center gap-1 cursor-pointer"
                              >
                                <Plus className="w-3 h-3" /> Add
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="border-t border-slate-200 pt-3 flex justify-end">
              <button
                type="button"
                onClick={() => setShowValueSynonymsModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
