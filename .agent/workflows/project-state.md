---
description: Maintain a living project state file that persists context across sessions. Use at the start and end of every significant work session.
---

# Project State Tracking — QuranNotes

> The "brain" of the project. One file that any AI or human can read to instantly know where the project stands.

## When to Use
- **Session start** — read `STATE.md` to get context
- **Session end** — update `STATE.md` with what changed
- **Major decisions** — log the decision and rationale immediately
- **Blockers encountered** — log them so the next session knows

## The STATE.md File

Create/maintain `STATE.md` in the project root:

```markdown
# Project State — QuranNotes

## Current Position
- **Phase:** {e.g., "V1.1 Polish — Khatma + Mood fixes"}
- **Focus:** {What's actively being worked on}
- **Status:** {🟢 On track | 🟡 Blocked | 🔴 Critical issue}
- **Last updated:** {ISO timestamp}

## Key Decisions
<!-- Most recent first. Never delete entries. -->

| Date | Decision | Rationale | Reversible? |
|------|----------|-----------|-------------|
| {date} | {what was decided} | {why} | {yes/no} |

## Recently Completed (Last 5)
1. {What was done} — {date}
2. ...

## Active Blockers
<!-- Remove when resolved, but add a "Resolved" entry to Key Decisions -->

- [ ] {Blocker description} — {who/what is needed}

## Known Technical Debt
<!-- Track for future cleanup. Don't let it grow silently. -->

- [ ] {Debt description} — {impact level: low/medium/high}

## Environment Notes
<!-- Anything the next session needs to know -->

- Run `npx expo prebuild --clean` after changing `app.json`
- Build number must be manually incremented before archive
- Use `./build-ios.sh` for all iOS builds (handles patches)
- Upload via Transporter (free Mac app), not EAS
```

## Session Protocol

### Starting a Session
1. Read `STATE.md`
2. Check for active blockers
3. Review recently completed items for context
4. Check Key Decisions for relevant architectural choices

### During a Session
- Log key decisions **immediately** — don't wait until the end
- If you encounter a blocker, add it to Active Blockers right away

### Ending a Session
1. Update **Current Position** with new phase/focus/status
2. Move completed work to **Recently Completed** (keep only last 5)
3. Add any new technical debt discovered
4. Update the timestamp
5. If next steps are clear, add them to Current Position → Focus

## Rules
1. **Append-only for Key Decisions** — never delete or modify past decisions
2. **Keep it concise** — living index, not a journal. One line per item.
3. **Recently Completed caps at 5** — older items graduate to git history
4. **Technical Debt max 10** — if it grows past 10, it's time to pay some down
