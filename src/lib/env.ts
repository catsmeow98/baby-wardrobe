function required(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Missing environment variable ${name}. Copy .env.example to .env.local and fill it in.`);
  return value;
}

// Next.js only inlines NEXT_PUBLIC_ variables when they are referenced literally, so each one is spelled out.
export const env = {
  supabaseUrl: () => required('NEXT_PUBLIC_SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL),
  supabaseAnonKey: () => required('NEXT_PUBLIC_SUPABASE_ANON_KEY', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  siteUrl: () => process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000',
};
