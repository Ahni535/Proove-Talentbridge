create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null check (char_length(username) between 2 and 60),
  account_type text not null check (account_type in ('client', 'professional')),
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_account_type text;
  v_username text;
begin
  v_account_type := new.raw_user_meta_data ->> 'account_type';
  if v_account_type is null or v_account_type not in ('client', 'professional') then
    v_account_type := 'client';
  end if;

  v_username := trim(coalesce(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1)));
  if char_length(v_username) < 2 or char_length(v_username) > 60 then
    raise exception 'Username must be between 2 and 60 characters.';
  end if;

  insert into public.profiles (id, username, account_type)
  values (new.id, v_username, v_account_type);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
revoke all on function public.handle_new_user() from public, anon, authenticated;

insert into public.profiles (id, username, account_type)
select
  u.id,
  case
    when char_length(trim(coalesce(u.raw_user_meta_data ->> 'username', split_part(u.email, '@', 1)))) between 2 and 60
      then trim(coalesce(u.raw_user_meta_data ->> 'username', split_part(u.email, '@', 1)))
    else 'User-' || left(u.id::text, 8)
  end,
  case
    when u.raw_user_meta_data ->> 'account_type' in ('client', 'professional')
      then u.raw_user_meta_data ->> 'account_type'
    else 'client'
  end
from auth.users u
on conflict (id) do nothing;

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;
revoke all on public.admin_users from anon, authenticated;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.admin_users where user_id = auth.uid()
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

alter table public.profiles enable row level security;
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;

drop policy if exists "Users and admins can read profiles" on public.profiles;
create policy "Users and admins can read profiles"
  on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin());

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles (id),
  purpose text not null check (purpose in ('premium_subscription', 'project_payment')),
  plan text check (plan in ('monthly', 'six-months', 'yearly')),
  project_reference text,
  amount_ngn integer not null check (amount_ngn > 0),
  narration text not null,
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'rejected')),
  payment_reference text,
  receipt_path text,
  admin_note text,
  reviewed_by uuid references public.admin_users (user_id),
  reviewed_at timestamptz,
  confirmed_by uuid references public.admin_users (user_id),
  created_at timestamptz not null default now(),
  confirmed_at timestamptz,
  constraint payment_purpose_fields check (
    (purpose = 'premium_subscription' and plan is not null and project_reference is null)
    or
    (purpose = 'project_payment' and plan is null and project_reference is not null)
  )
);

alter table public.payments enable row level security;
revoke all on public.payments from anon, authenticated;
grant select (
  id,
  client_id,
  purpose,
  plan,
  project_reference,
  amount_ngn,
  narration,
  status,
  payment_reference,
  receipt_path,
  created_at
) on public.payments to authenticated;
grant insert (client_id, purpose, plan, project_reference, amount_ngn)
  on public.payments to authenticated;
grant update (receipt_path, payment_reference)
  on public.payments to authenticated;

create or replace function public.prepare_payment_request()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_username text;
  v_account_type text;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.';
  end if;

  new.client_id := auth.uid();
  select username, account_type into v_username, v_account_type
  from public.profiles
  where id = auth.uid();

  if v_username is null then
    raise exception 'A registered profile is required before requesting payment.';
  end if;

  if new.purpose = 'premium_subscription' then
    new.amount_ngn := case new.plan
      when 'monthly' then 1500
      when 'six-months' then 7500
      when 'yearly' then 15000
      else null
    end;
    if new.amount_ngn is null then
      raise exception 'Choose a valid Premium plan.';
    end if;
    new.project_reference := null;
    new.narration := v_username || ' – Premium Subscription';
  else
    if v_account_type <> 'client' then
      raise exception 'Only client accounts can request project payments.';
    end if;
    new.plan := null;
    new.project_reference := nullif(trim(new.project_reference), '');
    if new.project_reference is null then
      raise exception 'A project reference is required.';
    end if;
    new.narration := v_username || ' – Project Payment';
  end if;

  new.status := 'pending';
  new.receipt_path := null;
  new.reviewed_by := null;
  new.reviewed_at := null;
  new.confirmed_by := null;
  new.confirmed_at := null;
  new.admin_note := null;
  return new;
end;
$$;

drop trigger if exists prepare_payment_request on public.payments;
create trigger prepare_payment_request
  before insert on public.payments
  for each row execute procedure public.prepare_payment_request();
revoke all on function public.prepare_payment_request() from public, anon, authenticated;

drop policy if exists "Clients and admins can read payments" on public.payments;
create policy "Clients and admins can read payments"
  on public.payments for select to authenticated
  using (client_id = auth.uid() or public.is_admin());

