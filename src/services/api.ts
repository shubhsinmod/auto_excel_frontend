import axios from 'axios';

// Base Axios instance
const api = axios.create({
  baseURL: (import.meta as any).env?.VITE_API_BASE_URL || '/api',
  timeout: 300000, // Preview can analyze large CSVs; backend query optimizations keep this bounded.
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const detail = error.response?.data?.detail;
    const message = Array.isArray(detail)
      ? detail.map((item: any) => item.msg || JSON.stringify(item)).join('; ')
      : typeof detail === 'string'
        ? detail
        : error.response?.data?.message || error.message || 'An unexpected error occurred';
    return Promise.reject(new Error(message));
  }
);

export default api;
