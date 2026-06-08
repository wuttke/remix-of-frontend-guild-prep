import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  ChevronDown,
  FolderGit2,
  GitBranch,
  GitFork,
  MessageSquare,
  Plus,
  Trash2,
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
import type { Repo, WorktreeInfo } from "@/lib/pdg/types";
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
  const wtQuery = useQuery({
    queryKey: ["worktrees", repo.id],
    queryFn: () => pdg.listWorktrees(repo.id),
    enabled: expanded,
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
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
              expanded && "rotate-180",
            )}
          />
        </button>
        <DeleteRepoButton repo={repo} />
      </div>

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

  const statusQuery = useQuery({
    queryKey: ["worktree-status", repoId, worktree.name],
    queryFn: () => pdg.getWorktreeStatus(repoId, worktree.name!),
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
      toast.success(`Removed ${worktree.name}`);
      setArchiveConversations(false); // Reset for next use
      setDialogOpen(false);
      setForceDelete(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const worktreeName = worktree.name ?? null;

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
                />
                <Label
                  htmlFor="archive-conversations"
                  className="text-sm font-normal cursor-pointer"
                >
                  Archive conversations with this worktree
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

function SkeletonList({ count }: { count: number }) {
  return (
    <ul className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <li key={i} className="h-16 animate-pulse rounded-xl border border-border/40 bg-card/40" />
      ))}
    </ul>
  );
}
