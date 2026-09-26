-- Second witness: registry events pushed by Curvegrid MultiBaas webhooks (signed, see
-- src/witness.ts). Kept apart from the index: nothing here is ever copied into titles or
-- transfers; the API only compares the two.

create table witness_events (
  tx           text not null,
  log_index    int not null,
  batch_index  int not null,
  block_hash   text not null,
  block        bigint not null,
  delivery_id  text not null,
  grader       text not null references graders(label),
  registry     text not null,
  kind         text not null check (kind in ('transfer', 'mint', 'burn')),
  from_addr    text not null,
  to_addr      text not null,
  token_id     numeric(78) not null,
  removed      boolean not null default false,
  triggered_at timestamptz,
  received_at  timestamptz not null default now(),
  primary key (tx, log_index, batch_index, block_hash)
);
create index witness_events_block on witness_events (block desc);

-- One row per accepted delivery (for the "last heard from" line and the delivery count).
create table witness_deliveries (
  id          bigserial primary key,
  received_at timestamptz not null default now(),
  events      int not null,
  ignored     int not null
);
