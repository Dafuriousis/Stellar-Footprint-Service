# Contributing to Stellar Footprint Service

Thank you for your interest in contributing! This guide covers everything you need to get started.

## Table of Contents

- [Fork and Clone](#fork-and-clone)
- [Local Development Setup](#local-development-setup)
- [Code Style](#code-style)
- [Commit Message Format](#commit-message-format)
- [Pull Request Process](#pull-request-process)
- [Issue Labels](#issue-labels)

---

## Fork and Clone

1. **Fork** the repository by clicking the **Fork** button on [GitHub](https://github.com/Dafuriousis/Stellar-Footprint-Service).

2. **Clone** your fork locally:
   ```bash
   git clone https://github.com/<your-username>/Stellar-Footprint-Service.git
   cd Stellar-Footprint-Service
   ```

3. **Add the upstream remote** so you can pull in future changes:
   ```bash
   git remote add upstream https://github.com/Dafuriousis/Stellar-Footprint-Service.git
   ```

4. **Create a branch** for your work:
   ```bash
   git checkout -b feature/your-feature-name
   ```

---

## Local Development Setup

### Prerequisites

- Node.js >= 22
- pnpm (preferred) or npm
- Git

### Steps

1. **Install dependencies:**

   ```bash
   pnpm install
   ```

2. **Configure environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env with your RPC URLs and settings
   ```

3. **Build the project:**

   ```bash
   pnpm run build
   ```

4. **Start the development server:**
   ```bash
   pnpm run dev
   ```

5. **Run tests:**
   ```bash
   pnpm test
   ```

### Available Scripts

| Script | Description |
|---|---|
| `pnpm run dev` | Start dev server with hot reload |
| `pnpm run build` | Compile TypeScript |
| `pnpm run start` | Start production server |
| `pnpm run lint` | Run ESLint |
| `pnpm run lint:fix` | Auto-fix lint issues |
| `pnpm run format` | Format code with Prettier |
| `pnpm run format:check` | Check formatting without writing |
| `pnpm test` | Run test suite |

---

## Code Style

This project enforces consistent style via ESLint, Prettier, and TypeScript strict mode.

### ESLint

- Config: `eslint.config.mjs`
- Only `console.warn` and `console.error` are allowed — no `console.log`
- Run: `pnpm run lint`

### Prettier

- Config: `prettier.config.cjs`
- Run: `pnpm run format`

### TypeScript

- Strict mode is enabled — all new code must be fully typed
- Config: `tsconfig.json`

### Pre-commit Hooks

Husky runs lint and branch name validation automatically before each commit. Commits are rejected if checks fail.

Branch names must follow one of these patterns:

- Protected: `main`, `develop`, `live`
- Prefixed: `feature/`, `fix/`, `refactor/`, `hotfix/`, `release/`, `chore/`, `docs/`

---

## Commit Message Format

This project follows [Conventional Commits](https://www.conventionalcommits.org/):

```
type(scope): short description

[optional body]

[optional footer — e.g. Closes #123]
```

### Types

| Type | When to use |
|---|---|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `style` | Formatting, no logic change |
| `refactor` | Code restructure, no behavior change |
| `test` | Adding or updating tests |
| `chore` | Maintenance, dependency updates |

### Examples

```
feat(api): add batch simulation endpoint
fix(metrics): correct cache hit counter
docs(contributing): add fork and clone instructions
refactor(optimizer): simplify footprint deduplication
test(simulator): add edge case for expired ledger entries
chore(deps): update @stellar/stellar-sdk to 12.1.0
```

### Rules

- Use present tense: "add" not "added"
- Keep the subject line under 72 characters
- Reference issues in the footer: `Closes #42`

---

## Pull Request Process

1. **Sync with upstream** before opening a PR:
   ```bash
   git fetch upstream
   git rebase upstream/main
   ```

2. **Run all checks locally:**
   ```bash
   pnpm run lint
   pnpm run format:check
   pnpm run build
   pnpm test
   ```

3. **Open a pull request** against the `main` branch with:
   - A clear title using the commit format (e.g. `feat(api): add restore endpoint`)
   - A description explaining what changed and why
   - A reference to the related issue (e.g. `Closes #12`)

4. **PR Checklist**

   - [ ] Code follows the style guidelines
   - [ ] All existing tests pass
   - [ ] New tests are included for new functionality
   - [ ] No linting or formatting errors
   - [ ] Documentation is updated if needed
   - [ ] Breaking changes are clearly noted in the PR description

5. **Address review feedback** — push additional commits to the same branch; do not open a new PR.

6. **Squash commits** if requested by a maintainer before merging.

---

## Issue Labels

| Label | Description |
|---|---|
| `bug` | Something is broken or behaving incorrectly |
| `enhancement` | A new feature or improvement to existing behavior |
| `documentation` | Improvements or additions to docs |
| `good first issue` | Suitable for first-time contributors |
| `help wanted` | Extra attention or expertise needed |
| `question` | Further information is requested |
| `duplicate` | This issue or PR already exists |
| `wontfix` | This will not be worked on |
| `performance` | Related to speed, memory, or resource usage |
| `security` | Security-related concern or fix |
| `dependencies` | Dependency update or version bump |
| `testing` | Related to test coverage or test infrastructure |

---

Thank you for contributing to Stellar Footprint Service — every improvement helps the Stellar/Soroban community. 🚀
