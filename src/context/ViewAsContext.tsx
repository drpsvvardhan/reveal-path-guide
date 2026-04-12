import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";

interface ProfileSummary {
  user_id: string;
  first_name: string | null;
  display_name: string | null;
  age: number | null;
  sex: string | null;
}

interface ViewAsContextValue {
  /** The effective user_id for data fetching. Falls back to the authenticated user. */
  effectiveUserId: string | null;
  /** Whether the current user is viewing as someone else */
  isViewingAs: boolean;
  /** Whether the current user has admin privileges */
  isAdmin: boolean;
  /** List of all profiles (only populated for admins) */
  allProfiles: ProfileSummary[];
  /** Switch to viewing as another user */
  viewAs: (userId: string) => void;
  /** Reset to viewing as self */
  resetViewAs: () => void;
}

const ViewAsContext = createContext<ViewAsContextValue>({
  effectiveUserId: null,
  isViewingAs: false,
  isAdmin: false,
  allProfiles: [],
  viewAs: () => {},
  resetViewAs: () => {},
});

export const useViewAs = () => useContext(ViewAsContext);

export const ViewAsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [allProfiles, setAllProfiles] = useState<ProfileSummary[]>([]);
  const [viewAsUserId, setViewAsUserId] = useState<string | null>(null);

  // Check if current user is admin
  useEffect(() => {
    if (!user) {
      setIsAdmin(false);
      setAllProfiles([]);
      setViewAsUserId(null);
      return;
    }

    (async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();

      const admin = !!data;
      setIsAdmin(admin);

      if (admin) {
        // Fetch all profiles for the switcher
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, first_name, display_name, age, sex")
          .order("created_at", { ascending: true });

        setAllProfiles((profiles || []) as ProfileSummary[]);
      }
    })();
  }, [user]);

  const effectiveUserId = viewAsUserId || user?.id || null;
  const isViewingAs = viewAsUserId !== null && viewAsUserId !== user?.id;

  const viewAs = useCallback((userId: string) => {
    setViewAsUserId(userId);
  }, []);

  const resetViewAs = useCallback(() => {
    setViewAsUserId(null);
  }, []);

  return (
    <ViewAsContext.Provider value={{ effectiveUserId, isViewingAs, isAdmin, allProfiles, viewAs, resetViewAs }}>
      {children}
    </ViewAsContext.Provider>
  );
};
