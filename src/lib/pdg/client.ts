/**
 * Pocket Dev Guild API client.
 *
 * Defines a `PdgClient` interface that mirrors the FastAPI REST API
 * documented in FRONTEND.md, plus two implementations:
 *
 *   - `mockClient`  — in-memory data, used by default during development.
 *   - `httpClient`  — fetch + EventSource against a real backend base URL.
 *
 * Swap by setting `VITE_PDG_API_URL` to your backend, e.g. `http://localhost:8000`.
 * Until then, the mock is active and all SSE streams are simulated with
 * intervals so the UI feels live.
 */

import {
  mockConversations,
  mockJobLogs,
  mockJobs,
  mockRepos,
  mockWorktrees,
} from "./mock-data";
import type {
  ConversationCreate,
  ConversationInfo,
  ConversationStateEvent,
  ConversationTurnCreate,
  ConversationTurnCreated,
  JobInfo,
  JobLog,
  JobStatusEvent,
  ListConversationsParams,
  ListJobsParams,
  LogLine,
  PaginatedResponse,
  Repo,
  WorktreeCreate,
  WorktreeCreateParams,
  WorktreeCreated,
  WorktreeInfo,
  WorktreeRemoved,
} from "./types";

export type Unsubscribe = () => void;

export interface PdgClient {
  listRepos(): Promise<Repo[]>;

  listWorktrees(repoId: string): Promise<WorktreeInfo[]>;
  createWorktree(
    repoId: string,
    body: WorktreeCreate,
    params?: WorktreeCreateParams,
  ): Promise<WorktreeCreated>;
  deleteWorktree(repoId: string, name: string): Promise<WorktreeRemoved>;

  listJobs(params?: ListJobsParams): Promise<PaginatedResponse<JobInfo>>;
  getJob(jobId: string): Promise<JobInfo>;
  getJobLog(jobId: string): Promise<JobLog>;
  cancelJob(jobId: string): Promise<void>;
  streamJobEvents(
    jobId: string,
    handlers: {
      onLog?: (line: LogLine) => void;
      onStatus?: (event: JobStatusEvent) => void;
      onError?: (error: unknown) => void;
    },
  ): Unsubscribe;

  listConversations(
    params?: ListConversationsParams,
  ): Promise<PaginatedResponse<ConversationInfo>>;
  getConversation(id: string): Promise<ConversationInfo>;
  createConversation(body: ConversationCreate): Promise<ConversationInfo>;
  createConversationTurn(
    id: string,
    body: ConversationTurnCreate,
  ): Promise<ConversationTurnCreated>;
  archiveConversation(id: string): Promise<void>;
  streamConversationEvents(
    id: string,
    handlers: {
      onSnapshot?: (event: ConversationStateEvent) => void;
      onUpdate?: (event: ConversationStateEvent) => void;
      onError?: (error: unknown) => void;
    },
  ): Unsubscribe;
}

/* -------------------------------------------------------------------------- */
/*  Mock implementation                                                       */
/* -------------------------------------------------------------------------- */

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function paginate<T>(items: T[], limit = 50, offset = 0): PaginatedResponse<T> {
  return {
    items: items.slice(offset, offset + limit),
    total: items.length,
    limit,
    offset,
  };
}

