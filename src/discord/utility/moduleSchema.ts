import { sql } from "drizzle-orm";
import { eq } from "drizzle-orm";
import { getTableName, isTable } from "drizzle-orm/table";
import { db } from "../../db/main";
import { module_runtime_state } from "../../db/schema";
import { moduleSlug } from "./moduleApi";

const tableColumns = Symbol.for("drizzle:Columns");
const stateKey = "module-lockfile";

type ModuleSchema = Record<string, unknown>;
type LockfileSnapshot = Record<string, { version?: string; commit?: string }>;

function quoteIdent(value: string) {
    return sql.identifier(value);
}

function validateTableName(moduleName: string, tableName: string) {
    const prefix = `module_${moduleSlug(moduleName)}_`;

    if (!/^[a-z][a-z0-9_]*$/.test(tableName)) {
        throw new Error(`Table "${tableName}" must be lowercase snake case.`);
    }

    if (!tableName.startsWith(prefix)) {
        throw new Error(`Table "${tableName}" must start with "${prefix}".`);
    }
}

function columnSql(column: any) {
    const name = column.name;
    const type = column.getSQLType?.();

    if (typeof name !== "string" || typeof type !== "string") {
        throw new Error("Could not inspect Drizzle column metadata.");
    }

    const parts = [quoteIdent(name), sql.raw(type)];

    if (column.primary) parts.push(sql.raw("primary key"));
    if (column.notNull) parts.push(sql.raw("not null"));
    if (column.hasDefault) {
        if (typeof column.default === "string") {
            parts.push(sql.raw(`default '${column.default}'`));
        } else if (
            typeof column.default === "number" ||
            typeof column.default === "boolean"
        ) {
            parts.push(sql.raw("default " + String(column.default)));
        }
    }

    return sql.join(parts, sql.raw(" "));
}

function createTableSql(table: unknown) {
    const tableName = getTableName(table as any);
    const columns = Object.values((table as any)[tableColumns] ?? {}).map(
        columnSql,
    );

    if (columns.length === 0) {
        throw new Error(`Table "${tableName}" does not define any columns.`);
    }

    return sql`create table if not exists ${quoteIdent(tableName)} (${sql.join(
        columns,
        sql.raw(", "),
    )})`;
}

export function getModuleTables(moduleName: string, exportedSchema: unknown) {
    if (exportedSchema === undefined) return [];
    if (
        typeof exportedSchema !== "object" ||
        exportedSchema === null ||
        Array.isArray(exportedSchema)
    ) {
        throw new Error(
            `Module ${moduleName} exported schema must be an object.`,
        );
    }

    const tables = Object.values(exportedSchema as ModuleSchema);
    for (const table of tables) {
        if (!isTable(table)) {
            throw new Error(
                `Module ${moduleName} schema contains a non-table export.`,
            );
        }

        validateTableName(moduleName, getTableName(table));
    }

    return tables;
}

export async function syncModuleTables(moduleName: string, tables: unknown[]) {
    for (const table of tables) {
        const tableName = getTableName(table as any);
        const existing = await db.execute(sql`
            select column_name
            from information_schema.columns
            where table_schema = 'public' and table_name = ${tableName}
        `);

        const rows = (
            Array.isArray(existing) ? existing : (existing as any).rows
        ) as {
            column_name: string;
        }[];

        // Create table if it doesn't exist
        if (rows?.length === 0) {
            await db.execute(createTableSql(table));
            continue;
        }

        // Add missing columns
        const existingColumns = new Set(rows.map((r) => r.column_name));
        const schemaColumns = (table as any)[tableColumns] ?? {};

        for (const column of Object.values(schemaColumns) as any[]) {
            if (!existingColumns.has(column.name)) {
                console.info(
                    `Module ${moduleName}: adding column ${column.name} to table ${tableName}`,
                );
                const colSql = columnSql(column);
                await db.execute(
                    sql`alter table ${quoteIdent(tableName)} add column ${colSql}`,
                );
            }
        }
    }
}

export async function getPreviousLockfileSnapshot(): Promise<LockfileSnapshot> {
    await ensureRuntimeStateTable();

    const [row] = await db
        .select({ value: module_runtime_state.value })
        .from(module_runtime_state)
        .where(eq(module_runtime_state.key, stateKey))
        .limit(1);

    return (row?.value as { modules?: LockfileSnapshot } | null)?.modules ?? {};
}

export async function saveLockfileSnapshot(snapshot: LockfileSnapshot) {
    await ensureRuntimeStateTable();

    await db
        .insert(module_runtime_state)
        .values({ key: stateKey, value: { modules: snapshot } })
        .onConflictDoUpdate({
            target: module_runtime_state.key,
            set: {
                value: { modules: snapshot },
                updated_at: sql`now()`,
            },
        });
}

async function ensureRuntimeStateTable() {
    await db.execute(sql`
        create table if not exists module_runtime_state (
            key text primary key,
            value jsonb default '{}'::jsonb,
            updated_at timestamp with time zone default now()
        )
    `);
}

export function lockfileModuleChanged(
    moduleName: string,
    current: LockfileSnapshot,
    previous: LockfileSnapshot,
) {
    return (
        JSON.stringify(current[moduleName] ?? null) !==
        JSON.stringify(previous[moduleName] ?? null)
    );
}
