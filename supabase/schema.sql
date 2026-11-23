-- =====================================================================
-- CeutaPlay · Base de datos en Supabase
--
-- Cómo usarlo: en tu proyecto de Supabase ve a "SQL Editor" → "New query",
-- pega TODO este archivo y pulsa "Run". Se puede ejecutar varias veces.
--
-- Qué crea:
--   perfiles  → nombre visible de cada usuario (se crea solo al registrarse)
--   subastas  → subastas de reservas entre usuarios
--   pujas     → pujas de cada subasta
--   reservas  → reservas de pistas de pádel
--
-- Las reglas importantes (puja mínima, plazos, no pujar en tu propia
-- subasta, etc.) se comprueban AQUÍ, en el servidor, así que nadie puede
-- saltárselas desde el navegador.
-- =====================================================================


-- ---------- TABLAS ----------

create table if not exists public.perfiles (
    id      uuid primary key references auth.users (id) on delete cascade,
    nombre  text not null check (char_length(nombre) between 2 and 40),
    creado  timestamptz not null default now()
);

create table if not exists public.subastas (
    id              uuid primary key default gen_random_uuid(),
    instalacion_id  integer not null,
    titulo          text not null check (char_length(titulo) <= 100),
    deporte         text not null check (char_length(deporte) <= 40),
    fecha           date not null,
    hora            text not null check (hora ~ '^\d{2}:\d{2}$'),
    descripcion     text not null default '' check (char_length(descripcion) <= 200),
    precio_salida   integer not null check (precio_salida >= 1),
    incremento      integer not null check (incremento >= 1),
    fin             timestamptz not null,
    vendedor_id     uuid not null references public.perfiles (id) on delete cascade,
    cancelada       boolean not null default false,
    creada          timestamptz not null default now()
);

create table if not exists public.pujas (
    id          bigint generated always as identity primary key,
    subasta_id  uuid not null references public.subastas (id) on delete cascade,
    usuario_id  uuid not null references public.perfiles (id) on delete cascade,
    cantidad    integer not null check (cantidad >= 1),
    fecha       timestamptz not null default now()
);

create index if not exists pujas_subasta_idx on public.pujas (subasta_id, cantidad desc);

create table if not exists public.reservas (
    id              uuid primary key default gen_random_uuid(),
    usuario_id      uuid not null default auth.uid() references public.perfiles (id) on delete cascade,
    instalacion_id  integer not null,
    pista           text not null check (char_length(pista) <= 60),
    fecha           date not null,
    hora            text not null check (hora ~ '^\d{2}:\d{2}$'),
    creada          timestamptz not null default now(),
    -- una pista solo se puede reservar una vez por turno
    unique (instalacion_id, pista, fecha, hora)
);


-- ---------- PERFIL AUTOMÁTICO AL REGISTRARSE ----------

create or replace function public.crear_perfil()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    insert into public.perfiles (id, nombre)
    values (
        new.id,
        left(coalesce(nullif(trim(new.raw_user_meta_data ->> 'nombre'), ''), split_part(new.email, '@', 1)), 40)
    )
    on conflict (id) do nothing;
    return new;
end;
$$;

drop trigger if exists al_crear_usuario on auth.users;
create trigger al_crear_usuario
    after insert on auth.users
    for each row execute function public.crear_perfil();


-- ---------- SEGURIDAD (Row Level Security) ----------
-- Todo el mundo puede LEER perfiles, subastas y pujas (para ver las subastas
-- sin iniciar sesión). Nadie puede escribir directamente en esas tablas:
-- solo a través de las funciones de abajo, que validan cada operación.

alter table public.perfiles enable row level security;
alter table public.subastas enable row level security;
alter table public.pujas    enable row level security;
alter table public.reservas enable row level security;

drop policy if exists "perfiles visibles" on public.perfiles;
create policy "perfiles visibles" on public.perfiles for select using (true);

drop policy if exists "subastas visibles" on public.subastas;
create policy "subastas visibles" on public.subastas for select using (true);

drop policy if exists "pujas visibles" on public.pujas;
create policy "pujas visibles" on public.pujas for select using (true);

-- Reservas: los usuarios con sesión ven las reservas (para saber qué pistas
-- están ocupadas) y solo pueden crear o borrar las suyas.
drop policy if exists "reservas visibles" on public.reservas;
create policy "reservas visibles" on public.reservas for select to authenticated using (true);

drop policy if exists "crear mis reservas" on public.reservas;
create policy "crear mis reservas" on public.reservas for insert to authenticated
    with check (usuario_id = auth.uid() and (fecha + hora::time) > (now() at time zone 'Europe/Madrid'));

drop policy if exists "borrar mis reservas" on public.reservas;
create policy "borrar mis reservas" on public.reservas for delete to authenticated
    using (usuario_id = auth.uid());


-- ---------- FUNCIONES ----------

-- Hora del servidor, para que la cuenta atrás sea igual en todos los dispositivos
create or replace function public.hora_servidor()
returns timestamptz
language sql
stable
as $$ select now(); $$;


