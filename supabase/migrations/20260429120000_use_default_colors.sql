-- Per-user opt-out flag for the custom light-mode palette.
-- When true, the client adds .use-default-colors to <html> and the cream +
-- yellow custom palette in app.css is overridden back to stock shadcn
-- light-mode values. Affects light mode only — dark mode CSS is independent.
-- Default false so existing users keep the new palette by default.

alter table public.profiles
	add column if not exists use_default_colors boolean not null default false;
