import { Card } from "@/components/ui/card";

export function EmptyHint({ label }: { label: string }) {
  return (
    <Card className="p-4 border-dashed bg-muted/30">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="text-sm text-muted-foreground/80 mt-1">
        Not provided in this manifest.
      </p>
    </Card>
  );
}