create or replace function public.crear_subasta(
    p_instalacion_id integer,
    p_titulo         text,
    p_deporte        text,
    p_fecha          date,
    p_hora           text,
    p_precio_salida  integer,
    p_incremento     integer,
    p_duracion_min   integer,
    p_descripcion    text default ''
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    v_fin timestamptz;
    v_id  uuid;
begin
    if auth.uid() is null then
        raise exception 'Tienes que iniciar sesión.';
    end if;
    if p_precio_salida is null or p_precio_salida < 1 then
        raise exception 'El precio de salida debe ser de al menos 1 €.';
    end if;
    if p_incremento is null or p_incremento < 1 then
        raise exception 'El incremento mínimo debe ser de al menos 1 €.';
    end if;
    if p_duracion_min is null or p_duracion_min < 1 or p_duracion_min > 7 * 24 * 60 then
        raise exception 'Elige la duración de la subasta.';
    end if;
    if p_fecha is null or p_hora is null or p_hora !~ '^\d{2}:\d{2}$' then
        raise exception 'Indica la fecha y la hora del partido.';
    end if;

    v_fin := now() + make_interval(mins => p_duracion_min);

    if ((p_fecha + p_hora::time) at time zone 'Europe/Madrid') <= v_fin then
        raise exception 'La subasta tiene que terminar antes de que empiece el partido.';
    end if;

    insert into public.subastas
        (instalacion_id, titulo, deporte, fecha, hora, descripcion, precio_salida, incremento, fin, vendedor_id)
    values
        (p_instalacion_id, left(p_titulo, 100), left(p_deporte, 40), p_fecha, p_hora,
         left(coalesce(trim(p_descripcion), ''), 200), p_precio_salida, p_incremento, v_fin, auth.uid())
    returning id into v_id;

    return v_id;
end;
$$;


create or replace function public.pujar(p_subasta uuid, p_cantidad integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_subasta public.subastas%rowtype;
    v_mejor   public.pujas%rowtype;
    v_minima  integer;
begin
    if auth.uid() is null then
        raise exception 'Tienes que iniciar sesión.';
    end if;

    -- Bloquea la subasta: si dos personas pujan a la vez, la segunda espera
    -- a que termine la primera y se valida contra el precio ya actualizado.
    select * into v_subasta from public.subastas where id = p_subasta for update;

    if not found then
        raise exception 'La subasta no existe.';
    end if;
    if v_subasta.cancelada or now() >= v_subasta.fin then
        raise exception 'Esta subasta ya no está activa.';
    end if;
    if v_subasta.vendedor_id = auth.uid() then
        raise exception 'No puedes pujar en tu propia subasta.';
    end if;

    select * into v_mejor from public.pujas
        where subasta_id = p_subasta
        order by cantidad desc, fecha asc
        limit 1;

    if v_mejor.id is not null and v_mejor.usuario_id = auth.uid() then
        raise exception 'Ya tienes la puja más alta.';
    end if;

    v_minima := case when v_mejor.id is null then v_subasta.precio_salida
                     else v_mejor.cantidad + v_subasta.incremento end;

    if p_cantidad is null or p_cantidad < v_minima then
        raise exception 'La puja mínima es de % €.', v_minima;
    end if;

    insert into public.pujas (subasta_id, usuario_id, cantidad)
    values (p_subasta, auth.uid(), p_cantidad);
end;
$$;


create or replace function public.cancelar_subasta(p_subasta uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_subasta public.subastas%rowtype;
begin
    select * into v_subasta from public.subastas where id = p_subasta for update;

    if not found then
        raise exception 'La subasta no existe.';
    end if;
    if v_subasta.vendedor_id is distinct from auth.uid() then
        raise exception 'Solo el creador puede cancelarla.';
    end if;
    if exists (select 1 from public.pujas where subasta_id = p_subasta) then
        raise exception 'No se puede cancelar una subasta que ya tiene pujas.';
    end if;

    update public.subastas set cancelada = true where id = p_subasta;
end;
$$;

revoke execute on function public.crear_subasta(integer, text, text, date, text, integer, integer, integer, text) from public, anon;
revoke execute on function public.pujar(uuid, integer) from public, anon;
revoke execute on function public.cancelar_subasta(uuid) from public, anon;
grant execute on function public.crear_subasta(integer, text, text, date, text, integer, integer, integer, text) to authenticated;
grant execute on function public.pujar(uuid, integer) to authenticated;
grant execute on function public.cancelar_subasta(uuid) to authenticated;
grant execute on function public.hora_servidor() to anon, authenticated;


-- ---------- TIEMPO REAL ----------
-- Para que las pujas aparezcan al momento en todos los dispositivos.

do $$
declare
    t text;
begin
    foreach t in array array['perfiles', 'subastas', 'pujas', 'reservas'] loop
        if not exists (
            select 1 from pg_publication_tables
            where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
        ) then
            execute format('alter publication supabase_realtime add table public.%I', t);
        end if;
    end loop;
end;
$$;
