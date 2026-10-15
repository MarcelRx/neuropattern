import React from "react";
import { useLocation } from "react-router-dom";
import { AppRoute } from "../../constants/routes";
import Navigation from "../Navigation";

interface MainLayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<MainLayoutProps> = ({ children }) => {
  const location = useLocation();
  const hideNav = [
    AppRoute.ONBOARDING,
    AppRoute.AUTH,
    AppRoute.FORGOT_PASSWORD,
    AppRoute.RESET_PASSWORD,
  ].includes(location.pathname as AppRoute);

  return (
    <div className="min-h-screen bg-background-dark text-white font-sans selection:bg-primary/30 selection:text-white">
      {children}
      {!hideNav && <Navigation />}
    </div>
  );
};

export default Layout;
