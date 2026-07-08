import { useQuery } from "@tanstack/react-query";
import { useState, useRef, useEffect } from "react";
import { X, ChevronRight, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { pdg } from "@/lib/pdg/client";
import { cn } from "@/lib/utils";
import type { GitFileStatus } from "@/lib/pdg/types";

interface GitDiffViewerProps {
  repoId: string;
  worktreeName: string | null;
  isPrimary: boolean;
  files: GitFileStatus[];
  onClose: () => void;
}

export function GitDiffViewer({ repoId, worktreeName, isPrimary, files, onClose }: GitDiffViewerProps) {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const fileRefs = useRef<Map<string, HTMLDivElement>>(new Map());

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

  return (
    <div className="fixed inset-0 z-50 bg-background">
      {/* Header */}
      <div className="flex h-14 items-center justify-between border-b border-border/60 px-4">
        <h1 className="font-display text-lg font-semibold">
          Git Changes: {isPrimary ? "Primary Repository" : worktreeName}
        </h1>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-5 w-5" />
        </Button>
      </div>

      <div className="flex h-[calc(100vh-3.5rem)]">
        {/* File List Sidebar */}
        <div className="w-80 border-r border-border/60 bg-muted/20">
          <div className="p-3">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Changed Files ({files.length})
            </h2>
            <ScrollArea className="h-[calc(100vh-8rem)]">
              <div className="space-y-1">
                {files.map((file) => (
                  <button
                    key={file.path}
                    onClick={() => scrollToFile(file.path)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm transition-colors hover:bg-muted/50",
                      selectedFile === file.path && "bg-muted font-medium"
                    )}
                  >
                    <span className={cn(
                      "font-mono text-xs",
                      file.staged ? "text-green-600 dark:text-green-400" : "text-orange-600 dark:text-orange-400"
                    )}>
                      {file.staged ? file.x : file.y}
                    </span>
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="truncate font-mono text-xs">{file.path}</span>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </div>
        </div>

        {/* Main Content Area */}
        <ScrollArea className="flex-1">
          <div className="p-6 space-y-8">
            {files.map((file) => (
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
            ))}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}

interface FileContentProps {
  repoId: string;
  worktreeName: string | null;
  isPrimary: boolean;
  file: GitFileStatus;
}

function FileContent({ repoId, worktreeName, isPrimary, file }: FileContentProps) {
  // For staged files, show diff
  // For unstaged files, show full file content
  const shouldShowDiff = file.staged;

  const { data, isLoading } = useQuery({
    queryKey: shouldShowDiff
      ? ["file-diff", repoId, worktreeName, file.path, file.staged]
      : ["file-content", repoId, worktreeName, file.path],
    queryFn: () => {
      if (shouldShowDiff) {
        return isPrimary
          ? pdg.getRepoFileDiff(repoId, file.path, file.staged)
          : pdg.getWorktreeFileDiff(repoId, worktreeName!, file.path, file.staged);
      } else {
        return isPrimary
          ? pdg.getRepoFileContent(repoId, file.path)
          : pdg.getWorktreeFileContent(repoId, worktreeName!, file.path);
      }
    },
  });

  return (
    <div className="rounded-lg border border-border/60 bg-card overflow-hidden">
      {/* File Header */}
      <div className="flex items-center justify-between border-b border-border/40 bg-muted/30 px-4 py-3">
        <div className="flex items-center gap-3">
          <span className={cn(
            "font-mono text-sm font-semibold",
            file.staged ? "text-green-600 dark:text-green-400" : "text-orange-600 dark:text-orange-400"
          )}>
            {file.staged ? file.x : file.y}
          </span>
          <span className="font-mono text-sm font-semibold">{file.path}</span>
        </div>
        <span className="text-xs font-medium text-muted-foreground">
          {shouldShowDiff ? "Diff" : "Full File"}
        </span>
      </div>

      {/* File Content */}
      <div className="p-4">
        {isLoading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Loading {shouldShowDiff ? "diff" : "file"}...
          </div>
        ) : data ? (
          <pre className="overflow-x-auto rounded bg-muted/40 p-4 font-mono text-xs leading-relaxed">
            {shouldShowDiff ? (
              <DiffContent diff={'diff' in data ? data.diff : ''} />
            ) : (
              <code className="text-foreground">{'content' in data ? data.content : ''}</code>
            )}
          </pre>
        ) : (
          <div className="py-8 text-center text-sm text-muted-foreground">
            No content available
          </div>
        )}
      </div>
    </div>
  );
}

function DiffContent({ diff }: { diff: string }) {
  return (
    <>
      {diff.split('\n').map((line, idx) => {
        let colorClass = "text-foreground";
        if (line.startsWith('+') && !line.startsWith('+++')) {
          colorClass = "text-green-600 dark:text-green-400 bg-green-500/10";
        } else if (line.startsWith('-') && !line.startsWith('---')) {
          colorClass = "text-red-600 dark:text-red-400 bg-red-500/10";
        } else if (line.startsWith('@@')) {
          colorClass = "text-blue-600 dark:text-blue-400 font-semibold";
        }

        return (
          <div key={idx} className={cn("px-2 -mx-2", colorClass)}>
            {line || ' '}
          </div>
        );
      })}
    </>
  );
}
