import { useEffect, useRef, useState } from "react";
import Ansi from "ansi-to-react";
import { pdg } from "@/lib/pdg/client";
import type { JobStatusEvent, LogLine, JobStatus } from "@/lib/pdg/types";
import { cn } from "@/lib/utils";

/**
 * Check if a line contains markdown patterns
 */
function hasMarkdown(text: string): boolean {
  const hasBold = /\*\*[^*]+\*\*/.test(text);
  const hasHeading = /^#{1,6}\s+/.test(text);
  return hasBold || hasHeading;
}

/**
 * Parse markdown in a plain text line (after ANSI has been converted to HTML)
 * This creates a DOM manipulation approach for post-ANSI markdown parsing
 */
function applyMarkdownToHtml(htmlString: string): string {
  let result = htmlString;

  // Handle bold: **text** -> <strong>text</strong>
  result = result.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

  // Handle headings: # Text -> styled span
  result = result.replace(/^(#{1,6})\s+(.+)$/gm, (_, hashes, content) => {
    const level = hashes.length;
    const fontSize = level === 1 ? '1.2em' : level === 2 ? '1.1em' : level === 3 ? '1.05em' : '1em';
    const fontWeight = level <= 3 ? 600 : 500;
    return `<span style="font-size: ${fontSize}; font-weight: ${fontWeight}; display: block;">${content}</span>`;
  });

  return result;
}

/**
 * Renders a single log line with ANSI color support and basic markdown parsing
 */
function LogLineContent({ line }: { line: LogLine }) {
  const baseClassName = cn(
    "whitespace-pre-wrap break-words",
    line.stream === "stderr" ? "text-[color:var(--status-failed)]" : "text-foreground/90",
  );

  // Check if line has markdown - if not, just use ANSI parser
  const lineHasMarkdown = hasMarkdown(line.line);

  if (!lineHasMarkdown) {
    // Simple case: just ANSI parsing
    return (
      <div className={baseClassName}>
        <Ansi linkify={false} useClasses={false}>
          {line.line}
        </Ansi>
      </div>
    );
  }

  // Complex case: both ANSI and markdown
  // We need to render ANSI first, then apply markdown to the result
  // Use a ref to manipulate the DOM after Ansi renders
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current && lineHasMarkdown) {
      const html = ref.current.innerHTML;
      const withMarkdown = applyMarkdownToHtml(html);
      if (html !== withMarkdown) {
        ref.current.innerHTML = withMarkdown;
      }
    }
  }, [line.line, lineHasMarkdown]);

  return (
    <div ref={ref} className={baseClassName}>
      <Ansi linkify={false} useClasses={false}>
        {line.line}
      </Ansi>
    </div>
  );
}

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
    // For completed jobs, fetch logs once instead of streaming
    const isCompleted = jobStatus === "finished" || jobStatus === "failed" || jobStatus === "cancelled";

    if (isCompleted) {
      // Fetch all logs at once for completed jobs
      // Don't clear existing lines to avoid flicker when transitioning from streaming to completed
      pdg.getJobLog(jobId).then((jobLog) => {
        setLines(jobLog.log);
      }).catch((err) => {
        console.error("Failed to fetch job log:", err);
      });
      return; // No cleanup needed for one-time fetch
    }

    // For active jobs (queued/running), stream events
    // Clear lines when starting fresh stream
    setLines([]);
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
          <LogLineContent key={i} line={line} />
        ))
      )}
    </div>
  );
}