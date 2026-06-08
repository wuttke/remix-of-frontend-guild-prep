import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { ArrowLeft, MessageSquare, Ban } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
  const router = useRouter();
  const qc = useQueryClient();
  const job = useQuery({ queryKey: ["job", id], queryFn: () => pdg.getJob(id) });
  const [liveStatus, setLiveStatus] = useState<JobStatus | null>(null);
  const [returncode, setReturncode] = useState<number | null>(null);

  const onStatus = (event: JobStatusEvent) => {
    setLiveStatus(event.status);
    setReturncode(event.returncode);
  };

  const cancel = useMutation({
    mutationFn: () => pdg.cancelJob(id),
    onSuccess: () => {
      setLiveStatus("cancelled");
      qc.invalidateQueries({ queryKey: ["job", id] });
      qc.invalidateQueries({ queryKey: ["jobs"] });
      toast.success("Job cancelled");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (job.isLoading || !job.data) {
    return <div className="h-24 animate-pulse rounded-xl bg-card/40" />;
  }
  const data = job.data;
  const status = liveStatus ?? data.status;
  const code = returncode ?? data.returncode;
  const isActive = status === "queued" || status === "running";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => router.history.back()}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        {data.conversation_id ? (
          <Link
            to="/conversations/$id"
            params={{ id: data.conversation_id }}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <MessageSquare className="h-4 w-4" /> Conversation
          </Link>
        ) : null}
      </div>

      <header className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={status} />
            {code !== null ? (
              <span className="font-mono text-[11px] text-muted-foreground">exit {code}</span>
            ) : null}
            <span className="text-[11px] text-muted-foreground">
              started {formatDistanceToNow(new Date(data.created_at), { addSuffix: true })}
            </span>
          </div>
          {isActive ? (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1.5 text-[color:var(--status-failed)] hover:text-[color:var(--status-failed)]"
                  disabled={cancel.isPending}
                >
                  <Ban className="h-3.5 w-3.5" />
                  {cancel.isPending ? "Cancelling…" : "Cancel"}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Cancel this job?</AlertDialogTitle>
                  <AlertDialogDescription>
                    The agent will stop and the job will be marked as cancelled.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep running</AlertDialogCancel>
                  <AlertDialogAction onClick={() => cancel.mutate()}>
                    Cancel job
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : null}
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

      <LogViewer jobId={id} jobStatus={status} onStatus={onStatus} />
    </div>
  );
}