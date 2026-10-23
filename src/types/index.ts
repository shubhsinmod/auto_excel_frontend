export interface DatabaseConnectRequest {
  server: string;
  port: number;
  database: string;
  username?: string;
  password?: string;
  driver?: string;
  trusted_connection: boolean;
}

export interface DatabaseConnectionResponse {
  connected: boolean;
  database?: string;
  server?: string;
  version?: string;
  message: string;
  error?: string;
}

export interface ColumnMetadata {
  name: string;
  type: string;
  nullable: boolean;
  primary_key: boolean;
  identity: boolean;
  default?: string | null;
  unique: boolean;
  collation?: string | null;
}

export interface TableMetadata {
  name: string;
  schema_name?: string;
  columns: ColumnMetadata[];
  primary_keys: string[];
  unique_keys?: Array<{ name?: string | null; columns: string[]; primary_key?: boolean }>;
}

export interface DatabaseSchemaMetadata {
  database_name: string;
  db_type: string;
  tables: TableMetadata[];
}

export interface ExcelAnalysisResponse {
  uploadId: string;
  fileName: string;
  sheetName: string;
  availableSheets: string[];
  rowCount: number;
  columnCount: number;
  columns: string[];
  sampleRows: Record<string, any>[];
  fileSizeBytes: number;
  createdAt: string;
  headerRowNumber?: number;
  titleRowsSkipped?: number[];
  headerDetectionMethod?: string;
}

export interface CandidateMapping {
  databaseTable: string;
  databaseColumn: string;
  confidence: number;
  matchType?: string;
  matchMethod?: string;
  dataTypeCompatibility?: string;
  keyInfo?: string;
  reason?: string;
  normalizedTargetName?: string;
  businessConcept?: string;
  sourceDataType?: string;
  targetDataType?: string;
  requirementType?: 'MANDATORY' | 'OPTIONAL' | 'AUTO_GENERATED' | 'DATABASE_DEFAULT' | 'FOREIGN_KEY' | 'UNRESOLVED' | string;
  isRequired?: boolean;
}

export interface ColumnMappingResult {
  excelColumn: string;
  databaseTable: string;
  databaseColumn: string;
  confidence: number;
  matchType: string;
  status: 'MATCHED' | 'UNMATCHED' | 'AMBIGUOUS' | 'DO_NOT_MIGRATE' | string;
  normalizedSourceName?: string;
  normalizedTargetName?: string;
  businessConcept?: string;
  sourceDataType?: string;
  targetDataType?: string;
  explanation?: string;
  requirementType?: 'MANDATORY' | 'OPTIONAL' | 'AUTO_GENERATED' | 'DATABASE_DEFAULT' | 'FOREIGN_KEY' | 'UNRESOLVED' | string;
  isRequired?: boolean;
  candidates?: CandidateMapping[];
}

export interface BusinessConcept {
  id: string;
  name: string;
  description: string;
  synonyms: string[];
  expected_type?: string;
  database_scope?: string | null;
  is_builtin?: boolean;
}

export interface CustomMappingRule {
  rule_id: string;
  source_column: string;
  business_concept?: string;
  target_table: string;
  target_column: string;
  database_scope?: string | null;
  schema_scope?: string;
  status: string;
  created_at?: string;
}

export interface ValueResolutionResult {
  excelColumn: string;
  excelValue: string;
  referenceTable: string;
  targetColumn: string;
  resolvedId?: string | null;
  status: 'MATCHED' | 'NOT_FOUND' | 'AMBIGUOUS' | 'PENDING' | string;
  excelName?: string | null;
  matchedDatabaseName?: string | null;
  valueSource?: 'DATABASE_LOOKUP' | 'EXISTING_DATABASE' | 'GENERATED_ID' | 'USER_OVERRIDE' | string;
  validationStatus?: 'VALID' | 'WARNING' | 'ERROR' | string;
  candidates?: { id: any; name: string }[];
  message?: string | null;
}

export interface ValueResolutionSummary {
  valuesInspected: number;
  valuesMatchedExisting: number;
  valuesResolvedConfirmed: number;
  valuesRequiringNewParent: number;
  unresolvedForeignKeys: number;
  ambiguousValues: number;
  valuesRejectedValidation: number;
}

