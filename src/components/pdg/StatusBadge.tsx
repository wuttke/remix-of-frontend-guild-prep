import { CheckCircle2, CircleDashed, Loader2, XCircle } from "lucide-react";
import type { JobStatus } from "@/lib/pdg/types";
import { cn } from "@/lib/utils";

const config: Record<
  JobStatus,
  { label: string; icon: typeof CheckCircle2; tone: string }
> = {
  queued: {
    label: "Queued",
    icon: CircleDashed,
    tone: "text-[color:var(--status-queued)] border-[color:var(--status-queued)]/40 bg-[color:var(--status-queued)]/10",
  },
  running: {
    label: "Running",
    icon: Loader2,
    tone: "text-[color:var(--status-running)] border-[color:var(--status-running)]/40 bg-[color:var(--status-running)]/10",
  },
  finished: {
    label: "Finished",
    icon: CheckCircle2,
    tone: "text-[color:var(--status-finished)] border-[color:var(--status-finished)]/40 bg-[color:var(--status-finished)]/10",
  },
  failed: {
    label: "Failed",
    icon: XCircle,
    tone: "text-[color:var(--status-failed)] border-[color:var(--status-failed)]/40 bg-[color:var(--status-failed)]/10",
  },
};

export function StatusBadge({ status, className }: { status: JobStatus; className?: string }) {
  const c = config[status];
  const Icon = c.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium",
        c.tone,
        className,
      )}
    >
      <Icon className={cn("h-3 w-3", status === "running" && "animate-spin")} />
      {c.label}
    </span>
  );
}