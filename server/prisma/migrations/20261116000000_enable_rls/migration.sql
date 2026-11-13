-- Lock every table against Supabase's auto-generated Data API (PostgREST).
-- RLS is enabled with no policies, so the anon/authenticated API roles can read nothing.
-- The app connects as the table owner, which bypasses RLS, so the backend is unaffected.
DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
  END LOOP;
END $$;
