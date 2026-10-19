import React, { useState, useEffect } from 'react';
import { Database, Server, Key, User, CheckCircle2, XCircle, Loader2, ShieldCheck, Zap } from 'lucide-react';
import { DatabaseConnectRequest, DatabaseConnectionResponse } from '../types';
import { databaseService } from '../services/databaseService';

interface DatabaseConnectFormProps {
  onConnectionSuccess: (info: DatabaseConnectionResponse) => void;
}

export const DatabaseConnectForm: React.FC<DatabaseConnectFormProps> = ({ onConnectionSuccess }) => {
  const [authType, setAuthType] = useState<'SQL' | 'WINDOWS'>('SQL');
  const [formData, setFormData] = useState<DatabaseConnectRequest>({
    server: 'localhost',
    port: 3307,
    database: 'excel_migration_db',
    username: 'root',
    password: '',
    driver: 'MySQL Driver',
    trusted_connection: false,
  });

  const [loading, setLoading] = useState(false);
  const [connectionResult, setConnectionResult] = useState<DatabaseConnectionResponse | null>(null);

  // Automatically attempt connection to backend configured database on mount
  useEffect(() => {
    const autoConnect = async () => {
      setLoading(true);
      try {
        const response = await databaseService.testDefaultConnection();
        if (response.connected) {
          setConnectionResult(response);
          onConnectionSuccess(response);
        }
      } catch (err) {
        // Silently catch initial load attempt
      } finally {
        setLoading(false);
      }
    };
    autoConnect();
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target as HTMLInputElement;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const handleAuthTypeChange = (type: 'SQL' | 'WINDOWS') => {
    setAuthType(type);
    setFormData((prev) => ({
      ...prev,
      trusted_connection: type === 'WINDOWS',
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setConnectionResult(null);

    try {
      const response = await databaseService.connect({
        ...formData,
        port: Number(formData.port),
        trusted_connection: authType === 'WINDOWS',
      });

      setConnectionResult(response);

      if (response.connected) {
        onConnectionSuccess(response);
      }
    } catch (err: any) {
      setConnectionResult({
        connected: false,
        message: 'Failed to connect to database.',
        error: err.message || 'Connection error',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUseDefaultConnection = async () => {
    setLoading(true);
    setConnectionResult(null);

    try {
      const response = await databaseService.testDefaultConnection();
      setConnectionResult(response);

      if (response.connected) {
        onConnectionSuccess(response);
      }
    } catch (err: any) {
      setConnectionResult({
        connected: false,
        message: 'Failed to connect using default database settings.',
        error: err.message || 'Connection error',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto mt-8 bg-slate-800/80 border border-slate-700/60 rounded-xl shadow-2xl p-6 sm:p-8 backdrop-blur">
      <div className="flex items-center space-x-3 mb-6 pb-4 border-b border-slate-700/60">
        <div className="p-3 bg-sky-500/10 text-sky-400 rounded-lg border border-sky-500/20">
          <Database className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-100">Connect Database</h2>
          <p className="text-sm text-slate-400">Connect to your target MySQL or SQL Server database.</p>
        </div>
      </div>

      {/* Quick Connect Default Option */}
      <div className="mb-6 p-4 bg-slate-900/60 border border-slate-700/80 rounded-lg flex flex-col sm:flex-row items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-sky-400 uppercase tracking-wider flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5" /> Auto-Configured Local Database
          </p>
          <p className="text-xs text-slate-400 mt-0.5">
            Use backend environment database configuration (.env)
          </p>
        </div>
        <button
          type="button"
          onClick={handleUseDefaultConnection}
          disabled={loading}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg shadow transition whitespace-nowrap"
        >
          Quick Connect
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Auth Type Selector */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
            Authentication Type
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => handleAuthTypeChange('SQL')}
              className={`py-2 px-4 rounded-lg border text-sm font-medium transition flex items-center justify-center gap-2 ${
                authType === 'SQL'
                  ? 'bg-sky-600/20 border-sky-500 text-sky-300'
                  : 'bg-slate-900/40 border-slate-700 text-slate-400 hover:border-slate-600'
              }`}
            >
              <User className="w-4 h-4" /> Standard / SQL Auth
            </button>
            <button
              type="button"
              onClick={() => handleAuthTypeChange('WINDOWS')}
              className={`py-2 px-4 rounded-lg border text-sm font-medium transition flex items-center justify-center gap-2 ${
                authType === 'WINDOWS'
                  ? 'bg-sky-600/20 border-sky-500 text-sky-300'
                  : 'bg-slate-900/40 border-slate-700 text-slate-400 hover:border-slate-600'
              }`}
            >
              <ShieldCheck className="w-4 h-4" /> Windows Auth
            </button>
          </div>
        </div>

        {/* Server & Port */}
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Database Host / Server <span className="text-rose-400">*</span>
            </label>
            <div className="relative">
              <Server className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
              <input
                type="text"
                name="server"
                required
                value={formData.server}
                onChange={handleInputChange}
                placeholder="e.g. localhost or 127.0.0.1"
                className="w-full pl-9 pr-3 py-2 bg-slate-900/80 border border-slate-700 rounded-lg text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Port</label>
            <input
              type="number"
              name="port"
              value={formData.port}
              onChange={handleInputChange}
              className="w-full px-3 py-2 bg-slate-900/80 border border-slate-700 rounded-lg text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>
        </div>

        {/* Database Name */}
        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1">
            Database Name <span className="text-rose-400">*</span>
          </label>
          <input
            type="text"
            name="database"
            required
            value={formData.database}
            onChange={handleInputChange}
            placeholder="e.g. excel_migration_db"
            className="w-full px-3 py-2 bg-slate-900/80 border border-slate-700 rounded-lg text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
        </div>

        {/* Username & Password (SQL Auth) */}
        {authType === 'SQL' && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Username</label>
              <div className="relative">
                <User className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
                <input
                  type="text"
                  name="username"
                  value={formData.username}
                  onChange={handleInputChange}
                  placeholder="root or sa"
                  className="w-full pl-9 pr-3 py-2 bg-slate-900/80 border border-slate-700 rounded-lg text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Password</label>
              <div className="relative">
                <Key className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-3 py-2 bg-slate-900/80 border border-slate-700 rounded-lg text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
            </div>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full mt-4 py-3 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-medium rounded-lg shadow-lg shadow-sky-600/20 transition flex items-center justify-center gap-2 cursor-pointer"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" /> Connecting to Database...
            </>
          ) : (
            'Connect Database'
          )}
        </button>
      </form>

      {/* Result feedback */}
      {connectionResult && (
        <div
          className={`mt-6 p-4 rounded-lg border flex items-start gap-3 ${
            connectionResult.connected
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
          }`}
        >
          {connectionResult.connected ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 mt-0.5 shrink-0" />
          ) : (
            <XCircle className="w-5 h-5 text-rose-400 mt-0.5 shrink-0" />
          )}
          <div className="text-sm">
            <p className="font-semibold">
              {connectionResult.connected ? '✓ Database Connected' : 'Connection Failed'}
            </p>
            <p className="mt-1 text-slate-300">{connectionResult.message}</p>
            {connectionResult.database && connectionResult.connected && (
              <p className="mt-1 text-xs text-emerald-400">
                Connected to: <span className="font-mono">{connectionResult.database}</span>
              </p>
            )}
            {connectionResult.error && (
              <p className="mt-2 text-xs font-mono bg-slate-950/60 p-2 rounded border border-rose-500/20 text-rose-300 break-words">
                {connectionResult.error}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
