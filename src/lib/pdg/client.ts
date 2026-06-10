/**
 * Pocket Dev Guild API client.
 *
 * Defines a `PdgClient` interface that mirrors the FastAPI REST API
 * documented in FRONTEND.md, plus two implementations:
 *
 *   - `mockClient`  — in-memory data for development without backend.
 *   - `httpClient`  — fetch + EventSource against the real backend at /api.
 *
 * Toggle between mock and live mode by setting VITE_USE_MOCK_DATA:
 *   - VITE_USE_MOCK_DATA=true  → uses mock data (default for development)
 *   - VITE_USE_MOCK_DATA=false → uses real backend at /api (for production/testing)
 */

import { mockConversations, mockJobLogs, mockJobs, mockRepos, mockWorktrees } from "./mock-data";
import type {
  ConversationCreate,
  ConversationInfo,
  ConversationStateEvent,
  ConversationTurnCreate,
  ConversationTurnCreated,
  ConversationUpdate,
  JobInfo,
  JobLog,
  JobStatusEvent,
  ListConversationsParams,
  ListJobsParams,
  LogLine,
  PaginatedResponse,
  Repo,
  RepoClone,
  RepoCreate,
  WorktreeCreate,
  WorktreeCreateParams,
  WorktreeCreated,
  WorktreeInfo,
  WorktreeRemoved,
  WorktreeStatus,
} from "./types";

export type Unsubscribe = () => void;

export interface PdgClient {
  listRepos(): Promise<Repo[]>;
  createRepo(body: RepoCreate): Promise<Repo>;
  cloneRepo(body: RepoClone): Promise<Repo>;
  deleteRepo(repoId: string): Promise<void>;

  listWorktrees(repoId: string): Promise<WorktreeInfo[]>;
  createWorktree(
    repoId: string,
    body: WorktreeCreate,
    params?: WorktreeCreateParams,
  ): Promise<WorktreeCreated>;
  getWorktreeStatus(repoId: string, name: string): Promise<WorktreeStatus>;
  deleteWorktree(
    repoId: string,
    name: string,
    params?: { archive_conversations?: boolean },
  ): Promise<WorktreeRemoved>;

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

  listConversations(params?: ListConversationsParams): Promise<PaginatedResponse<ConversationInfo>>;
  getConversation(id: string): Promise<ConversationInfo>;
  createConversation(body: ConversationCreate): Promise<ConversationInfo>;
  updateConversation(id: string, body: ConversationUpdate): Promise<ConversationInfo>;
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

    async createRepo(body) {
      await delay(200);
      // Check if repo with same ID already exists
      if (repos.find((r) => r.id === body.id)) {
        throw new Error(`Repository with ID '${body.id}' already exists`);
      }
      const repo: Repo = { ...body, inactive: false };
      repos.push(repo);
      return clone(repo);
    },

    async cloneRepo(body) {
      await delay(800);
      // Derive name and ID similar to backend
      const name = body.name ?? body.url.split("/").pop()?.replace(".git", "") ?? "repo";
      const id = body.id ?? name;

      // Check if repo with same ID already exists
      if (repos.find((r) => r.id === id)) {
        throw new Error(`Repository with ID '${id}' already exists`);
      }

      const repo: Repo = {
        id,
        name,
        path: `${body.parent_path}/${name}`,
        inactive: false,
      };
      repos.push(repo);
      return clone(repo);
    },

    async deleteRepo(repoId) {
      await delay();
      const index = repos.findIndex((r) => r.id === repoId);
      if (index === -1) {
        throw new Error(`Repository '${repoId}' not found`);
      }
      // Soft delete - mark as inactive instead of removing
      repos[index].inactive = true;
      // Remove from list (simulating the backend filtering out inactive repos)
      repos.splice(index, 1);
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

    async getWorktreeStatus(repoId, name) {
      await delay();
      const list = worktrees[repoId] ?? [];
      const wt = list.find((w) => w.name === name);
      if (!wt) {
        throw new Error(`Worktree '${name}' not found in repository '${repoId}'`);
      }
      // Mock: randomly generate status for demonstration
      const isDirty = Math.random() > 0.5;
      const hasUntracked = Math.random() > 0.6;
      const hasUnpushed = Math.random() > 0.7;

      const messages: string[] = [];
      if (isDirty) {
        const count = Math.floor(Math.random() * 5) + 1;
        messages.push(`Uncommitted changes in ${count} file(s)`);
      }
      if (hasUntracked) {
        const count = Math.floor(Math.random() * 3) + 1;
        messages.push(`Untracked files: ${count} file(s)`);
      }
      if (hasUnpushed) {
        const count = Math.floor(Math.random() * 3) + 1;
        messages.push(`Unpushed commits: ${count} commit(s) on branch ${wt.branch}`);
      }

      return {
        is_clean: messages.length === 0,
        messages,
      };
    },

    async deleteWorktree(repoId, name, params) {
      await delay();
      const list = worktrees[repoId] ?? [];
      worktrees[repoId] = list.filter((w) => w.name !== name);
      void params; // Mock doesn't implement archive_conversations yet
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
        last_turn_status: null,
      };
      conversations.unshift(conv);
      return clone(conv);
    },

