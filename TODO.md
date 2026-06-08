# TODO

## Frontend + Backend Tasks

### 1. Add Ability to Edit Conversation Headlines

Can we add an ability to edit the headline of conversations? We'll also need to plan a PUT call in the backend for this functionality.

**Frontend Details:** Add an inline edit UI component for the conversation title field. Implement PUT request handler to update the title on blur/submit.

**Backend Details:** Implement PUT /conversations/{conversation_id} endpoint that accepts a ConversationUpdate schema with optional title field. Update the conversation record in the ConversationStore and emit update event via SSE to notify listening clients.

### 2. Display Uncommitted Changes in Worktrees

Display prominently if there are uncommitted changes in a worktree. This will require backend work to check git status for each worktree.

**Frontend Details:** Add visual indicator (badge, icon, or status text) on worktree list items showing uncommitted changes count. Display details in worktree detail view.

**Backend Details:** Add has_uncommitted_changes boolean field to WorktreeInfo schema. Implement git status check in GitService (e.g., `git status --porcelain`) and include result in GET /repos/{repo_id}/worktrees response. Consider caching to avoid performance issues on large repositories.

### 3. Show Chat Running Status on List Page

Display on the chat list page if a chat is still running or if all turns are completed. This might also require backend work to efficiently determine the status.

**Frontend Details:** Add status badge/indicator on conversation list items showing if the conversation is currently busy (running a turn). Use SSE to update status in real-time.

**Backend Details:** The ConversationInfo schema already includes turns array with job IDs. Need to add a computed is_running/busy field to ConversationListResponse that checks if the last turn's job status is "queued" or "running". Alternatively, expose this via the existing GET /conversations/{conversation_id}/events SSE stream which already includes busy flag.
