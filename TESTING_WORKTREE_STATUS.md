# Testing Worktree Status Integration

## Manual Testing Steps

### Prerequisites
1. Start the development server: `npm run dev`
2. Navigate to the Repos page
3. Ensure you have at least one repository with worktrees

### Test Scenario 1: Clean Worktree
**Expected behavior**: Single-step confirmation

1. Expand a repository to view its worktrees
2. Click the trash icon on a worktree
3. **Verify**: Dialog shows "Checking worktree status..." briefly
4. **Verify**: Dialog displays green checkmark: "✓ Worktree is clean..."
5. **Verify**: Only "Cancel" and "Remove" buttons are visible
6. Click "Remove"
7. **Verify**: Worktree is deleted successfully

### Test Scenario 2: Dirty Worktree (First Time)
**Expected behavior**: Two-step confirmation with warnings

1. Click the trash icon on a different worktree
2. **Verify**: Dialog shows "Checking worktree status..." briefly
3. **Verify**: Amber warning box appears with:
   - ⚠️ emoji
   - "Worktree has unsaved changes" header
   - Bullet-pointed list of issues
4. **Verify**: Buttons show "Cancel" and "Delete Anyway" (amber)
5. Click "Delete Anyway"
6. **Verify**: Warning box remains visible
7. **Verify**: Buttons change to "Cancel" and "Remove" (red)
8. Click "Remove"
9. **Verify**: Worktree is deleted successfully

### Test Scenario 3: Dirty Worktree (Cancelled)
**Expected behavior**: State resets when dialog is closed

1. Click the trash icon on a worktree
2. Wait for status to load
3. If warning appears, click "Delete Anyway"
4. Click "Cancel"
5. Open the same worktree's delete dialog again
6. **Verify**: Warning box appears again (not in "Delete Anyway" state)
7. **Verify**: Shows "Delete Anyway" button, not "Remove"

### Test Scenario 4: Archive Conversations Checkbox
**Expected behavior**: Checkbox works independently of status warnings

1. Click the trash icon on a worktree
2. Check the "Archive conversations with this worktree" checkbox
3. If warnings appear, click "Delete Anyway"
4. **Verify**: Checkbox remains checked
5. Click "Cancel"
6. **Verify**: Next time dialog opens, checkbox is unchecked (reset)

### Test Scenario 5: Multiple Worktrees
**Expected behavior**: Each worktree has independent status

1. Open delete dialog for multiple worktrees in sequence
2. **Verify**: Each shows different status (due to mock randomization)
3. **Verify**: Some show clean, some show warnings

## API Testing

### Mock Mode (Development)
The mock client randomly generates status:
- Check `src/lib/pdg/client.ts` lines 196-226
- Status is generated fresh each time the dialog opens
- Approximately 50% will show as dirty

### Live Backend Mode
Set `VITE_USE_MOCK_DATA=false` and test with real backend:

```bash
# In .env.local or .env
VITE_USE_MOCK_DATA=false
```

Then verify:
1. Endpoint called: `GET /api/repos/{repo_id}/worktrees/{name}/status`
2. Response matches `WorktreeStatus` type
3. Real git status is reflected in the UI

## Edge Cases to Test

### 1. Network Error
- Simulate network failure (disconnect, slow connection)
- **Verify**: Loading state doesn't hang
- **Verify**: Error is handled gracefully

### 2. Primary Worktree
- **Verify**: Primary worktrees don't show delete button at all
- No need to test status for primary worktrees

### 3. Rapid Dialog Open/Close
1. Rapidly open and close the delete dialog
2. **Verify**: No race conditions
3. **Verify**: Status query is properly cancelled when dialog closes

### 4. Long Status Messages
- Test with backend returning very long messages
- **Verify**: Messages wrap properly
- **Verify**: Dialog doesn't overflow

## Automated Testing (Future)

Consider adding these tests:
1. **Unit test**: WorktreeStatus type validation
2. **Component test**: Dialog state transitions
3. **Integration test**: API client methods
4. **E2E test**: Full deletion flow with warnings

## Performance Checks

1. **Status fetch timing**: Should complete in < 500ms
2. **Dialog responsiveness**: Should open immediately
3. **No flickering**: Loading state should be smooth
4. **Memory**: No memory leaks when opening/closing dialog multiple times

## Accessibility Testing

1. **Keyboard navigation**: Tab through dialog elements
2. **Screen reader**: Announce warnings and button states
3. **Focus management**: Focus returns to trash button after cancel
4. **ARIA labels**: Trash button has proper aria-label
