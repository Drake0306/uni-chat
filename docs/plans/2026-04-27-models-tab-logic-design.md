# Models tab — logic design

Date: 2026-04-27

## Decisions (all approved 2026-04-27)

| Question | Choice |
|---|---|
| Selector behavior | Picker shows **only starred** models. Unstarred = hidden from composer's selector entirely. |
| Default for new users | Hardcoded recommended subset (5 flagships) when no Supabase row exists. |
| Selection storage | Supabase per-user, synced across devices. New table `user_model_selections (user_id, model_id, created_at)`. |
| Effort picker location | Composer toolbar, alongside thinking/vision/files toggles. Only renders for models that support effort levels. |
| Effort persistence | Per-chat — resets each new chat (matches existing thinking/vision toggle behavior). |
| Effort declaration | Explicit `effortLevels?: ('low' \| 'medium' \| 'high')[]` on each Model. |
| Free-tier effort | Free users get **no effort picker** and request omits thinking entirely ("fast" = no thinking). Paid tiers get the full picker for models that declare `effortLevels`. |
| Price tier scale | Symbol-based: `'$' \| '$$' \| '$$$' \| '$$$$'`. Only set on paid models; free models render the FREE badge instead. |
| BYOK | Field added (`byok?: boolean`) for badge rendering. No actual key-storage plumbing yet — that's the API Keys tab's problem. |

## New `Model` fields

```ts
type Model = {
  // existing fields …
  description?: string;                                // short marketing line
  priceTier?: '$' | '$$' | '$$$' | '$$$$';            // only on free=false models
  byok?: boolean;                                      // visual only for now
  effortLevels?: ('low' | 'medium' | 'high')[];        // present iff thinking-capable
};
```

## Default recommended subset (used when no Supabase row exists)

```ts
const DEFAULT_RECOMMENDED = new Set([
  'gemini-2.5-flash',
  'gemini-2.5-pro',
  'gpt-oss-120b',
  'meta-llama-4-scout-fast',
  'deepseek-r1-free',
]);
```

Five enabled, free flagships covering: fast multimodal, thinking with vision, OpenAI lineage, Llama 4 with long context, popular reasoning.

## Supabase schema

```sql
create table user_model_selections (
  user_id uuid not null references profiles(id) on delete cascade,
  model_id text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, model_id)
);

alter table user_model_selections enable row level security;

create policy "users read their own selections"
  on user_model_selections for select
  using (auth.uid() = user_id);

create policy "users manage their own selections"
  on user_model_selections for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

`model_id` is a free text column — it references `Model.id` from `models.ts` but isn't a real FK (models.ts is code-driven, not a DB table).

## Sequencing

Three chunks, executed in separate sessions so each is reviewable.

**Chunk 1 (this session) — schema + types**
- Add the four new fields to `Model` type.
- Backfill values across all models in `models.ts` (descriptions, price tiers for paid, effortLevels for thinking).
- Update `settings-models-tab.svelte` to render the new fields (description as the row subtitle, $-tier indicator, BYOK badge).
- Add the Supabase migration file. Don't push it yet — user runs migrations themselves.

**Chunk 2 — recommended → selector wiring**
- Add `selectionsStore` reading/writing to `user_model_selections`.
- On load: hydrate from Supabase; if empty, use `DEFAULT_RECOMMENDED`.
- Star toggle in Models tab calls into the store (upsert / delete row).
- `model-selector.svelte` filters its model list through the store.
- Guests fall back to `DEFAULT_RECOMMENDED` only (no localStorage shadow — keeps it simple).

**Chunk 3 — effort control**
- Add effort picker to chat composer toolbar (similar to thinking/vision toggles).
- Renders only when `selectedModel.effortLevels` is defined and the user's tier is paid.
- Plumb effort through `/api/chat` to providers (per-provider translation: Anthropic budget tokens, OpenAI `reasoning_effort`, Gemini thinking budget).
- Free-tier requests on thinking-capable models omit the thinking parameter entirely.

## Out of scope

- BYOK key storage — separate spec, lives with API Keys tab.
- Filter checkboxes on Models tab actually filtering — separate small task; design phase rendered them as no-ops.
- Real `Fast` and `Effort Control` semantics for the filter dropdown — drop or repurpose later.
