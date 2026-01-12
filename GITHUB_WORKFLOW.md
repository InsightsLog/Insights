# GitHub Workflow Guide

This guide documents the GitHub Issues, Labels, and Milestones setup for the Insights project.

## Milestones

Milestones track feature scope aligned with the [ROADMAP.md](ROADMAP.md).

| Milestone | Description | Status |
|-----------|-------------|--------|
| **L0** | Public calendar, search/filter, admin upload | ✅ Shipped |
| **L1** | Auth with magic-link, watchlists, calendar filter | ✅ Shipped |
| **L2** | Email alerts, role-based admin, rate limiting, revision tracking | ✅ Shipped |
| **L3** | Webhooks, full API, billing, organizations | 🚧 In Progress |
| **L4** | Mobile app, calendar integrations, advanced analytics | 📋 Planned |

### Creating Milestones in GitHub

1. Go to **Issues** → **Milestones** → **New milestone**
2. Create milestones:
   - **L0 - Public Calendar** (Due: Dec 2025, Closed)
   - **L1 - Auth + Watchlists** (Due: Jan 2026, Closed)
   - **L2 - Alerts + Admin** (Due: Jan 2026, Closed)
   - **L3 - API + Billing** (Due: TBD)
   - **L4 - Mobile + Integrations** (Due: TBD)

## Labels

Use labels to categorize issues and PRs for quick filtering.

### Type Labels

| Label | Color | Description |
|-------|-------|-------------|
| `bug` | `#d73a4a` (red) | Something isn't working |
| `enhancement` | `#a2eeef` (cyan) | New feature or request |
| `task` | `#0075ca` (blue) | Development task from TASKS.md |
| `docs` | `#0075ca` (blue) | Documentation improvements |
| `refactor` | `#d4c5f9` (purple) | Code improvement (no behavior change) |
| `test` | `#f9d0c4` (peach) | Test additions/improvements |

### Priority Labels

| Label | Color | Description |
|-------|-------|-------------|
| `priority: critical` | `#b60205` (dark red) | Must fix immediately |
| `priority: high` | `#d93f0b` (orange) | Important, do soon |
| `priority: medium` | `#fbca04` (yellow) | Normal priority |
| `priority: low` | `#0e8a16` (green) | Nice to have |

### Status Labels

| Label | Color | Description |
|-------|-------|-------------|
| `in progress` | `#5319e7` (purple) | Currently being worked on |
| `blocked` | `#e99695` (pink) | Waiting on something |
| `ready for review` | `#0e8a16` (green) | PR ready for review |
| `needs discussion` | `#fbca04` (yellow) | Requires team input |

### Scope Labels

| Label | Color | Description |
|-------|-------|-------------|
| `L1` | `#c5def5` (light blue) | Part of L1 milestone (shipped) |
| `L2` | `#bfdadc` (teal) | Part of L2 milestone (shipped) |
| `L3` | `#d4c5f9` (purple) | Part of L3 milestone |
| `L4` | `#f9d0c4` (peach) | Part of L4 milestone |
| `breaking` | `#b60205` (dark red) | Breaking change |
| `security` | `#d73a4a` (red) | Security-related |

### Area Labels

| Label | Color | Description |
|-------|-------|-------------|
| `area: auth` | `#e4e669` (lime) | Authentication/profiles |
| `area: watchlist` | `#e4e669` (lime) | Watchlist feature |
| `area: calendar` | `#e4e669` (lime) | Calendar/releases |
| `area: admin` | `#e4e669` (lime) | Admin upload |
| `area: alerts` | `#e4e669` (lime) | Email/webhook alerts |
| `area: api` | `#e4e669` (lime) | Public REST API |
| `area: billing` | `#e4e669` (lime) | Payments/subscriptions |
| `area: orgs` | `#e4e669` (lime) | Organizations/teams |
| `area: infra` | `#e4e669` (lime) | CI/CD, deployment |

## Issue Workflow

### Creating Issues

1. Use the appropriate template:
   - **Bug report** - For broken functionality
   - **Feature request** - For new features (must map to roadmap)
   - **Task** - For development tasks from TASKS_L2.md

