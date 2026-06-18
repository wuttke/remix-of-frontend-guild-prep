import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  Circle,
  FileText,
  FolderGit2,
  GitBranch,
  GitFork,
  MessageSquare,
  Plus,
  Trash2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { NewConversationDialog } from "@/components/pdg/NewConversationDialog";
import { pdg } from "@/lib/pdg/client";
import type { GitStatus, Repo, WorktreeInfo } from "@/lib/pdg/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/repos")({
  head: () => ({
    meta: [
      { title: "Repositories · Pocket Dev Guild" },
      {
        name: "description",
        content: "Browse repositories and their git worktrees.",
      },
    ],
  }),
  component: ReposPage,
});

function ReposPage() {
  const reposQuery = useQuery({ queryKey: ["repos"], queryFn: () => pdg.listRepos() });
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold">Repositories</h1>
          <p className="text-sm text-muted-foreground">Tap a repo to manage its worktrees.</p>
        </div>
        <div className="flex gap-2">
          <CreateRepoDialog />
          <CloneRepoDialog />
        </div>
      </header>

      {reposQuery.isLoading ? (
        <SkeletonList count={3} />
      ) : (
        <ul className="space-y-3">
          {reposQuery.data?.map((repo) => (
            <RepoCard
              key={repo.id}
              repo={repo}
              expanded={expanded === repo.id}
              onToggle={() => setExpanded((cur) => (cur === repo.id ? null : repo.id))}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function RepoCard({
  repo,
  expanded,
  onToggle,
}: {
  repo: Repo;
  expanded: boolean;
  onToggle: () => void;
}) {
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);

  const wtQuery = useQuery({
    queryKey: ["worktrees", repo.id],
    queryFn: () => pdg.listWorktrees(repo.id),
    enabled: expanded,
  });

  const statusQuery = useQuery({
    queryKey: ["repo-status", repo.id],
    queryFn: () => pdg.getRepoStatus(repo.id),
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  return (
    <li className="overflow-hidden rounded-xl border border-border/60 bg-card">
      <div className="flex w-full items-center justify-between gap-3 px-4 py-3">
        <button
          onClick={onToggle}
          className="flex min-w-0 flex-1 items-center gap-3 text-left transition-colors hover:opacity-70"
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-muted/60 text-muted-foreground">
            <FolderGit2 className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="font-medium">{repo.name}</div>
            <div className="truncate font-mono text-[11px] text-muted-foreground">{repo.path}</div>
          </div>
          {statusQuery.data?.summary.total_worktrees != null && (
            <span className="shrink-0 rounded-md bg-muted/60 px-2 py-0.5 text-xs font-medium text-muted-foreground">
              {statusQuery.data.summary.total_worktrees} worktree
              {statusQuery.data.summary.total_worktrees !== 1 ? "s" : ""}
            </span>
          )}
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
              expanded && "rotate-180",
            )}
          />
        </button>
        <div className="flex items-center gap-2">
          <RepoStatusIndicator status={statusQuery.data} onClick={() => setStatusDialogOpen(true)} />
          <DeleteRepoButton repo={repo} />
        </div>
      </div>

      <RepoStatusDialog
        open={statusDialogOpen}
        onOpenChange={setStatusDialogOpen}
        repo={repo}
        status={statusQuery.data}
      />

      {expanded ? (
        <div className="border-t border-border/60 bg-background/40 px-3 py-3">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Worktrees {wtQuery.data ? `(${wtQuery.data.length})` : ""}
            </h3>
            <CreateWorktreeDialog repoId={repo.id} />
          </div>
          {wtQuery.isLoading ? (
            <SkeletonList count={2} />
          ) : (
            <ul className="space-y-2">
              {wtQuery.data?.map((w) => (
                <WorktreeRow key={w.name ?? "__primary"} repoId={repo.id} worktree={w} />
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </li>
  );
}

function WorktreeRow({ repoId, worktree }: { repoId: string; worktree: WorktreeInfo }) {
  const qc = useQueryClient();
  const [archiveConversations, setArchiveConversations] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [forceDelete, setForceDelete] = useState(false);

  // Get repo status to find this worktree's status
  const repoStatusQuery = useQuery({
    queryKey: ["repo-status", repoId],
    queryFn: () => pdg.getRepoStatus(repoId),
  });

  const statusQuery = useQuery({
    queryKey: ["worktree-status", repoId, worktree.name],
    queryFn: () => pdg.getWorktreeStatus(repoId, worktree.name!),
    enabled: dialogOpen && worktree.name != null,
  });

  const conversationsQuery = useQuery({
    queryKey: ["conversations", { repo_id: repoId, worktree: worktree.name }],
    queryFn: () => pdg.listConversations({ repo_id: repoId, worktree: worktree.name ?? undefined }),
    enabled: dialogOpen && worktree.name != null,
  });

  const deleteMutation = useMutation({
    mutationFn: () =>
      pdg.deleteWorktree(
        repoId,
        worktree.name!,
        archiveConversations ? { archive_conversations: true } : undefined,
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["worktrees", repoId] });
      qc.invalidateQueries({ queryKey: ["repo-status", repoId] });
      toast.success(`Removed ${worktree.name}`);
      setArchiveConversations(false); // Reset for next use
      setDialogOpen(false);
      setForceDelete(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const worktreeName = worktree.name ?? null;

  // Find this worktree's status from the repo status
  const worktreeStatus = worktree.is_primary
    ? repoStatusQuery.data?.primary
    : repoStatusQuery.data?.worktrees.find((w) => w.name === worktree.name);

  return (
    <li className="flex items-center justify-between rounded-lg border border-border/40 bg-card/60 px-3 py-2">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <GitBranch className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="truncate text-sm font-medium">{worktree.branch ?? "(detached)"}</span>
          {worktree.is_primary ? (
            <span className="rounded-full border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
              primary
            </span>
          ) : null}
          {worktreeStatus && !worktreeStatus.is_clean ? (
            <span className="rounded-full border border-[color:var(--status-failed)]/30 bg-[color:var(--status-failed)]/10 px-1.5 py-0.5 text-[10px] font-medium text-[color:var(--status-failed)]">
              changes
            </span>
          ) : null}
        </div>
        <div className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground">
          {worktree.head?.slice(0, 12)} · {worktree.name ?? "—"}
        </div>
      </div>
      <div className="flex items-center gap-1">
        <NewConversationDialog
          defaultRepoId={repoId}
          defaultWorktree={worktreeName ?? "__none"}
          variant="ghost"
          size="icon"
          trigger={
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-primary"
              aria-label={`Start conversation in ${worktree.branch ?? "primary"}`}
            >
              <MessageSquare className="h-4 w-4" />
            </Button>
          }
        />
        {!worktree.is_primary && worktree.name ? (
          <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-[color:var(--status-failed)]"
                disabled={deleteMutation.isPending}
                aria-label={`Remove worktree ${worktree.name}`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Remove worktree?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will delete the worktree <span className="font-mono">{worktree.name}</span>{" "}
                  (branch <span className="font-mono">{worktree.branch}</span>).
                </AlertDialogDescription>
              </AlertDialogHeader>

              {statusQuery.isLoading ? (
                <div className="py-4 text-sm text-muted-foreground">
                  Checking worktree status...
                </div>
              ) : statusQuery.data && !statusQuery.data.is_clean && !forceDelete ? (
                <div className="space-y-3 py-4">
                  <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
                    <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber-600 dark:text-amber-500">
                      <span className="text-lg">⚠️</span>
                      Worktree has unsaved changes
                    </div>
                    <ul className="ml-7 space-y-1 text-sm text-amber-700 dark:text-amber-400">
                      {statusQuery.data.messages.map((msg, i) => (
                        <li key={i}>• {msg}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : statusQuery.data?.is_clean ? (
                <div className="py-2 text-sm text-muted-foreground">
                  ✓ Worktree is clean (no uncommitted changes, untracked files, or unpushed commits)
                </div>
              ) : null}

              <div className="flex items-center space-x-2 py-2">
                <Checkbox
                  id="archive-conversations"
                  checked={archiveConversations}
                  onCheckedChange={(checked) => setArchiveConversations(checked === true)}
                  disabled={conversationsQuery.data?.total === 0}
                />
                <Label
                  htmlFor="archive-conversations"
                  className={cn(
                    "text-sm font-normal cursor-pointer",
                    conversationsQuery.data?.total === 0 && "text-muted-foreground",
                  )}
                >
                  Archive conversations with this worktree
                  {conversationsQuery.data && conversationsQuery.data.total > 0
                    ? ` (${conversationsQuery.data.total} open)`
                    : conversationsQuery.data?.total === 0
                      ? " (0 open)"
                      : ""}
                </Label>
              </div>

              <AlertDialogFooter>
                <AlertDialogCancel
                  onClick={() => {
                    setArchiveConversations(false);
                    setForceDelete(false);
                  }}
                >
                  Cancel
                </AlertDialogCancel>
                {statusQuery.data && !statusQuery.data.is_clean && !forceDelete ? (
                  <AlertDialogAction
                    onClick={() => setForceDelete(true)}
                    className="bg-amber-600 text-white hover:bg-amber-700"
                  >
                    Delete Anyway
                  </AlertDialogAction>
                ) : (
                  <AlertDialogAction
                    onClick={() => deleteMutation.mutate()}
                    disabled={statusQuery.isLoading || deleteMutation.isPending}
                    className="bg-[color:var(--status-failed)] text-white hover:bg-[color:var(--status-failed)]/90"
                  >
                    {deleteMutation.isPending ? "Removing..." : "Remove"}
                  </AlertDialogAction>
                )}
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : null}
      </div>
    </li>
  );
}

function CreateWorktreeDialog({ repoId }: { repoId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [branch, setBranch] = useState("");
  const [existing, setExisting] = useState(false);

  const create = useMutation({
    mutationFn: () => pdg.createWorktree(repoId, { branch }, { existing }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["worktrees", repoId] });
      toast.success(`Created ${data.name}`);
      setOpen(false);
      setBranch("");
      setExisting(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const valid = /^[A-Za-z]+(\/[A-Za-z0-9.-]+)+$/.test(branch);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="secondary" className="h-8 gap-1.5">
          <Plus className="h-3.5 w-3.5" /> New
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create worktree</DialogTitle>
          <DialogDescription>
            Pattern: <span className="font-mono">type/name</span> — e.g.{" "}
            <span className="font-mono">feature/auth</span>.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="branch">Branch</Label>
            <Input
              id="branch"
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              placeholder="feature/new-thing"
              autoComplete="off"
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border/60 bg-card/60 px-3 py-2">
            <div>
              <Label htmlFor="existing" className="font-medium">
                Check out existing branch
              </Label>
              <p className="text-xs text-muted-foreground">
                Otherwise a new branch is created from origin.
              </p>
            </div>
            <Switch id="existing" checked={existing} onCheckedChange={setExisting} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={() => create.mutate()} disabled={!valid || create.isPending}>
            {create.isPending ? "Creating…" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CreateRepoDialog() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [id, setId] = useState("");
  const [name, setName] = useState("");
  const [path, setPath] = useState("");

  const create = useMutation({
    mutationFn: () => pdg.createRepo({ id, name, path }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["repos"] });
      toast.success(`Registered ${data.name}`);
      setOpen(false);
      setId("");
      setName("");
      setPath("");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const idValid = /^[A-Za-z0-9_-]+$/.test(id);
  const canSubmit = idValid && name.trim() && path.trim();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="secondary" className="gap-1.5">
          <Plus className="h-3.5 w-3.5" /> Register
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Register existing repository</DialogTitle>
          <DialogDescription>
            Register a repository that already exists on disk. The path must be a valid git
            repository.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="repo-id">ID</Label>
            <Input
              id="repo-id"
              value={id}
              onChange={(e) => setId(e.target.value)}
              placeholder="my-project"
              autoComplete="off"
            />
            <p className="text-xs text-muted-foreground">
              Letters, numbers, hyphens, and underscores only
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="repo-name">Name</Label>
            <Input
              id="repo-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Project"
              autoComplete="off"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="repo-path">Path</Label>
            <Input
              id="repo-path"
              value={path}
              onChange={(e) => setPath(e.target.value)}
              placeholder="/home/user/repos/my-project"
              autoComplete="off"
            />
            <p className="text-xs text-muted-foreground">
              Absolute path to the git repository on disk
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={() => create.mutate()} disabled={!canSubmit || create.isPending}>
            {create.isPending ? "Registering…" : "Register"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CloneRepoDialog() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [parentPath, setParentPath] = useState("");
  const [id, setId] = useState("");
  const [name, setName] = useState("");

  const clone = useMutation({
    mutationFn: () =>
      pdg.cloneRepo({ url, parent_path: parentPath, id: id || undefined, name: name || undefined }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["repos"] });
      toast.success(`Cloned ${data.name}`);
      setOpen(false);
      setUrl("");
      setParentPath("");
      setId("");
      setName("");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const idValid = !id || /^[A-Za-z0-9_-]+$/.test(id);
  const canSubmit = url.trim() && parentPath.trim() && idValid;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="secondary" className="gap-1.5">
          <GitFork className="h-3.5 w-3.5" /> Clone
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Clone repository</DialogTitle>
          <DialogDescription>
            Clone a repository from a URL. The ID and name will be derived from the URL if not
            specified.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="clone-url">Repository URL</Label>
            <Input
              id="clone-url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://github.com/user/repo.git"
              autoComplete="off"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="clone-parent-path">Parent Directory</Label>
            <Input
              id="clone-parent-path"
              value={parentPath}
              onChange={(e) => setParentPath(e.target.value)}
              placeholder="/home/user/repos"
              autoComplete="off"
            />
            <p className="text-xs text-muted-foreground">
              Repository will be cloned into a subdirectory here
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="clone-id">ID (optional)</Label>
            <Input
              id="clone-id"
              value={id}
              onChange={(e) => setId(e.target.value)}
              placeholder="Auto-derived from URL"
              autoComplete="off"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="clone-name">Name (optional)</Label>
            <Input
              id="clone-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Auto-derived from URL"
              autoComplete="off"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={() => clone.mutate()} disabled={!canSubmit || clone.isPending}>
            {clone.isPending ? "Cloning…" : "Clone"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteRepoButton({ repo }: { repo: Repo }) {
  const qc = useQueryClient();

  const deleteRepo = useMutation({
    mutationFn: () => pdg.deleteRepo(repo.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["repos"] });
      toast.success(`Deactivated ${repo.name}`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          size="sm"
          variant="ghost"
          className="h-8 w-8 shrink-0 p-0 text-muted-foreground hover:text-destructive"
          onClick={(e) => e.stopPropagation()}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent onClick={(e) => e.stopPropagation()}>
        <AlertDialogHeader>
          <AlertDialogTitle>Deactivate repository?</AlertDialogTitle>
          <AlertDialogDescription>
            This will deactivate <span className="font-semibold">{repo.name}</span> and hide it from
            listings. The repository files on disk will NOT be deleted. This action can be reversed
            by re-registering the repository.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => deleteRepo.mutate()}
            disabled={deleteRepo.isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {deleteRepo.isPending ? "Deactivating…" : "Deactivate"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function RepoStatusIndicator({
  status,
  onClick,
}: {
  status?: import("@/lib/pdg/types").MultiWorktreeStatus;
  onClick: () => void;
}) {
  if (!status) {
    return (
      <button
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        className="grid h-8 w-8 shrink-0 place-items-center rounded-lg transition-colors hover:bg-muted/60"
        title="Loading status..."
      >
        <Circle className="h-4 w-4 animate-pulse text-muted-foreground" />
      </button>
    );
  }

  const isClean = status.summary.all_clean;
  const Icon = isClean ? CheckCircle2 : XCircle;
  const colorClass = isClean
    ? "text-[color:var(--status-finished)] hover:bg-[color:var(--status-finished)]/10"
    : "text-[color:var(--status-failed)] hover:bg-[color:var(--status-failed)]/10";

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        "grid h-8 w-8 shrink-0 place-items-center rounded-lg transition-colors",
        colorClass,
      )}
      title={
        isClean
          ? "All worktrees clean"
          : `${status.summary.dirty_count} of ${status.summary.total_worktrees} worktree(s) have changes`
      }
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

function RepoStatusDialog({
  open,
  onOpenChange,
  repo,
  status,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  repo: Repo;
  status?: import("@/lib/pdg/types").MultiWorktreeStatus;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onClick={(e) => e.stopPropagation()} className="max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Repository Status: {repo.name}</DialogTitle>
          <DialogDescription>
            {status?.summary.all_clean
              ? "All worktrees are clean with no uncommitted changes or unpushed commits."
              : `${status?.summary.dirty_count ?? 0} of ${status?.summary.total_worktrees ?? 0} worktree(s) have changes.`}
          </DialogDescription>
        </DialogHeader>

        {status ? (
          <div className="space-y-3 overflow-y-auto flex-1 px-1">
            {/* Primary worktree */}
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Primary Repository
              </h3>
              <WorktreeStatusItem repoId={repo.id} item={status.primary} />
            </div>

            {/* Additional worktrees */}
            {status.worktrees.length > 0 ? (
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Worktrees ({status.worktrees.length})
                </h3>
                <div className="space-y-2">
                  {status.worktrees.map((wt) => (
                    <WorktreeStatusItem key={wt.name} repoId={repo.id} item={wt} />
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="py-8 text-center text-sm text-muted-foreground">Loading status...</div>
        )}

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function WorktreeStatusItem({ repoId, item }: { repoId: string; item: import("@/lib/pdg/types").WorktreeStatusItem }) {
  const [fileDialogOpen, setFileDialogOpen] = useState(false);
  const Icon = item.is_clean ? CheckCircle2 : XCircle;
  const colorClass = item.is_clean
    ? "text-[color:var(--status-finished)]"
    : "text-[color:var(--status-failed)]";

  return (
    <>
      <div className="rounded-lg border border-border/60 bg-card/60 p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <GitBranch className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate text-sm font-medium">
                {item.branch ?? "(no branch)"}
                {item.is_primary ? (
                  <span className="ml-2 rounded-full border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                    primary
                  </span>
                ) : null}
              </span>
            </div>
            <div className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground">
              {item.name ?? item.path}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {!item.is_clean ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  setFileDialogOpen(true);
                }}
                className="h-7 px-2 text-xs"
                title="View changed files"
              >
                <FileText className="h-3.5 w-3.5 mr-1" />
                Files
              </Button>
            ) : null}
            <Icon className={cn("h-5 w-5", colorClass)} />
          </div>
        </div>

        {!item.is_clean && item.messages.length > 0 ? (
          <div className="mt-2 space-y-1 border-t border-border/40 pt-2">
            {item.messages.map((msg, idx) => (
              <div key={idx} className="text-xs text-muted-foreground">
                • {msg}
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <FileStatusDialog
        open={fileDialogOpen}
        onOpenChange={setFileDialogOpen}
        repoId={repoId}
        worktreeName={item.name}
        isPrimary={item.is_primary}
      />
    </>
  );
}

function FileStatusDialog({
  open,
  onOpenChange,
  repoId,
  worktreeName,
  isPrimary,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  repoId: string;
  worktreeName: string | null;
  isPrimary: boolean;
}) {
  const gitStatusQuery = useQuery({
    queryKey: ["git-status", repoId, worktreeName],
    queryFn: () =>
      isPrimary
        ? pdg.getRepoGitStatus(repoId)
        : pdg.getWorktreeGitStatus(repoId, worktreeName!),
    enabled: open && (!isPrimary ? worktreeName != null : true),
  });

  const gitStatus = gitStatusQuery.data;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onClick={(e) => e.stopPropagation()} className="max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            Changed Files: {isPrimary ? "Primary Repository" : worktreeName}
          </DialogTitle>
          <DialogDescription>
            {gitStatus
              ? `${gitStatus.summary.total} file(s) with changes`
              : "Loading file details..."}
          </DialogDescription>
        </DialogHeader>

        {gitStatus ? (
          <div className="space-y-3 overflow-y-auto flex-1 px-1">
            {gitStatus.summary.staged > 0 ? (
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Staged Changes ({gitStatus.summary.staged})
                </h3>
                <div className="space-y-1">
                  {gitStatus.files
                    .filter((f) => f.staged)
                    .map((file, idx) => (
                      <div
                        key={idx}
                        className="rounded border border-border/40 bg-card/40 px-2 py-1.5 font-mono text-xs"
                      >
                        <span className="text-[color:var(--status-finished)] mr-2">{file.x}</span>
                        <span className="text-muted-foreground">{file.path}</span>
                      </div>
                    ))}
                </div>
              </div>
            ) : null}

            {gitStatus.summary.unstaged > 0 ? (
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Unstaged Changes ({gitStatus.summary.unstaged})
                </h3>
                <div className="space-y-1">
                  {gitStatus.files
                    .filter((f) => !f.staged && f.status !== "untracked")
                    .map((file, idx) => (
                      <div
                        key={idx}
                        className="rounded border border-border/40 bg-card/40 px-2 py-1.5 font-mono text-xs"
                      >
                        <span className="text-[color:var(--status-failed)] mr-2">{file.y}</span>
                        <span className="text-muted-foreground">{file.path}</span>
                      </div>
                    ))}
                </div>
              </div>
            ) : null}

            {gitStatus.summary.untracked > 0 ? (
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Untracked Files ({gitStatus.summary.untracked})
                </h3>
                <div className="space-y-1">
                  {gitStatus.files
                    .filter((f) => f.status === "untracked")
                    .map((file, idx) => (
                      <div
                        key={idx}
                        className="rounded border border-border/40 bg-card/40 px-2 py-1.5 font-mono text-xs"
                      >
                        <span className="text-muted-foreground mr-2">??</span>
                        <span className="text-muted-foreground">{file.path}</span>
                      </div>
                    ))}
                </div>
              </div>
            ) : null}

            {gitStatus.summary.total === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                No changes detected
              </div>
            ) : null}
          </div>
        ) : (
          <div className="py-8 text-center text-sm text-muted-foreground">Loading file details...</div>
        )}

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SkeletonList({ count }: { count: number }) {
  return (
    <ul className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <li key={i} className="h-16 animate-pulse rounded-xl border border-border/40 bg-card/40" />
      ))}
    </ul>
  );
}
