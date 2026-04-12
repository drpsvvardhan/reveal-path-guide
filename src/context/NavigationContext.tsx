import React, { createContext, useContext } from "react";

interface NavigationContextValue {
  navigateTo: (sectionId: string) => void;
}

const NavigationContext = createContext<NavigationContextValue | null>(null);

export const useNavigation = () => {
  const ctx = useContext(NavigationContext);
  if (!ctx) return { navigateTo: () => {} };
  return ctx;
};

export const NavigationProvider: React.FC<{
  onNavigate: (id: string) => void;
  children: React.ReactNode;
}> = ({ onNavigate, children }) => (
  <NavigationContext.Provider value={{ navigateTo: onNavigate }}>
    {children}
  </NavigationContext.Provider>
);
