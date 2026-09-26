-- The declared price as Curvegrid's copy of the transaction carries it (read from the calldata
-- MultiBaas sends with each event). price_seen is false for rows received before this, and for
-- transactions without readable calldata: nothing is compared for those.

alter table witness_events add column price_seen boolean not null default false;
alter table witness_events add column price_jpy int;
