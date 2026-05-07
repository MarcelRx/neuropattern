import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { AppRoute } from '../types';

const ResetPassword: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Get token from URL - handle both ?token=xxx and #/reset-password?token=xxx
  const searchParams = new URLSearchParams(location.search);
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(true);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isValidToken, setIsValidToken] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    verifyToken();
  }, [token]);

  const verifyToken = async () => {
    if (!token) {
      setError('Invalid reset link - no token found');
      setIsVerifying(false);
      return;
    }

    try {
      const response = await fetch('http://127.0.0.1:8000/auth/verify-reset-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });

      if (response.ok) {
        setIsValidToken(true);
      } else {
        const data = await response.json();
        setError(data.detail || 'This reset link has expired or is invalid');
      }
    } catch (err) {
      setError('Failed to verify reset link. Please try again.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('http://127.0.0.1:8000/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, new_password: password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Failed to reset password');
      }

      setIsSuccess(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  if (isVerifying) {
    return (
      <div className="min-h-screen bg-background-dark flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <span className="h-8 w-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></span>
          <p className="text-gray-400">Verifying reset link...</p>
        </div>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-background-dark flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-sm text-center">
          <div className="h-16 w-16 rounded-full bg-secondary/20 flex items-center justify-center mx-auto mb-6">
            <span className="material-symbols-outlined text-3xl text-secondary">check_circle</span>
          </div>
          <h1 className="text-2xl font-bold text-white mb-4">Password Reset!</h1>
          <p className="text-gray-400 mb-8">
            Your password has been reset successfully. You can now log in with your new password.
          </p>
          <button 
            onClick={() => navigate(AppRoute.AUTH)}
            className="w-full bg-primary hover:bg-blue-500 text-white font-bold py-4 rounded-xl transition-colors"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  if (!isValidToken) {
    return (
      <div className="min-h-screen bg-background-dark flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-sm text-center">
          <div className="h-16 w-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-6">
            <span className="material-symbols-outlined text-3xl text-red-500">error</span>
          </div>
          <h1 className="text-2xl font-bold text-white mb-4">Link Expired</h1>
          <p className="text-gray-400 mb-8">{error}</p>
          <button 
            onClick={() => navigate(AppRoute.FORGOT_PASSWORD)}
            className="w-full bg-primary hover:bg-blue-500 text-white font-bold py-4 rounded-xl transition-colors"
          >
            Request New Link
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background-dark flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="h-16 w-16 rounded-2xl bg-[#1e293b] flex items-center justify-center border border-white/5 shadow-lg mb-6">
            <span className="material-symbols-outlined text-3xl text-primary">lock_reset</span>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Create New Password</h1>
          <p className="text-sm text-gray-400 text-center">
            Enter your new password below.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-3 rounded-lg bg-red-500/10 border border-red-500/50 text-red-500 text-xs text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 ml-1">
              New Password
            </label>
            <input 
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-background-card border border-white/10 rounded-xl py-4 px-4 text-white focus:outline-none focus:border-primary/50 transition-all"
              placeholder="••••••••"
              required
              minLength={6}
              disabled={isLoading}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 ml-1">
              Confirm Password
            </label>
            <input 
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full bg-background-card border border-white/10 rounded-xl py-4 px-4 text-white focus:outline-none focus:border-primary/50 transition-all"
              placeholder="••••••••"
              required
              disabled={isLoading}
            />
          </div>

          <button 
            type="submit"
            disabled={isLoading}
            className="w-full bg-primary hover:bg-blue-500 text-white font-bold py-4 rounded-xl shadow-neon-blue transition-all mt-6 flex items-center justify-center gap-2 disabled:opacity-70"
          >
            {isLoading ? (
              <>
                <span className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                Resetting...
              </>
            ) : (
              'Reset Password'
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ResetPassword;