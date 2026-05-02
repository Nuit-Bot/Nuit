# Nuit

Nuit is a Discord bot built with TypeScript and Discord.js. The bot features a modular architecture with dynamic command and event loading capabilities. It supports slash commands and is designed to be easily extensible.

## Features

- Modular architecture with dynamic command and event loading
- Support for slash commands
- Built with TypeScript for type safety
- Uses Bun runtime for fast execution
- Supabase integration for database operations
- Chalk for colorful console logging

## Prerequisites

- [Bun](https://bun.sh/) runtime

## Installation

> [!NOTE]
> A CLI will be released for setting up Nuit someday, for now everything has to be done manually.

- [Development](#development)
- [Production](#production)

### Development

1. Clone the repository
2. Install dependencies:

```bash
bun install
```

3. Set up your environment variables (see section [Environment Variables](#environment-variables))

4. Run the bot in development mode:

```bash
bun run dev
```

> [!WARNING]
> On first boot or when a command's `data` field has been changed, use `bun run dev --register`.

### Production

For production environments, we recommend using `bun ci` to install only production dependencies:

1. Clone the repository
2. Install dependencies for production:

```bash
bun ci
```

3. Set up your environment variables (see section [Environment Variables](#environment-variables))

4. Start the bot in production mode:

```bash
bun run start
```

> [!WARNING]
> If a slash command was added but not registered by the bot, use `bun run start --register`.

## Adding Commands

To add a new slash command:

1. Create a new file in the `src/discord/commands/[category]/` directory
2. Follow the structure of the ping command as a template
3. Export a default object with `data` (SlashCommandBuilder) and `execute` (interaction handler)

## Contributing

We welcome contributions from the community. Please read our [contributing guidelines](./CONTRIBUTING.md) for more information on how to get involved with this project.

Note that we may take longer to review pull requests depending on their size - larger PRs require more time to properly evaluate.

## Environment Variables

Put the following environment variables in your `.env` file:

- `DISCORD_TOKEN`: Your Discord bot token from the Discord Developer Portal
- `DISCORD_CLIENT_ID`: Your Discord bot's client ID
- `DISCORD_CALLBACK_URL`: The URL that's used for Supabase Auth redirecting. See format below
- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_KEY`: Your Supabase secret key (MUST BE SECRET KEY, found in Supabase dashboard > Settings > API Keys)
- `SESSION_SECRET`: A randomized string that's used for storing express-session data

They must be formatted like the following:

```ini
DISCORD_TOKEN=your-discord-bot-token-here
DISCORD_CLIENT_ID=your-discord-client-id
DISCORD_CALLBACK_URL=${base_server_url}/auth/discord/callback
SUPABASE_URL=https://your-supabase-project
SUPABASE_KEY=your-supabase-service-role-key
SESSION_SECRET=randomized-session-secret-here
```
