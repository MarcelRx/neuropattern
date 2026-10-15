import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AppRoute } from "../constants/routes";
import { useApp } from "../context/AppContext";
import {
  fetchMyProfile,
  login,
  register,
  setAuthToken,
} from "../services/auth.service";

const Auth: React.FC = () => {
  const navigate = useNavigate();
  const { updateUserProfile, refreshData, hasSeenOnboarding } = useApp();

  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<
    "email" | "password" | "general" | null
  >(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const location = useLocation();

  useEffect(() => {
    if (!hasSeenOnboarding) {
      navigate(AppRoute.ONBOARDING);
    }
  }, [hasSeenOnboarding, navigate]);

  useEffect(() => {
    const query = new URLSearchParams(location.search);
    if (query.get("verified") === "true") {
      setSuccessMessage("Your email has been verified. You can now sign in.");
      setIsLogin(true);
    }
  }, [location.search]);

  const getPasswordStrength = (pass: string) => {
    if (!pass) return { score: 0, label: "", color: "" };
    let score = 0;
    if (pass.length >= 8) score += 1;
    if (pass.length >= 12) score += 1;
    if (/[A-Z]/.test(pass)) score += 1;
    if (/[0-9]/.test(pass)) score += 1;
    if (/[^A-Za-z0-9]/.test(pass)) score += 1;

    if (score <= 2) return { score, label: "Weak", color: "bg-red-500" };
    if (score <= 4) return { score, label: "Fair", color: "bg-yellow-500" };
    return { score, label: "Strong", color: "bg-emerald-500" };
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setErrorType(null);
    setSuccessMessage(null);

    try {
      if (isLogin) {
        const authResult = await login({
          email: email.trim().toLowerCase(),
          password,
        });

        setAuthToken(authResult.access_token, 60);

        const profile = await fetchMyProfile();
        updateUserProfile({
          name: profile.full_name || profile.fullName || "User",
          email: profile.email,
          avatar:
            profile.avatar_url ||
            profile.avatarUrl ||
            "https://picsum.photos/100/100",
        });

        await refreshData();
        navigate(AppRoute.HOME);
      } else {
        const registerResult = await register({
          email: email.trim().toLowerCase(),
          password,
          ...(name.trim()
            ? { fullName: name.trim(), full_name: name.trim() }
            : {}),
        });

        setSuccessMessage(registerResult.message);
        setIsLogin(true);
        setPassword("");
        setName("");
      }
    } catch (err: any) {
      setError(err.message || "Authentication failed");
      const status = err.status || err.response?.status;
      if (status === 409 || status === 404 || status === 400) {
        setErrorType("email");
      } else if (status === 401) {
        setErrorType("password");
      } else {
        setErrorType("general");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const strength = getPasswordStrength(password);

  return (
    <div className="min-h-screen bg-background-dark flex flex-col justify-center items-center p-6 relative overflow-hidden">
      <div className="absolute top-[-10%] right-[-10%] w-64 h-64 bg-primary/10 rounded-full blur-[80px]"></div>
      <div className="absolute bottom-[-10%] left-[-10%] w-64 h-64 bg-secondary/10 rounded-full blur-[80px]"></div>

      <div className="w-full max-w-sm z-10">
        <div className="flex justify-center mb-8">
          <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center border border-white/10 shadow-lg">
            <span className="material-symbols-outlined text-3xl text-primary">
              neurology
            </span>
          </div>
        </div>

        <h1 className="text-2xl font-bold text-white text-center mb-2">
          {isLogin ? "Welcome Back" : "Join NeuroPattern"}
        </h1>
        <p className="text-gray-400 text-center text-sm mb-8">
          {isLogin
            ? "Sign in to continue your wellness journey"
            : "Start tracking your patterns today"}
        </p>

        {successMessage && (
          <div className="mb-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm text-center animate-in fade-in duration-300">
            {successMessage}
          </div>
        )}

        {error && errorType === "general" && (
          <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-sm text-center animate-in fade-in duration-300">
            {error}
          </div>
        )}

        <form onSubmit={handleAuth} className="space-y-4">
          {!isLogin && (
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 ml-1">
                Full Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-background-card border border-white/10 rounded-xl py-4 px-4 text-white focus:outline-none focus:border-primary/50 transition-all"
                placeholder="Alex Chen"
                required={!isLogin}
                minLength={2}
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 ml-1">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError(null);
                setErrorType(null);
              }}
              className={`w-full bg-background-card border-2 rounded-xl py-4 px-4 text-white focus:outline-none transition-all ${
                errorType === "email"
                  ? "border-rose-500 focus:border-rose-400 shadow-[0_0_15px_rgba(244,63,94,0.2)]"
                  : "border-white/10 focus:border-primary/50"
              }`}
              placeholder="alex@example.com"
              required
            />
            {error && errorType === "email" && (
              <p className="text-rose-500 text-[10px] mt-1.5 ml-1 flex items-center gap-1 font-bold animate-in slide-in-from-top-1 duration-200">
                <span className="material-symbols-outlined text-sm">
                  warning
                </span>
                {error}
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 ml-1">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError(null);
                  setErrorType(null);
                }}
                className={`w-full bg-background-card border-2 rounded-xl py-4 px-4 pr-12 text-white focus:outline-none transition-all ${
                  errorType === "password"
                    ? "border-rose-500 focus:border-rose-400 shadow-[0_0_15px_rgba(244,63,94,0.2)]"
                    : "border-white/10 focus:border-primary/50"
                }`}
                placeholder="••••••••"
                required
                minLength={8}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
              >
                <span className="material-symbols-outlined text-xl">
                  {showPassword ? "visibility_off" : "visibility"}
                </span>
              </button>
            </div>

            {!isLogin && password && (
              <div className="mt-3 px-1 animate-in fade-in slide-in-from-top-1 duration-300">
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-[10px] text-gray-500 uppercase font-bold tracking-widest">
                    Security
                  </span>
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider ${strength.color.replace("bg-", "text-")}`}
                  >
                    {strength.label}
                  </span>
                </div>
                <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden flex gap-0.5">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div
                      key={i}
                      className={`h-full ${strength.score >= i ? strength.color : "bg-transparent"} transition-all duration-500`}
                      style={{ width: "20%" }}
                    ></div>
                  ))}
                </div>
              </div>
            )}
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
            className={`w-full bg-primary hover:bg-blue-500 text-white font-bold py-4 rounded-xl shadow-neon-blue transition-all mt-2 flex items-center justify-center gap-2 ${isLoading ? "opacity-70 cursor-not-allowed" : ""}`}
          >
            {isLoading ? (
              <span className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
            ) : isLogin ? (
              "Sign In"
            ) : (
              "Create Account"
            )}
          </button>
        </form>

        <div className="mt-8 text-center">
          <p className="text-gray-400 text-sm">
            {isLogin ? "Don't have an account? " : "Already have an account? "}
            <button
              onClick={() => {
                setIsLogin(!isLogin);
                setError(null);
                setErrorType(null);
                setPassword("");
              }}
              className="text-primary font-bold hover:underline"
            >
              {isLogin ? "Sign Up" : "Sign In"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Auth;
