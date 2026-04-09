import React, { useState, useEffect } from "react";
import { UtensilsCrossed, Mic, MessageCircle, Upload, ListChecks, Phone, ArrowLeft, MicOff, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useManifest } from "@/context/ManifestContext";

interface QuickActionItem {
  icon: React.ElementType;
  label: string;
  action?: string;
  overlay?: "food" | "voice";
}

const actions: QuickActionItem[] = [
  { icon: UtensilsCrossed, label: "Log food", overlay: "food" },
  { icon: Mic, label: "Voice note", overlay: "voice" },
  { icon: MessageCircle, label: "Ask a question", action: "ask" },
  { icon: Upload, label: "Upload report", action: "records" },
  { icon: ListChecks, label: "View plan", action: "actions" },
  { icon: Phone, label: "Message coach", action: "care-team" },
];

interface QuickActionsProps {
  onNavigate?: (id: string) => void;
}

/* ── Food Logger Overlay ── */
const FoodLogOverlay: React.FC<{ onClose: () => void; patientId: string }> = ({ onClose, patientId }) => {
  const [entry, setEntry] = useState("");
  const [logged, setLogged] = useState<{ id: string; entry: string; logged_at: string }[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchLogs = async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const { data } = await supabase
        .from("food_logs")
        .select("id, entry, logged_at")
        .eq("patient_id", patientId)
        .gte("logged_at", today.toISOString())
        .order("logged_at", { ascending: false });
      if (data) setLogged(data);
    };
    fetchLogs();
  }, [patientId]);

  const handleLog = async () => {
    if (!entry.trim() || saving) return;
    setSaving(true);
    const { data, error } = await supabase
      .from("food_logs")
      .insert({ patient_id: patientId, entry: entry.trim() })
      .select("id, entry, logged_at")
      .single();
    setSaving(false);
    if (data && !error) {
      setLogged((prev) => [data, ...prev]);
      setEntry("");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={onClose} className="p-1.5 rounded-md hover:bg-muted/60 transition-colors">
          <ArrowLeft className="h-4 w-4 text-muted-foreground" />
        </button>
        <h3 className="font-serif text-base text-foreground">Log Food</h3>
      </div>
      <div className="flex gap-2">
        <input
          value={entry}
          onChange={(e) => setEntry(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleLog()}
          placeholder="e.g. Oatmeal with berries"
          className="flex-1 rounded-lg border border-border bg-card px-3 py-2 text-sm font-sans text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
        />
        <button
          onClick={handleLog}
          disabled={saving}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-sans font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Log"}
        </button>
      </div>
      {logged.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground font-sans">Today's entries</p>
          {logged.map((item) => (
            <div key={item.id} className="flex items-center gap-2 rounded-md border border-border bg-card/60 px-3 py-2 text-sm font-sans text-foreground">
              <UtensilsCrossed className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="flex-1">{item.entry}</span>
              <span className="text-[10px] text-muted-foreground">
                {new Date(item.logged_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

/* ── Voice Note Overlay ── */
const VoiceNoteOverlay: React.FC<{ onClose: () => void; patientId: string }> = ({ onClose, patientId }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [notes, setNotes] = useState<{ id: string; transcript: string; recorded_at: string }[]>([]);
  const [transcript, setTranscript] = useState("");
  const [saving, setSaving] = useState(false);
  const recognitionRef = React.useRef<any>(null);

  useEffect(() => {
    const fetchNotes = async () => {
      const { data } = await supabase
        .from("voice_notes")
        .select("id, transcript, recorded_at")
        .eq("patient_id", patientId)
        .order("recorded_at", { ascending: false })
        .limit(10);
      if (data) setNotes(data);
    };
    fetchNotes();
  }, [patientId]);

  const saveNote = async (text: string) => {
    if (!text.trim() || saving) return;
    setSaving(true);
    const { data, error } = await supabase
      .from("voice_notes")
      .insert({ patient_id: patientId, transcript: text.trim() })
      .select("id, transcript, recorded_at")
      .single();
    setSaving(false);
    if (data && !error) {
      setNotes((prev) => [data, ...prev]);
    }
  };

  const toggleRecording = () => {
    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
      if (transcript.trim()) {
        saveNote(transcript.trim());
        setTranscript("");
      }
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      const note = prompt("Voice recognition not supported. Type your note:");
      if (note?.trim()) saveNote(note.trim());
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event: any) => {
      let result = "";
      for (let i = 0; i < event.results.length; i++) {
        result += event.results[i][0].transcript;
      }
      setTranscript(result);
    };

    recognition.onerror = () => {
      setIsRecording(false);
      const note = prompt("Microphone not available. Type your note:");
      if (note?.trim()) saveNote(note.trim());
    };

    recognition.onend = () => setIsRecording(false);

    recognitionRef.current = recognition;
    try {
      recognition.start();
      setIsRecording(true);
    } catch {
      const note = prompt("Could not start recording. Type your note:");
      if (note?.trim()) saveNote(note.trim());
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const today = new Date();
    const isToday = d.toDateString() === today.toDateString();
    const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    return isToday ? time : `${d.toLocaleDateString([], { month: "short", day: "numeric" })} ${time}`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={onClose} className="p-1.5 rounded-md hover:bg-muted/60 transition-colors">
          <ArrowLeft className="h-4 w-4 text-muted-foreground" />
        </button>
        <h3 className="font-serif text-base text-foreground">Voice Note</h3>
      </div>
      <div className="flex flex-col items-center gap-3 py-4">
        <button
          onClick={toggleRecording}
          disabled={saving}
          className={`p-5 rounded-full transition-all ${
            isRecording
              ? "bg-pink-light text-accent ring-2 ring-accent/30 animate-pulse"
              : "bg-muted/60 text-muted-foreground hover:bg-muted"
          }`}
        >
          {isRecording ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
        </button>
        <p className="text-xs text-muted-foreground font-sans">
          {saving ? "Saving..." : isRecording ? "Tap to stop recording" : "Tap to start recording"}
        </p>
        {transcript && (
          <p className="text-sm text-foreground font-sans bg-card border border-border rounded-lg p-3 w-full">
            {transcript}
          </p>
        )}
      </div>
      {notes.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground font-sans">Saved notes</p>
          {notes.map((note) => (
            <div key={note.id} className="flex items-start gap-2 rounded-md border border-border bg-card/60 px-3 py-2 text-sm font-sans text-foreground">
              <Mic className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
              <span className="flex-1">{note.transcript}</span>
              <span className="text-[10px] text-muted-foreground shrink-0">{formatDate(note.recorded_at)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

/* ── Main QuickActions ── */
const QuickActions: React.FC<QuickActionsProps> = ({ onNavigate }) => {
  const { manifest } = useManifest();
  const [activeOverlay, setActiveOverlay] = useState<"food" | "voice" | null>(null);
  const patientId = manifest.patient.id;

  return (
    <div>
      <AnimatePresence mode="wait">
        {activeOverlay ? (
          <motion.div
            key={activeOverlay}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="rounded-xl border border-border bg-card p-4"
          >
            {activeOverlay === "food" && <FoodLogOverlay onClose={() => setActiveOverlay(null)} patientId={patientId} />}
            {activeOverlay === "voice" && <VoiceNoteOverlay onClose={() => setActiveOverlay(null)} patientId={patientId} />}
          </motion.div>
        ) : (
          <motion.div
            key="buttons"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex gap-2 overflow-x-auto pb-1 scrollbar-none"
          >
            {actions.map((item) => (
              <button
                key={item.label}
                onClick={() => {
                  if (item.overlay) setActiveOverlay(item.overlay);
                  else if (item.action) onNavigate?.(item.action);
                }}
                className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs font-sans font-medium text-foreground hover:bg-muted/60 hover:border-primary/30 transition-all whitespace-nowrap shrink-0"
              >
                <item.icon className="h-3.5 w-3.5 text-muted-foreground" />
                {item.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default QuickActions;
