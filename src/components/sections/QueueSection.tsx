import React, { useState } from "react";
import { useQueue } from "@/context/QueueContext";
import {
  Plus,
  Copy,
  ClipboardCheck,
  Archive,
  ArchiveRestore,
  Trash2,
  Share2,
  Check,
  X,
  MessageCircle,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Pencil,
  GripVertical,
  Link as LinkIcon,
  RefreshCw,
  Eye,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { QueuedQuestion } from "@/types/manifest";

const QueueSection: React.FC = () => {
  const {
    questions,
    archived,
    loading,
    shareInfo,
    addManualQuestion,
    archiveQuestion,
    unarchiveQuestion,
    deleteQuestion,
    reorderQuestions,
    editQuestion,
    ensureShareToken,
    revokeShareToken,
  } = useQueue();

  const [newQuestionText, setNewQuestionText] = useState("");
  const [newRationale, setNewRationale] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const handleCopyQuestion = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleAdd = async () => {
    if (!newQuestionText.trim()) return;
    setAdding(true);
    try {
      await addManualQuestion(newQuestionText, newRationale);
      setNewQuestionText("");
      setNewRationale("");
      setShowAddForm(false);
    } catch (e) {
      console.error("Add failed:", e);
    } finally {
      setAdding(false);
    }
  };

  const handleStartEdit = (q: QueuedQuestion) => {
    setEditingId(q.id);
    setEditText(q.question);
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editText.trim()) return;
    await editQuestion(editingId, editText);
    setEditingId(null);
    setEditText("");
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditText("");
  };

  const handleShare = async () => {
    await ensureShareToken();
    setShowShareDialog(true);
  };

  const handleCopyShareLink = () => {
    if (!shareInfo.shareUrl) return;
    navigator.clipboard.writeText(shareInfo.shareUrl);
    setShareCopied(true);
    setTimeout(() => setShareCopied(false), 2500);
  };

  const handleRevokeShare = async () => {
    if (!confirm("Generate a new share link? The old link will stop working.")) return;
    await revokeShareToken();
  };

  const handleDragStart = (id: string) => setDraggedId(id);
  const handleDragOver = (e: React.DragEvent) => e.preventDefault();
  const handleDrop = (targetId: string) => {
    if (!draggedId || draggedId === targetId) return;
    const ids = questions.map((q) => q.id);
    const fromIdx = ids.indexOf(draggedId);
    const toIdx = ids.indexOf(targetId);
    if (fromIdx === -1 || toIdx === -1) return;
    const reordered = [...ids];
    reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, draggedId);
    reorderQuestions(reordered);
    setDraggedId(null);
  };

  return (
    <section className="animate-fade-in space-y-5">
      <div>
        <h2 className="text-sm font-sans font-medium uppercase tracking-widest text-secondary">
          Questions for your doctor
        </h2>
        <p className="text-muted-foreground text-sm max-w-xl mt-1">
          Questions ready for your next appointment. Add your own, archive ones you've decided not
          to ask, or share the list with your doctor before you visit.
        </p>
      </div>

      {/* Action bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center gap-1.5 rounded-lg bg-secondary text-secondary-foreground px-3 py-1.5 text-xs hover:bg-secondary/90 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          Add question
        </button>
        <button
          onClick={handleShare}
          disabled={questions.length === 0}
          className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-foreground hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Share2 className="h-3.5 w-3.5" />
          Share with doctor
        </button>
        {archived.length > 0 && (
          <button
            onClick={() => setShowArchived(!showArchived)}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted transition-colors ml-auto"
          >
            <Archive className="h-3.5 w-3.5" />
            Archived ({archived.length})
            {showArchived ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
        )}
      </div>

      {/* Count and curation hint */}
      {questions.length > 0 && (
        <div className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{questions.length}</span>{" "}
          {questions.length === 1 ? "question" : "questions"} ready for your next visit.
          {questions.length > 5 && (
            <span className="ml-2 italic">
              Most appointments only have time for 2 or 3 — consider archiving the ones that feel
              less urgent.
            </span>
          )}
        </div>
      )}

      {/* Add form */}
      <AnimatePresence>
        {showAddForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="rounded-lg border border-border bg-card p-4 space-y-3 overflow-hidden"
          >
            <div>
              <label className="text-xs font-medium text-foreground block mb-1.5">
                Your question
              </label>
              <input
                value={newQuestionText}
                onChange={(e) => setNewQuestionText(e.target.value)}
                placeholder="What do you want to ask?"
                autoFocus
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-secondary/30"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-foreground block mb-1.5">
                Why this matters (optional)
              </label>
              <input
                value={newRationale}
                onChange={(e) => setNewRationale(e.target.value)}
                placeholder="A short note to remind yourself"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-secondary/30"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  setShowAddForm(false);
                  setNewQuestionText("");
                  setNewRationale("");
                }}
                className="rounded-md px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAdd}
                disabled={!newQuestionText.trim() || adding}
                className="rounded-md bg-secondary text-secondary-foreground px-3 py-1.5 text-xs hover:bg-secondary/90 transition-colors disabled:opacity-50"
              >
                {adding ? "Adding..." : "Add to queue"}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading state */}
      {loading && questions.length === 0 && (
        <div className="text-xs text-muted-foreground italic py-4">Loading your questions...</div>
      )}

      {/* Empty state */}
      {!loading && questions.length === 0 && (
        <div className="rounded-lg border border-dashed border-border bg-muted/20 px-6 py-8 text-center">
          <MessageCircle className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm text-foreground font-medium mb-1">
            No questions queued yet
          </p>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            When you ask the patient companion something, the suggested doctor questions will land
            here automatically. You can also add your own using the button above.
          </p>
        </div>
      )}

      {/* Active questions */}
      <div className="space-y-2">
        <AnimatePresence>
          {questions.map((q) => (
            <motion.div
              key={q.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              draggable
              onDragStart={() => handleDragStart(q.id)}
              onDragOver={handleDragOver}
              onDrop={() => handleDrop(q.id)}
              className={`rounded-lg border bg-card p-3 group transition-colors ${
                draggedId === q.id ? "opacity-50" : "border-border hover:border-secondary/40"
              }`}
            >
              <div className="flex items-start gap-2">
                <div className="cursor-grab active:cursor-grabbing text-muted-foreground/40 hover:text-muted-foreground transition-colors mt-1">
                  <GripVertical className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  {editingId === q.id ? (
                    <div className="space-y-2">
                      <input
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        autoFocus
                        className="w-full rounded-md border border-border bg-background px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-secondary/30"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={handleSaveEdit}
                          className="text-xs text-secondary hover:underline"
                        >
                          Save
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          className="text-xs text-muted-foreground hover:underline"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-start gap-2">
                        <p className="text-sm italic text-foreground leading-relaxed flex-1">
                          "{q.question}"
                        </p>
                        {q.source === "auto" && (
                          <span
                            className="shrink-0 mt-0.5 inline-flex items-center gap-1 text-[9px] text-secondary bg-secondary/10 px-1.5 py-0.5 rounded"
                            title="Generated from a chat conversation"
                          >
                            <Sparkles className="h-2.5 w-2.5" />
                            from chat
                          </span>
                        )}
                        {q.source === "derived" && (
                          <span
                            className="shrink-0 mt-0.5 inline-flex items-center gap-1 text-[9px] text-amber-700 bg-amber-50 border border-amber-200/60 px-1.5 py-0.5 rounded"
                            title="Noticed automatically by the pattern detector"
                          >
                            <Eye className="h-2.5 w-2.5" />
                            from patterns
                          </span>
                        )}
                      </div>
                      {q.rationale && (
                        <p className="text-[11px] text-muted-foreground mt-1.5 leading-relaxed">
                          {q.rationale}
                        </p>
                      )}
                    </>
                  )}
                </div>

                {editingId !== q.id && (
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleCopyQuestion(q.id, q.question)}
                      className="p-1.5 rounded-md hover:bg-muted transition-colors"
                      title="Copy question"
                    >
                      {copiedId === q.id ? (
                        <ClipboardCheck className="h-3.5 w-3.5 text-secondary" />
                      ) : (
                        <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                    </button>
                    <button
                      onClick={() => handleStartEdit(q)}
                      className="p-1.5 rounded-md hover:bg-muted transition-colors"
                      title="Edit question"
                    >
                      <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                    <button
                      onClick={() => archiveQuestion(q.id)}
                      className="p-1.5 rounded-md hover:bg-muted transition-colors"
                      title="Archive question"
                    >
                      <Archive className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Archived questions */}
      <AnimatePresence>
        {showArchived && archived.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-2 pt-2 border-t border-border overflow-hidden"
          >
            <p className="text-xs font-sans font-medium uppercase tracking-wider text-muted-foreground pt-2">
              Archived
            </p>
            {archived.map((q) => (
              <div
                key={q.id}
                className="rounded-lg border border-border/40 bg-muted/20 p-3 group"
              >
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm italic text-muted-foreground leading-relaxed">
                      "{q.question}"
                    </p>
                  </div>
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => unarchiveQuestion(q.id)}
                      className="p-1.5 rounded-md hover:bg-muted transition-colors"
                      title="Restore to queue"
                    >
                      <ArchiveRestore className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm("Delete this question permanently?")) deleteQuestion(q.id);
                      }}
                      className="p-1.5 rounded-md hover:bg-muted transition-colors"
                      title="Delete forever"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Share dialog */}
      <AnimatePresence>
        {showShareDialog && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
            onClick={() => setShowShareDialog(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-background rounded-xl border border-border shadow-xl w-full max-w-md p-6 space-y-4"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-serif text-lg text-foreground">Share with your doctor</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    A clean view of your questions, no login required.
                  </p>
                </div>
                <button
                  onClick={() => setShowShareDialog(false)}
                  className="p-1 rounded-md hover:bg-muted transition-colors"
                >
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>

              {shareInfo.shareUrl ? (
                <>
                  <div className="rounded-lg border border-border bg-muted/30 p-3">
                    <div className="flex items-center gap-2">
                      <LinkIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <p className="text-xs text-foreground font-mono truncate flex-1">
                        {shareInfo.shareUrl}
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={handleCopyShareLink}
                      className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-secondary text-secondary-foreground px-3 py-2 text-xs hover:bg-secondary/90 transition-colors"
                    >
                      {shareCopied ? (
                        <>
                          <Check className="h-3.5 w-3.5" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" />
                          Copy link
                        </>
                      )}
                    </button>
                    <button
                      onClick={handleRevokeShare}
                      className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted-foreground hover:bg-muted transition-colors"
                      title="Generate a new link (the old one stops working)"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      Reset
                    </button>
                  </div>

                  <div className="rounded-lg bg-muted/30 border border-border/40 p-3 space-y-2">
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      <strong className="text-foreground">What your doctor will see:</strong> Only
                      your queued questions, formatted as a clean list. They'll see your name and
                      the date the list was prepared.
                    </p>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      <strong className="text-foreground">What they won't see:</strong> Your other
                      health data, your chat history, your archived questions, or your account.
                    </p>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      <strong className="text-foreground">Privacy:</strong> Anyone with this link
                      can see your queued questions. If you share it widely or want to make it
                      private again, click Reset to generate a new link.
                    </p>
                  </div>
                </>
              ) : (
                <div className="text-xs text-muted-foreground italic py-4 text-center">
                  Generating share link...
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
};

export default QueueSection;
