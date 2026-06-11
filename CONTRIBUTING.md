# Contributing to Nuit

Thank you for considering contributing to Nuit! This document outlines the guidelines for contributing to this project.

## Table of Contents

- [Contributing to Nuit](#contributing-to-nuit)
  - [Table of Contents](#table-of-contents)
  - [Getting Started](#getting-started)
  - [Development Setup](#development-setup)
  - [Code Style](#code-style)
    - [Naming Conventions](#naming-conventions)
  - [Making new Modules](#making-new-modules)
  - [Submitting Changes](#submitting-changes)
  - [Pull Request Guidelines](#pull-request-guidelines)
    - [Pull Request Checklist](#pull-request-checklist)
  - [Issues](#issues)
    - [Reporting Bugs](#reporting-bugs)
    - [Suggesting Features](#suggesting-features)
  - [Questions?](#questions)

## Getting Started

Before you begin, please make sure you have the following setup:

- [Bun](https://bun.sh/) runtime installed
- Git installed and set up
- A Discord account with a bot set up
- Access to a PostgreSQL database
  - We use Supabase, you can use whatever you want but it's better tested there

## Development Setup

Follow [our installation docs](https://nuit-bot.github.io/Docs/installation.html)

## Code Style

- We use TypeScript for type safety
- Follow consistent formatting using Prettier
- Use meaningful variable and function names
- Write clear comments for complex logic
- Follow the existing code patterns in the project

### Naming Conventions

- File names: camelCase (e.g., `myFile.ts`)
- Variable names: camelCase (e.g., `clientReady`)
- Constants: UPPER_SNAKE_CASE (e.g., `MAX_MESSAGE_LENGTH`)

## Making new Modules

> [!NOTE]
> This applies only to first-party modules. For third-party ones, you can also follow this but use a Git repo instead of step 1 and remove the `nuit` field in step 2.

Making a new module is simple:

1. Create a new file in the `src/modules/[moduleName]` directory

2. Add the following to a `package.json`:

```json
{
    "name": "[moduleName]", // the module's name, preferably the one put in the directory from step 1
    "main": "main.ts", // main entry point relative to `src/modules/[moduleName]`
    "nuit": {
        "kind": "" // "internal", "essential", "optional"
    }
}
```

3. Follow the structure of existing commands as a template

Best example is [the main internal module](./src/modules/main/main.ts) or [the example module](https://github.com/Nuit-Bot/module-example)

## Submitting Changes

1. Create a new branch off `main` for your feature or bug fix:

```bash
git checkout -b feat/your-feature-name
# or
git checkout -b fix/issue-description
```

2. Make your changes following the code style guidelines
3. Test your changes thoroughly
4. Commit using [Conventional Commits](https://www.conventionalcommits.org/):

```bash
git commit -m "type(scope): short description"
```

**Types:** `feat`, `fix`, `chore`, `refactor`, `docs`, `test`, `perf`  
**Scopes:** `discord`, `server`, `web`, `modules`, or a specific module name

```bash
# Examples
git commit -m "feat(modules): add welcome message module"
git commit -m "fix(discord): handle missing guild member intent"
```

5. Push your branch and open a PR targeting `main`:

```bash
git push origin feat/your-feature-name
```

> Direct commits to `main` are not allowed.

## Pull Request Guidelines

- Use a clear title following the same convention as commits (`type(scope): description`)
- Explain what changed and why in the description
- Reference any related issues
- Keep PRs focused -- one feature or fix per PR
- Update docs if your change needs it
- AI-generated PRs are allowed, but may be deprioritized for review
- Larger PRs take longer to review -- when possible, split them up

### Pull Request Checklist

- [ ] Code follows the established style guidelines
- [ ] Changes are tested and working properly
- [ ] Commits follow the Conventional Commits format
- [ ] Documentation has been updated if needed
- [ ] Breaking changes are clearly flagged and reviewed by a trusted contributor

## Issues

Before opening an issue, check if it's already been reported.

### Reporting Bugs

- Use a clear, descriptive title
- Include steps to reproduce
- Describe what you expected vs. what actually happened
- Attach any relevant error messages or logs
- Specify your environment (Bun version, OS, etc.)

### Suggesting Features

- Clearly explain the feature and the problem it solves
- Provide examples of how it would work

## Questions?

Open an issue or jump into the Discord server.

Thank you for contributing to Nuit!
