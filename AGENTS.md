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

## Commit Message Draft (Required)

Maintain `COMMIT_MESSAGE.txt` at the repository root so a relevant commit title and body are ready before the user commits.

1. After every change, including documentation, configuration and tests, refresh the draft before finishing the task.
2. Inspect `git status --short`, the staged and unstaged diffs, and relevant untracked files. Summarize the complete pending change set, not just the last edit. Do not stage, discard or modify unrelated changes to prepare the draft.
3. Write a plain-text Git commit message: a concise imperative title on the first line (aim for 72 characters or fewer), a blank line, then a short body explaining the concrete changes and their purpose. No Markdown title headings or code fences.
4. Include verification actually performed and material remaining limitations. Never claim tests passed or changes were deployed without evidence. Avoid generic titles such as “debug” or “updates”.
5. Rewrite the draft as the pending scope changes; do not append a history of earlier drafts. After a commit, replace stale content when the next change is made. Use the current diff as the source of truth, excluding `COMMIT_MESSAGE.txt` itself from the functional change summary.
6. If asked to commit only a subset of changes, refresh the draft to describe exactly that subset before committing.
7. This requirement maintains a draft only. Do not create commits, amend existing commit messages or push changes unless the user requests it. When authorized, the draft can be used with `git commit -F COMMIT_MESSAGE.txt`.
