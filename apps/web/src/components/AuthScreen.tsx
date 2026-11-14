import {useState, type FormEvent} from 'react';
import {Home, KeyRound, Mail, MapPin, UserRound} from 'lucide-react';
import {apiRequest, type AccountResponse} from '../services/api';
import type {CityId} from '../types';

interface AuthScreenProps {
  onAuthenticated: (account: AccountResponse) => void;
}

export function AuthScreen({onAuthenticated}: AuthScreenProps) {
  const [mode, setMode] = useState<'login' | 'register'>('register');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [cityId, setCityId] = useState<CityId>('bengaluru');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const account = await apiRequest<AccountResponse>(`/auth/${mode}`, {
        method: 'POST',
        body: JSON.stringify(mode === 'register'
          ? {email, password, displayName, cityId}
          : {email, password}),
      });
      onAuthenticated(account);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#FAF9F6] px-4 py-10 flex items-center justify-center">
      <section className="w-full max-w-md rounded-[28px] bg-white p-7 sm:p-9 shadow-kinship-2 border border-slate-900/5">
        <div className="mb-7">
          <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F05A4A]/10 text-[#F05A4A]"><Home /></div>
          <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#F05A4A]">Other Half</p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-[#1E293B]">{mode === 'register' ? 'Find your people.' : 'Welcome back.'}</h1>
          <p className="mt-2 text-sm leading-6 text-[#64748B]">A better way to find a home and flatmates who fit your life.</p>
        </div>
        <form className="space-y-4" onSubmit={submit}>
          {mode === 'register' && <>
            <label className="block text-xs font-bold text-[#1E293B]">Your name
              <span className="relative mt-1.5 block"><UserRound className="absolute left-3 top-3.5 h-4 w-4 text-[#64748B]" /><input required minLength={2} maxLength={80} autoComplete="name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="h-11 w-full rounded-xl bg-[#F4F2EE] pl-10 pr-3 text-sm outline-none focus:ring-2 focus:ring-[#F05A4A]/40" placeholder="How should flatmates call you?" /></span>
            </label>
          </>}
          <label className="block text-xs font-bold text-[#1E293B]">Email address
            <span className="relative mt-1.5 block"><Mail className="absolute left-3 top-3.5 h-4 w-4 text-[#64748B]" /><input required type="email" maxLength={254} autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-11 w-full rounded-xl bg-[#F4F2EE] pl-10 pr-3 text-sm outline-none focus:ring-2 focus:ring-[#F05A4A]/40" placeholder="you@example.com" /></span>
          </label>
          <label className="block text-xs font-bold text-[#1E293B]">Password
            <span className="relative mt-1.5 block"><KeyRound className="absolute left-3 top-3.5 h-4 w-4 text-[#64748B]" /><input required type="password" minLength={mode === 'register' ? 12 : 1} maxLength={128} autoComplete={mode === 'register' ? 'new-password' : 'current-password'} value={password} onChange={(e) => setPassword(e.target.value)} className="h-11 w-full rounded-xl bg-[#F4F2EE] pl-10 pr-3 text-sm outline-none focus:ring-2 focus:ring-[#F05A4A]/40" placeholder={mode === 'register' ? 'At least 12 characters' : 'Your password'} /></span>
          </label>
          {mode === 'register' && <label className="block text-xs font-bold text-[#1E293B]">Your city
            <span className="relative mt-1.5 block"><MapPin className="absolute left-3 top-3.5 h-4 w-4 text-[#64748B]" /><select value={cityId} onChange={(e) => setCityId(e.target.value as CityId)} className="h-11 w-full rounded-xl bg-[#F4F2EE] pl-10 pr-3 text-sm outline-none focus:ring-2 focus:ring-[#F05A4A]/40"><option value="bengaluru">Bengaluru</option><option value="mumbai">Mumbai</option><option value="delhi">Delhi NCR</option><option value="hyderabad">Hyderabad</option></select></span>
          </label>}
          {error && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-700">{error}</p>}
          <button disabled={busy} className="h-12 w-full rounded-xl bg-[#F05A4A] text-sm font-bold text-white transition hover:bg-[#df4d3d] disabled:cursor-wait disabled:opacity-60">{busy ? 'Please wait…' : mode === 'register' ? 'Create your account' : 'Sign in'}</button>
        </form>
        <p className="mt-6 text-center text-sm text-[#64748B]">{mode === 'register' ? 'Already have an account?' : 'New to Other Half?'}{' '}
          <button type="button" onClick={() => {setMode(mode === 'register' ? 'login' : 'register'); setError('');}} className="font-bold text-[#F05A4A] hover:underline">{mode === 'register' ? 'Sign in' : 'Create account'}</button>
        </p>
        <p className="mt-5 text-center text-xs leading-5 text-[#76726B]">Your account is stored securely. Email verification and password recovery will be enabled when email delivery is configured.</p>
      </section>
    </main>
  );
}
