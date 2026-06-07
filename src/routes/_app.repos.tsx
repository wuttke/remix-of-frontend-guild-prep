import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  ChevronDown,
  FolderGit2,
  GitBranch,
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
          <p className="text-sm text-muted-foreground">
            Tap a repo to manage its worktrees.
          </p>
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
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/30"
      >
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-muted/60 text-muted-foreground">
            <FolderGit2 className="h-4 w-4" />
          </span>
          <div>
            <div className="font-medium">{repo.name}</div>
            <div className="font-mono text-[11px] text-muted-foreground">{repo.path}</div>
          </div>
        </div>
        <ChevronDown
          className={cn("h-4 w-4 text-muted-foreground transition-transform", expanded && "rotate-180")}
        />
      </button>

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
  const deleteMutation = useMutation({
    mutationFn: () => pdg.deleteWorktree(repoId, worktree.name!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["worktrees", repoId] });
      toast.success(`Removed ${worktree.name}`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

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
      {!worktree.is_primary && worktree.name ? (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-[color:var(--status-failed)]"
          onClick={() => deleteMutation.mutate()}
          disabled={deleteMutation.isPending}
          aria-label={`Remove worktree ${worktree.name}`}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      ) : null}
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
            Pattern: <span className="font-mono">type/name</span> — e.g. <span className="font-mono">feature/auth</span>.
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
          <Button
            onClick={() => create.mutate()}
            disabled={!valid || create.isPending}
          >
            {create.isPending ? "Creating…" : "Create"}
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
        <li
          key={i}
          className="h-16 animate-pulse rounded-xl border border-border/40 bg-card/40"
        />
      ))}
    </ul>
  );
}