function delay(ms = 120) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function makeMockClient(): PdgClient {
  const repos: Repo[] = clone(mockRepos);
  const worktrees: Record<string, WorktreeInfo[]> = clone(mockWorktrees);
  const conversations: ConversationInfo[] = clone(mockConversations);
  const jobs: JobInfo[] = clone(mockJobs);
  const jobLogs: Record<string, LogLine[]> = clone(mockJobLogs);

  return {
    async listRepos() {
      await delay();
      return clone(repos);
    },

    async listWorktrees(repoId) {
      await delay();
      return clone(worktrees[repoId] ?? []);
    },

    async createWorktree(repoId, body, params) {
      await delay(280);
      const name = body.branch.toLowerCase().replace(/[/.]/g, "_");
      const wt: WorktreeInfo = {
        name,
        is_primary: false,
        path: `/home/alex/repos/${repoId}-worktrees/${name}`,
        branch: body.branch,
        head: Math.random().toString(16).slice(2, 18),
        bare: false,
        detached: false,
      };
      (worktrees[repoId] ||= []).push(wt);
      void params;
      return { name, path: wt.path! };
    },

    async deleteWorktree(repoId, name) {
      await delay();
      const list = worktrees[repoId] ?? [];
      worktrees[repoId] = list.filter((w) => w.name !== name);
      return { removed: name };
    },

    async listJobs(params = {}) {
      await delay();
      let items = jobs.slice();
      if (params.repo_id) items = items.filter((j) => j.repo_id === params.repo_id);
      if (params.worktree) items = items.filter((j) => j.worktree === params.worktree);
      if (params.status) items = items.filter((j) => j.status === params.status);
      if (params.conversation_id)
        items = items.filter((j) => j.conversation_id === params.conversation_id);
      items.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
      return paginate(clone(items), params.limit ?? 50, params.offset ?? 0);
    },

    async getJob(jobId) {
      await delay();
      const job = jobs.find((j) => j.id === jobId);
      if (!job) throw new Error(`Job ${jobId} not found`);
      return clone(job);
    },

    async getJobLog(jobId) {
      await delay();
      const job = jobs.find((j) => j.id === jobId);
      if (!job) throw new Error(`Job ${jobId} not found`);
      return { ...clone(job), log: clone(jobLogs[jobId] ?? []) };
    },

    async cancelJob(jobId) {
      await delay();
      const job = jobs.find((j) => j.id === jobId);
      if (!job) throw new Error(`Job ${jobId} not found`);
      if (job.status !== "queued" && job.status !== "running") {
        throw new Error(`Job already terminal: status=${job.status}`);
      }
      job.status = "cancelled";
      job.finished_at = new Date().toISOString();
    },

    streamJobEvents(jobId, handlers) {
      const job = jobs.find((j) => j.id === jobId);
      if (!job) {
        handlers.onError?.(new Error(`Job ${jobId} not found`));
        return () => {};
      }

      // Replay existing log lines, then if running, stream a few more.
      let cancelled = false;
      const existing = clone(jobLogs[jobId] ?? []);

      const tick = async () => {
        for (const line of existing) {
          if (cancelled) return;
          handlers.onLog?.(line);
          await delay(60);
        }
        if (job.status === "running" && !cancelled) {
          const extra: LogLine[] = [
            { stream: "stdout", line: "Compiling components/log-viewer.tsx\n" },
            { stream: "stdout", line: "Type-checking…\n" },
            { stream: "stdout", line: "Running tests (3 files)…\n" },
            { stream: "stdout", line: "  ✔ renders log lines\n" },
            { stream: "stdout", line: "  ✔ auto-scrolls\n" },
            { stream: "stdout", line: "  ✔ closes EventSource on unmount\n" },
          ];
          for (const line of extra) {
            if (cancelled) return;
            await delay(700);
            handlers.onLog?.(line);
          }
        }
      };
      void tick();

      return () => {
        cancelled = true;
      };
    },

    async listConversations(params = {}) {
      await delay();
      let items = conversations.slice();
      if (!params.include_archived) items = items.filter((c) => !c.archived);
      if (params.repo_id) items = items.filter((c) => c.repo_id === params.repo_id);
      if (params.worktree) items = items.filter((c) => c.worktree === params.worktree);
      items.sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1));
      return paginate(clone(items), params.limit ?? 50, params.offset ?? 0);
    },

    async getConversation(id) {
      await delay();
      const conv = conversations.find((c) => c.id === id);
      if (!conv) throw new Error(`Conversation ${id} not found`);
      return clone(conv);
    },

    async createConversation(body) {
      await delay(200);
      const id = `conv-${Math.random().toString(36).slice(2, 8)}`;
      const conv: ConversationInfo = {
        id,
        repo_id: body.repo_id,
        worktree: body.worktree,
        agent_id: body.agent_id,
        title: body.title,
        session_id: null,
        summary: null,
        archived: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        turns: [],
      };
      conversations.unshift(conv);
      return clone(conv);
    },

    async createConversationTurn(id, body) {
      await delay(180);
      const conv = conversations.find((c) => c.id === id);
      if (!conv) throw new Error(`Conversation ${id} not found`);
      const jobId = `job-${Math.random().toString(36).slice(2, 8)}`;
      const job: JobInfo = {
        id: jobId,
        repo_id: conv.repo_id,
        worktree: conv.worktree,
        prompt: body.prompt,
        status: "running",
        returncode: null,
        created_at: new Date().toISOString(),
        finished_at: null,
        conversation_id: conv.id,
        request_id: `req-${jobId}`,
        session_id: conv.session_id,
      };
      jobs.unshift(job);
      jobLogs[jobId] = [
        { stream: "stdout", line: `› auggie run "${body.prompt}"\n` },
      ];
      conv.turns = [...conv.turns, jobId];
      conv.updated_at = new Date().toISOString();
      return { job_id: jobId };
    },

    async archiveConversation(id) {
      await delay();
      const conv = conversations.find((c) => c.id === id);
      if (conv) conv.archived = true;
    },

    streamConversationEvents(id, handlers) {
      const conv = conversations.find((c) => c.id === id);
      if (!conv) {
        handlers.onError?.(new Error(`Conversation ${id} not found`));
        return () => {};
      }
      handlers.onSnapshot?.({ conversation: clone(conv), busy: false });
      return () => {};
    },
  };
}

