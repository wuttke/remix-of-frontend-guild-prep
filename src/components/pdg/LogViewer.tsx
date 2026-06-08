import { useEffect, useRef, useState } from "react";
import Ansi from "ansi-to-react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { pdg } from "@/lib/pdg/client";
import type { JobStatusEvent, LogLine, JobStatus } from "@/lib/pdg/types";
import { cn } from "@/lib/utils";

/* ============================================================================
 * Section Types & Grouping Logic
 * ============================================================================ */

type SectionType = "normal" | "tool" | "agent-response" | "summary";

interface LogSection {
  type: SectionType;
  toolName?: string;
  lines: LogLine[];
  collapsed: boolean;
}

/**
 * Pattern matching for tool calls/results, agent responses, and summaries
 * Matches both plain emoji and ANSI-colored versions
 */
const TOOL_CALL_PATTERN = /🔧 Tool call: ([\w-]+)/;
const TOOL_RESULT_PATTERN = /📋 Tool result: ([\w-]+)/;
const AGENT_RESPONSE_PATTERN = /^🤖\s*$/; // Just the robot emoji, possibly with whitespace
const SUMMARY_PATTERN = /^---+\s*$/; // Three or more dashes

/**
 * Check if a line is a tool/agent/summary marker
 */
function getLineType(line: LogLine): { type: SectionType; toolName?: string } {
  const toolCall = line.line.match(TOOL_CALL_PATTERN);
  if (toolCall) {
    return { type: "tool", toolName: toolCall[1] };
  }

  const toolResult = line.line.match(TOOL_RESULT_PATTERN);
  if (toolResult) {
    // Tool results are part of the same tool section, so continue previous section
    return { type: "tool", toolName: toolResult[1] };
  }

  if (AGENT_RESPONSE_PATTERN.test(line.line.trim())) {
    return { type: "agent-response" };
  }

  if (SUMMARY_PATTERN.test(line.line.trim())) {
    return { type: "summary" };
  }

  return { type: "normal" };
}

/**
 * Group flat log lines into collapsible sections
 * Tools (call + result), agent responses, and summaries become their own sections
 * that include all following lines until the next marker
 */
