import api from './api';
import { ExcelAnalysisResponse } from '../types';

export const excelService = {
  /**
   * Uploads Excel spreadsheet (.xlsx, .xls) to backend and receives analysis metadata.
   */
  async uploadExcel(file: File): Promise<ExcelAnalysisResponse> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await api.post<ExcelAnalysisResponse>('/excel/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  /**
   * Retrieves upload session by uploadId.
   */
  async getSession(uploadId: string): Promise<ExcelAnalysisResponse> {
    const response = await api.get<ExcelAnalysisResponse>(`/excel/${uploadId}`);
    return response.data;
  },
};
