import { createClient, SupabaseClient } from "@supabase/supabase-js";

let supabase: SupabaseClient | null = null;

export function getSupabaseClient() {
    if (!supabase) {
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_KEY;

        if (!supabaseUrl || !supabaseKey) {
            throw new Error(
                "Supabase URL and Key must be set in environment variables",
            );
        }

        supabase = createClient(supabaseUrl, supabaseKey, {});
    }
    return supabase;
}
