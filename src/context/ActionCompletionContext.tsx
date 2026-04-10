import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import { useManifest } from "@/context/ManifestContext";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";

const todayStr = () => new Date().toISOString().slice(0, 10);

const computeStreak = (dates: string[], totalActions: number): number => {
  if (totalActions === 0) return 0;
  const countByDate: Record<string, number> = {};
  dates.forEach((d) => { countByDate[d] = (countByDate[d] || 0) + 1; });

  let streak = 0;
  const d = new Date();
  while (true) {
    const ds = d.toISOString().slice(0, 10);
    if ((countByDate[ds] || 0) >= totalActions) {
      streak++;
      d.setDate(d.getDate() - 1);
    } else if (ds === todayStr()) {
      d.setDate(d.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
};

const actionIcons = ["🏃", "🌙", "💊", "🥗", "🧬", "🧘", "💤", "🩺"];

export interface ActionItem {
  key: string;
  title: string;
  description: string;
  action: any;
  icon: string;
}

interface ActionCompletionContextValue {
  allActions: ActionItem[];
  completedKeys: Set<string>;
  streak: number;
  loaded: boolean;
  toggleDone: (key: string) => Promise<void>;
}

const ActionCompletionContext = createContext<ActionCompletionContextValue | null>(null);

export const useActionCompletions = () => {
  const ctx = useContext(ActionCompletionContext);
  if (!ctx) throw new Error("useActionCompletions must be used within ActionCompletionProvider");
  return ctx;
};

export const ActionCompletionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { manifest } = useManifest();
  const { user } = useAuth();
  const { sequencedActions } = manifest;
  const [completedKeys, setCompletedKeys] = useState<Set<string>>(new Set());
  const [streak, setStreak] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const userId = user?.id;

  const allActions = useMemo(() => {
    const items: ActionItem[] = [];
    if (sequencedActions?.startHere) {
      items.push({
        key: "start",
        title: sequencedActions.startHere.title,
        description: sequencedActions.startHere.description,
        action: sequencedActions.startHere,
        icon: "🛡️",
      });
    }
    sequencedActions?.thenAdd?.forEach((a: any, i: number) => {
      items.push({
        key: `then-${i}`,
        title: a.title,
        description: a.description,
        action: a,
        icon: actionIcons[i % actionIcons.length],
      });
    });
    return items;
  }, [sequencedActions]);

  useEffect(() => {
    if (!userId) return;
    const load = async () => {
      const today = todayStr();
      const { data: todayData } = await supabase
        .from("action_completions")
        .select("action_key")
        .eq("user_id", userId)
        .eq("completed_date", today);

      if (todayData) {
        setCompletedKeys(new Set(todayData.map((r) => r.action_key)));
      }

      const sixtyAgo = new Date();
      sixtyAgo.setDate(sixtyAgo.getDate() - 60);
      const { data: streakData } = await supabase
        .from("action_completions")
        .select("completed_date")
        .eq("user_id", userId)
        .gte("completed_date", sixtyAgo.toISOString().slice(0, 10));

      if (streakData) {
        setStreak(computeStreak(streakData.map((r) => r.completed_date), allActions.length));
      }
      setLoaded(true);
    };
    load();
  }, [userId, allActions.length]);

  const toggleDone = useCallback(async (key: string) => {
    if (!userId) return;
    const today = todayStr();
    const isDone = completedKeys.has(key);

    setCompletedKeys((prev) => {
      const next = new Set(prev);
      if (isDone) next.delete(key);
      else next.add(key);
      return next;
    });

    if (isDone) {
      await supabase
        .from("action_completions")
        .delete()
        .eq("user_id", userId)
        .eq("action_key", key)
        .eq("completed_date", today);
    } else {
      await supabase
        .from("action_completions")
        .insert({ user_id: userId, action_key: key, completed_date: today });
    }

    const sixtyAgo = new Date();
    sixtyAgo.setDate(sixtyAgo.getDate() - 60);
    const { data: streakData } = await supabase
      .from("action_completions")
      .select("completed_date")
      .eq("user_id", userId)
      .gte("completed_date", sixtyAgo.toISOString().slice(0, 10));
    if (streakData) {
      setStreak(computeStreak(streakData.map((r) => r.completed_date), allActions.length));
    }
  }, [userId, completedKeys, allActions.length]);

  return (
    <ActionCompletionContext.Provider value={{ allActions, completedKeys, streak, loaded, toggleDone }}>
      {children}
    </ActionCompletionContext.Provider>
  );
};
