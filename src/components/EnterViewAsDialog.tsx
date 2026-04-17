import { useState, useEffect } from "react";
import { useViewAs } from "@/context/ViewAsContext";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pre-populate the target user ID (e.g. when launched from a profile row). */
  defaultTargetUserId?: string;
};

/**
 * Dialog that mints a server-validated view-as session.
 * Captures target user, audit reason (≥10 chars), and optional duration.
 */
export default function EnterViewAsDialog({
  open,
  onOpenChange,
  defaultTargetUserId,
}: Props) {
  const { enterViewAs, allProfiles, isAdmin } = useViewAs();
  const [targetUserId, setTargetUserId] = useState(defaultTargetUserId ?? "");
  const [reason, setReason] = useState("");
  const [duration, setDuration] = useState<number>(60);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setTargetUserId(defaultTargetUserId ?? "");
      setReason("");
      setDuration(60);
    }
  }, [open, defaultTargetUserId]);

  if (!isAdmin) return null;

  const reasonValid = reason.trim().length >= 10;
  const targetValid = targetUserId.trim().length > 0;
  const canSubmit = reasonValid && targetValid && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await enterViewAs(targetUserId.trim(), reason.trim(), duration);
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif">Start view-as session</DialogTitle>
          <DialogDescription>
            Every action during this session is logged for audit. Sessions auto-expire.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="target-user" className="text-xs">Target user</Label>
            {allProfiles && allProfiles.length > 0 ? (
              <Select value={targetUserId} onValueChange={setTargetUserId}>
                <SelectTrigger id="target-user">
                  <SelectValue placeholder="Select a profile…" />
                </SelectTrigger>
                <SelectContent>
                  {allProfiles.map((p) => (
                    <SelectItem key={p.user_id} value={p.user_id}>
                      {p.first_name || p.display_name || "Unknown"}
                      {p.age ? ` · ${p.age}y` : ""}
                      {p.sex ? ` · ${p.sex}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                id="target-user"
                placeholder="user UUID"
                value={targetUserId}
                onChange={(e) => setTargetUserId(e.target.value)}
              />
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="reason" className="text-xs">
              Reason <span className="text-muted-foreground">(min 10 chars, audit-logged)</span>
            </Label>
            <Textarea
              id="reason"
              rows={3}
              placeholder="e.g. Investigating upload failure reported via support ticket #1234"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            <p className={`text-[10px] ${reasonValid ? "text-muted-foreground" : "text-destructive"}`}>
              {reason.trim().length}/10 characters minimum
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="duration" className="text-xs">Duration</Label>
            <Select
              value={String(duration)}
              onValueChange={(v) => setDuration(Number(v))}
            >
              <SelectTrigger id="duration">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="15">15 minutes</SelectItem>
                <SelectItem value="30">30 minutes</SelectItem>
                <SelectItem value="60">1 hour</SelectItem>
                <SelectItem value="120">2 hours</SelectItem>
                <SelectItem value="240">4 hours (max)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {submitting ? "Starting…" : "Start session"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
