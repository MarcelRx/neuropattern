import React, { Suspense, lazy } from "react";
import { Route, HashRouter as Router, Routes } from "react-router-dom";
import MainLayout from "./components/layout/MainLayout";
import { AppRoute } from "./constants/routes";
import { AppProvider } from "./context/AppContext";

const Analysis = lazy(() => import("./pages/Analysis"));
const Auth = lazy(() => import("./pages/Auth"));
const CheckIn = lazy(() => import("./pages/CheckIn"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const Habits = lazy(() => import("./pages/Habits"));
const Home = lazy(() => import("./pages/Home"));
const Insights = lazy(() => import("./pages/Insights"));
const Onboarding = lazy(() => import("./pages/Onboarding"));
const Profile = lazy(() => import("./pages/Profile"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));

const App: React.FC = () => (
  <AppProvider>
    <Router>
      <MainLayout>
        <Suspense
          fallback={
            <div className="flex flex-col h-screen items-center justify-center bg-[#0a0a0f] gap-4">
              <div className="relative">
                <div className="h-12 w-12 rounded-full border-t-2 border-primary animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="h-2 w-2 rounded-full bg-primary animate-pulse"></div>
                </div>
              </div>
              <p className="text-white/40 text-sm font-medium animate-pulse">
                Initializing Aura...
              </p>
            </div>
          }
        >
          <Routes>
            <Route path={AppRoute.ONBOARDING} element={<Onboarding />} />
            <Route path={AppRoute.AUTH} element={<Auth />} />
            <Route
              path={AppRoute.FORGOT_PASSWORD}
              element={<ForgotPassword />}
            />
            <Route path={AppRoute.RESET_PASSWORD} element={<ResetPassword />} />
            <Route path={AppRoute.HOME} element={<Home />} />
            <Route path={AppRoute.ANALYSIS} element={<Analysis />} />
            <Route path={AppRoute.COACH} element={<CheckIn />} />
            <Route path={AppRoute.PROFILE} element={<Profile />} />
            <Route path={AppRoute.INSIGHTS} element={<Insights />} />
            <Route path={AppRoute.HABITS} element={<Habits />} />
          </Routes>
        </Suspense>
      </MainLayout>
    </Router>
  </AppProvider>
);

export default App;
