import React, { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { resetPassword } from '../services/auth.service';
import { AppRoute } from '../constants/routes';

const ResetPassword: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [status, setStatus] = useState<{ type: 'error' | 'success', msg: string } | null>(null);

  const token = searchParams.get('token');
  const email = searchParams.get('email') || '';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      return setStatus({ type: 'error', msg: 'Passwords do not match' });
    }

    try {
      await resetPassword({ token, new_password: password, email });
      setStatus({ type: 'success', msg: 'Password updated successfully! Redirecting...' });
      setTimeout(() => navigate(AppRoute.AUTH), 2000);
    } catch (err: any) {
      setStatus({ type: 'error', msg: err.message || 'Failed to reset password' });
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white/5 border border-white/10 rounded-[32px] p-8 backdrop-blur-xl">
        <h2 className="text-2xl font-bold text-white mb-2">Set New Password</h2>
        <p className="text-slate-400 text-sm mb-8">Enter a strong password to secure your account.</p>

        {status && (
          <div className={`mb-6 p-4 rounded-xl text-sm ${
            status.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
          }`}>
            {status.msg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">New Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-4 text-white focus:outline-none focus:border-indigo-500/50 transition-all"
              required
              minLength={8}
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Confirm Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-4 text-white focus:outline-none focus:border-indigo-500/50 transition-all"
              required
            />
          </div>
          <button
            type="submit"
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-4 rounded-2xl shadow-lg shadow-indigo-600/20 transition-all mt-4"
          >
            Update Password
          </button>
        </form>
      </div>
    </div>
  );
};
export default ResetPassword;
