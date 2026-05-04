import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@nuit-bot/api";

let supabase: SupabaseClient<Database> | null = null;

export function getSupabaseClient(): SupabaseClient<Database> {
    if (!supabase) {
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_KEY;

        if (!supabaseUrl || !supabaseKey) {
            throw new Error(
                "Supabase URL and Key must be set in environment variables",
            );
        }

        supabase = createClient<Database>(supabaseUrl, supabaseKey, {
            auth: {
                flowType: "pkce",
            },
        });
    }
    return supabase;
}
