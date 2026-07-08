import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useRef, useEffect } from "react";
import { ArrowLeft, FileText, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { pdg } from "@/lib/pdg/client";
import { cn } from "@/lib/utils";
import type { GitFileStatus } from "@/lib/pdg/types";

interface DiffSearchParams {
  repoId: string;
  worktreeName?: string;
  isPrimary?: boolean;
}

export const Route = createFileRoute("/repos/diff")({
  validateSearch: (search: Record<string, unknown>): DiffSearchParams => ({
    repoId: (search.repoId as string) || "",
    worktreeName: search.worktreeName as string | undefined,
    isPrimary: search.isPrimary === "true" || search.isPrimary === true,
  }),
  head: () => ({
    meta: [
      { title: "Git Diff Viewer · Pocket Dev Guild" },
      {
        name: "description",
        content: "View git changes and diffs for repository worktrees.",
      },
    ],
  }),
  component: DiffViewerPage,
});

function DiffViewerPage() {
  const navigate = useNavigate();
  const { repoId, worktreeName, isPrimary } = Route.useSearch();
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const fileRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const gitStatusQuery = useQuery({
    queryKey: ["git-status", repoId, worktreeName],
    queryFn: () =>
      isPrimary
        ? pdg.getRepoGitStatus(repoId)
        : pdg.getWorktreeGitStatus(repoId, worktreeName!),
    enabled: !isPrimary ? !!worktreeName : true,
  });

  const gitStatus = gitStatusQuery.data;
  const files = gitStatus?.files || [];

  // Auto-select first file on mount
  useEffect(() => {
    if (files.length > 0 && !selectedFile) {
      setSelectedFile(files[0].path);
    }
  }, [files, selectedFile]);

  const scrollToFile = (filePath: string) => {
    const element = fileRefs.current.get(filePath);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    setSelectedFile(filePath);
  };

  const displayName = isPrimary ? "Primary Repository" : worktreeName || "Unknown";

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Header */}
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-border/60 px-4">
        <div className="flex items-center gap-3">
          {/* Mobile menu button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="gap-2 lg:hidden"
          >
            {isSidebarOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate({ to: "/repos" })}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Back to Repos</span>
            <span className="sm:hidden">Back</span>
          </Button>
          <div className="h-6 w-px bg-border/60 hidden sm:block" />
          <h1 className="font-display text-sm sm:text-lg font-semibold truncate">
            <span className="hidden sm:inline">Git Changes: </span>{displayName}
          </h1>
        </div>
        <div className="text-xs sm:text-sm text-muted-foreground shrink-0">
          {files.length} file{files.length !== 1 ? "s" : ""} changed
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* File List Sidebar - Mobile Overlay */}
        <div
          className={cn(
            "fixed inset-y-0 left-0 z-50 w-80 shrink-0 border-r border-border/60 bg-background transition-transform duration-300 lg:relative lg:translate-x-0 lg:bg-muted/20",
            isSidebarOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <div className="flex h-full flex-col">
            <div className="shrink-0 border-b border-border/40 px-4 py-3 flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Changed Files ({files.length})
              </h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsSidebarOpen(false)}
                className="lg:hidden h-6 w-6 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <ScrollArea className="flex-1">
              <div className="space-y-1 p-3">
                {files.map((file) => (
                  <button
                    key={file.path}
                    onClick={() => {
                      scrollToFile(file.path);
                      setIsSidebarOpen(false); // Close sidebar on mobile after click
                    }}
                    className={cn(
                      "flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm transition-colors hover:bg-muted/50",
                      selectedFile === file.path && "bg-muted font-medium"
                    )}
                  >
                    <span
                      className={cn(
                        "font-mono text-xs font-semibold",
                        file.staged
                          ? "text-green-600 dark:text-green-400"
                          : "text-orange-600 dark:text-orange-400"
                      )}
                    >
                      {file.staged ? file.x : file.y}
                    </span>
                    <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="truncate font-mono text-xs">{file.path}</span>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </div>
        </div>

        {/* Mobile Backdrop */}
        {isSidebarOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/50 lg:hidden"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        {/* Main Content Area */}
        <ScrollArea className="flex-1">
          <div className="space-y-6 p-6">
            {gitStatusQuery.isLoading ? (
              <div className="py-20 text-center text-muted-foreground">
                Loading git status...
              </div>
            ) : files.length === 0 ? (
              <div className="py-20 text-center text-muted-foreground">
                No changes detected
              </div>
            ) : (
              files.map((file) => (
                <div
                  key={file.path}
                  ref={(el) => {
                    if (el) fileRefs.current.set(file.path, el);
                  }}
                >
                  <FileContent
                    repoId={repoId}
                    worktreeName={worktreeName}
                    isPrimary={isPrimary}
                    file={file}
                  />
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}

interface FileContentProps {
  repoId: string;
  worktreeName: string | undefined;
  isPrimary: boolean | undefined;
  file: GitFileStatus;
}

function FileContent({ repoId, worktreeName, isPrimary, file }: FileContentProps) {
  // Check if this is an untracked file (new file not in git)
  const isUntracked = file.status === "untracked" || (file.x === "?" && file.y === "?");

  // For tracked files, show normal diff
  // For untracked files, show a message since backend doesn't support reading file content
  const { data, isLoading } = useQuery({
    queryKey: ["file-diff", repoId, worktreeName, file.path, file.staged],
    queryFn: () =>
      isPrimary
        ? pdg.getRepoFileDiff(repoId, file.path, file.staged)
        : pdg.getWorktreeFileDiff(repoId, worktreeName!, file.path, file.staged),
    // Skip query for untracked files since they won't have diffs
    enabled: !isUntracked,
  });

  return (
    <div className="overflow-hidden rounded-lg border border-border/60 bg-card">
      {/* File Header */}
      <div className="flex items-center justify-between border-b border-border/40 bg-muted/30 px-4 py-3">
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "font-mono text-sm font-semibold",
              file.staged
                ? "text-green-600 dark:text-green-400"
                : "text-orange-600 dark:text-orange-400"
            )}
          >
            {file.staged ? file.x : file.y}
          </span>
          <span className="font-mono text-sm font-semibold">{file.path}</span>
        </div>
        <span className="text-xs font-medium text-muted-foreground">
          {file.staged ? "Staged Changes" : "Unstaged Changes"}
        </span>
      </div>

      {/* File Content */}
      <div className="p-4">
        {isLoading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Loading diff...
          </div>
        ) : data && data.files.length > 0 && data.files[0].diff ? (
          <pre className="overflow-x-auto rounded bg-muted/40 p-4 font-mono text-xs leading-relaxed">
            <DiffContent diff={data.files[0].diff} />
          </pre>
        ) : isUntracked ? (
          <div className="py-8 text-center space-y-2">
            <div className="text-sm font-medium text-muted-foreground">
              New File
            </div>
            <div className="text-xs text-muted-foreground">
              This is a newly added file that hasn't been committed yet.
              <br />
              Full file content is not available through the diff API.
            </div>
          </div>
        ) : data && data.files.length > 0 && data.files[0].diff === null ? (
          <div className="py-8 text-center space-y-2">
            <div className="text-sm font-medium text-muted-foreground">
              Diff Not Available
            </div>
            <div className="text-xs text-muted-foreground">
              {data.files[0].binary ? (
                <>This is a binary file that cannot be displayed as text diff.</>
              ) : (
                <>
                  The diff could not be generated for this file.
                  <br />
                  {data.files[0].additions > 0 && `+${data.files[0].additions} additions`}
                  {data.files[0].additions > 0 && data.files[0].deletions > 0 && ", "}
                  {data.files[0].deletions > 0 && `-${data.files[0].deletions} deletions`}
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="py-8 text-center text-sm text-muted-foreground">
            No changes to display
          </div>
        )}
      </div>
    </div>
  );
}

function DiffContent({ diff }: { diff: string }) {
  return (
    <>
      {diff.split("\n").map((line, idx) => {
        let colorClass = "text-foreground";
        if (line.startsWith("+") && !line.startsWith("+++")) {
          colorClass = "text-green-600 dark:text-green-400 bg-green-500/10";
        } else if (line.startsWith("-") && !line.startsWith("---")) {
          colorClass = "text-red-600 dark:text-red-400 bg-red-500/10";
        } else if (line.startsWith("@@")) {
          colorClass = "text-blue-600 dark:text-blue-400 font-semibold";
        }

        return (
          <div key={idx} className={cn("px-2 -mx-2", colorClass)}>
            {line || " "}
          </div>
        );
      })}
    </>
  );
}
