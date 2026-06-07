import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { ArrowLeft } from "lucide-react";
import { StatusBadge } from "@/components/pdg/StatusBadge";
import { LogViewer } from "@/components/pdg/LogViewer";
import { pdg } from "@/lib/pdg/client";
import type { JobStatus, JobStatusEvent } from "@/lib/pdg/types";

export const Route = createFileRoute("/_app/jobs/$id")({
  head: ({ params }) => ({
    meta: [
      { title: `Job ${params.id} · Pocket Dev Guild` },
      { name: "description", content: "Live log stream and status for a single agent job." },
    ],
  }),
  component: JobDetail,
});

function JobDetail() {
  const { id } = Route.useParams();
  const job = useQuery({ queryKey: ["job", id], queryFn: () => pdg.getJob(id) });
  const [liveStatus, setLiveStatus] = useState<JobStatus | null>(null);
  const [returncode, setReturncode] = useState<number | null>(null);

  const onStatus = (event: JobStatusEvent) => {
    setLiveStatus(event.status);
    setReturncode(event.returncode);
  };

  if (job.isLoading || !job.data) {
    return <div className="h-24 animate-pulse rounded-xl bg-card/40" />;
  }
  const data = job.data;
  const status = liveStatus ?? data.status;
  const code = returncode ?? data.returncode;

  return (
    <div className="space-y-4">
      <Link
        to="/jobs"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> All jobs
      </Link>

      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={status} />
          {code !== null ? (
            <span className="font-mono text-[11px] text-muted-foreground">exit {code}</span>
          ) : null}
          <span className="text-[11px] text-muted-foreground">
            started {formatDistanceToNow(new Date(data.created_at), { addSuffix: true })}
          </span>
        </div>
        <h1 className="font-display text-lg font-semibold leading-snug">{data.prompt}</h1>
        <div className="font-mono text-[11px] text-muted-foreground">
          {data.repo_id}
          {data.worktree ? ` / ${data.worktree}` : ""}
          {data.conversation_id ? (
            <>
              {" · "}
              <Link
                to="/conversations/$id"
                params={{ id: data.conversation_id }}
                className="underline-offset-2 hover:underline"
              >
                {data.conversation_id}
              </Link>
            </>
          ) : null}
        </div>
      </header>

      <LogViewer jobId={id} onStatus={onStatus} />
    </div>
  );
}