function groupLogsIntoSections(lines: LogLine[]): LogSection[] {
  const sections: LogSection[] = [];
  let currentSection: LogSection | null = null;

  for (const line of lines) {
    const { type, toolName } = getLineType(line);

    if (type === "tool" || type === "agent-response" || type === "summary") {
      // For tool sections, continue the current section if it's already a tool section
      // This merges tool-call and tool-result into one section
      if (type === "tool" && currentSection?.type === "tool") {
        currentSection.lines.push(line);
        // Update tool name if this is a result line
        if (!currentSection.toolName && toolName) {
          currentSection.toolName = toolName;
        }
      } else {
        // Start a new section
        if (currentSection) {
          sections.push(currentSection);
        }
        currentSection = {
          type,
          toolName,
          lines: [line],
          collapsed: false, // Will be set based on type later
        };
      }
    } else {
      // Normal line - add to current section or create new normal section
      if (!currentSection) {
        // No current section, create a normal one
        currentSection = {
          type: "normal",
          lines: [line],
          collapsed: false,
        };
      } else if (currentSection.type === "normal") {
        // Add to existing normal section
        currentSection.lines.push(line);
      } else {
        // Current section is a special section - add this line to it
        // (special sections capture all lines until next marker)
        currentSection.lines.push(line);
      }
    }
  }

  // Don't forget the last section
  if (currentSection) {
    sections.push(currentSection);
  }

  // Set default collapsed state:
  // - Tools: auto-collapse (true)
  // - Agent responses: auto-expand (false)
  // - Summary: auto-expand (false)
  return sections.map((section) => ({
    ...section,
    collapsed: section.type === "tool",
  }));
}

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
  result = result.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");

  // Handle headings: # Text -> styled span with colored hashtags
  // Match headings that might be wrapped in ANSI spans
  // Pattern: matches (#{1,6}) followed by space and content, anywhere in the string
  result = result.replace(/(^|>)(#{1,6})\s+([^<\n]+)/gm, (match, prefix, hashes, content) => {
    const level = hashes.length;
    // Use bold + underline instead of size changes
    const fontWeight = level <= 2 ? 700 : level <= 4 ? 600 : 500;
    const textDecoration = level === 1 ? "underline" : "none";
    const hashColor = "rgba(156, 163, 175, 0.4)"; // muted color for hashtags

    return `${prefix}<span style="display: block; font-weight: ${fontWeight}; text-decoration: ${textDecoration};"><span style="color: ${hashColor};">${hashes}</span> ${content}</span>`;
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

/* ============================================================================
 * Collapsible Section Component
 * ============================================================================ */

interface CollapsibleSectionProps {
  section: LogSection;
  onToggle: () => void;
}

function CollapsibleSection({ section, onToggle }: CollapsibleSectionProps) {
  const { type, toolName, lines, collapsed } = section;

  // Normal sections render directly without collapsing
  if (type === "normal") {
    return (
      <>
        {lines.map((line, i) => (
          <LogLineContent key={i} line={line} />
        ))}
      </>
    );
  }

  // Determine icon, label, and styling for each section type
  let icon: string;
  let label: string;
  let bgClass: string;

  switch (type) {
    case "tool":
      icon = "🔧";
      label = "Tool";
      bgClass = "bg-accent/10";
      break;
    case "agent-response":
      icon = "🤖";
      label = "Agent response";
      bgClass = "bg-blue-500/10";
      break;
    case "summary":
      icon = "📝";
      label = "Summary";
      bgClass = "bg-green-500/10";
      break;
    default:
      icon = "📄";
      label = "Section";
      bgClass = "bg-muted/10";
  }

  // Filter out marker lines from content
  // For agent-response: remove the first line if it's just "🤖"
  // For summary: remove the first line if it's just "---"
  let contentLines = lines;
  if (type === "agent-response" && lines.length > 0) {
    const firstLine = lines[0].line.trim();
    if (AGENT_RESPONSE_PATTERN.test(firstLine)) {
      contentLines = lines.slice(1);
    }
    // Remove trailing empty line if present (to avoid double newlines)
    if (contentLines.length > 0 && contentLines[contentLines.length - 1].line.trim() === "") {
      contentLines = contentLines.slice(0, -1);
    }
  } else if (type === "summary" && lines.length > 0) {
    const firstLine = lines[0].line.trim();
    if (SUMMARY_PATTERN.test(firstLine)) {
      contentLines = lines.slice(1);
    }
  }

  const lineCount = contentLines.length;

  return (
    <div className="my-1">
      {/* Header with toggle */}
      <button
        onClick={onToggle}
        className={cn(
          "flex w-full items-center gap-2 rounded px-2 py-1 font-mono text-xs transition-colors",
          "hover:bg-muted/30 focus:outline-none focus:ring-1 focus:ring-ring",
          bgClass,
        )}
      >
        {collapsed ? (
          <ChevronRight className="h-3 w-3 flex-shrink-0" />
        ) : (
          <ChevronDown className="h-3 w-3 flex-shrink-0" />
        )}
        <span className="flex-shrink-0">
          {icon && `${icon} `}
          {label}
          {toolName ? `: ${toolName}` : ""}
        </span>
        <span className="text-muted-foreground">
          ({lineCount} line{lineCount === 1 ? "" : "s"})
        </span>
      </button>

      {/* Content - only render when expanded */}
      {!collapsed && (
        <div className="ml-5 mt-1 border-l-2 border-muted/30 pl-2">
          {contentLines.map((line, i) => (
            <LogLineContent key={i} line={line} />
          ))}
        </div>
      )}
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
  const [sections, setSections] = useState<LogSection[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // For completed jobs, fetch logs once instead of streaming
    const isCompleted =
      jobStatus === "finished" || jobStatus === "failed" || jobStatus === "cancelled";

    if (isCompleted) {
      // Fetch all logs at once for completed jobs
      // Don't clear existing lines to avoid flicker when transitioning from streaming to completed
      pdg
        .getJobLog(jobId)
        .then((jobLog) => {
          setLines(jobLog.log);
        })
        .catch((err) => {
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

  // Group lines into sections whenever lines change
  useEffect(() => {
    setSections(groupLogsIntoSections(lines));
  }, [lines]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [lines]);

  // Toggle a section's collapsed state
  const toggleSection = (index: number) => {
    setSections((prev) =>
      prev.map((section, i) =>
        i === index ? { ...section, collapsed: !section.collapsed } : section,
      ),
    );
  };

  // Expand/collapse all tool sections
  const expandAll = () => {
    setSections((prev) => prev.map((section) => ({ ...section, collapsed: false })));
  };

  const collapseAll = () => {
    setSections((prev) =>
      prev.map((section) =>
        section.type === "normal" ? section : { ...section, collapsed: true },
      ),
    );
  };

  // Check if there are any collapsible sections
  const hasCollapsibleSections = sections.some(
    (s) => s.type === "tool" || s.type === "agent-response" || s.type === "summary",
  );

  return (
    <div className="space-y-2">
      {/* Expand/Collapse All buttons */}
      {hasCollapsibleSections && lines.length > 0 && (
        <div className="flex gap-2">
          <button
            onClick={expandAll}
            className="rounded bg-muted/40 px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
          >
            Expand All
          </button>
          <button
            onClick={collapseAll}
            className="rounded bg-muted/40 px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
          >
            Collapse All
          </button>
        </div>
      )}

      {/* Log content */}
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
          sections.map((section, i) => (
            <CollapsibleSection key={i} section={section} onToggle={() => toggleSection(i)} />
          ))
        )}
      </div>
    </div>
  );
}
