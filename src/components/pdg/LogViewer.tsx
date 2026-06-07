import { useEffect, useRef, useState } from "react";
import { pdg } from "@/lib/pdg/client";
import type { JobStatusEvent, LogLine } from "@/lib/pdg/types";
import { cn } from "@/lib/utils";

export function LogViewer({
  jobId,
  onStatus,
  className,
}: {
  jobId: string;
  onStatus?: (event: JobStatusEvent) => void;
  className?: string;
}) {
  const [lines, setLines] = useState<LogLine[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLines([]);
    const unsubscribe = pdg.streamJobEvents(jobId, {
      onLog: (line) => setLines((prev) => [...prev, line]),
      onStatus: (event) => onStatus?.(event),
    });
    return unsubscribe;
  }, [jobId, onStatus]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [lines]);

  return (
    <div
      ref={scrollRef}
      className={cn(
        "h-[55vh] overflow-y-auto rounded-lg border border-border/60 bg-[oklch(0.14_0.01_250)] p-3 font-mono text-[12px] leading-relaxed",
        className,
      )}
    >
      {lines.length === 0 ? (
        <div className="text-muted-foreground italic">Waiting for output…</div>
      ) : (
        lines.map((line, i) => (
          <div
            key={i}
            className={cn(
              "whitespace-pre-wrap",
              line.stream === "stderr" ? "text-[color:var(--status-failed)]" : "text-foreground/90",
            )}
          >
            {line.line}
          </div>
        ))
      )}
    </div>
  );
}