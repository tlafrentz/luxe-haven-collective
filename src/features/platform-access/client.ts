// Minimal structural client type -- deliberately decoupled from generated
// Supabase Database types (which don't cover these new tables/functions
// yet) so callers can pass any real Supabase client, and tests can pass a
// trivial mock, without a type-only dependency on the whole client shape.
export type PlatformAccessClient = Readonly<{
  rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
}>;
