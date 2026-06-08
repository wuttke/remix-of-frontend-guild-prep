import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useEffect } from "react";
import { formatDistanceToNow } from "date-fns";
import { MessageSquare } from "lucide-react";
import { EmptyState } from "@/components/pdg/EmptyState";
import { NewConversationDialog } from "@/components/pdg/NewConversationDialog";
import { StatusBadge } from "@/components/pdg/StatusBadge";
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

  // Check if there are any non-terminal jobs in the conversation list
  const hasNonTerminalJobs = useMemo(() => {
    return (conv.data?.items ?? []).some((c) => {
      const status = c.last_turn_status;
      return status === "queued" || status === "running";
    });
  }, [conv.data]);

  // Poll every 5 seconds if there are non-terminal jobs
  useEffect(() => {
    if (!hasNonTerminalJobs) return;

    const interval = setInterval(() => {
      conv.refetch();
    }, 5000);

    return () => clearInterval(interval);
  }, [hasNonTerminalJobs, conv]);

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
            <li
              key={i}
              className="h-20 animate-pulse rounded-xl border border-border/40 bg-card/40"
            />
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
            <div className="flex items-center gap-2">
              <div className="truncate font-medium">{conversation.title ?? "Untitled"}</div>
              {conversation.last_turn_status ? (
                <StatusBadge status={conversation.last_turn_status} />
              ) : null}
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
