import { FormEvent, useState } from 'react';
import { ArrowRight, Eye, EyeOff, FileSpreadsheet, Layers, LockKeyhole } from 'lucide-react';
import { login } from '../services/authService';

interface LoginPageProps {
  onLogin: (username: string) => void;
}

export const LoginPage = ({ onLogin }: LoginPageProps) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      const result = await login(username.trim(), password);
      onLogin(result.username);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to sign in.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#f4f6f3] text-slate-900">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-5 py-7 sm:px-8">
        <header className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900 text-white">
            <Layers className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm font-semibold tracking-normal">Intelligent Excel-to-SQL</p>
            <p className="mt-0.5 text-xs text-slate-500">Migration workspace</p>
          </div>
        </header>

        <section className="grid flex-1 items-center gap-12 py-14 lg:grid-cols-[1fr_420px] lg:gap-20">
          <div className="hidden max-w-xl lg:block">
            <div className="mb-7 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-800">
              <FileSpreadsheet className="h-7 w-7" aria-hidden="true" />
            </div>
            <h1 className="max-w-lg text-4xl font-semibold leading-tight tracking-normal text-slate-950">
              Your data migration workspace.
            </h1>
            <div className="mt-8 h-px w-20 bg-emerald-700" />
            <p className="mt-5 text-sm text-slate-500">Secure sign-in for your team workspace.</p>
          </div>

          <div className="mx-auto w-full max-w-md rounded-2xl border border-slate-200 bg-white p-7 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.4)] sm:p-9">
            <div className="mb-8">
              <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-800 lg:hidden">
                <LockKeyhole className="h-5 w-5" aria-hidden="true" />
              </div>
              <h2 className="text-2xl font-semibold tracking-normal text-slate-950">Sign in</h2>
              <p className="mt-2 text-sm text-slate-500">Enter your account credentials to continue.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="username" className="mb-2 block text-sm font-medium text-slate-700">Username</label>
                <input
                  id="username"
                  name="username"
                  type="text"
                  autoComplete="username"
                  required
                  maxLength={50}
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3.5 text-sm text-slate-900 outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/15"
                  placeholder="Your username"
                />
              </div>

              <div>
                <label htmlFor="password" className="mb-2 block text-sm font-medium text-slate-700">Password</label>
                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3.5 pr-12 text-sm text-slate-900 outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/15"
                    placeholder="Your password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((visible) => !visible)}
                    className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-slate-500 hover:text-slate-900"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-800">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2 disabled:cursor-wait disabled:opacity-60"
              >
                {isSubmitting ? 'Signing in…' : 'Sign in'}
                {!isSubmitting && <ArrowRight className="h-4 w-4" aria-hidden="true" />}
              </button>
            </form>
          </div>
        </section>

        <footer className="flex items-center justify-between border-t border-slate-200 pt-4 text-xs text-slate-500">
          <span>Intelligent Excel-to-SQL</span>
          <span>Authorized access only</span>
        </footer>
      </div>
    </main>
  );
};