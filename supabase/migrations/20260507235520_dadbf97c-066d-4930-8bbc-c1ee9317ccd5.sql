
-- Conversations
CREATE TABLE public.chat_conversations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  title text NOT NULL DEFAULT 'New conversation',
  last_message_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_chat_conversations_user ON public.chat_conversations(user_id, last_message_at DESC) WHERE archived_at IS NULL;

ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users select own conversations" ON public.chat_conversations
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own conversations" ON public.chat_conversations
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own conversations" ON public.chat_conversations
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own conversations" ON public.chat_conversations
  FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Admins read all conversations" ON public.chat_conversations
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_chat_conversations_updated_at
  BEFORE UPDATE ON public.chat_conversations
  FOR EACH ROW EXECUTE FUNCTION public.update_clusters_updated_at();

-- Messages
CREATE TABLE public.chat_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id uuid NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('user','assistant')),
  content text NOT NULL DEFAULT '',
  sections jsonb,
  voice_validation_status text,
  voice_validation_warnings jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_chat_messages_conv ON public.chat_messages(conversation_id, created_at);
CREATE INDEX idx_chat_messages_user ON public.chat_messages(user_id, created_at DESC);

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users select own chat messages" ON public.chat_messages
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own chat messages" ON public.chat_messages
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own chat messages" ON public.chat_messages
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own chat messages" ON public.chat_messages
  FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Admins read all chat messages" ON public.chat_messages
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
