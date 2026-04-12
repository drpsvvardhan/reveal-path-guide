import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { useViewAs } from "@/context/ViewAsContext";
import { QueuedQuestion, QueueShareInfo } from "@/types/manifest";

interface QueueContextValue {
  questions: QueuedQuestion[];
  archived: QueuedQuestion[];
  loading: boolean;
  error: string | null;
  shareInfo: QueueShareInfo;
  refresh: () => Promise<void>;
  addManualQuestion: (text: string, rationale?: string) => Promise<void>;
  archiveQuestion: (id: string) => Promise<void>;
  unarchiveQuestion: (id: string) => Promise<void>;
  deleteQuestion: (id: string) => Promise<void>;
  reorderQuestions: (orderedIds: string[]) => Promise<void>;
  editQuestion: (id: string, newText: string) => Promise<void>;
  ensureShareToken: () => Promise<string | null>;
  revokeShareToken: () => Promise<void>;
}

const QueueContext = createContext<QueueContextValue | null>(null);

export const useQueue = () => {
  const ctx = useContext(QueueContext);
  if (!ctx) throw new Error("useQueue must be used within QueueProvider");
  return ctx;
};

export const QueueProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const { effectiveUserId } = useViewAs();
  const [questions, setQuestions] = useState<QueuedQuestion[]>([]);
  const [archived, setArchived] = useState<QueuedQuestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shareInfo, setShareInfo] = useState<QueueShareInfo>({
    shareToken: null,
    shareUrl: null,
  });

  const refresh = useCallback(async () => {
    const uid = effectiveUserId;
    if (!uid) {
      setQuestions([]);
      setArchived([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data, error: dbError } = await supabase
        .from("patient_question_queue")
        .select("*")
        .eq("user_id", uid)
        .order("priority", { ascending: true });

      if (dbError) throw dbError;

      const all = (data || []) as QueuedQuestion[];
      setQuestions(all.filter((q) => q.status === "queued"));
      setArchived(all.filter((q) => q.status === "archived"));
    } catch (e: any) {
      console.error("Queue refresh failed:", e);
      setError(e.message || "Failed to load queue");
    } finally {
      setLoading(false);
    }
  }, [effectiveUserId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!user) {
      setShareInfo({ shareToken: null, shareUrl: null });
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("share_token")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data?.share_token) {
        const url = `${window.location.origin}/share/${data.share_token}`;
        setShareInfo({ shareToken: data.share_token, shareUrl: url });
      }
    })();
  }, [user]);

  const addManualQuestion = useCallback(
    async (text: string, rationale?: string) => {
      if (!user || !text.trim()) return;
      const maxPriority =
        questions.length > 0 ? Math.max(...questions.map((q) => q.priority)) + 1 : 0;
      const { error: dbError } = await supabase.from("patient_question_queue").insert({
        user_id: user.id,
        question: text.trim(),
        rationale: rationale?.trim() || null,
        source: "manual",
        status: "queued",
        priority: maxPriority,
      });
      if (dbError) throw dbError;
      await refresh();
    },
    [user, questions, refresh]
  );

  const archiveQuestion = useCallback(
    async (id: string) => {
      const { error: dbError } = await supabase
        .from("patient_question_queue")
        .update({ status: "archived", archived_at: new Date().toISOString() })
        .eq("id", id);
      if (dbError) throw dbError;
      await refresh();
    },
    [refresh]
  );

  const unarchiveQuestion = useCallback(
    async (id: string) => {
      const { error: dbError } = await supabase
        .from("patient_question_queue")
        .update({ status: "queued", archived_at: null })
        .eq("id", id);
      if (dbError) throw dbError;
      await refresh();
    },
    [refresh]
  );

  const deleteQuestion = useCallback(
    async (id: string) => {
      const { error: dbError } = await supabase
        .from("patient_question_queue")
        .delete()
        .eq("id", id);
      if (dbError) throw dbError;
      await refresh();
    },
    [refresh]
  );

  const reorderQuestions = useCallback(
    async (orderedIds: string[]) => {
      const reordered = orderedIds
        .map((id) => questions.find((q) => q.id === id))
        .filter(Boolean) as QueuedQuestion[];
      setQuestions(reordered.map((q, i) => ({ ...q, priority: i })));

      const updates = orderedIds.map((id, idx) =>
        supabase.from("patient_question_queue").update({ priority: idx }).eq("id", id)
      );
      try {
        await Promise.all(updates);
      } catch (e) {
        console.error("Reorder persist failed:", e);
        await refresh();
      }
    },
    [questions, refresh]
  );

  const editQuestion = useCallback(
    async (id: string, newText: string) => {
      if (!newText.trim()) return;
      const { error: dbError } = await supabase
        .from("patient_question_queue")
        .update({ question: newText.trim() })
        .eq("id", id);
      if (dbError) throw dbError;
      await refresh();
    },
    [refresh]
  );

  const ensureShareToken = useCallback(async (): Promise<string | null> => {
    if (!user) return null;
    if (shareInfo.shareToken) return shareInfo.shareToken;

    const { data, error: fetchError } = await supabase
      .from("profiles")
      .select("share_token")
      .eq("user_id", user.id)
      .maybeSingle();

    if (fetchError) {
      console.error("Share token fetch failed:", fetchError);
      return null;
    }

    let token = data?.share_token;
    if (!token) {
      const { data: updated, error: updateError } = await supabase
        .from("profiles")
        .update({ share_token: crypto.randomUUID() })
        .eq("user_id", user.id)
        .select("share_token")
        .single();
      if (updateError) {
        console.error("Share token create failed:", updateError);
        return null;
      }
      token = updated.share_token;
    }

    const url = `${window.location.origin}/share/${token}`;
    setShareInfo({ shareToken: token, shareUrl: url });
    return token;
  }, [user, shareInfo.shareToken]);

  const revokeShareToken = useCallback(async () => {
    if (!user) return;
    const newToken = crypto.randomUUID();
    const { error: dbError } = await supabase
      .from("profiles")
      .update({ share_token: newToken })
      .eq("user_id", user.id);
    if (dbError) {
      console.error("Token revoke failed:", dbError);
      return;
    }
    const url = `${window.location.origin}/share/${newToken}`;
    setShareInfo({ shareToken: newToken, shareUrl: url });
  }, [user]);

  return (
    <QueueContext.Provider
      value={{
        questions,
        archived,
        loading,
        error,
        shareInfo,
        refresh,
        addManualQuestion,
        archiveQuestion,
        unarchiveQuestion,
        deleteQuestion,
        reorderQuestions,
        editQuestion,
        ensureShareToken,
        revokeShareToken,
      }}
    >
      {children}
    </QueueContext.Provider>
  );
};
