import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
const sb: any = supabase;
import type { ChatMessageData } from "@/components/chat/ChatMessage";

export interface ChatConversationMeta {
  id: string;
  title: string;
  last_message_at: string;
}

const LS_PREFIX = "ask-chat:";
const LS_ACTIVE = "ask-chat:active";

function lsKey(userId: string, convId: string) {
  return `${LS_PREFIX}${userId}:${convId}`;
}
function lsListKey(userId: string) {
  return `${LS_PREFIX}${userId}:list`;
}
function lsActiveKey(userId: string) {
  return `${LS_ACTIVE}:${userId}`;
}

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try { return JSON.parse(raw) as T; } catch { return fallback; }
}

function deriveTitle(firstUserMessage: string): string {
  const t = firstUserMessage.trim().replace(/\s+/g, " ");
  if (!t) return "New conversation";
  return t.length > 60 ? t.slice(0, 57) + "…" : t;
}

export function useChatHistory(userId: string | null) {
  const [conversations, setConversations] = useState<ChatConversationMeta[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessageData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const messagesRef = useRef<ChatMessageData[]>([]);
  messagesRef.current = messages;

  // Initial load — localStorage first, then Cloud sync
  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    setLoading(true);

    // 1. Hydrate from localStorage immediately
    const cachedList = safeParse<ChatConversationMeta[]>(
      localStorage.getItem(lsListKey(userId)),
      [],
    );
    const cachedActive = localStorage.getItem(lsActiveKey(userId));
    if (cachedList.length) setConversations(cachedList);
    if (cachedActive) {
      setActiveId(cachedActive);
      const cachedMsgs = safeParse<ChatMessageData[]>(
        localStorage.getItem(lsKey(userId, cachedActive)),
        [],
      );
      setMessages(cachedMsgs);
    }

    // 2. Sync from Cloud
    (async () => {
      const { data: convs, error } = await sb
        .from("chat_conversations")
        .select("id,title,last_message_at")
        .eq("user_id", userId)
        .is("archived_at", null)
        .order("last_message_at", { ascending: false })
        .limit(50);
      if (!error && convs) {
        setConversations(convs as ChatConversationMeta[]);
        localStorage.setItem(lsListKey(userId), JSON.stringify(convs));

        const targetId = cachedActive && convs.find((c) => c.id === cachedActive)
          ? cachedActive
          : convs[0]?.id ?? null;

        if (targetId) {
          setActiveId(targetId);
          localStorage.setItem(lsActiveKey(userId), targetId);
          const { data: rows } = await sb
            .from("chat_messages")
            .select("*")
            .eq("conversation_id", targetId)
            .order("created_at", { ascending: true });
          if (rows) {
            const mapped: ChatMessageData[] = rows.map((r: any) => ({
              id: r.id,
              role: r.role,
              content: r.content,
              sections: r.sections ?? undefined,
              timestamp: r.created_at,
              voiceValidationStatus: r.voice_validation_status ?? undefined,
              voiceValidationWarnings: r.voice_validation_warnings ?? undefined,
            }));
            setMessages(mapped);
            localStorage.setItem(lsKey(userId, targetId), JSON.stringify(mapped));
          }
        }
      }
      setLoading(false);
    })();
  }, [userId]);

  // Persist messages to localStorage whenever they change
  useEffect(() => {
    if (!userId || !activeId) return;
    localStorage.setItem(lsKey(userId, activeId), JSON.stringify(messages));
  }, [userId, activeId, messages]);

  const ensureConversation = useCallback(
    async (firstUserMessage: string): Promise<string | null> => {
      if (!userId) return null;
      if (activeId) return activeId;
      const title = deriveTitle(firstUserMessage);
      const tempId = `tmp-${Date.now()}`;
      setActiveId(tempId);
      localStorage.setItem(lsActiveKey(userId), tempId);
      const { data, error } = await sb
        .from("chat_conversations")
        .insert({ user_id: userId, title })
        .select("id,title,last_message_at")
        .single();
      if (error || !data) {
        // Local-only mode: the conversation lives in localStorage under the
        // tmp id. Loud, because a silent failure here means nothing from
        // this session persists to Cloud (RLS denies inserts for another
        // user's user_id, e.g. admin view-as).
        console.error(
          "chat_conversations insert failed — conversation is local-only and will not sync",
          error,
        );
        return tempId;
      }
      setActiveId(data.id);
      localStorage.setItem(lsActiveKey(userId), data.id);
      // migrate cached messages from tempId -> real id
      const cached = localStorage.getItem(lsKey(userId, tempId));
      if (cached) {
        localStorage.setItem(lsKey(userId, data.id), cached);
        localStorage.removeItem(lsKey(userId, tempId));
      }
      setConversations((prev) => [data as ChatConversationMeta, ...prev.filter((c) => c.id !== tempId)]);
      return data.id;
    },
    [userId, activeId],
  );

  const persistMessage = useCallback(
    async (convId: string, msg: ChatMessageData) => {
      if (!userId || convId.startsWith("tmp-")) return;
      await sb.from("chat_messages").insert({
        conversation_id: convId,
        user_id: userId,
        role: msg.role,
        content: msg.content ?? "",
        sections: msg.sections ?? null,
        voice_validation_status: msg.voiceValidationStatus ?? null,
        voice_validation_warnings: msg.voiceValidationWarnings ?? null,
      });
      await sb
        .from("chat_conversations")
        .update({ last_message_at: new Date().toISOString() })
        .eq("id", convId);
    },
    [userId],
  );

  const newChat = useCallback(() => {
    setMessages([]);
    setActiveId(null);
    if (userId) localStorage.removeItem(lsActiveKey(userId));
  }, [userId]);

  const switchTo = useCallback(
    async (convId: string) => {
      if (!userId) return;
      setActiveId(convId);
      localStorage.setItem(lsActiveKey(userId), convId);
      const cached = safeParse<ChatMessageData[]>(localStorage.getItem(lsKey(userId, convId)), []);
      setMessages(cached);
      const { data: rows } = await sb
        .from("chat_messages")
        .select("*")
        .eq("conversation_id", convId)
        .order("created_at", { ascending: true });
      if (rows) {
        const mapped: ChatMessageData[] = rows.map((r: any) => ({
          id: r.id,
          role: r.role,
          content: r.content,
          sections: r.sections ?? undefined,
          timestamp: r.created_at,
          voiceValidationStatus: r.voice_validation_status ?? undefined,
          voiceValidationWarnings: r.voice_validation_warnings ?? undefined,
        }));
        setMessages(mapped);
        localStorage.setItem(lsKey(userId, convId), JSON.stringify(mapped));
      }
    },
    [userId],
  );

  const deleteConversation = useCallback(
    async (convId: string) => {
      if (!userId) return;
      setConversations((prev) => prev.filter((c) => c.id !== convId));
      localStorage.removeItem(lsKey(userId, convId));
      if (activeId === convId) {
        setActiveId(null);
        setMessages([]);
        localStorage.removeItem(lsActiveKey(userId));
      }
      const updated = (safeParse<ChatConversationMeta[]>(localStorage.getItem(lsListKey(userId)), []))
        .filter((c) => c.id !== convId);
      localStorage.setItem(lsListKey(userId), JSON.stringify(updated));
      if (!convId.startsWith("tmp-")) {
        await sb.from("chat_conversations").delete().eq("id", convId);
      }
    },
    [userId, activeId],
  );

  const clearCurrent = useCallback(async () => {
    if (activeId) await deleteConversation(activeId);
  }, [activeId, deleteConversation]);

  return {
    conversations,
    activeId,
    messages,
    setMessages,
    loading,
    newChat,
    switchTo,
    deleteConversation,
    clearCurrent,
    ensureConversation,
    persistMessage,
  };
}