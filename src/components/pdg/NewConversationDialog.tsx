import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Plus } from "lucide-react";
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
import { pdg } from "@/lib/pdg/client";
import { formatBranchTitle } from "@/lib/utils";

interface NewConversationDialogProps {
  /** Pre-selected repo id (optional) */
  defaultRepoId?: string;
  /** Pre-selected worktree name (optional). "__none" means primary checkout. */
  defaultWorktree?: string;
  /** Button size variant */
  size?: "default" | "sm" | "lg" | "icon";
  /** Button variant */
  variant?: "default" | "secondary" | "outline" | "ghost" | "link";
  /** Optional custom trigger element instead of the default button */
  trigger?: React.ReactNode;
  /** Callback when dialog closes after successful creation */
  onCreated?: () => void;
}

export function NewConversationDialog({
  defaultRepoId = "",
  defaultWorktree = "__none",
  size = "sm",
  variant = "secondary",
  trigger,
  onCreated,
}: NewConversationDialogProps) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [repoId, setRepoId] = useState<string>(defaultRepoId);
  const [worktree, setWorktree] = useState<string>(defaultWorktree);
  const [title, setTitle] = useState("");

  const repos = useQuery({ queryKey: ["repos"], queryFn: () => pdg.listRepos() });
  const worktrees = useQuery({
    queryKey: ["worktrees", repoId],
    queryFn: () => pdg.listWorktrees(repoId),
    enabled: !!repoId,
  });

  const create = useMutation({
    mutationFn: () => {
      // If no title provided, try to generate one from the branch name
      let conversationTitle = title || null;
      if (!conversationTitle && worktree !== "__none") {
        // Find the selected worktree to get its branch name
        const selectedWorktree = worktrees.data?.find((w) => w.name === worktree);
        if (selectedWorktree?.branch) {
          conversationTitle = formatBranchTitle(selectedWorktree.branch);
        }
      }

      return pdg.createConversation({
        repo_id: repoId,
        worktree: worktree === "__none" ? null : worktree,
        agent_id: null,
        title: conversationTitle,
      });
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["conversations"] });
      toast.success("Conversation created");
      setOpen(false);
      setTitle("");
      if (!defaultRepoId) setRepoId("");
      if (!defaultWorktree) setWorktree("__none");
      onCreated?.();
      navigate({ to: "/conversations/$id", params: { id: data.id } });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger ? (
        <DialogTrigger asChild>{trigger}</DialogTrigger>
      ) : (
        <DialogTrigger asChild>
          <Button size={size} variant={variant} className="gap-1.5">
            <Plus className="h-4 w-4" /> New
          </Button>
        </DialogTrigger>
      )}
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
