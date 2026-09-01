import React, { createContext, useContext, useEffect, useState } from "react";
import { getSession, onSessionChange, signOut as sessionSignOut, type Session, type User } from "@/lib/session";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  loading: true,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onSessionChange((next) => {
      setSession(next);
      setLoading(false);
    });

    getSession().then((next) => {
      setSession(next);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const signOut = async () => {
    await sessionSignOut();
  };

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
