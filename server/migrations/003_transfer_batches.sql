-- One safeBatchTransferFrom of two or more names emits a single TransferBatch log, so a log no
-- longer identifies one transfer: the position within the batch joins the key.

alter table transfers add column batch_index int not null default 0;
alter table transfers drop constraint transfers_pkey;
alter table transfers add primary key (tx, log_index, batch_index);
