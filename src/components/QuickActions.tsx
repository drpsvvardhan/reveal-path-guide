import React, { useState } from "react";
import { UtensilsCrossed, Mic, MessageCircle, Upload, ListChecks, Phone, ArrowLeft, X, MicOff } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

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
const FoodLogOverlay: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [entry, setEntry] = useState("");
  const [logged, setLogged] = useState<string[]>([]);

  const handleLog = () => {
    if (!entry.trim()) return;
    setLogged((prev) => [entry.trim(), ...prev]);
    setEntry("");
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
          className="rounded-lg bg-primary px-4 py-2 text-sm font-sans font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Log
        </button>
      </div>
      {logged.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground font-sans">Today's entries</p>
          {logged.map((item, i) => (
            <div key={i} className="flex items-center gap-2 rounded-md border border-border bg-card/60 px-3 py-2 text-sm font-sans text-foreground">
              <UtensilsCrossed className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              {item}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

/* ── Voice Note Overlay ── */
const VoiceNoteOverlay: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [notes, setNotes] = useState<string[]>([]);
  const [transcript, setTranscript] = useState("");
  const recognitionRef = React.useRef<any>(null);

  const toggleRecording = () => {
    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
      if (transcript.trim()) {
        setNotes((prev) => [transcript.trim(), ...prev]);
        setTranscript("");
      }
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      // Fallback: show text input
      const note = prompt("Voice recognition not supported. Type your note:");
      if (note?.trim()) setNotes((prev) => [note.trim(), ...prev]);
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
      if (note?.trim()) setNotes((prev) => [note.trim(), ...prev]);
    };

    recognition.onend = () => setIsRecording(false);

    recognitionRef.current = recognition;
    try {
      recognition.start();
      setIsRecording(true);
    } catch {
      const note = prompt("Could not start recording. Type your note:");
      if (note?.trim()) setNotes((prev) => [note.trim(), ...prev]);
    }
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
          className={`p-5 rounded-full transition-all ${
            isRecording
              ? "bg-red-100 text-red-600 ring-2 ring-red-300 animate-pulse"
              : "bg-muted/60 text-muted-foreground hover:bg-muted"
          }`}
        >
          {isRecording ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
        </button>
        <p className="text-xs text-muted-foreground font-sans">
          {isRecording ? "Tap to stop recording" : "Tap to start recording"}
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
          {notes.map((note, i) => (
            <div key={i} className="flex items-start gap-2 rounded-md border border-border bg-card/60 px-3 py-2 text-sm font-sans text-foreground">
              <Mic className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
              {note}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

/* ── Main QuickActions ── */
const QuickActions: React.FC<QuickActionsProps> = ({ onNavigate }) => {
  const [activeOverlay, setActiveOverlay] = useState<"food" | "voice" | null>(null);

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
            {activeOverlay === "food" && <FoodLogOverlay onClose={() => setActiveOverlay(null)} />}
            {activeOverlay === "voice" && <VoiceNoteOverlay onClose={() => setActiveOverlay(null)} />}
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
                className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs font-sans font-medium text-foreground hover:bg-muted/60 hover:border-secondary/30 transition-all whitespace-nowrap shrink-0"
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
