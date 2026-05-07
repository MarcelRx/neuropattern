import React from 'react';
import { HashRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import Navigation from './components/Navigation';
import Home from './pages/Home';
import Analysis from './pages/Analysis';
import CheckIn from './pages/CheckIn';
import Onboarding from './pages/Onboarding';
import Auth from './pages/Auth';
import ForgotPassword from './pages/ForgotPassword';
import Profile from './pages/Profile';
import Insights from './pages/Insights';
import Habits from './pages/Habits';
import ResetPassword from './pages/ResetPassword';
import { AppRoute } from './types';
import { AppProvider } from './context/AppContext';

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  
  // Hide navigation on these pages only
  const hideNav = [
    AppRoute.ONBOARDING, 
    AppRoute.AUTH, 
    AppRoute.FORGOT_PASSWORD,
    '/reset-password'
  ].includes(location.pathname as AppRoute);

  return (
    <div className="min-h-screen bg-background-dark text-white font-sans selection:bg-primary/30 selection:text-white">
      {children}
      {!hideNav && <Navigation />}
    </div>
  );
};

const App: React.FC = () => {
  return (
    <AppProvider>
      <Router>
        <Layout>
          <Routes>
            <Route path={AppRoute.ONBOARDING} element={<Onboarding />} />
            <Route path={AppRoute.AUTH} element={<Auth />} />
            <Route path={AppRoute.FORGOT_PASSWORD} element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path={AppRoute.HOME} element={<Home />} />
            <Route path={AppRoute.ANALYSIS} element={<Analysis />} />
            <Route path={AppRoute.CHECKIN} element={<CheckIn />} />
            <Route path={AppRoute.PROFILE} element={<Profile />} />
            <Route path={AppRoute.INSIGHTS} element={<Insights />} />
            <Route path={AppRoute.HABITS} element={<Habits />} />
          </Routes>
        </Layout>
      </Router>
    </AppProvider>
  );
};

export default App;