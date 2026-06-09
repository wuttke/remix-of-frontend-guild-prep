import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { formatDistanceToNow } from "date-fns";
import { Archive, ArrowLeft } from "lucide-react";
import { EmptyState } from "@/components/pdg/EmptyState";
import { StatusBadge } from "@/components/pdg/StatusBadge";
import { pdg } from "@/lib/pdg/client";
import type { ConversationInfo } from "@/lib/pdg/types";

export const Route = createFileRoute("/_app/conversations/archived")({
  head: () => ({
    meta: [
      { title: "Archived Conversations · Pocket Dev Guild" },
      {
        name: "description",
        content: "View archived agent conversations.",
      },
    ],
  }),
  component: ArchivedConversationsPage,
});

function ArchivedConversationsPage() {
  const conv = useQuery({
    queryKey: ["conversations", { archived: true }],
    queryFn: () => pdg.listConversations({ include_archived: true }),
  });

  const archivedConversations = useMemo(() => {
    return (conv.data?.items ?? []).filter((c) => c.archived);
  }, [conv.data]);

  const grouped = useMemo(() => {
    const map = new Map<string, ConversationInfo[]>();
    for (const c of archivedConversations) {
      const list = map.get(c.repo_id) ?? [];
      list.push(c);
      map.set(c.repo_id, list);
    }
    return Array.from(map.entries());
  }, [archivedConversations]);

  return (
    <div className="space-y-4">
      <Link
        to="/conversations"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> All conversations
      </Link>

      <header className="flex items-end justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold">Archived Conversations</h1>
          <p className="text-sm text-muted-foreground">
            Read-only view of completed conversations.
          </p>
        </div>
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
          icon={<Archive className="h-8 w-8" />}
          title="No archived conversations"
          description="Archived conversations will appear here."
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
        search={{ from: "archived" }}
        className="block rounded-xl border border-border/60 bg-card px-4 py-3 transition-colors hover:bg-muted/30"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className="truncate font-medium">{conversation.title ?? "Untitled"}</div>
              <span className="rounded-full border border-border/80 bg-muted/60 px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                archived
              </span>
            </div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              {conversation.turns.length} turn{conversation.turns.length === 1 ? "" : "s"}
              {" · "}
              {formatDistanceToNow(new Date(conversation.updated_at), { addSuffix: true })}
            </div>
          </div>
        </div>
      </Link>
    </li>
  );
}
