import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppRoute } from '../types';

const ForgotPassword: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('http://127.0.0.1:8000/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Something went wrong');
      }

      // Check if email exists by looking at the response
      // Backend returns same message for security, but we can check if user exists
      // For now, we'll show success for all emails (security best practice)
      // But you want to show error, so let's modify the backend to indicate
      
      setIsSent(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  if (isSent) {
    return (
      <div className="min-h-screen bg-background-dark flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-sm text-center">
          <div className="h-16 w-16 rounded-full bg-secondary/20 flex items-center justify-center mx-auto mb-6">
            <span className="material-symbols-outlined text-3xl text-secondary">mail</span>
          </div>
          <h1 className="text-2xl font-bold text-white mb-4">Check Your Email</h1>
          <p className="text-gray-400 mb-6">
            We've sent a password reset link to <span className="text-white font-medium">{email}</span>
          </p>
          <p className="text-sm text-gray-500 mb-8">
            Didn't receive it? Check your spam folder or try again in a few minutes.
          </p>
          <button 
            onClick={() => navigate(AppRoute.AUTH)}
            className="w-full bg-primary hover:bg-blue-500 text-white font-bold py-4 rounded-xl transition-colors"
          >
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background-dark text-white overflow-x-hidden min-h-screen relative flex flex-col font-sans justify-center items-center px-6">
      {/* Background Ambience */}
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-primary/10 rounded-full blur-[100px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-secondary/10 rounded-full blur-[100px]"></div>
      </div>

      <main className="w-full max-w-sm z-10 relative">
        <div className="flex flex-col items-center mb-8">
          <div className="h-16 w-16 rounded-2xl bg-surface-dark flex items-center justify-center border border-white/5 shadow-lg mb-6 group bg-[#1e293b]">
            <span className="material-symbols-outlined text-3xl text-primary group-hover:scale-110 transition-transform duration-300">lock_reset</span>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2 text-center">Forgot Password?</h1>
          <p className="text-sm text-gray-400 text-center leading-relaxed">
            Don't worry, it happens. Please enter the email address associated with your account.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-3 rounded-lg bg-red-500/10 border border-red-500/50 text-red-500 text-xs text-center animate-shake">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-gray-400 ml-1" htmlFor="email">Email Address</label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <span className="material-symbols-outlined text-gray-500 group-focus-within:text-primary transition-colors">mail</span>
              </div>
              <input 
                className="block w-full pl-11 pr-4 py-4 bg-[#1e293b]/50 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all text-sm" 
                id="email" 
                name="email" 
                type="email"
                placeholder="alex@example.com" 
                required 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
              />
            </div>
          </div>
          
          <button 
            className="w-full bg-secondary hover:bg-emerald-400 text-white font-semibold py-4 px-6 rounded-xl shadow-neon-green transition-all transform active:scale-[0.98] flex items-center justify-center gap-2 mt-2 disabled:opacity-70 disabled:cursor-not-allowed" 
            type="submit"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <span className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                Sending...
              </>
            ) : (
              <>
                <span>Send Reset Link</span>
                <span className="material-symbols-outlined text-lg">arrow_forward</span>
              </>
            )}
          </button>
        </form>

        <div className="mt-8 text-center">
          <button 
            onClick={() => navigate(AppRoute.AUTH)}
            className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors group"
          >
            <span className="material-symbols-outlined text-lg group-hover:-translate-x-1 transition-transform">arrow_back</span>
            Back to Login
          </button>
        </div>

        <div className="mt-12 flex justify-center">
          <a className="text-xs text-primary/70 hover:text-primary transition-colors" href="#">
            Need help? Contact Support
          </a>
        </div>
      </main>
    </div>
  );
};

export default ForgotPassword;