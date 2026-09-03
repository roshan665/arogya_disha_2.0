import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://iwinomhcofhouapfirjo.supabase.co';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml3aW5vbWhjb2Zob3VhcGZpcmpvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgzNDM1OTgsImV4cCI6MjEwMzkxOTU5OH0.Vm5RHwbzKTlbyw8RiU92HqMdfIaMMFtnpAcCPSRw_uE';

  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
