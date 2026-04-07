-- Recreate execute_version_transfer in environments where an earlier version
-- of the function was already applied without the final additional works logic.

create or replace function public.execute_version_transfer(
  p_source_tender_id uuid,
  p_new_positions jsonb,
  p_matches jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
set statement_timeout = '0'
as $$
declare
  v_source_tender public.tenders%rowtype;
  v_new_tender public.tenders%rowtype;
  v_new_version integer;
  v_positions_inserted integer := 0;
  v_manual_transferred integer := 0;
  v_boq_items_copied integer := 0;
  v_parent_links_restored integer := 0;
  v_cost_volumes_copied integer := 0;
  v_insurance_rows_copied integer := 0;
  v_additional_works_copied integer := 0;
  v_additional_works_skipped integer := 0;
  v_rows_affected integer := 0;
  v_target_parent_id uuid;
  v_target_parent_position_number numeric(10,2);
  v_new_additional_position_id uuid;
  v_new_additional_position_number numeric(10,2);
  v_old_parent record;
  v_additional_work record;
begin
  if p_new_positions is null or jsonb_typeof(p_new_positions) <> 'array' or jsonb_array_length(p_new_positions) = 0 then
    raise exception 'new_positions must be a non-empty json array';
  end if;

  select *
  into v_source_tender
  from public.tenders
  where id = p_source_tender_id;

  if not found then
    raise exception 'Source tender % not found', p_source_tender_id;
  end if;

  v_new_version := coalesce(v_source_tender.version, 0) + 1;

  if exists (
    select 1
    from public.tenders
    where tender_number = v_source_tender.tender_number
      and version = v_new_version
  ) then
    raise exception 'Tender % version % already exists', v_source_tender.tender_number, v_new_version;
  end if;

  create temporary table tmp_new_positions (
    row_index integer not null,
    item_no text,
    hierarchy_level integer not null,
    work_name text not null,
    unit_code text,
    volume numeric(18,6),
    client_note text
  ) on commit drop;

  insert into tmp_new_positions (
    row_index,
    item_no,
    hierarchy_level,
    work_name,
    unit_code,
    volume,
    client_note
  )
  select
    row_index,
    nullif(item_no, ''),
    coalesce(hierarchy_level, 0),
    work_name,
    nullif(unit_code, ''),
    volume,
    nullif(client_note, '')
  from jsonb_to_recordset(p_new_positions) as rows(
    row_index integer,
    item_no text,
    hierarchy_level integer,
    work_name text,
    unit_code text,
    volume numeric(18,6),
    client_note text
  );

  insert into public.tenders (
    title,
    description,
    client_name,
    tender_number,
    submission_deadline,
    version,
    area_client,
    area_sp,
    usd_rate,
    eur_rate,
    cny_rate,
    upload_folder,
    bsm_link,
    tz_link,
    qa_form_link,
    markup_tactic_id,
    apply_subcontract_works_growth,
    apply_subcontract_materials_growth,
    housing_class,
    construction_scope,
    project_folder_link,
    is_archived,
    volume_title
  )
  values (
    v_source_tender.title,
    v_source_tender.description,
    v_source_tender.client_name,
    v_source_tender.tender_number,
    v_source_tender.submission_deadline,
    v_new_version,
    v_source_tender.area_client,
    v_source_tender.area_sp,
    v_source_tender.usd_rate,
    v_source_tender.eur_rate,
    v_source_tender.cny_rate,
    v_source_tender.upload_folder,
    v_source_tender.bsm_link,
    v_source_tender.tz_link,
    v_source_tender.qa_form_link,
    v_source_tender.markup_tactic_id,
    v_source_tender.apply_subcontract_works_growth,
    v_source_tender.apply_subcontract_materials_growth,
    v_source_tender.housing_class,
    v_source_tender.construction_scope,
    v_source_tender.project_folder_link,
    v_source_tender.is_archived,
    v_source_tender.volume_title
  )
  returning * into v_new_tender;

  insert into public.client_positions (
    tender_id,
    position_number,
    item_no,
    work_name,
    unit_code,
    volume,
    client_note,
    hierarchy_level,
    is_additional,
    parent_position_id,
    manual_volume,
    manual_note
  )
  select
    v_new_tender.id,
    src.row_index + 1,
    src.item_no,
    src.work_name,
    units.code,
    src.volume,
    src.client_note,
    src.hierarchy_level,
    false,
    null,
    null,
    null
  from tmp_new_positions src
  left join public.units units on units.code = src.unit_code
  order by src.row_index;

  get diagnostics v_positions_inserted = row_count;

  create temporary table tmp_new_position_map on commit drop as
  select
    cp.id as new_position_id,
    (cp.position_number::integer - 1) as new_row_index
  from public.client_positions cp
  where cp.tender_id = v_new_tender.id
    and cp.is_additional = false;

  create temporary table tmp_matches on commit drop as
  select
    old_position_id,
    new_row_index
  from jsonb_to_recordset(coalesce(p_matches, '[]'::jsonb)) as rows(
    old_position_id uuid,
    new_row_index integer
  );

  create temporary table tmp_old_to_new_position_map on commit drop as
  select
    matches.old_position_id,
    new_map.new_position_id
  from tmp_matches matches
  join tmp_new_position_map new_map on new_map.new_row_index = matches.new_row_index;

  update public.client_positions new_cp
  set
    manual_volume = old_cp.manual_volume,
    manual_note = old_cp.manual_note
  from tmp_matches matches
  join tmp_new_position_map new_map on new_map.new_row_index = matches.new_row_index
  join public.client_positions old_cp on old_cp.id = matches.old_position_id
  where new_cp.id = new_map.new_position_id;

  get diagnostics v_manual_transferred = row_count;

  create temporary table tmp_boq_source on commit drop as
  select
    old_boq.id as old_item_id,
    new_map.new_position_id,
    old_boq.sort_number,
    old_boq.boq_item_type,
    old_boq.material_type,
    old_boq.material_name_id,
    old_boq.work_name_id,
    old_boq.unit_code,
    old_boq.quantity,
    old_boq.base_quantity,
    old_boq.consumption_coefficient,
    old_boq.conversion_coefficient,
    old_boq.delivery_price_type,
    old_boq.delivery_amount,
    old_boq.currency_type,
    old_boq.total_amount,
    old_boq.detail_cost_category_id,
    old_boq.quote_link,
    old_boq.commercial_markup,
    old_boq.total_commercial_material_cost,
    old_boq.total_commercial_work_cost,
    old_boq.description,
    old_boq.unit_rate,
    old_boq.parent_work_item_id,
    row_number() over (
      partition by matches.old_position_id
      order by old_boq.sort_number, old_boq.id
    ) as source_seq
  from tmp_matches matches
  join tmp_new_position_map new_map on new_map.new_row_index = matches.new_row_index
  join public.boq_items old_boq on old_boq.client_position_id = matches.old_position_id;

  insert into public.boq_items (
    tender_id,
    client_position_id,
    sort_number,
    boq_item_type,
    material_type,
    material_name_id,
    work_name_id,
    unit_code,
    quantity,
    base_quantity,
    consumption_coefficient,
    conversion_coefficient,
    delivery_price_type,
    delivery_amount,
    currency_type,
    total_amount,
    detail_cost_category_id,
    quote_link,
    commercial_markup,
    total_commercial_material_cost,
    total_commercial_work_cost,
    parent_work_item_id,
    description,
    unit_rate
  )
  select
    v_new_tender.id,
    src.new_position_id,
    src.sort_number,
    src.boq_item_type,
    src.material_type,
    src.material_name_id,
    src.work_name_id,
    src.unit_code,
    src.quantity,
    src.base_quantity,
    src.consumption_coefficient,
    src.conversion_coefficient,
    src.delivery_price_type,
    src.delivery_amount,
    src.currency_type,
    src.total_amount,
    src.detail_cost_category_id,
    src.quote_link,
    src.commercial_markup,
    src.total_commercial_material_cost,
    src.total_commercial_work_cost,
    null,
    src.description,
    src.unit_rate
  from tmp_boq_source src
  order by src.new_position_id, src.source_seq;

  get diagnostics v_boq_items_copied = row_count;

  create temporary table tmp_boq_item_map on commit drop as
  select
    src.old_item_id,
    new_items.id as new_item_id
  from tmp_boq_source src
  join (
    select
      id,
      client_position_id,
      row_number() over (
        partition by client_position_id
        order by sort_number, id
      ) as target_seq
    from public.boq_items
    where tender_id = v_new_tender.id
  ) new_items
    on new_items.client_position_id = src.new_position_id
   and new_items.target_seq = src.source_seq;

  update public.boq_items target_boq
  set parent_work_item_id = parent_map.new_item_id
  from tmp_boq_source src
  join tmp_boq_item_map child_map on child_map.old_item_id = src.old_item_id
  join tmp_boq_item_map parent_map on parent_map.old_item_id = src.parent_work_item_id
  where target_boq.id = child_map.new_item_id
    and src.parent_work_item_id is not null;

  get diagnostics v_parent_links_restored = row_count;

  create temporary table tmp_additional_boq_source (
    old_item_id uuid,
    new_position_id uuid,
    sort_number integer,
    boq_item_type public.boq_item_type,
    material_type public.material_type,
    material_name_id uuid,
    work_name_id uuid,
    unit_code text,
    quantity numeric(18,6),
    base_quantity numeric(18,6),
    consumption_coefficient numeric(10,4),
    conversion_coefficient numeric(10,4),
    delivery_price_type public.delivery_price_type,
    delivery_amount numeric(15,5),
    currency_type public.currency_type,
    total_amount numeric(18,2),
    detail_cost_category_id uuid,
    quote_link text,
    commercial_markup numeric(10,4),
    total_commercial_material_cost numeric(18,6),
    total_commercial_work_cost numeric(18,6),
    description text,
    unit_rate numeric(18,2),
    parent_work_item_id uuid,
    source_seq integer
  ) on commit drop;

  create temporary table tmp_additional_boq_item_map (
    old_item_id uuid,
    new_item_id uuid
  ) on commit drop;

  for v_additional_work in
    select *
    from public.client_positions
    where tender_id = p_source_tender_id
      and is_additional = true
    order by position_number, id
  loop
    if v_additional_work.parent_position_id is null then
      v_additional_works_skipped := v_additional_works_skipped + 1;
      continue;
    end if;

    v_target_parent_id := null;

    select new_position_id
    into v_target_parent_id
    from tmp_old_to_new_position_map
    where old_position_id = v_additional_work.parent_position_id;

    if v_target_parent_id is null then
      select *
      into v_old_parent
      from public.client_positions
      where id = v_additional_work.parent_position_id;

      if found and v_old_parent.item_no is not null then
        select id
        into v_target_parent_id
        from public.client_positions
        where tender_id = v_new_tender.id
          and is_additional = false
          and item_no = v_old_parent.item_no
          and position_number < v_old_parent.position_number
        order by position_number desc, id desc
        limit 1;

        if v_target_parent_id is null then
          select id
          into v_target_parent_id
          from public.client_positions
          where tender_id = v_new_tender.id
            and is_additional = false
            and item_no = v_old_parent.item_no
            and position_number > v_old_parent.position_number
          order by position_number asc, id asc
          limit 1;
        end if;
      end if;
    end if;

    if v_target_parent_id is null then
      v_additional_works_skipped := v_additional_works_skipped + 1;
      continue;
    end if;

    select position_number
    into v_target_parent_position_number
    from public.client_positions
    where id = v_target_parent_id;

    select coalesce(max(position_number), v_target_parent_position_number) + 0.1
    into v_new_additional_position_number
    from public.client_positions
    where parent_position_id = v_target_parent_id
      and is_additional = true;

    insert into public.client_positions (
      tender_id,
      position_number,
      item_no,
      work_name,
      unit_code,
      volume,
      client_note,
      hierarchy_level,
      is_additional,
      parent_position_id,
      manual_volume,
      manual_note
    )
    values (
      v_new_tender.id,
      v_new_additional_position_number,
      null,
      v_additional_work.work_name,
      v_additional_work.unit_code,
      v_additional_work.volume,
      v_additional_work.client_note,
      coalesce(v_additional_work.hierarchy_level, 0),
      true,
      v_target_parent_id,
      v_additional_work.manual_volume,
      v_additional_work.manual_note
    )
    returning id into v_new_additional_position_id;

    v_additional_works_copied := v_additional_works_copied + 1;

    truncate table tmp_additional_boq_source;
    truncate table tmp_additional_boq_item_map;

    insert into tmp_additional_boq_source (
      old_item_id,
      new_position_id,
      sort_number,
      boq_item_type,
      material_type,
      material_name_id,
      work_name_id,
      unit_code,
      quantity,
      base_quantity,
      consumption_coefficient,
      conversion_coefficient,
      delivery_price_type,
      delivery_amount,
      currency_type,
      total_amount,
      detail_cost_category_id,
      quote_link,
      commercial_markup,
      total_commercial_material_cost,
      total_commercial_work_cost,
      description,
      unit_rate,
      parent_work_item_id,
      source_seq
    )
    select
      old_boq.id,
      v_new_additional_position_id,
      old_boq.sort_number,
      old_boq.boq_item_type,
      old_boq.material_type,
      old_boq.material_name_id,
      old_boq.work_name_id,
      old_boq.unit_code,
      old_boq.quantity,
      old_boq.base_quantity,
      old_boq.consumption_coefficient,
      old_boq.conversion_coefficient,
      old_boq.delivery_price_type,
      old_boq.delivery_amount,
      old_boq.currency_type,
      old_boq.total_amount,
      old_boq.detail_cost_category_id,
      old_boq.quote_link,
      old_boq.commercial_markup,
      old_boq.total_commercial_material_cost,
      old_boq.total_commercial_work_cost,
      old_boq.description,
      old_boq.unit_rate,
      old_boq.parent_work_item_id,
      row_number() over (order by old_boq.sort_number, old_boq.id)
    from public.boq_items old_boq
    where old_boq.client_position_id = v_additional_work.id;

    insert into public.boq_items (
      tender_id,
      client_position_id,
      sort_number,
      boq_item_type,
      material_type,
      material_name_id,
      work_name_id,
      unit_code,
      quantity,
      base_quantity,
      consumption_coefficient,
      conversion_coefficient,
      delivery_price_type,
      delivery_amount,
      currency_type,
      total_amount,
      detail_cost_category_id,
      quote_link,
      commercial_markup,
      total_commercial_material_cost,
      total_commercial_work_cost,
      parent_work_item_id,
      description,
      unit_rate
    )
    select
      v_new_tender.id,
      src.new_position_id,
      src.sort_number,
      src.boq_item_type,
      src.material_type,
      src.material_name_id,
      src.work_name_id,
      src.unit_code,
      src.quantity,
      src.base_quantity,
      src.consumption_coefficient,
      src.conversion_coefficient,
      src.delivery_price_type,
      src.delivery_amount,
      src.currency_type,
      src.total_amount,
      src.detail_cost_category_id,
      src.quote_link,
      src.commercial_markup,
      src.total_commercial_material_cost,
      src.total_commercial_work_cost,
      null,
      src.description,
      src.unit_rate
    from tmp_additional_boq_source src
    order by src.source_seq;

    get diagnostics v_rows_affected = row_count;
    v_boq_items_copied := v_boq_items_copied + v_rows_affected;

    insert into tmp_additional_boq_item_map (old_item_id, new_item_id)
    select
      src.old_item_id,
      new_items.id
    from tmp_additional_boq_source src
    join (
      select
        id,
        row_number() over (order by sort_number, id) as target_seq
      from public.boq_items
      where client_position_id = v_new_additional_position_id
    ) new_items on new_items.target_seq = src.source_seq;

    update public.boq_items target_boq
    set parent_work_item_id = parent_map.new_item_id
    from tmp_additional_boq_source src
    join tmp_additional_boq_item_map child_map on child_map.old_item_id = src.old_item_id
    join tmp_additional_boq_item_map parent_map on parent_map.old_item_id = src.parent_work_item_id
    where target_boq.id = child_map.new_item_id
      and src.parent_work_item_id is not null;

    get diagnostics v_rows_affected = row_count;
    v_parent_links_restored := v_parent_links_restored + v_rows_affected;

    update public.client_positions
    set
      total_material = coalesce((
        select sum(case
          when boq_item_type in ('мат', 'суб-мат', 'мат-комп.') then coalesce(total_amount, 0)
          else 0
        end)
        from public.boq_items
        where client_position_id = v_new_additional_position_id
      ), 0),
      total_works = coalesce((
        select sum(case
          when boq_item_type in ('раб', 'суб-раб', 'раб-комп.') then coalesce(total_amount, 0)
          else 0
        end)
        from public.boq_items
        where client_position_id = v_new_additional_position_id
      ), 0)
    where id = v_new_additional_position_id;
  end loop;

  update public.client_positions target_cp
  set
    total_material = totals.total_material,
    total_works = totals.total_works
  from (
    select
      client_position_id,
      coalesce(sum(case
        when boq_item_type in ('мат', 'суб-мат', 'мат-комп.') then coalesce(total_amount, 0)
        else 0
      end), 0) as total_material,
      coalesce(sum(case
        when boq_item_type in ('раб', 'суб-раб', 'раб-комп.') then coalesce(total_amount, 0)
        else 0
      end), 0) as total_works
    from public.boq_items
    where tender_id = v_new_tender.id
    group by client_position_id
  ) totals
  where target_cp.id = totals.client_position_id;

  insert into public.construction_cost_volumes (
    tender_id,
    detail_cost_category_id,
    volume,
    group_key
  )
  select
    v_new_tender.id,
    detail_cost_category_id,
    volume,
    group_key
  from public.construction_cost_volumes
  where tender_id = p_source_tender_id;

  get diagnostics v_cost_volumes_copied = row_count;

  insert into public.tender_insurance (
    tender_id,
    judicial_pct,
    total_pct,
    apt_price_m2,
    apt_area,
    parking_price_m2,
    parking_area,
    storage_price_m2,
    storage_area
  )
  select
    v_new_tender.id,
    judicial_pct,
    total_pct,
    apt_price_m2,
    apt_area,
    parking_price_m2,
    parking_area,
    storage_price_m2,
    storage_area
  from public.tender_insurance
  where tender_id = p_source_tender_id
  on conflict (tender_id) do update
  set
    judicial_pct = excluded.judicial_pct,
    total_pct = excluded.total_pct,
    apt_price_m2 = excluded.apt_price_m2,
    apt_area = excluded.apt_area,
    parking_price_m2 = excluded.parking_price_m2,
    parking_area = excluded.parking_area,
    storage_price_m2 = excluded.storage_price_m2,
    storage_area = excluded.storage_area;

  get diagnostics v_insurance_rows_copied = row_count;

  return jsonb_build_object(
    'tenderId', v_new_tender.id,
    'version', v_new_version,
    'positionsInserted', v_positions_inserted,
    'manualTransferred', v_manual_transferred,
    'boqItemsCopied', v_boq_items_copied,
    'parentLinksRestored', v_parent_links_restored,
    'costVolumesCopied', v_cost_volumes_copied,
    'insuranceRowsCopied', v_insurance_rows_copied,
    'additionalWorksCopied', v_additional_works_copied,
    'additionalWorksSkipped', v_additional_works_skipped
  );
end;
$$;

revoke all on function public.execute_version_transfer(uuid, jsonb, jsonb) from public;
grant execute on function public.execute_version_transfer(uuid, jsonb, jsonb) to authenticated;
grant execute on function public.execute_version_transfer(uuid, jsonb, jsonb) to service_role;
