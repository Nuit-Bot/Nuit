# Nuit Discord Bot - Agent Instructions

See README.md for more general instructions

## Key Technologies

- Runtime: Bun (not Node.js)
- Language: TypeScript
- Framework: Discord.js v14
- Database: Supabase
- Host configuration: TOML format
- Formatter: Prettier

## Project Structure

- `src/discord/` - Discord bot logic, commands, and events
- `src/server/` - Express web server (minimal implementation)
- `src/utility/` - Shared utilities (config loader)
- `src/discord/commands/[category]/` - Slash commands organized by category
- `src/discord/events/[category]/` - Discord event handlers
- `src/discord/utility/` - Bot utilities (loader.ts for dynamic import)

## Essential Commands

- `bun install` - Install dependencies
- `bun run dev` - Run in development mode (with file watching)
- `bun run start` - Run in production mode
- `bun ci` - Install production dependencies only

## Development Workflow

- Add new slash commands by creating files in `src/discord/commands/[category]/`
- Commands must export a default object with `data` (SlashCommandBuilder) and `execute` (interaction handler)
- Events are loaded dynamically from `src/discord/events/[category]/`
- Configuration uses TOML files (config.toml, config.example.toml, config.private.toml)

## Important Notes

- Environment variables go in `.env` file (DISCORD_TOKEN, SUPABASE_URL, SUPABASE_KEY)
- Uses dynamic module loading for commands and events - check loader.ts for implementation details
- The bot runs both Discord client and Express server simultaneously (main.ts)
- Type checking requires TypeScript ^5
- Config loading priority: config.private.toml > config.toml > config.example.toml

## Testing Commands

- Test command loading by adding/removing command files and restarting
- Commands are automatically registered with Discord API on startup
- Use `/ping` command as reference for new command structure

## Gotchas

- Requires Bun runtime (not compatible with npm/yarn workflows without modification)
- Commands are cached in Collection object (client.commands)
- Server runs on PORT environment variable or defaults to 8080
- Intent configuration in discord/main.ts is critical for bot functionality

## Code style

- Always use double quotes instead of single quotes
- Using `ephemeral: true` as a message flag in discord.js is deprecated. Use `flags: MessageFlags.Ephemeral` (`MessageFlags` imported from `discord.js`)
