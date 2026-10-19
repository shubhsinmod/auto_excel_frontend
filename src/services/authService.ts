import api from './api';

export interface LoginResponse {
  authenticated: boolean;
  username: string;
}

export const login = async (username: string, password: string): Promise<LoginResponse> => {
  const response = await api.post<LoginResponse>('/auth/login', { username, password });
  return response.data;
};