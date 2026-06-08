# TODO

## Frontend-Only Tasks

### 1. Navigate Immediately to New Conversation Page
When creating a new conversation, please go immediately to its page, so we can enter the prompt directly.

**Details:** After POST /conversations returns the new conversation object, immediately navigate to `/conversations/{id}` instead of staying on the list page. No backend changes needed - just frontend routing logic.

### 2. Fix ANSI Coloring and Improve Markdown Interpretation
It seems the ANSI coloring does not work. We might also improve the markdown interpretation, at least for **Bold** and **Headlines**.

**Details:** Improve the terminal/log rendering component to properly parse and display ANSI escape codes. Enhance markdown renderer to support bold (**text**), headlines (# H1, ## H2, etc.), and other common markdown syntax. No backend changes needed.

### 3. Add "Create Conversation" Buttons to Repo/Worktree List
Add buttons to create a conversation directly from the repository/worktree list view.

**Details:** Add a button next to each worktree in the repo list (position it next to the trashcan icon, or on the right side if there's no trashcan like with the primary worktree). When clicked, open the existing "create conversation" dialog with the repo and worktree fields pre-filled. This provides a quick way to start a conversation in a specific worktree without navigating to the conversations page first. No backend changes needed.

## Frontend + Backend Tasks

### 4. Add Ability to Edit Conversation Headlines
Can we add an ability to edit the headline of conversations? We'll also need to plan a PUT call in the backend for this functionality.

**Frontend Details:** Add an inline edit UI component for the conversation title field. Implement PUT request handler to update the title on blur/submit.

**Backend Details:** Implement PUT /conversations/{conversation_id} endpoint that accepts a ConversationUpdate schema with optional title field. Update the conversation record in the ConversationStore and emit update event via SSE to notify listening clients.

### 5. Frontend for Repository Admin Backend
Make frontend for not-yet-finished repository admin backend.

**Frontend Details:** Create admin UI pages for managing repository configuration, viewing repository status, and performing administrative actions.

**Backend Details:** The backend TODO.md mentions repository admin features are not yet finished. Need to complete the admin endpoints in the backend first, likely under /repos/{repo_id}/admin or similar routes.

### 6. Display Uncommitted Changes in Worktrees
Display prominently if there are uncommitted changes in a worktree. This will require backend work to check git status for each worktree.

**Frontend Details:** Add visual indicator (badge, icon, or status text) on worktree list items showing uncommitted changes count. Display details in worktree detail view.

**Backend Details:** Add has_uncommitted_changes boolean field to WorktreeInfo schema. Implement git status check in GitService (e.g., `git status --porcelain`) and include result in GET /repos/{repo_id}/worktrees response. Consider caching to avoid performance issues on large repositories.

### 7. Show Chat Running Status on List Page
Display on the chat list page if a chat is still running or if all turns are completed. This might also require backend work to efficiently determine the status.

**Frontend Details:** Add status badge/indicator on conversation list items showing if the conversation is currently busy (running a turn). Use SSE to update status in real-time.

**Backend Details:** The ConversationInfo schema already includes turns array with job IDs. Need to add a computed is_running/busy field to ConversationListResponse that checks if the last turn's job status is "queued" or "running". Alternatively, expose this via the existing GET /conversations/{conversation_id}/events SSE stream which already includes busy flag.
