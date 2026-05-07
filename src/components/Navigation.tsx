import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AppRoute } from '../types';

const Navigation: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { icon: 'home', label: 'Home', route: AppRoute.HOME },
    { icon: 'donut_small', label: 'Analytics', route: AppRoute.ANALYSIS },
    { icon: 'psychology', label: 'Coach', route: AppRoute.CHECKIN },  // Coach as regular tab
    { icon: 'insights', label: 'Insights', route: AppRoute.INSIGHTS },
    { icon: 'settings', label: 'Settings', route: AppRoute.PROFILE },
  ];

  // Hide nav on these pages
  const hideNavPaths = [
    AppRoute.ONBOARDING, 
    AppRoute.AUTH, 
    AppRoute.FORGOT_PASSWORD, 
    AppRoute.CHECKIN,
    '/reset-password'
  ];

  if (hideNavPaths.includes(location.pathname as AppRoute)) {
    return null;
  }

  return (
    <nav className="fixed bottom-0 w-full z-40 bg-background-dark/95 backdrop-blur-md border-t border-white/5 pb-safe pt-3 px-2">
      <div className="flex items-center justify-around max-w-md mx-auto">
        {navItems.map((item) => {
          const isActive = location.pathname === item.route;
          const isCoach = item.route === AppRoute.CHECKIN;

          return (
            <button
              key={item.route}
              onClick={() => navigate(item.route)}
              className={`
                flex flex-col items-center gap-1 py-2 px-3 rounded-xl transition-all relative
                ${isActive ? 'text-primary' : 'text-gray-500 hover:text-gray-300'}
                ${isCoach && isActive ? 'bg-primary/10' : ''}
              `}
            >
              <div className="relative">
                {isActive && !isCoach && (
                  <span className="absolute inset-0 bg-primary/20 blur-md rounded-full scale-150"></span>
                )}
                {isCoach && isActive && (
                  <span className="absolute inset-0 bg-primary/30 blur-lg rounded-full scale-125 animate-pulse"></span>
                )}
                <span className={`
                  relative material-symbols-outlined text-[24px] transition-all
                  ${isActive ? 'fill-1' : ''}
                  ${isCoach ? 'text-primary' : ''}
                `}>
                  {item.icon}
                </span>
                
                {/* Online indicator for Coach */}
                {isCoach && (
                  <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-500 border border-background-dark"></span>
                )}
              </div>
              
              <span className={`
                text-[10px] font-medium transition-colors
                ${isCoach && isActive ? 'text-primary' : ''}
              `}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default Navigation;