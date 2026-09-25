-- Off-chain, signed data (EIP-712): trade interest and grading submissions. Unlike the event
-- index, these rows are not derivable from the chain, and none of them moves a title.

create table offers (
  id          bigserial primary key,
  grader      text not null references graders(label),
  cert        text not null,
  kind        text not null check (kind in ('ask', 'bid')),
  from_addr   text not null,
  price_jpy   bigint not null,
  note        text not null default '',
  nonce       numeric(78) not null,
  expiry      timestamptz not null,
  signature   text not null,
  status      text not null default 'open' check (status in ('open', 'withdrawn')),
  created_at  timestamptz not null default now(),
  unique (from_addr, nonce)
);
create index offers_title on offers (grader, cert, status);

create table submissions (
  id                  bigserial primary key,
  grader              text not null references graders(label),
  submitter           text not null,
  card                text not null,
  declared_value_jpy  bigint not null,
  service             text not null,
  status              text not null default 'received' check (status in ('received', 'grading', 'sealed', 'issued', 'rejected')),
  grade               text,
  cert                text,
  issue_tx            text,
  nonce               numeric(78) not null,
  signature           text not null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (submitter, nonce)
);
create index submissions_grader on submissions (grader, status);
create index submissions_submitter on submissions (submitter);

create table used_nonces (
  signer text not null,
  nonce  numeric(78) not null,
  primary key (signer, nonce)
);
