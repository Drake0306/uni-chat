-- Persistent dismissal of the first-login onboarding tour. Defaults to
-- false for everyone (including users who signed up before this column
-- existed) so the tour shows on their next sign-in too. The user can
-- mark it true via the "Don't show again" toggle on the tour's final
-- step; existing RLS policy on profiles ("Users can update own profile")
-- already permits the write — no additional policy needed.
alter table public.profiles
  add column onboarding_dismissed boolean not null default false;