2. Apply labels:
   - One **type** label (bug, enhancement, task)
   - One **priority** label
   - One **scope** label (L2 or L3)
   - Optionally, an **area** label

3. Assign to a milestone (L2 or L3)

### Issue Lifecycle

```
Open → In Progress → Ready for Review → Closed
         ↓
      Blocked (if waiting)
```

## PR Workflow

### Creating PRs

1. Fill out the PR template completely
2. Apply labels from the Labels section in the template
3. Link to related issue(s) with "Closes #123" or "Fixes #123"
4. Request review when ready

### PR Best Practices

- **One task per PR** - Keep changes small and focused
- **Update CHANGELOG.md** - For user-visible changes
- **Include test steps** - How to verify the change works
- **Document risks** - Edge cases and potential issues

## Quick Reference

### Finding Work

- [Open bugs](../../issues?q=is%3Aissue+is%3Aopen+label%3Abug)
- [L2 tasks](../../issues?q=is%3Aissue+is%3Aopen+label%3AL2)
- [High priority](../../issues?q=is%3Aissue+is%3Aopen+label%3A%22priority%3A+high%22)
- [Ready for review PRs](../../pulls?q=is%3Apr+is%3Aopen+label%3A%22ready+for+review%22)

### Useful Searches

- My assigned issues: `is:issue assignee:@me`
- Recent activity: `is:issue sort:updated-desc`
- No labels: `is:issue no:label`

## Setting Up Labels

To create these labels in your GitHub repository:

1. Go to **Issues** → **Labels** → **New label**
2. Create each label with the name, color, and description from the tables above

Alternatively, use the GitHub CLI:

```bash
# Example: Create bug label
gh label create "bug" --color "d73a4a" --description "Something isn't working"

# Create all labels at once (run from repo root)
gh label create "enhancement" --color "a2eeef" --description "New feature or request"
gh label create "task" --color "0075ca" --description "Development task from TASKS.md"
gh label create "docs" --color "0075ca" --description "Documentation improvements"
gh label create "refactor" --color "d4c5f9" --description "Code improvement (no behavior change)"
gh label create "test" --color "f9d0c4" --description "Test additions/improvements"
gh label create "priority: critical" --color "b60205" --description "Must fix immediately"
gh label create "priority: high" --color "d93f0b" --description "Important, do soon"
gh label create "priority: medium" --color "fbca04" --description "Normal priority"
gh label create "priority: low" --color "0e8a16" --description "Nice to have"
gh label create "in progress" --color "5319e7" --description "Currently being worked on"
gh label create "blocked" --color "e99695" --description "Waiting on something"
gh label create "ready for review" --color "0e8a16" --description "PR ready for review"
gh label create "needs discussion" --color "fbca04" --description "Requires team input"
gh label create "L1" --color "c5def5" --description "Part of L1 milestone (shipped)"
gh label create "L2" --color "bfdadc" --description "Part of L2 milestone"
gh label create "L3" --color "d4c5f9" --description "Part of L3 milestone"
gh label create "breaking" --color "b60205" --description "Breaking change"
gh label create "security" --color "d73a4a" --description "Security-related"
gh label create "area: auth" --color "e4e669" --description "Authentication/profiles"
gh label create "area: watchlist" --color "e4e669" --description "Watchlist feature"
gh label create "area: calendar" --color "e4e669" --description "Calendar/releases"
gh label create "area: admin" --color "e4e669" --description "Admin upload"
gh label create "area: alerts" --color "e4e669" --description "Email/webhook alerts"
gh label create "area: infra" --color "e4e669" --description "CI/CD, deployment"
```

## Related Files

- [ROADMAP.md](ROADMAP.md) - Feature roadmap and milestone definitions
- [TASKS_L2.md](TASKS_L2.md) - Current task list
- [TASKS_L1.md](TASKS_L1.md) - L1 task archive
- [BACKLOG.md](BACKLOG.md) - Future improvement ideas
- [SPEC.md](SPEC.md) - Product specification
- [AGENTS.md](AGENTS.md) - Agent coding rules