/* -------------------------------------------------------------------------- */
/*  HTTP implementation (used when VITE_PDG_API_URL is set)                   */
/* -------------------------------------------------------------------------- */

function makeHttpClient(baseUrl: string): PdgClient {
  const url = (p: string) => `${baseUrl.replace(/\/$/, "")}${p}`;

  async function json<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
    const res = await fetch(input, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`${res.status} ${res.statusText}${text ? `: ${text}` : ""}`);
    }
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }

  function qs(params?: Record<string, unknown>): string {
    if (!params) return "";
    const search = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v === undefined || v === null) continue;
      search.set(k, String(v));
    }
    const s = search.toString();
    return s ? `?${s}` : "";
  }

  return {
    listRepos: () => json(url("/repos")),

    listWorktrees: (repoId) => json(url(`/repos/${repoId}/worktrees`)),
    createWorktree: (repoId, body, params) =>
      json(url(`/repos/${repoId}/worktrees${qs(params as Record<string, unknown>)}`), {
        method: "POST",
        body: JSON.stringify(body),
      }),
    deleteWorktree: (repoId, name) =>
      json(url(`/repos/${repoId}/worktrees/${name}`), { method: "DELETE" }),

    listJobs: (params) => json(url(`/jobs${qs(params as Record<string, unknown>)}`)),
    getJob: (jobId) => json(url(`/jobs/${jobId}`)),
    getJobLog: (jobId) => json(url(`/jobs/${jobId}/log`)),
    cancelJob: (jobId) => json(url(`/jobs/${jobId}`), { method: "DELETE" }),

    streamJobEvents(jobId, handlers) {
      const es = new EventSource(url(`/jobs/${jobId}/events`));
      es.addEventListener("log", (ev) => {
        try {
          handlers.onLog?.(JSON.parse((ev as MessageEvent).data) as LogLine);
        } catch (err) {
          handlers.onError?.(err);
        }
      });
      es.addEventListener("status", (ev) => {
        try {
          handlers.onStatus?.(JSON.parse((ev as MessageEvent).data) as JobStatusEvent);
        } catch (err) {
          handlers.onError?.(err);
        }
      });
      es.onerror = (err) => handlers.onError?.(err);
      return () => es.close();
    },

    listConversations: (params) =>
      json(url(`/conversations${qs(params as Record<string, unknown>)}`)),
    getConversation: (id) => json(url(`/conversations/${id}`)),
    createConversation: (body) =>
      json(url(`/conversations`), { method: "POST", body: JSON.stringify(body) }),
    createConversationTurn: (id, body) =>
      json(url(`/conversations/${id}/turns`), {
        method: "POST",
        body: JSON.stringify(body),
      }),
    archiveConversation: (id) =>
      json(url(`/conversations/${id}`), { method: "DELETE" }),

    streamConversationEvents(id, handlers) {
      const es = new EventSource(url(`/conversations/${id}/events`));
      es.addEventListener("snapshot", (ev) => {
        try {
          handlers.onSnapshot?.(
            JSON.parse((ev as MessageEvent).data) as ConversationStateEvent,
          );
        } catch (err) {
          handlers.onError?.(err);
        }
      });
      es.addEventListener("update", (ev) => {
        try {
          handlers.onUpdate?.(
            JSON.parse((ev as MessageEvent).data) as ConversationStateEvent,
          );
        } catch (err) {
          handlers.onError?.(err);
        }
      });
      es.onerror = (err) => handlers.onError?.(err);
      return () => es.close();
    },
  };
}

const apiUrl = import.meta.env.VITE_PDG_API_URL as string | undefined;

export const pdg: PdgClient = apiUrl ? makeHttpClient(apiUrl) : makeMockClient();
export const isMockMode = !apiUrl;
export const apiBaseUrl = apiUrl ?? null;