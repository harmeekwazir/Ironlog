import { useState } from 'react';
import { Cloud, Mail, Lock, ArrowLeft, Wifi } from 'lucide-react';
import { useNav } from '../store/nav';
import { useAuth } from '../store/auth';
import { isSupabaseConfigured } from '../lib/supabase';

type Mode = 'sign-in' | 'sign-up' | 'magic-link';

export function AuthPage() {
  const { setPage } = useNav();
  const { signInWithPassword, signUpWithPassword, signInWithMagicLink } = useAuth();
  const [mode, setMode] = useState<Mode>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setBusy(true);
    try {
      if (mode === 'sign-in') {
        const err = await signInWithPassword(email, password);
        if (err) setError(err);
        else setPage('settings');
      } else if (mode === 'sign-up') {
        const err = await signUpWithPassword(email, password);
        if (err) setError(err);
        else setMessage('Account created — check your email to confirm, then sign in.');
      } else {
        const err = await signInWithMagicLink(email);
        if (err) setError(err);
        else setMessage('Magic link sent — check your email.');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col min-h-full pb-24">
      <div className="px-4 pt-12 pb-4 border-b border-iron-800 flex items-center gap-3">
        <button onClick={() => setPage('settings')} className="text-iron-300 hover:text-white transition-colors">
          <ArrowLeft size={20} />
        </button>
        <div>
          <p className="text-iron-400 text-xs uppercase tracking-wider">Account</p>
          <h1 className="text-2xl font-black text-white">Cloud sync</h1>
        </div>
      </div>

      <div className="px-4 pt-5 space-y-4">
        <div className="bg-iron-900 rounded-3xl border border-iron-800 p-4 flex items-start gap-3">
          <div className="w-11 h-11 rounded-2xl bg-volt-400/10 flex items-center justify-center text-volt-400 flex-shrink-0">
            <Cloud size={20} />
          </div>
          <div>
            <p className="text-white font-bold text-base">Sign in to sync across devices</p>
            <p className="text-iron-400 text-sm mt-1">
              Your data keeps working fully offline either way — signing in just backs it up and keeps it in sync
              across every device you use.
            </p>
          </div>
        </div>

        {!isSupabaseConfigured && (
          <div className="bg-iron-900 rounded-2xl border border-iron-800 p-4 flex items-start gap-3">
            <Wifi size={16} className="text-iron-500 flex-shrink-0 mt-0.5" />
            <p className="text-iron-400 text-sm">
              Cloud sync isn't configured for this build yet. Ask whoever runs this app to set
              <code className="mx-1 px-1.5 py-0.5 rounded bg-iron-950 text-iron-300 text-xs">VITE_SUPABASE_URL</code>
              and
              <code className="mx-1 px-1.5 py-0.5 rounded bg-iron-950 text-iron-300 text-xs">VITE_SUPABASE_ANON_KEY</code>.
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-iron-900 rounded-3xl border border-iron-800 p-4 space-y-3">
          <div className="flex rounded-2xl bg-iron-950 border border-iron-800 p-1">
            {(['sign-in', 'sign-up', 'magic-link'] as Mode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => { setMode(m); setError(''); setMessage(''); }}
                className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-colors ${mode === m ? 'bg-volt-400 text-iron-950' : 'text-iron-400'}`}
              >
                {m === 'sign-in' ? 'Sign in' : m === 'sign-up' ? 'Sign up' : 'Magic link'}
              </button>
            ))}
          </div>

          <label className="block space-y-2">
            <div className="text-iron-400 text-xs uppercase tracking-wide flex items-center gap-1.5"><Mail size={12} /> Email</div>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-2xl bg-iron-950 border border-iron-800 px-3 py-3 text-white outline-none focus:border-volt-400/50"
            />
          </label>

          {mode !== 'magic-link' && (
            <label className="block space-y-2">
              <div className="text-iron-400 text-xs uppercase tracking-wide flex items-center gap-1.5"><Lock size={12} /> Password</div>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-2xl bg-iron-950 border border-iron-800 px-3 py-3 text-white outline-none focus:border-volt-400/50"
              />
            </label>
          )}

          {error && <p className="text-red-400 text-sm">{error}</p>}
          {message && <p className="text-volt-400 text-sm">{message}</p>}

          <button
            type="submit"
            disabled={busy || !isSupabaseConfigured}
            className="w-full py-4 bg-volt-400 text-iron-950 rounded-2xl font-black text-base disabled:opacity-40"
          >
            {busy ? 'Please wait…' : mode === 'sign-in' ? 'Sign in' : mode === 'sign-up' ? 'Create account' : 'Send magic link'}
          </button>
        </form>

        <button onClick={() => setPage('settings')} className="w-full text-iron-500 text-sm py-2">
          Continue without an account
        </button>
      </div>
    </div>
  );
}