    async updateConversation(id, body) {
      await delay();
      const conv = conversations.find((c) => c.id === id);
      if (!conv) throw new Error(`Conversation ${id} not found`);
      if (body.title !== undefined) {
        conv.title = body.title;
      }
      conv.updated_at = new Date().toISOString();
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
      jobLogs[jobId] = [{ stream: "stdout", line: `› auggie run "${body.prompt}"\n` }];
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
    const hasBody = init?.body != null;
    const res = await fetch(input, {
      ...init,
      headers: {
        ...(hasBody ? { "Content-Type": "application/json" } : {}),
        ...(init?.headers ?? {}),
      },
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
    createRepo: (body) => json(url("/repos"), { method: "POST", body: JSON.stringify(body) }),
    cloneRepo: (body) => json(url("/repos/clone"), { method: "POST", body: JSON.stringify(body) }),
    deleteRepo: (repoId) => json(url(`/repos/${encodeURIComponent(repoId)}`), { method: "DELETE" }),

    listWorktrees: (repoId) => json(url(`/repos/${encodeURIComponent(repoId)}/worktrees`)),
    createWorktree: (repoId, body, params) =>
      json(url(`/repos/${encodeURIComponent(repoId)}/worktrees${qs(params as Record<string, unknown>)}`), {
        method: "POST",
        body: JSON.stringify(body),
      }),
    getWorktreeStatus: (repoId, name) => json(url(`/repos/${encodeURIComponent(repoId)}/worktrees/${encodeURIComponent(name)}/status`)),
    deleteWorktree: (repoId, name, params) =>
      json(url(`/repos/${encodeURIComponent(repoId)}/worktrees/${encodeURIComponent(name)}${qs(params as Record<string, unknown>)}`), {
        method: "DELETE",
      }),

    listJobs: (params) => json(url(`/jobs${qs(params as Record<string, unknown>)}`)),
    getJob: (jobId) => json(url(`/jobs/${encodeURIComponent(jobId)}`)),
    getJobLog: (jobId) => json(url(`/jobs/${encodeURIComponent(jobId)}/log`)),
    cancelJob: (jobId) => json(url(`/jobs/${encodeURIComponent(jobId)}`), { method: "DELETE" }),

    streamJobEvents(jobId, handlers) {
      const es = new EventSource(url(`/jobs/${encodeURIComponent(jobId)}/events`));
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
    getConversation: (id) => json(url(`/conversations/${encodeURIComponent(id)}`)),
    createConversation: (body) =>
      json(url(`/conversations`), { method: "POST", body: JSON.stringify(body) }),
    updateConversation: (id, body) =>
      json(url(`/conversations/${encodeURIComponent(id)}`), {
        method: "PUT",
        body: JSON.stringify(body),
      }),
    createConversationTurn: (id, body) =>
      json(url(`/conversations/${encodeURIComponent(id)}/turns`), {
        method: "POST",
        body: JSON.stringify(body),
      }),
    archiveConversation: (id) => json(url(`/conversations/${encodeURIComponent(id)}`), { method: "DELETE" }),

    streamConversationEvents(id, handlers) {
      const es = new EventSource(url(`/conversations/${encodeURIComponent(id)}/events`));
      es.addEventListener("snapshot", (ev) => {
        try {
          handlers.onSnapshot?.(JSON.parse((ev as MessageEvent).data) as ConversationStateEvent);
        } catch (err) {
          handlers.onError?.(err);
        }
      });
      es.addEventListener("update", (ev) => {
        try {
          handlers.onUpdate?.(JSON.parse((ev as MessageEvent).data) as ConversationStateEvent);
        } catch (err) {
          handlers.onError?.(err);
        }
      });
      es.onerror = (err) => handlers.onError?.(err);
      return () => es.close();
    },
  };
}

// Toggle between mock and live mode via VITE_USE_MOCK_DATA environment variable.
// Default is true (mock mode) for easy development without backend.
// Set VITE_USE_MOCK_DATA=false to use the real backend at /api.
const useMockData = import.meta.env.VITE_USE_MOCK_DATA !== "false";

export const pdg: PdgClient = useMockData ? makeMockClient() : makeHttpClient("/api");
export const isMockMode = useMockData;
export const apiBaseUrl = useMockData ? null : "/api";
