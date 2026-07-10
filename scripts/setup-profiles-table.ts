import "dotenv/config";
import postgres from "postgres";

const SQL = `
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select on public.profiles to anon;
grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.profiles to service_role;

alter table public.profiles enable row level security;

drop policy if exists "Profiles are viewable by owner" on public.profiles;
create policy "Profiles are viewable by owner"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "Profiles are updatable by owner" on public.profiles;
create policy "Profiles are updatable by owner"
  on public.profiles for update
  using (auth.uid() = id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
`;

async function main() {
  const connectionString = process.env.NEXT_SUPABASE_DIRECT_CONNECTION_URL;
  if (!connectionString) {
    throw new Error("NEXT_SUPABASE_DIRECT_CONNECTION_URL is not set in .env");
  }

  const sql = postgres(connectionString, { prepare: false });

  console.log("Creating public.profiles table, RLS policies, and trigger...");
  await sql.unsafe(SQL);
  console.log("Done.");

  // Backfill any existing auth.users rows that predate the trigger (e.g. the
  // superadmin, who registered before this table/trigger existed).
  console.log("Backfilling existing auth.users into public.profiles...");
  const result = await sql.unsafe(`
    insert into public.profiles (id, email, full_name, avatar_url)
    select id, email, raw_user_meta_data ->> 'full_name', raw_user_meta_data ->> 'avatar_url'
    from auth.users
    on conflict (id) do nothing
    returning id, email;
  `);
  console.log(`Backfilled ${result.length} row(s):`, result);

  await sql.end();
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
