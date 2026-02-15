---
description: Git branching strategy and commit workflow for QuranNotes. Use before making any code changes.
---

# Git Flow — QuranNotes

> **Golden rule:** Never commit directly to `main`. All work happens on feature/fix branches.

## Branch Structure

| Branch | Purpose | Merges Into |
|:-------|:--------|:------------|
| `main` | Production-ready code. Always stable & deployable. | — |
| `develop` | Integration branch. All features merge here first. | `main` (via PR) |
| `feature/<name>` | New features | `develop` |
| `fix/<name>` | Bug fixes | `develop` |
| `hotfix/<name>` | Critical production fixes | `main` + `develop` |
| `release/<version>` | Pre-release stabilization | `main` + `develop` |

## Workflow Steps

### 1. Starting New Work

```bash
# Always start from develop
git checkout develop
git pull origin develop

# Create a feature or fix branch
git checkout -b feature/trophy-button    # for features
git checkout -b fix/delete-account-freeze # for bugs
```

### 2. Making Commits

**Commit messages follow Conventional Commits:**

```
<type>(<scope>): <short description>

Types: feat, fix, refactor, style, docs, chore, test
Scope: khatma, auth, toast, audio, mood, ui, etc.
```

**Examples:**
```bash
git commit -m "feat(khatma): restore trophy button visibility on completion"
git commit -m "fix(auth): resolve screen freeze on account deletion"
git commit -m "style(toast): redesign notifications with Headspace-inspired UI"
git commit -m "chore: remove node_modules from git tracking"
```

**Rules:**
- Keep commits atomic — one logical change per commit
- Never mix feature code with unrelated fixes in the same commit
- Write messages in imperative mood ("add" not "added")

### 3. Pushing & Creating PRs

```bash
# Push the branch
git push origin feature/trophy-button

# Then create a PR on GitHub:
# feature/* → develop
# hotfix/* → main
```

### 4. Merging to Main (Releases)

```bash
# When develop is stable and ready for release:
git checkout main
git pull origin main
git merge develop --no-ff -m "release: v1.x.x"
git tag v1.x.x
git push origin main --tags
```

### 5. Hotfixes (Critical Production Bugs)

```bash
git checkout main
git checkout -b hotfix/crash-fix
# ... fix the bug ...
git commit -m "fix(auth): prevent crash on sign-out"
git checkout main && git merge hotfix/crash-fix --no-ff
git checkout develop && git merge hotfix/crash-fix --no-ff
git push origin main develop
```

## Pre-Commit Checklist
// turbo-all

1. Run TypeScript check
```bash
npx tsc --noEmit
```

2. Verify no debug code left
```bash
grep -rn "console.log\|debugger\|TODO.*HACK" src/ app/ --include="*.ts" --include="*.tsx" | head -20
```

3. Check git diff before committing
```bash
git diff --stat
```

## Rules for the AI Assistant

1. **Before ANY code changes:** Create a feature/fix branch from `develop`
2. **After changes:** Make atomic commits with conventional commit messages
3. **Never force push** to `main` or `develop`
4. **Always run `npx tsc --noEmit`** before committing
5. **Group related changes** into single commits, unrelated changes into separate commits
6. **Tag releases** when merging to `main` for App Store builds
