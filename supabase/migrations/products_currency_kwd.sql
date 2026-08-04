-- Display shop prices in Kuwaiti Dinar (KWD) to match what MyFatoorah bills.
update public.products set currency = 'KWD' where currency is distinct from 'KWD';
alter table public.products alter column currency set default 'KWD';
