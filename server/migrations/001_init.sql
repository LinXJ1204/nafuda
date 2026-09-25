-- Index of on-chain events. Everything here can be rebuilt from the chain: it is a cache for
-- lists, stats and search. Title pages still resolve through ENS in the browser.

create table graders (
  label             text primary key,
  ens_name          text not null,
  short             text not null,
  name              text not null,
  color             text not null,
  grader            text not null,
  registry          text not null,
  controller        text not null,
  controller_version int not null
);

create table blocks (
  number bigint primary key,
  time   timestamptz not null
);

create table titles (
  grader         text not null references graders(label),
  cert           text not null,
  label_id       numeric(78) not null,
  card           text not null,
  grade          text not null,
  grade_score    real not null,
  chip           text not null,
  holder         text not null,
  issued_block   bigint not null,
  issued_tx      text not null,
  issued_at      timestamptz not null,
  attributes     jsonb not null default '{}',
  transfer_count int not null default 0,
  last_price_jpy int,
  last_transfer_at timestamptz,
  primary key (grader, cert)
);
create index titles_holder on titles (holder);
create index titles_issued on titles (issued_block desc);

create table transfers (
  grader    text not null references graders(label),
  cert      text not null,
  from_addr text not null,
  to_addr   text not null,
  block     bigint not null,
  log_index int not null,
  tx        text not null,
  time      timestamptz not null,
  price_jpy int,
  primary key (tx, log_index)
);
create index transfers_title on transfers (grader, cert, block);
create index transfers_time on transfers (block desc, log_index desc);
create index transfers_from on transfers (from_addr);
create index transfers_to on transfers (to_addr);

create table indexer_state (
  key   text primary key,
  value bigint not null
);
