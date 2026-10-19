import api from './api';
import {
  Step3ProcessingResponse,
  MigrationExecutionResponse,
  MigrationJobStatus,
  BusinessConcept,
  CustomMappingRule
} from '../types';

export const migrationService = {
  /**
   * Executes Intelligent Preview & Validation (Zero writes):
   * Schema introspection -> Column Mapping -> FK Resolution -> Row Preview -> Entire Dataset Validation.
   */
  async processStep3(uploadId: string): Promise<Step3ProcessingResponse> {
    const t0 = performance.now();
    console.log(`[FRONTEND STEP3] Request START | uploadId=${uploadId}`);
    console.log(`[FRONTEND STEP3] Request SENT | POST /api/migration/process/${uploadId}`);

    const response = await api.post<Step3ProcessingResponse>(`/migration/process/${uploadId}`);

    const t1 = performance.now();
    const duration = (t1 - t0) / 1000;
    console.log(`[FRONTEND STEP3] Response RECEIVED | ${duration.toFixed(3)}s`);

    return response.data;
  },

  /**
   * Initiates background migration job and immediately returns job status.
   */
  async startMigration(uploadId: string): Promise<MigrationJobStatus> {
    console.log(`[FRONTEND ASYNC] Starting background migration for uploadId=${uploadId}`);
    const response = await api.post<MigrationJobStatus>(`/migration/start/${uploadId}`);
    return response.data;
  },

  /**
   * Polls live status, progress, and transaction state of an ongoing migration.
   */
  async getMigrationStatus(uploadId: string): Promise<MigrationJobStatus> {
    const response = await api.get<MigrationJobStatus>(`/migration/status/${uploadId}`);
    return response.data;
  },

  /**
   * Reconciles uncertain transaction outcome against database state.
   */
  async reconcileMigration(uploadId: string): Promise<MigrationJobStatus> {
    const response = await api.post<MigrationJobStatus>(`/migration/reconcile/${uploadId}`);
    return response.data;
  },

  /**
   * Executes actual Database Migration inside an atomic SQL transaction:
   * Dependent insertion -> Identity mapping -> Foreign Key linking -> Transaction Commit.
   */
  async executeMigration(uploadId: string): Promise<MigrationExecutionResponse> {
    const t0 = performance.now();
    console.log(`[FRONTEND EXECUTE] Request START | uploadId=${uploadId}`);
    console.log(`[FRONTEND EXECUTE] Request SENT | POST /api/migration/execute/${uploadId}`);

    const response = await api.post<any>(`/migration/execute/${uploadId}`);

    const t1 = performance.now();
    const duration = (t1 - t0) / 1000;
    console.log(`[FRONTEND EXECUTE] Response RECEIVED | ${duration.toFixed(3)}s`);

    let data = response.data;

    // Handle unexpected raw text / CSV response
    if (typeof data === 'string') {
      console.warn('[FRONTEND EXECUTE] Backend returned text/CSV instead of JSON object:', data);
      try {
        data = JSON.parse(data);
      } catch {
        // Parse CSV audit report if text was returned
        const statusMatch = data.match(/Transaction Status,([A-Z_]+)/);
        const txStatus = statusMatch ? statusMatch[1].trim() : 'NOT_EXECUTED';
        return {
          uploadId,
          status: txStatus === 'COMMITTED' ? 'COMPLETED' : txStatus === 'ROLLED_BACK' ? 'FAILED' : 'BLOCKED',
          transaction: txStatus,
          transactionStatus: txStatus,
          canExecute: txStatus === 'COMMITTED',
          tables: {},
          totalInserted: 0,
          totalReused: 0,
          totalSkipped: 0,
          totalFailed: txStatus === 'COMMITTED' ? 0 : 1,
          verificationCounts: {},
          processingTimeSeconds: duration,
          message: `Received audit text report from execution endpoint. Transaction Status: ${txStatus}.`,
          failureDetails: [{ error: data, transaction: txStatus }]
        };
      }
    }

    if (!data || typeof data !== 'object') {
      throw new Error('Malformed execution response: expected JSON object from server.');
    }

    // Normalize transaction field if missing
    if (!data.transaction && data.transactionStatus) {
      data.transaction = data.transactionStatus;
    } else if (!data.transaction && data.status === 'COMPLETED') {
      data.transaction = 'COMMITTED';
    } else if (!data.transaction) {
      data.transaction = 'NOT_EXECUTED';
    }

    return data as MigrationExecutionResponse;
  },

  /**
   * Downloads audit and error report for an upload session.
   */
  async downloadReport(uploadId: string): Promise<void> {
    const response = await api.get(`/migration/report/${uploadId}`, {
      responseType: 'blob',
    });
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `migration_report_${uploadId}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  },

  /**
   * Updates user mapping overrides and immediately re-validates the dataset.
   */
  async updateMappings(
    uploadId: string,
    overrides: Array<{
      excelColumn: string;
      databaseTable: string;
      databaseColumn: string;
      action?: string;
      businessConcept?: string;
      saveRule?: boolean;
    }>
  ): Promise<Step3ProcessingResponse> {
    const response = await api.post<Step3ProcessingResponse>(`/migration/mappings/${uploadId}`, {
      overrides,
    });
    return response.data;
  },

  /**
   * Fetches all registered business concepts and synonyms.
   */
  async getSynonyms(database?: string): Promise<BusinessConcept[]> {
    const params = database ? { database } : {};
    const res = await api.get<BusinessConcept[]>('/mapping/synonyms', { params });
    return res.data;
  },

  /**
   * Adds a synonym to a business concept.
   */
  async addSynonym(conceptId: string, synonym: string, database?: string): Promise<{ message: string }> {
    const res = await api.post<{ message: string }>('/mapping/synonyms', {
      conceptId,
      synonym,
      database,
    });
    return res.data;
  },

  /**
   * Deletes a synonym from a business concept.
   */
  async deleteSynonym(conceptId: string, synonym: string, database?: string): Promise<{ message: string }> {
    const params = database ? { database } : {};
    const res = await api.delete<{ message: string }>(`/mapping/synonyms/${conceptId}/${synonym}`, { params });
    return res.data;
  },

  /**
   * Fetches learned approved mapping rules.
   */
  async getRules(database?: string): Promise<CustomMappingRule[]> {
    const params = database ? { database } : {};
    const res = await api.get<CustomMappingRule[]>('/mapping/rules', { params });
    return res.data;
  },

  /**
   * Saves an approved user mapping rule.
   */
  async saveRule(rule: {
    sourceColumn: string;
    businessConcept?: string;
    targetTable: string;
    targetColumn: string;
    databaseScope?: string;
    schemaScope?: string;
  }): Promise<CustomMappingRule> {
    const res = await api.post<CustomMappingRule>('/mapping/rules', rule);
    return res.data;
  },

  /**
   * Deletes an approved mapping rule.
   */
  async deleteRule(ruleId: string): Promise<{ message: string }> {
    const res = await api.delete<{ message: string }>(`/mapping/rules/${ruleId}`);
    return res.data;
  },

  /**
   * Updates value mapping overrides/approvals and immediately re-validates the dataset.
   */
  async updateValueMappings(
    uploadId: string,
    overrides: Array<{
      excelColumn: string;
      databaseTable: string;
      databaseColumn: string;
      excelValue: string;
      targetValue: string;
      saveCache?: boolean;
    }>
  ): Promise<Step3ProcessingResponse> {
    const response = await api.post<Step3ProcessingResponse>(`/migration/values/${uploadId}`, {
      overrides,
    });
    return response.data;
  },

  /**
   * Fetches all registered value synonyms by category and target value.
   */
  async getValueSynonyms(): Promise<Record<string, Record<string, string[]>>> {
    const res = await api.get<Record<string, Record<string, string[]>>>('/mapping/values/synonyms');
    return res.data;
  },

  /**
   * Adds a value synonym.
   */
  async addValueSynonym(category: string, targetValue: string, synonym: string): Promise<{ message: string }> {
    const res = await api.post<{ message: string }>('/mapping/values/synonyms', {
      category,
      targetValue,
      synonym,
    });
    return res.data;
  },

  /**
   * Deletes a value synonym.
   */
  async deleteValueSynonym(category: string, targetValue: string, synonym: string): Promise<{ message: string }> {
    const res = await api.delete<{ message: string }>(
      `/mapping/values/synonyms/${encodeURIComponent(category)}/${encodeURIComponent(targetValue)}/${encodeURIComponent(synonym)}`
    );
    return res.data;
  },

  /**
   * Fetches cached approved value mappings.
   */
  async getCachedValueMappings(): Promise<any[]> {
    const res = await api.get<any[]>('/mapping/values/cache');
    return res.data;
  },
};