drop policy if exists "Clients can create pending payment requests" on public.payments;
create policy "Clients can create pending payment requests"
  on public.payments for insert to authenticated
  with check (
    client_id = auth.uid()
    and status = 'pending'
    and receipt_path is null
    and reviewed_by is null
    and reviewed_at is null
    and confirmed_by is null
    and confirmed_at is null
  );

drop policy if exists "Clients can attach receipts to their pending payments" on public.payments;
create policy "Clients can attach receipts to their pending payments"
  on public.payments for update to authenticated
  using (client_id = auth.uid() and status = 'pending' and receipt_path is null)
  with check (
    client_id = auth.uid()
    and status = 'pending'
    and reviewed_by is null
    and reviewed_at is null
    and confirmed_by is null
    and confirmed_at is null
    and receipt_path like auth.uid()::text || '/' || id::text || '/%'
  );

create table if not exists public.payment_admin_notifications (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments (id) on delete cascade,
  admin_id uuid not null references public.admin_users (user_id) on delete cascade,
  created_at timestamptz not null default now(),
  seen_at timestamptz
);

alter table public.payment_admin_notifications enable row level security;
revoke all on public.payment_admin_notifications from anon, authenticated;
grant select on public.payment_admin_notifications to authenticated;
grant update (seen_at) on public.payment_admin_notifications to authenticated;

drop policy if exists "Admins can read their payment notifications" on public.payment_admin_notifications;
create policy "Admins can read their payment notifications"
  on public.payment_admin_notifications for select to authenticated
  using (admin_id = auth.uid() and public.is_admin());

drop policy if exists "Admins can mark their payment notifications read" on public.payment_admin_notifications;
create policy "Admins can mark their payment notifications read"
  on public.payment_admin_notifications for update to authenticated
  using (admin_id = auth.uid() and public.is_admin())
  with check (admin_id = auth.uid() and public.is_admin());

create or replace function public.notify_admins_of_receipt()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if old.receipt_path is null and new.receipt_path is not null then
    insert into public.payment_admin_notifications (payment_id, admin_id)
    select new.id, user_id from public.admin_users;
  end if;
  return new;
end;
$$;

drop trigger if exists payment_receipt_submitted on public.payments;
create trigger payment_receipt_submitted
  after update of receipt_path on public.payments
  for each row execute procedure public.notify_admins_of_receipt();
revoke all on function public.notify_admins_of_receipt() from public, anon, authenticated;

create table if not exists public.payout_requests (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles (id),
  project_reference text not null,
  amount_ngn integer not null check (amount_ngn > 0),
  bank_name text not null,
  account_number text not null,
  account_name text not null,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'paid', 'rejected')),
  created_at timestamptz not null default now()
);

alter table public.payout_requests enable row level security;
revoke all on public.payout_requests from anon, authenticated;
grant select on public.payout_requests to authenticated;
grant insert (client_id, project_reference, amount_ngn, bank_name, account_number, account_name)
  on public.payout_requests to authenticated;

drop policy if exists "Clients and admins can read payout requests" on public.payout_requests;
create policy "Clients and admins can read payout requests"
  on public.payout_requests for select to authenticated
  using (client_id = auth.uid() or public.is_admin());

drop policy if exists "Clients can create their own pending payout requests" on public.payout_requests;
create policy "Clients can create their own pending payout requests"
  on public.payout_requests for insert to authenticated
  with check (
    client_id = auth.uid()
    and status = 'pending'
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.account_type = 'professional'
    )
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'payment-receipts',
  'payment-receipts',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Clients upload receipts for their own pending payments" on storage.objects;
create policy "Clients upload receipts for their own pending payments"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'payment-receipts'
    and (storage.foldername(name))[1] = auth.uid()::text
    and (storage.foldername(name))[2] is not null
    and (storage.foldername(name))[3] is null
    and exists (
      select 1 from public.payments p
      where p.id::text = (storage.foldername(name))[2]
        and p.client_id = auth.uid()
        and p.status = 'pending'
        and p.receipt_path is null
    )
  );

drop policy if exists "Clients and admins read authorized receipts" on storage.objects;
create policy "Clients and admins read authorized receipts"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'payment-receipts'
    and exists (
      select 1 from public.payments p
      where p.receipt_path = name
        and (p.client_id = auth.uid() or public.is_admin())
    )
  );

drop policy if exists "Clients remove unlinked receipt uploads" on storage.objects;
create policy "Clients remove unlinked receipt uploads"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'payment-receipts'
    and (storage.foldername(name))[1] = auth.uid()::text
    and exists (
      select 1 from public.payments p
      where p.id::text = (storage.foldername(name))[2]
        and p.client_id = auth.uid()
        and p.status = 'pending'
        and p.receipt_path is null
    )
  );
