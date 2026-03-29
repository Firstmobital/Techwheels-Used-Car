import { createClient } from '@supabase/supabase-js';

const importMeta = /** @type {any} */ (import.meta);
const env = importMeta.env || {};
const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
