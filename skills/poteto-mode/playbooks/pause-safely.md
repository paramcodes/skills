### Pause safely

**You own a clean stop. Leave a checkpoint a cold-start agent can resume from.** This is explicit only. On "keep going", "going to bed, keep going", or "don't stop", do not pause.

This is the complement to `playbooks/session-pickup.md`: pickup reads the trail this playbook leaves.

What can trigger a pause here is the end of a session or subagent, a context compaction, or the user stepping away. A Cursor-style window restart does not exist on this machine, so the durable artifacts below are the only thing that survives; assume nothing is carried in your head.

1. Stop at a safe boundary. Finish the current atomic step or back out of it. Start nothing new, and cancel any nested subagents.
2. Take no irreversible action to pause. No PR and no push unless you already had one out.
3. Make the work durable. Commit uncommitted edits as one clear `wip:` commit on the current branch so nothing is lost. If the tree is broken, say so in the commit body in one line. Never delete or reset uncommitted work to pause — committing is the pause-safe move.
4. Write the resume note off-context. Capture intent, what you were doing, progress and what's verified, current state, next steps, key files, and gotchas. For a compaction trigger write it to a file like `.worktrees/<slug>-resume.md` under the project root. If a show-me-your-work trail exists, point at it instead of duplicating it. Name the worktree path so a cold-start agent knows where to `cd` before it edits anything.
5. Name the resume command. The note ends with the exact command or step that restarts the work, so the next agent needs no chat history.

**Reply:** where you are in the loop, what's on disk versus still in your head (paths, no diff dumps), the commits you made and whether the tree is clean, where the resume note lives, and the first action on resume. This is a pause, not a final report.