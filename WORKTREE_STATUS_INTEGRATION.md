# Worktree Status Integration

## Overview

This implementation integrates the new `GET /api/repos/{repo_id}/worktrees/{name}/status` endpoint into the frontend to provide smart warnings before deleting worktrees.

## Changes Made

### 1. Type Definitions (`src/lib/pdg/types.ts`)

Added the `WorktreeStatus` interface to match the backend API response:

```typescript
export interface WorktreeStatus {
  is_clean: boolean;
  messages: string[];
}
```

### 2. API Client (`src/lib/pdg/client.ts`)

#### Added to `PdgClient` interface:
```typescript
getWorktreeStatus(repoId: string, name: string): Promise<WorktreeStatus>;
```

#### Mock Implementation:
- Randomly generates status for demonstration purposes
- Simulates uncommitted changes, untracked files, and unpushed commits
- Returns realistic warning messages

#### HTTP Client Implementation:
- Calls `GET /repos/{repoId}/worktrees/{name}/status`
- Returns the status response from the backend

### 3. UI Component (`src/routes/_app.repos.tsx`)

Enhanced the `WorktreeRow` component with:

#### State Management:
- `dialogOpen`: Controls the AlertDialog visibility
- `forceDelete`: Tracks whether user acknowledged warnings
- `statusQuery`: Fetches worktree status when dialog opens

#### Smart Confirmation Flow:

1. **When dialog opens**: Automatically fetches worktree status
2. **Loading state**: Shows "Checking worktree status..." message
3. **Clean worktree**: Shows green checkmark with confirmation
4. **Dirty worktree** (not clean):
   - Displays amber warning box with detailed messages
   - Lists all issues (uncommitted changes, untracked files, unpushed commits)
   - Shows "Delete Anyway" button (amber color)
   - Requires user to click "Delete Anyway" before showing final "Remove" button
5. **After "Delete Anyway"**: Shows red "Remove" button for final confirmation

#### UI Features:
- **Warning styling**: Amber background with warning emoji (⚠️)
- **Message list**: Bullet-pointed list of specific issues
- **Color coding**:
  - Amber for warnings/"Delete Anyway" button
  - Red for final "Remove" button
  - Green checkmark for clean worktrees
- **Two-step confirmation** for dirty worktrees:
  1. Acknowledge warnings → "Delete Anyway"
  2. Final confirmation → "Remove"
- **Single-step confirmation** for clean worktrees (skips the "Delete Anyway" step)

#### Example Warning Messages:
- "Uncommitted changes in 3 file(s)"
- "Untracked files: 2 file(s)"
- "Unpushed commits: 2 commit(s) on branch feature/foo"

## User Experience

### Scenario 1: Clean Worktree
1. User clicks trash icon
2. Dialog shows: "✓ Worktree is clean (no uncommitted changes, untracked files, or unpushed commits)"
3. User can directly click "Remove"

### Scenario 2: Dirty Worktree
1. User clicks trash icon
2. Dialog shows: "⚠️ Worktree has unsaved changes" with detailed messages
3. User must click "Delete Anyway" (amber button)
4. Dialog updates to show "Remove" button (red)
5. User clicks "Remove" to complete deletion

### Benefits
- **Advisory only**: Status check is informational; deletion is always allowed
- **Informed decisions**: Users see exactly what they'll lose
- **No surprise data loss**: Clear warnings prevent accidental deletions
- **Clean worktrees**: Streamlined UX when there's nothing to warn about

## Testing

The mock client implementation randomly generates dirty/clean status for testing different scenarios:
- ~50% chance of uncommitted changes
- ~40% chance of untracked files
- ~30% chance of unpushed commits

This allows testing the UI in both clean and dirty states during development.

## Future Enhancements

Potential improvements:
- Add "View Changes" button to show git diff before deletion
- Cache status results to avoid re-fetching when dialog is closed/reopened
- Show file names for uncommitted/untracked files
- Add option to commit/push changes before deletion
