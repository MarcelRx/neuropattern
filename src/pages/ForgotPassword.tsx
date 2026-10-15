import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppRoute } from "../constants/routes";
import { forgotPassword } from "../services/auth.service";

const ForgotPassword: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<"not_found" | "general" | null>(
    null,
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setErrorType(null);

    try {
      // Pass as an object to match ForgotPasswordRequest { email: string }
      await forgotPassword({ email: email.trim().toLowerCase() });
      setIsSent(true);
    } catch (err: any) {
      const data = err.response?.data;
      setError(data?.message || err.message || "Something went wrong");
      const status = err.status || err.response?.status;
      if (status === 404) {
        setErrorType("not_found");
      } else {
        setErrorType("general");
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (isSent) {
    return (
      <div className="min-h-screen bg-background-dark flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-sm text-center">
          <div className="h-16 w-16 rounded-full bg-secondary/20 flex items-center justify-center mx-auto mb-6 animate-in zoom-in duration-500">
            <span className="material-symbols-outlined text-3xl text-secondary">
              mail
            </span>
          </div>
          <h1 className="text-2xl font-bold text-white mb-4">
            Check Your Email
          </h1>
          <p className="text-gray-400 mb-2">
            We've sent a password reset link to
          </p>
          <p className="text-white font-medium mb-6 bg-white/5 py-2 px-4 rounded-lg inline-block">
            {email}
          </p>
          <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 mb-6">
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined text-primary text-lg mt-0.5">
                info
              </span>
              <div className="text-left">
                <p className="text-sm text-gray-300 mb-1">
                  Didn't receive the email?
                </p>
                <ul className="text-xs text-gray-500 space-y-1 list-disc list-inside">
                  <li>Check your spam/junk folder</li>
                  <li>Verify your email address is correct</li>
                  <li>The link expires in 30 minutes</li>
                </ul>
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-3">
            <button
              onClick={() => navigate(AppRoute.AUTH)}
              className="w-full bg-primary hover:bg-blue-500 text-white font-bold py-4 rounded-xl transition-colors shadow-neon-blue"
            >
              Back to Login
            </button>
            <button
              onClick={() => {
                setIsSent(false);
                setEmail("");
              }}
              className="w-full text-sm text-gray-400 hover:text-white transition-colors"
            >
              Try with a different email
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background-dark text-white overflow-x-hidden min-h-screen relative flex flex-col font-sans justify-center items-center px-6">
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-primary/10 rounded-full blur-[100px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-secondary/10 rounded-full blur-[100px]"></div>
      </div>

      <main className="w-full max-w-sm z-10 relative">
        <div className="flex flex-col items-center mb-8">
          <div className="h-16 w-16 rounded-2xl bg-surface-dark flex items-center justify-center border border-white/5 shadow-lg mb-6 group bg-[#1e293b]">
            <span className="material-symbols-outlined text-3xl text-primary group-hover:scale-110 transition-transform duration-300">
              lock_reset
            </span>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2 text-center">
            Forgot Password?
          </h1>
          <p className="text-sm text-gray-400 text-center leading-relaxed">
            Don't worry, it happens. Enter your email and we'll send you a reset
            link.
          </p>
        </div>

        {error && errorType === "general" && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm text-center animate-in fade-in duration-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <div className="space-y-2">
            <label
              className="text-xs font-semibold uppercase tracking-wider text-gray-400 ml-1"
              htmlFor="email"
            >
              Email Address
            </label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <span className="material-symbols-outlined text-gray-500 group-focus-within:text-primary transition-colors">
                  mail
                </span>
              </div>
              <input
                className={`block w-full pl-11 pr-4 py-4 bg-[#1e293b]/50 border-2 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-1 transition-all text-sm ${
                  errorType === "not_found"
                    ? "border-rose-500 focus:border-rose-400 focus:ring-rose-500/20 shadow-[0_0_15px_rgba(244,63,94,0.2)]"
                    : "border-white/10 focus:border-primary/50 focus:ring-primary/20"
                }`}
                id="email"
                name="email"
                type="email"
                placeholder="alex@example.com"
                required
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError(null);
                  setErrorType(null);
                }}
                disabled={isLoading}
              />
            </div>
            {error && errorType === "not_found" && (
              <p className="text-rose-500 text-[10px] mt-1 ml-1 flex items-center gap-1 font-bold animate-in slide-in-from-top-1 duration-200">
                <span className="material-symbols-outlined text-sm">
                  warning
                </span>
                {error}
              </p>
            )}
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
                <span className="material-symbols-outlined text-lg">
                  arrow_forward
                </span>
              </>
            )}
          </button>
        </form>

        <div className="mt-8 text-center">
          <button
            onClick={() => navigate(AppRoute.AUTH)}
            className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors group"
          >
            <span className="material-symbols-outlined text-lg group-hover:-translate-x-1 transition-transform">
              arrow_back
            </span>
            Back to Login
          </button>
        </div>

        <div className="mt-12 flex justify-center">
          <p className="text-xs text-gray-600">
            Need help?{" "}
            <a
              className="text-primary/70 hover:text-primary transition-colors"
              href="#"
            >
              Contact Support
            </a>
          </p>
        </div>
      </main>
    </div>
  );
};

export default ForgotPassword;
