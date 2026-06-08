import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Terminal } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/pdg/StatusBadge";
import { EmptyState } from "@/components/pdg/EmptyState";
import { pdg } from "@/lib/pdg/client";
import type { JobStatus } from "@/lib/pdg/types";

export const Route = createFileRoute("/_app/jobs/")({
  head: () => ({
    meta: [
      { title: "Jobs · Pocket Dev Guild" },
      { name: "description", content: "Recent agent jobs across all conversations." },
    ],
  }),
  component: JobsPage,
});

function JobsPage() {
  const [status, setStatus] = useState<JobStatus | "all">("all");
  const jobs = useQuery({
    queryKey: ["jobs", { status }],
    queryFn: () => pdg.listJobs({ status: status === "all" ? undefined : status, limit: 100 }),
  });

  return (
    <div className="space-y-4">
      <header>
        <h1 className="font-display text-2xl font-semibold">Jobs</h1>
        <p className="text-sm text-muted-foreground">Every job started by a conversation turn.</p>
      </header>

      <div className="flex items-center gap-2">
        <Select value={status} onValueChange={(v) => setStatus(v as JobStatus | "all")}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="queued">Queued</SelectItem>
            <SelectItem value="running">Running</SelectItem>
            <SelectItem value="finished">Finished</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {jobs.isLoading ? (
        <ul className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <li
              key={i}
              className="h-20 animate-pulse rounded-xl border border-border/40 bg-card/40"
            />
          ))}
        </ul>
      ) : jobs.data?.items.length === 0 ? (
        <EmptyState
          icon={<Terminal className="h-8 w-8" />}
          title="No jobs match"
          description="Try another filter or start a new conversation turn."
        />
      ) : (
        <ul className="space-y-2">
          {jobs.data?.items.map((job) => (
            <li key={job.id}>
              <Link
                to="/jobs/$id"
                params={{ id: job.id }}
                className="block rounded-xl border border-border/60 bg-card px-4 py-3 transition-colors hover:bg-muted/30"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="line-clamp-2 text-sm font-medium">{job.prompt}</p>
                    <div className="mt-1 text-[11px] text-muted-foreground">
                      <span className="font-mono">{job.repo_id}</span>
                      {job.worktree ? (
                        <>
                          {" / "}
                          <span className="font-mono">{job.worktree}</span>
                        </>
                      ) : null}
                      {" · "}
                      {formatDistanceToNow(new Date(job.created_at), { addSuffix: true })}
                    </div>
                  </div>
                  <StatusBadge status={job.status} />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
