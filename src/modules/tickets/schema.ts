import { pgTable, bigserial, text } from "drizzle-orm/pg-core";

export const ticketsTable = pgTable("module_nuit_bot_module_tickets_tickets", {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    reason: text("reason"),
    ownerId: text("ownerId").notNull().default("0"),
    assignees: text("assignees").array().default([]),
});
