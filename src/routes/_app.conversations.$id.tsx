import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Archive, ArrowLeft, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/pdg/StatusBadge";
import { pdg } from "@/lib/pdg/client";

export const Route = createFileRoute("/_app/conversations/$id")({
  head: ({ params }) => ({
    meta: [
      { title: `Conversation ${params.id} · Pocket Dev Guild` },
      {
        name: "description",
        content: "View turns, summary, and live status of an agent conversation.",
      },
    ],
  }),
  component: ConversationDetail,
});

function ConversationDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [prompt, setPrompt] = useState("");

  const conv = useQuery({
    queryKey: ["conversation", id],
    queryFn: () => pdg.getConversation(id),
  });

  const turns = useQuery({
    queryKey: ["jobs", { conversation_id: id }],
    queryFn: () => pdg.listJobs({ conversation_id: id, limit: 100 }),
  });

  const sendTurn = useMutation({
    mutationFn: () => pdg.createConversationTurn(id, { prompt }),
    onSuccess: () => {
      setPrompt("");
      qc.invalidateQueries({ queryKey: ["conversation", id] });
      qc.invalidateQueries({ queryKey: ["jobs", { conversation_id: id }] });
      qc.invalidateQueries({ queryKey: ["jobs"] });
      toast.success("Turn sent");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const archive = useMutation({
    mutationFn: () => pdg.archiveConversation(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["conversations"] });
      qc.invalidateQueries({ queryKey: ["conversation", id] });
      toast.success("Conversation archived");
      navigate({ to: "/conversations" });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (conv.isLoading || !conv.data) {
    return <div className="h-24 animate-pulse rounded-xl bg-card/40" />;
  }
  const c = conv.data;
  const orderedTurns = [...(turns.data?.items ?? [])].sort((a, b) =>
    a.created_at < b.created_at ? -1 : 1,
  );
  const hasRunningTurn = orderedTurns.some(
    (j) => j.status === "queued" || j.status === "running",
  );

  return (
    <div className="space-y-4">
      <Link
        to="/conversations"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> All conversations
      </Link>

      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
        <h1 className="font-display text-2xl font-semibold">
          {c.title ?? "Untitled"}
          {c.archived ? (
            <span className="ml-2 align-middle text-xs font-normal text-muted-foreground">
              (archived)
            </span>
          ) : null}
        </h1>
        <div className="mt-1 text-xs text-muted-foreground">
          <span className="font-mono">{c.repo_id}</span>
          {c.worktree ? (
            <>
              {" · "}
              <span className="font-mono">{c.worktree}</span>
            </>
          ) : null}
          {" · updated "}
          {formatDistanceToNow(new Date(c.updated_at), { addSuffix: true })}
        </div>
        </div>
        {!c.archived ? (
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            disabled={hasRunningTurn || archive.isPending}
            title={hasRunningTurn ? "Wait for running turns to finish" : "Archive conversation"}
            onClick={() => archive.mutate()}
          >
            <Archive className="h-4 w-4" />
            {archive.isPending ? "Archiving…" : "Archive"}
          </Button>
        ) : null}
      </header>

      {c.summary ? (
        <section className="rounded-xl border border-border/60 bg-card p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Summary
          </h2>
          <p className="mt-1.5 text-sm leading-relaxed">{c.summary}</p>
        </section>
      ) : null}

      <section className="space-y-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Turns ({orderedTurns.length})
        </h2>
        <ul className="space-y-2">
          {orderedTurns.map((job, idx) => (
            <li key={job.id}>
              <Link
                to="/jobs/$id"
                params={{ id: job.id }}
                className="block rounded-xl border border-border/60 bg-card px-4 py-3 transition-colors hover:bg-muted/30"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[11px] text-muted-foreground">
                        #{idx + 1}
                      </span>
                      <StatusBadge status={job.status} />
                    </div>
                    <p className="mt-1.5 line-clamp-2 text-sm">{job.prompt}</p>
                    <div className="mt-1 text-[11px] text-muted-foreground">
                      {formatDistanceToNow(new Date(job.created_at), { addSuffix: true })}
                    </div>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl border border-border/60 bg-card p-3">
        <Textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={orderedTurns.length === 0 ? "What do you want to do today?" : "Send another turn to the agent…"}
          rows={3}
          className="resize-none border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
        />
        <div className="flex justify-end">
          <Button
            size="sm"
            className="gap-1.5"
            disabled={!prompt.trim() || sendTurn.isPending || hasRunningTurn}
            onClick={() => sendTurn.mutate()}
          >
            <Send className="h-4 w-4" />
            {sendTurn.isPending
              ? "Sending…"
              : hasRunningTurn
                ? "Turn in progress…"
                : "Send"}
          </Button>
        </div>
      </section>
    </div>
  );
}