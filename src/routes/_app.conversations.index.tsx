import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { MessageSquare, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/pdg/EmptyState";
import { pdg } from "@/lib/pdg/client";
import type { ConversationInfo } from "@/lib/pdg/types";

export const Route = createFileRoute("/_app/conversations/")({
  head: () => ({
    meta: [
      { title: "Conversations · Pocket Dev Guild" },
      {
        name: "description",
        content: "Multi-turn agent conversations across your repositories.",
      },
    ],
  }),
  component: ConversationsPage,
});

function ConversationsPage() {
  const conv = useQuery({
    queryKey: ["conversations"],
    queryFn: () => pdg.listConversations(),
  });

  const grouped = useMemo(() => {
    const map = new Map<string, ConversationInfo[]>();
    for (const c of conv.data?.items ?? []) {
      const list = map.get(c.repo_id) ?? [];
      list.push(c);
      map.set(c.repo_id, list);
    }
    return Array.from(map.entries());
  }, [conv.data]);

  return (
    <div className="space-y-4">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold">Conversations</h1>
          <p className="text-sm text-muted-foreground">
            Resume an agent session or start a new one.
          </p>
        </div>
        <NewConversationDialog />
      </header>

      {conv.isLoading ? (
        <ul className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <li key={i} className="h-20 animate-pulse rounded-xl border border-border/40 bg-card/40" />
          ))}
        </ul>
      ) : grouped.length === 0 ? (
        <EmptyState
          icon={<MessageSquare className="h-8 w-8" />}
          title="No conversations yet"
          description="Start one to give the agent a fresh context window."
        />
      ) : (
        <div className="space-y-5">
          {grouped.map(([repoId, items]) => (
            <section key={repoId} className="space-y-2">
              <h2 className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                {repoId}
              </h2>
              <ul className="space-y-2">
                {items.map((c) => (
                  <ConversationRow key={c.id} conversation={c} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function ConversationRow({ conversation }: { conversation: ConversationInfo }) {
  return (
    <li>
      <Link
        to="/conversations/$id"
        params={{ id: conversation.id }}
        className="block rounded-xl border border-border/60 bg-card px-4 py-3 transition-colors hover:bg-muted/30"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate font-medium">
              {conversation.title ?? "Untitled"}
            </div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              {conversation.turns.length} turn{conversation.turns.length === 1 ? "" : "s"}
              {" · "}
              {formatDistanceToNow(new Date(conversation.updated_at), { addSuffix: true })}
              {conversation.worktree ? (
                <>
                  {" · "}
                  <span className="font-mono">{conversation.worktree}</span>
                </>
              ) : null}
            </div>
            {conversation.summary ? (
              <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">
                {conversation.summary}
              </p>
            ) : null}
          </div>
        </div>
      </Link>
    </li>
  );
}

function NewConversationDialog() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [repoId, setRepoId] = useState<string>("");
  const [worktree, setWorktree] = useState<string>("__none");
  const [title, setTitle] = useState("");

  const repos = useQuery({ queryKey: ["repos"], queryFn: () => pdg.listRepos() });
  const worktrees = useQuery({
    queryKey: ["worktrees", repoId],
    queryFn: () => pdg.listWorktrees(repoId),
    enabled: !!repoId,
  });

  const create = useMutation({
    mutationFn: () =>
      pdg.createConversation({
        repo_id: repoId,
        worktree: worktree === "__none" ? null : worktree,
        agent_id: null,
        title: title || null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["conversations"] });
      toast.success("Conversation created");
      setOpen(false);
      setTitle("");
      setRepoId("");
      setWorktree("__none");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" /> New
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New conversation</DialogTitle>
          <DialogDescription>
            Pick a repo and (optionally) a worktree for the agent context.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Repository</Label>
            <Select value={repoId} onValueChange={setRepoId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a repo" />
              </SelectTrigger>
              <SelectContent>
                {repos.data?.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Worktree</Label>
            <Select value={worktree} onValueChange={setWorktree} disabled={!repoId}>
              <SelectTrigger>
                <SelectValue placeholder="Primary checkout" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">Primary checkout</SelectItem>
                {worktrees.data
                  ?.filter((w) => w.name)
                  .map((w) => (
                    <SelectItem key={w.name!} value={w.name!}>
                      {w.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="title">Title (optional)</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Add OAuth login"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={() => create.mutate()} disabled={!repoId || create.isPending}>
            {create.isPending ? "Creating…" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}