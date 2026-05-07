import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppRoute } from '../types';
import { useApp } from '../context/AppContext';

const Auth: React.FC = () => {
  const navigate = useNavigate();
  const { updateUserProfile } = useApp();
  
  // Form State
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  
  // UI State
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const endpoint = isLogin ? '/auth/login' : '/auth/register';
    const payload = isLogin 
        ? { email, password } 
        : { email, password, full_name: name };

    try {
      const response = await fetch(`http://127.0.0.1:8000${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Authentication failed');
      }

      // 1. Save Token for future API calls
      localStorage.setItem('token', data.access_token);
      
      // 2. Update Global App Context
      updateUserProfile({
        name: data.user.full_name,
        email: data.user.email,
        avatar: data.user.avatar_url
      });

      // 3. Redirect to Home
      navigate(AppRoute.HOME);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background-dark flex flex-col justify-center items-center p-6 relative overflow-hidden">
      {/* Background blobs */}
      <div className="absolute top-[-10%] right-[-10%] w-64 h-64 bg-primary/10 rounded-full blur-[80px]"></div>
      <div className="absolute bottom-[-10%] left-[-10%] w-64 h-64 bg-secondary/10 rounded-full blur-[80px]"></div>

      <div className="w-full max-w-sm z-10">
        <div className="flex justify-center mb-8">
            <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center border border-white/10 shadow-lg">
                <span className="material-symbols-outlined text-3xl text-primary">neurology</span>
            </div>
        </div>

        <h1 className="text-2xl font-bold text-white text-center mb-2">
            {isLogin ? 'Welcome Back' : 'Join NeuroPattern'}
        </h1>
        <p className="text-gray-400 text-center text-sm mb-8">
            {isLogin ? 'Enter your details to continue' : 'Start tracking your patterns today'}
        </p>

        {error && (
            <div className="mb-6 p-3 rounded-lg bg-red-500/10 border border-red-500/50 text-red-500 text-xs text-center animate-shake">
                {error}
            </div>
        )}

        <form onSubmit={handleAuth} className="space-y-4">
            {!isLogin && (
                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 ml-1">Full Name</label>
                    <input 
                        type="text" 
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full bg-background-card border border-white/10 rounded-xl py-4 px-4 text-white focus:outline-none focus:border-primary/50 transition-all"
                        placeholder="Alex Chen"
                        required={!isLogin}
                    />
                </div>
            )}

            <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 ml-1">Email Address</label>
                <input 
                    type="email" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-background-card border border-white/10 rounded-xl py-4 px-4 text-white focus:outline-none focus:border-primary/50 transition-all"
                    placeholder="alex@example.com"
                    required
                />
            </div>

            <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 ml-1">Password</label>
                <input 
                    type="password" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-background-card border border-white/10 rounded-xl py-4 px-4 text-white focus:outline-none focus:border-primary/50 transition-all"
                    placeholder="••••••••"
                    required
                />
            </div>

            {isLogin && (
                <div className="flex justify-end">
                    <button 
                        type="button" 
                        onClick={() => navigate(AppRoute.FORGOT_PASSWORD)}
                        className="text-xs text-primary font-medium hover:text-primary/80"
                    >
                        Forgot Password?
                    </button>
                </div>
            )}

            <button 
                type="submit" 
                disabled={isLoading}
                className={`w-full bg-primary hover:bg-blue-500 text-white font-bold py-4 rounded-xl shadow-neon-blue transition-all mt-2 flex items-center justify-center gap-2 ${isLoading ? 'opacity-70 cursor-not-allowed' : ''}`}
            >
                {isLoading ? (
                    <span className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                ) : (
                    isLogin ? 'Sign In' : 'Create Account'
                )}
            </button>
        </form>

        <div className="mt-8 text-center">
            <p className="text-gray-400 text-sm">
                {isLogin ? "Don't have an account? " : "Already have an account? "}
                <button onClick={() => setIsLogin(!isLogin)} className="text-primary font-bold hover:underline">
                    {isLogin ? 'Sign Up' : 'Sign In'}
                </button>
            </p>
        </div>
      </div>
    </div>
  );
};

export default Auth;