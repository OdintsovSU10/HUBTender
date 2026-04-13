alter table public.tender_registry
  add column if not exists object_coordinates text,
  add column if not exists commission_date timestamptz,
  add column if not exists dashboard_status text;

alter table public.tender_registry
  drop constraint if exists tender_registry_dashboard_status_check;

alter table public.tender_registry
  add constraint tender_registry_dashboard_status_check
  check (dashboard_status in ('calc', 'sent', 'waiting_pd', 'archive') or dashboard_status is null);

update public.tender_registry as tr
set dashboard_status = case
  when tr.is_archived then 'archive'
  when exists (
    select 1
    from public.tender_statuses ts
    where ts.id = tr.status_id
      and (
        lower(ts.name) like '%выиграл%'
        or lower(ts.name) like '%проиграл%'
      )
  ) then 'archive'
  when exists (
    select 1
    from public.tender_statuses ts
    where ts.id = tr.status_id
      and lower(ts.name) = 'направлено'
  ) then 'sent'
  when exists (
    select 1
    from public.tender_statuses ts
    where ts.id = tr.status_id
      and lower(ts.name) = 'в работе'
  ) then 'calc'
  when exists (
    select 1
    from public.tender_statuses ts
    where ts.id = tr.status_id
      and lower(ts.name) like '%ожидаем тендерный пакет%'
  ) then 'waiting_pd'
  when exists (
    select 1
    from public.tender_statuses ts
    where ts.id = tr.status_id
      and lower(ts.name) like '%ожида%'
  ) then 'waiting_pd'
  else 'calc'
end
where tr.dashboard_status is null;

alter table public.tender_registry
  alter column dashboard_status set default 'calc';
