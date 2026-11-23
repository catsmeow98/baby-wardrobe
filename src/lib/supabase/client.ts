import { createBrowserClient } from '@supabase/ssr';
import { env } from '@/lib/env';

/** For client components. */
export const createClient = () => createBrowserClient(env.supabaseUrl(), env.supabaseAnonKey());
