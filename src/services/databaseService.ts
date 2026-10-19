import api from './api';
import { DatabaseConnectRequest, DatabaseConnectionResponse } from '../types';

export const databaseService = {
  /**
   * Connect to database using dynamic user credentials.
   */
  async connect(credentials: DatabaseConnectRequest): Promise<DatabaseConnectionResponse> {
    const response = await api.post<DatabaseConnectionResponse>('/database/connect', credentials);
    return response.data;
  },

  /**
   * Connect using default environment database configuration (.env).
   */
  async testDefaultConnection(): Promise<DatabaseConnectionResponse> {
    const response = await api.get<DatabaseConnectionResponse>('/database/test');
    return response.data;
  },
};
