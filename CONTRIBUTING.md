# Contributing to Nuit

Thank you for considering contributing to Nuit! This document outlines the guidelines for contributing to this project.

## Table of Contents

- [Contributing to Nuit](#contributing-to-nuit)
  - [Table of Contents](#table-of-contents)
  - [Getting Started](#getting-started)
  - [Development Setup](#development-setup)
  - [Code Style](#code-style)
    - [Naming Conventions](#naming-conventions)
  - [Adding Commands](#adding-commands)
  - [Submitting Changes](#submitting-changes)
  - [Pull Request Guidelines](#pull-request-guidelines)
    - [Pull Request Checklist](#pull-request-checklist)
  - [Issues](#issues)
    - [Reporting Bugs](#reporting-bugs)
    - [Suggesting Features](#suggesting-features)
  - [Questions?](#questions)

## Getting Started

Before you begin, please make sure you have:

- [Bun](https://bun.sh/) runtime installed
- A Discord bot account with proper permissions
- Access to a Supabase project for database operations (optional for basic development)

## Development Setup

1. Fork the repository
2. Clone your forked repository:

```bash
git clone https://github.com/your-username/nuit.git
cd nuit
```

3. Install dependencies:

```bash
bun install
```

4. Create a `.env` file based on the [README.md](README.md#environment-variables) instructions

5. Run the bot in development mode:

```bash
bun run dev
```

## Code Style

- We use TypeScript for type safety
- Follow consistent formatting using Prettier (if available)
- Use meaningful variable and function names
- Write clear comments for complex logic
- Follow the existing code patterns in the project

### Naming Conventions

- File names: kebab-case (e.g., `my-command.ts`)
- Variable names: camelCase (e.g., `clientReady`)
- Constants: UPPER_SNAKE_CASE (e.g., `MAX_MESSAGE_LENGTH`)

## Adding Commands

To add a new slash command:

1. Create a new file in the `src/discord/commands/[category]/` directory
2. Follow the structure of existing commands as a template
3. Export a default object with:
   - `data`: A `SlashCommandBuilder` instance
   - `execute`: An interaction handler function

Example command structure:

```typescript
import { SlashCommandBuilder } from 'discord.js';

export default {
    data: new SlashCommandBuilder()
        .setName('command-name')
        .setDescription('Description of the command'),
    async execute(interaction) {
        // Command logic here
        await interaction.reply('Command response');
    },
};
```

## Submitting Changes

1. Create a new branch for your feature or bug fix:

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/issue-description
```

2. Make your changes following the code style guidelines
3. Test your changes thoroughly
4. Commit your changes with a clear and descriptive commit message:

```bash
git add .
git commit -m "feat: add new command for user management"
```

5. Push your changes to your fork:

```bash
git push origin feature/your-feature-name
```

## Pull Request Guidelines

When submitting a pull request:

- Use a clear and descriptive title
- Explain the purpose of your changes in the description
- Reference any related issues
- Ensure all tests pass (if applicable)
- Keep pull requests focused on a single feature or bug fix
- Include documentation updates if applicable
- Pull requests must not be entirely AI-generated. PRs that are completely AI-generated will be closed directly.
- Please note that we may take longer to review PRs depending on their size. Larger PRs require more time to properly evaluate.

### Pull Request Checklist

- [ ] Code follows the established style guidelines
- [ ] Changes are tested and working properly
- [ ] Commits are clean and descriptive
- [ ] Documentation has been updated if needed
- [ ] Breaking changes must be avoided at all costs and, if any, reviewed by a trusted contributor

## Issues

When creating an issue, please:

- Use a clear and descriptive title
- Provide a detailed description of the problem
- Include reproduction steps if reporting a bug
- Specify your environment (Node.js/Bun version, OS, etc.)
- Label the issue appropriately if possible

### Reporting Bugs

- Check if the issue has already been reported
- Include steps to reproduce the issue
- Describe the expected behavior vs. the actual behavior
- Provide any relevant error messages or logs

### Suggesting Features

- Explain the proposed feature clearly
- Describe the problem the feature solves
- Provide examples of how the feature could be used

## Questions?

If you have any questions about contributing, feel free to open an issue with your question.

Thank you for contributing to Nuit!
