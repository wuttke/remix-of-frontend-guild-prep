import { useEffect, useRef, useState } from "react";
import { pdg } from "@/lib/pdg/client";
import type { JobStatusEvent, LogLine, JobStatus } from "@/lib/pdg/types";
import { cn } from "@/lib/utils";

export function LogViewer({
  jobId,
  jobStatus,
  onStatus,
  className,
}: {
  jobId: string;
  jobStatus?: JobStatus;
  onStatus?: (event: JobStatusEvent) => void;
  className?: string;
}) {
  const [lines, setLines] = useState<LogLine[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLines([]);

    // For completed jobs, fetch logs once instead of streaming
    const isCompleted = jobStatus === "finished" || jobStatus === "failed" || jobStatus === "cancelled";

    if (isCompleted) {
      // Fetch all logs at once for completed jobs
      pdg.getJobLog(jobId).then((jobLog) => {
        setLines(jobLog.log);
      }).catch((err) => {
        console.error("Failed to fetch job log:", err);
      });
      return; // No cleanup needed for one-time fetch
    }

    // For active jobs (queued/running), stream events
    const unsubscribe = pdg.streamJobEvents(jobId, {
      onLog: (line) => setLines((prev) => [...prev, line]),
      onStatus: (event) => onStatus?.(event),
    });
    return unsubscribe;
  }, [jobId, jobStatus, onStatus]);

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