/**
 * Pocket Dev Guild — TypeScript types.
 *
 * These mirror the FastAPI backend's OpenAPI schema EXACTLY as documented in
 * https://github.com/wuttke/pocket-dev-guild/blob/main/FRONTEND.md so that the
 * mock client and the real HTTP client are interchangeable.
 */

export interface Repo {
  id: string;
  name: string;
  path: string;
  inactive?: boolean;
}

export interface RepoCreate {
  id: string;
  name: string;
  path: string;
}

export interface RepoClone {
  url: string;
  parent_path: string;
  id?: string;
  name?: string;
}

export interface WorktreeInfo {
  name: string | null;
  is_primary: boolean;
  path: string | null;
  branch: string | null;
  head: string | null;
  bare: boolean;
  detached: boolean;
}

export interface WorktreeCreate {
  branch: string;
}

export interface WorktreeCreateParams {
  existing?: boolean;
}

export interface WorktreeCreated {
  name: string;
  path: string;
}

export type JobStatus = "queued" | "running" | "finished" | "failed" | "cancelled";
export type LogStream = "stdout" | "stderr";

export interface JobInfo {
  id: string;
  repo_id: string;
  worktree: string | null;
  prompt: string;
  status: JobStatus;
  returncode: number | null;
  created_at: string;
  finished_at: string | null;
  conversation_id: string | null;
  request_id: string | null;
  session_id: string | null;
}

export interface LogLine {
  stream: LogStream;
  line: string;
}

export interface JobLog extends JobInfo {
  log: LogLine[];
}

export interface ConversationCreate {
  repo_id: string;
  worktree: string | null;
  agent_id: string | null;
  title: string | null;
}

export interface ConversationUpdate {
  title?: string | null;
}

export interface ConversationInfo {
  id: string;
  repo_id: string;
  worktree: string | null;
  agent_id: string | null;
  title: string | null;
  session_id: string | null;
  summary: string | null;
  archived: boolean;
  created_at: string;
  updated_at: string;
  turns: string[];
  last_turn_status: JobStatus | null;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface JobStatusEvent {
  status: JobStatus;
  returncode: number | null;
  finished_at: string | null;
}

export interface ConversationStateEvent {
  conversation: ConversationInfo;
  busy: boolean;
}

/* Query parameter shapes */

export interface ListConversationsParams {
  repo_id?: string;
  worktree?: string;
  include_archived?: boolean;
  updated_since?: string;
  limit?: number;
  offset?: number;
  sort?: string;
}

export interface ListJobsParams {
  repo_id?: string;
  worktree?: string;
  status?: JobStatus;
  conversation_id?: string;
  limit?: number;
  offset?: number;
  sort?: string;
}

export interface ConversationTurnCreate {
  prompt: string;
}

export interface ConversationTurnCreated {
  job_id: string;
}

export interface WorktreeRemoved {
  removed: string;
}

export interface WorktreeStatus {
  is_clean: boolean;
  messages: string[];
}

export interface WorktreeStatusItem {
  name: string | null;
  is_primary: boolean;
  path: string;
  branch: string | null;
  is_clean: boolean;
  messages: string[];
}

export interface WorktreeStatusSummary {
  total_worktrees: number;
  clean_count: number;
  dirty_count: number;
  all_clean: boolean;
}

export interface MultiWorktreeStatus {
  repo_id: string;
  primary: WorktreeStatusItem;
  worktrees: WorktreeStatusItem[];
  summary: WorktreeStatusSummary;
}

export interface GitFileStatus {
  path: string;
  status: string;
  staged: boolean;
  x: string;
  y: string;
}

export interface GitStatusSummary {
  total: number;
  staged: number;
  unstaged: number;
  untracked: number;
  conflicts: number;
}

export interface GitStatus {
  branch: string | null;
  head: string;
  upstream: string | null;
  ahead: number;
  behind: number;
  files: GitFileStatus[];
  summary: GitStatusSummary;
}

export interface GitDiffFile {
  path: string;
  old_path: string | null;
  additions: number;
  deletions: number;
  changes: number;
  binary: boolean;
  diff: string | null;
}

export interface GitDiffSummary {
  files_changed: number;
  insertions: number;
  deletions: number;
}

export interface GitFileDiff {
  base: string;
  files: GitDiffFile[];
  summary: GitDiffSummary;
}

export interface GitFileContent {
  path: string;
  content: string;
  staged: boolean;
}
