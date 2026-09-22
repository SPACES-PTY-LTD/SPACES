This project is a laravel project but the is a expo mobile app in this folder /mobile_app and the main frontend and admin area is on the /website folder

## Dashboard Plan (Required)

Read `docs/design/dashboard/README.md` before dashboard, run-map, run-lifecycle, or driver delivery-note upload work. It is the canonical intended behaviour and implementation handoff.

Whenever the dashboard plan changes, update that README in the same task, including its revision history, acceptance criteria, and implementation status. Keep the affected Figma designs consistent with the plan. Do not describe a planned feature as already implemented.

## Release Notes Policy (Required)

For every code change (feature, fix, refactor, migration, endpoint change), update `docs/release-notes.md` in the same task.

Rules:
1. Add newest entries at the top.
2. Include:
   - Date (YYYY-MM-DD)
   - Version/tag
   - Summary
   - API Changes
   - Database Changes
   - Behavior Changes
   - Breaking Changes (or None)
   - Verification
3. If no user-facing/runtime impact, still add a short `Internal Changes` note.
4. Do not finish a task until release notes are updated.

## GitHub Desktop Commit Draft (Required)

After every change, update the current repository's draft directly in GitHub Desktop's **Commit summary** and **Commit description** fields. Do not create `COMMIT_MESSAGE.txt` or another commit-message file.

1. Before finishing a task, inspect `git status --short`, staged/unstaged diffs and relevant untracked files. Draft a title and description reflecting the full pending change set, not just the last edit.
2. Verify that GitHub Desktop is showing this repository before editing its draft. Use supported UI automation to fill the Commit summary and Commit description fields, then read them back to verify the update.
3. Use a concise imperative summary (aim for 72 characters or fewer). Explain the concrete changes and their purpose in the description, including verification actually performed and material remaining limitations. Avoid generic titles such as “debug” or “updates”.
4. Replace stale draft text as the pending scope changes; do not append a history of previous drafts. After a commit, draft only the next pending changes. If the user selected a specific subset for the next commit, describe that subset without changing their selection.
5. Do not stage, discard or modify unrelated changes, create a commit, amend an existing commit or push merely to update the draft. Leave the Commit button for the user unless committing is explicitly requested.
6. If GitHub Desktop or its draft fields cannot be accessed, report that limitation and provide the proposed summary/description in the response. Do not substitute a file or claim the draft was updated.