export interface ValueCandidate {
  value: string;
  confidence: number;
  reason?: string;
}

export interface ValueMappingItem {
  excelColumn: string;
  databaseTable: string;
  databaseColumn: string;
  excelValue: string;
  normalizedExcelValue?: string;
  targetValue?: string | null;
  matchType: 'EXACT' | 'NORMALIZED' | 'SYNONYM' | 'APPROVED' | 'USER_OVERRIDE' | 'AMBIGUOUS' | 'UNMATCHED' | string;
  status: 'MATCHED' | 'SUGGESTED' | 'AMBIGUOUS' | 'UNMATCHED' | string;
  confidence: number;
  explanation?: string;
  candidates?: ValueCandidate[];
  occurrenceCount: number;
}

export interface ValueOverrideItem {
  excelColumn: string;
  databaseTable: string;
  databaseColumn: string;
  excelValue: string;
  targetValue: string;
  saveCache?: boolean;
}

export interface SourceRowPreviewItem {
  sourceRow: number;
  sourceFile: string;
  targetDatabase: string;
  targetSchema: string;
  targetTable: string;
  targetColumn: string;
  sourceColumn?: string | null;
  sourceValue?: string | null;
  finalValue?: string | null;
  valueSource: 'EXCEL' | 'EXISTING_DATABASE' | 'FOREIGN_KEY' | 'GENERATED_ID' | 'DATABASE_DEFAULT' | 'NULL' | 'USER_OVERRIDE' | 'DATABASE_LOOKUP' | string;
  mappingStatus: string;
  mappingConfidence: number;
  isNullable: boolean;
  isRequired: boolean;
  isIdentity: boolean;
  hasDefault: boolean;
  requirementType?: 'MANDATORY' | 'OPTIONAL' | 'AUTO_GENERATED' | 'DATABASE_DEFAULT' | 'FOREIGN_KEY' | 'UNRESOLVED' | string;
  validationStatus: 'VALID' | 'WARNING' | 'ERROR';
  validationMessage?: string | null;
}

export interface ForeignKeyPlanItem {
  childTable: string;
  childColumn: string;
  parentTable: string;
  parentColumn: string;
  sourceBusinessKey?: string | null;
  existingParentFound: boolean;
  resolvedId?: string | null;
  generatedIdPending: boolean;
  status: 'MATCHED' | 'NOT_FOUND' | 'AMBIGUOUS' | 'PENDING' | string;
  insertionOrder: number;
  matchedDatabaseName?: string | null;
  valueSource?: string;
  validationStatus?: string;
  candidates?: { id: any; name: string }[];
}

export interface RowValidationError {
  rowNumber: number;
  tableName: string;
  columnName: string;
  errorType: string;
  message: string;
  severity: 'ERROR' | 'WARNING';
  sourceColumn?: string | null;
  invalidValue?: string | null;
  recommendedCorrection?: string | null;
}

export interface ValidationSummary {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  warningsCount: number;
  matchedColumnsCount: number;
  unmatchedColumnsCount: number;
  unresolvedForeignKeysCount: number;
  errors: RowValidationError[];
  warnings: RowValidationError[];
  circularDependencies: string[];
  canExecute: boolean;
}

export interface PlannedOperationsSummary {
  totalPlannedInserts: number;
  totalPlannedUpdates: number;
  totalPlannedSkips: number;
  plannedInsertsByTable: Record<string, number>;
  plannedUpdatesByTable: Record<string, number>;
  plannedSkipsByTable: Record<string, number>;
  existingRowsSkipped?: number;
  duplicateSourceRows?: number;
  ambiguousRows?: number;
  matchingKeysUnavailable?: string[];
  statement: string;
  canExecute: boolean;
}

export interface Step3ProcessingResponse {
  uploadId: string;
  status: string;
  schema: DatabaseSchemaMetadata;
  columnMappings: ColumnMappingResult[];
  valueResolutions: ValueResolutionResult[];
  valueMappings?: ValueMappingItem[];
  tablesProcessed: string[];
  matchedColumnsCount: number;
  matchedValuesCount: number;
  unmatchedValuesCount: number;
  ambiguousValuesCount: number;
  processingTimeSeconds: number;

