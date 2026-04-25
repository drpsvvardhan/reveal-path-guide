import { Card } from "@/components/ui/card";

/**
 * Fallback card for sections the manifest does not provide.
 * `field` is the JSON path the renderer was looking for so the user knows
 * exactly which key to add to make the section appear.
 */
export function EmptyHint({ label, field }: { label: string; field?: string }) {
  return (
    <Card className="p-4 border-dashed bg-muted/30">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="text-sm text-muted-foreground/80 mt-1">
        Not in this manifest{field ? <> — add <code className="font-mono text-xs">{field}</code> to populate this section.</> : "."}
      </p>
    </Card>
  );
}