  // Safe Preview-First Workflow fields
  previewRows?: SourceRowPreviewItem[];
  dependencyPlan?: ForeignKeyPlanItem[];
  validationSummary?: ValidationSummary;
  plannedOperations?: PlannedOperationsSummary;
  executionOrder?: string[];
  statement?: string;
  canExecute?: boolean;
  valueResolutionSummary?: ValueResolutionSummary;
}

export interface TableMigrationStat {
  inserted: number;
  updated?: number;
  reused: number;
  skipped: number;
  duplicateSource?: number;
  ambiguous?: number;
  failed?: number;
  verifiedInserted?: number;
  totalTableRows?: number;
}

export interface MigrationExecutionResponse {
  uploadId: string;
  status: string;
  transaction: string;
  transactionStatus?: string;
  canExecute?: boolean;
  executionStarted?: string;
  executionCompleted?: string;
  tables: Record<string, TableMigrationStat>;

  // Source row metrics (Counting unit = Source Excel/CSV rows)
  sourceRowsTotal?: number;
  sourceRowsWithInserts?: number;
  sourceRowsFullyReused?: number;
  sourceRowsFailed?: number;

  // Target table operations metrics (Counting unit = Target table records/operations)
  totalTableOperations?: number;
  totalInserted: number;
  totalUpdated?: number;
  totalReused: number;
  totalSkipped?: number;
  totalFailed?: number;
  duplicateSourceRows?: number;
  ambiguousRows?: number;
  unresolvedForeignKeyRows?: number;
  committedRows?: number;
  matchingKeysUnavailable?: string[];
  recordOutcomes?: Array<Record<string, unknown>>;
  insertedCount?: number;
  updatedCount?: number;
  reusedCount?: number;
  skippedCount?: number;
  failedCount?: number;

  // Verification and FK propagation details
  verifiedInsertedCounts?: Record<string, number>;
  foreignKeysPropagated?: number;
  verificationDetails?: Record<string, string>;

  validationErrors?: RowValidationError[];
  warnings?: RowValidationError[];
  generatedIds?: Record<string, any[]>;
  failureDetails?: Array<{ row?: number; table?: string; error: string; transaction?: string }>;
  verificationCounts: Record<string, number>;
  processingTimeSeconds: number;
  message?: string;
  errorReport?: any[];
}

export interface MigrationJobStatus {
  jobId: string;
  uploadId: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'BLOCKED';
  transactionStatus: 'NOT_EXECUTED' | 'IN_PROGRESS' | 'COMMITTED' | 'ROLLED_BACK' | 'UNCERTAIN';
  currentTable?: string | null;
  totalTables: number;
  tablesCompleted: number;
  totalRows: number;
  rowsProcessed: number;

  // Source row metrics
  sourceRowsTotal?: number;
  sourceRowsWithInserts?: number;
  sourceRowsFullyReused?: number;

  // Target table operations metrics
  totalTableOperations?: number;
  totalInserted: number;
  totalReused: number;
  percentComplete: number;
  elapsedSeconds: number;
  startedAt?: string | null;
  completedAt?: string | null;
  message?: string;
  errorMessage?: string | null;
  result?: MigrationExecutionResponse | null;
}

export interface HistoryFileItem {
  fileId: number | string;
  uploadId?: string | null;
  fileName: string;
  uploadedAt: string;
  status: 'Completed' | 'Failed' | 'Processing' | string;
  totalRows?: number | null;
  totalInserted?: number | null;
  totalReused?: number | null;
  source?: string;
  errorMessage?: string | null;
}

export interface MigrationHistorySummary {
  totalFiles: number;
  completedCount: number;
  failedCount: number;
  processingCount: number;
  totalRowsMigrated: number;
  files: HistoryFileItem[];
}

export type MigrationStep = 'CONNECT_DB' | 'UPLOAD_EXCEL' | 'PROCESSING' | 'RESULT' | 'HISTORY';

