-- =====================================================================
-- CeutaPlay · Plataforma: reservas por tramos, monedero (CeutaCoins),
-- privacidad, comunidad, subastas (última hora y reventa), gestores de
-- instalaciones y pista solidaria.
--
-- Ejecutar en Supabase → SQL Editor → New query → pegar todo → Run,
-- en este orden:  schema.sql → admin.sql → plataforma.sql  (→ seed.sql, opcional)
-- Se puede ejecutar varias veces.
--
-- Resumen:
--   · Reservas de 30 min a 3 h que empiezan cada 30 min. Precio por franja
--     (hora valle = 20 % menos). Se reservan y cancelan con funciones
--     (reservar_pista / cancelar_reserva) que cobran y reembolsan.
--   · Monedero simulado: cada cuenta empieza con 1.000.000 CeutaCoins (CC).
--   · Privacidad: cada usuario solo ve sus reservas, las abiertas (públicas)
--     y aquellas a las que se ha unido. El resto, solo como "turno ocupado".
--   · Comunidad: reservas abiertas a las que otros piden unirse; el dueño
--     acepta o rechaza.
--   · Subastas ⚡ automáticas de última hora y 🔁 reventa de reservas.
--   · Gestores: cada instalación puede tener cuentas que bloquean turnos y
--     ven sus reservas.
--   · Pista solidaria (RSC): entidades acreditadas piden pista; si una pista
--     de última hora se queda sin pujas, se les cede gratis.
--
-- Si cambias instalaciones, pistas, precios u horarios en public/js/data.js,
-- actualiza también el catálogo de este archivo y vuelve a ejecutarlo.
-- =====================================================================


-- =====================================================================
-- UTILIDADES
-- =====================================================================

create or replace function public.minutos(p_hora text)
returns integer
language sql
immutable
as $$ select split_part(p_hora, ':', 1)::integer * 60 + split_part(p_hora, ':', 2)::integer; $$;

create or replace function public.hora_texto(p_minutos integer)
returns text
language sql
immutable
as $$ select lpad((p_minutos / 60)::text, 2, '0') || ':' || lpad((p_minutos % 60)::text, 2, '0'); $$;

-- Igual que precioTurno() en public/js/data.js
create or replace function public.precio_turno(p_precio numeric, p_fecha date, p_hora text, p_duracion integer)
returns numeric
language plpgsql
immutable
as $$
declare
    v_total numeric := 0;
    v_m     integer;
    v_finde boolean := extract(isodow from p_fecha) >= 6;
begin
    v_m := public.minutos(p_hora);
    while v_m < public.minutos(p_hora) + p_duracion loop
        v_total := v_total + p_precio * (case when v_finde or v_m >= 17 * 60 then 1 else 0.8 end) * 30 / 60.0;
        v_m := v_m + 30;
    end loop;
    return round(v_total, 2);
end;
$$;

-- Fecha y minutos actuales en Ceuta
create or replace function public.ahora_ceuta()
returns timestamp
language sql
stable
as $$ select now() at time zone 'Europe/Madrid'; $$;

create or replace function public.inicio_turno(p_fecha date, p_hora text)
returns timestamptz
language sql
stable
as $$ select (p_fecha + p_hora::time) at time zone 'Europe/Madrid'; $$;


-- =====================================================================
-- CATÁLOGO DE PISTAS (precios y horarios que necesita el servidor)
-- =====================================================================

create table if not exists public.catalogo_pistas (
    instalacion_id  integer not null,
    pista           text    not null,
    instalacion     text    not null,
    deporte         text    not null,
    precio          integer not null check (precio >= 0),   -- €/h en hora punta
    apertura        text    not null default '09:00',
    cierre          text    not null default '22:00',
    reservable      boolean not null default true,   -- false: instalación pública (ICD)
    subastable      boolean not null default true,   -- se puede revender
    automatica      boolean not null default false,  -- sale sola a subasta de última hora
    primary key (instalacion_id, pista)
);

alter table public.catalogo_pistas add column if not exists apertura text not null default '09:00';
alter table public.catalogo_pistas add column if not exists cierre text not null default '22:00';
alter table public.catalogo_pistas add column if not exists reservable boolean not null default true;
alter table public.catalogo_pistas drop column if exists horas;

alter table public.catalogo_pistas enable row level security;
grant select on public.catalogo_pistas to anon, authenticated;
drop policy if exists "catalogo visible" on public.catalogo_pistas;
create policy "catalogo visible" on public.catalogo_pistas for select using (true);

-- Generado a partir de public/js/data.js
insert into public.catalogo_pistas
    (instalacion_id, pista, instalacion, deporte, precio, apertura, cierre, reservable, subastable, automatica)
values
    (1, 'Pista 1', 'Pádel La Marina', 'Pádel', 20, '09:00', '22:00', true, true, true),
    (1, 'Pista 2', 'Pádel La Marina', 'Pádel', 20, '09:00', '22:00', true, true, true),
    (1, 'Pista 3', 'Pádel La Marina', 'Pádel', 20, '09:00', '22:00', true, true, true),
    (4, 'Doble 1', 'Pádel Jardines de la Hípica', 'Pádel', 15, '09:00', '22:00', true, true, true),
    (4, 'Doble 2', 'Pádel Jardines de la Hípica', 'Pádel', 15, '09:00', '22:00', true, true, true),
    (4, 'Individual', 'Pádel Jardines de la Hípica', 'Pádel', 15, '09:00', '22:00', true, true, true),
    (5, 'Pista de demostración', 'Pádel Loma Colmenar', 'Pádel', 12, '09:00', '22:00', true, true, true),
    (2, 'Campo José Benoliel', 'Campo Federativo José Benoliel', 'Fútbol', 45, '09:00', '22:00', false, false, false),
    (9, 'Pista de fútbol sala', 'Pista Polideportiva José Zurrón', 'Fútbol', 12, '09:00', '22:00', false, false, false),
    (10, 'Tuhami Al Lal', 'Campos de Fútbol del Príncipe', 'Fútbol', 25, '09:00', '22:00', false, false, false),
    (10, 'Aiman Aomar', 'Campos de Fútbol del Príncipe', 'Fútbol', 25, '09:00', '22:00', false, false, false),
    (11, 'Pista de fútbol sala', 'Pista Polígono Virgen de África', 'Fútbol', 12, '09:00', '22:00', false, false, false),
    (12, 'Campo José Martínez Pirri', 'Campo José Martínez Pirri', 'Fútbol', 45, '09:00', '22:00', false, false, false),
    (13, 'Campo Emilio Cózar', 'Campo Emilio Cózar', 'Fútbol', 25, '09:00', '22:00', false, false, false),
    (14, 'Pista polideportiva', 'Pista Deportiva Juan XXIII', 'Fútbol', 15, '09:00', '22:00', false, false, false),
    (15, 'Pista cubierta de fútbol sala', 'Polideportivo Santa Amelia', 'Fútbol', 20, '09:00', '22:00', false, false, false),
    (3, 'Pista 1', 'Tenis La Marina', 'Tenis', 15, '09:00', '22:00', true, true, true),
    (3, 'Pista 2', 'Tenis La Marina', 'Tenis', 15, '09:00', '22:00', true, true, true),
    (6, 'Pista 1', 'Club de Tenis y Pádel Loma Margarita', 'Tenis', 15, '09:00', '22:00', true, true, true),
    (6, 'Pista 2', 'Club de Tenis y Pádel Loma Margarita', 'Tenis', 15, '09:00', '22:00', true, true, true),
    (6, 'Pista 3', 'Club de Tenis y Pádel Loma Margarita', 'Tenis', 15, '09:00', '22:00', true, true, true),
    (6, 'Pista 4', 'Club de Tenis y Pádel Loma Margarita', 'Tenis', 15, '09:00', '22:00', true, true, true),
    (6, 'Pista 5', 'Club de Tenis y Pádel Loma Margarita', 'Tenis', 15, '09:00', '22:00', true, true, true),
    (6, 'Pista 6', 'Club de Tenis y Pádel Loma Margarita', 'Tenis', 15, '09:00', '22:00', true, true, true),
    (7, 'Pista 1', 'Club de Tenis Perla del Mediterráneo', 'Tenis', 15, '09:00', '22:00', true, true, true),
    (7, 'Pista 2', 'Club de Tenis Perla del Mediterráneo', 'Tenis', 15, '09:00', '22:00', true, true, true),
    (7, 'Pista 3', 'Club de Tenis Perla del Mediterráneo', 'Tenis', 15, '09:00', '22:00', true, true, true),
    (8, 'Pista 1', 'Club de Tenis Ceuta', 'Tenis', 15, '09:00', '22:00', true, true, true),
    (8, 'Pista 2', 'Club de Tenis Ceuta', 'Tenis', 15, '09:00', '22:00', true, true, true),
    (8, 'Pista 3', 'Club de Tenis Ceuta', 'Tenis', 15, '09:00', '22:00', true, true, true),
    (16, 'Kayak 1', 'Kayak con Ceuta Kayak', 'Kayak', 12, '10:00', '19:00', true, false, false),
    (16, 'Kayak 2', 'Kayak con Ceuta Kayak', 'Kayak', 12, '10:00', '19:00', true, false, false),
    (16, 'Kayak 3', 'Kayak con Ceuta Kayak', 'Kayak', 12, '10:00', '19:00', true, false, false),
    (17, 'Tabla 1', 'Paddle surf con Ceuta Kayak', 'Paddle surf', 15, '10:00', '19:00', true, false, false),
    (17, 'Tabla 2', 'Paddle surf con Ceuta Kayak', 'Paddle surf', 15, '10:00', '19:00', true, false, false),
    (17, 'Tabla 3', 'Paddle surf con Ceuta Kayak', 'Paddle surf', 15, '10:00', '19:00', true, false, false),
    (18, 'Piragua 1', 'Piragüismo con Ceuta Kayak', 'Piragüismo', 14, '10:00', '19:00', true, false, false),
    (18, 'Piragua 2', 'Piragüismo con Ceuta Kayak', 'Piragüismo', 14, '10:00', '19:00', true, false, false)

on conflict (instalacion_id, pista) do update set
    instalacion = excluded.instalacion, deporte = excluded.deporte, precio = excluded.precio,
    apertura = excluded.apertura, cierre = excluded.cierre, reservable = excluded.reservable,
    subastable = excluded.subastable, automatica = excluded.automatica;


-- =====================================================================
-- PERFILES: biografía y deporte favorito (para la comunidad)
-- =====================================================================

alter table public.perfiles add column if not exists bio text not null default '' check (char_length(bio) <= 280);
alter table public.perfiles add column if not exists deporte_favorito text not null default '' check (char_length(deporte_favorito) <= 40);

create or replace function public.actualizar_perfil(p_nombre text, p_bio text, p_deporte text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    if auth.uid() is null then
        raise exception 'Tienes que iniciar sesión.';
    end if;
    -- el trigger perfiles_validar_nombre (admin.sql) rechaza nombres no permitidos
    update public.perfiles
        set nombre = btrim(p_nombre),
            bio = left(coalesce(btrim(p_bio), ''), 280),
            deporte_favorito = left(coalesce(btrim(p_deporte), ''), 40)
        where id = auth.uid();
end;
$$;

revoke execute on function public.actualizar_perfil(text, text, text) from public, anon;
grant execute on function public.actualizar_perfil(text, text, text) to authenticated;


-- =====================================================================
-- MONEDERO (simulacro de pago con CeutaCoins)
-- =====================================================================

create table if not exists public.movimientos (
    id          bigint generated always as identity primary key,
    usuario_id  uuid not null references public.perfiles (id) on delete cascade,
    importe     numeric(12,2) not null,           -- positivo: entra · negativo: sale
    tipo        text not null check (tipo in ('bienvenida', 'recarga', 'reserva', 'reembolso',
                                              'subasta', 'venta', 'bonificacion', 'ajuste')),
    concepto    text not null check (char_length(concepto) <= 160),
    referencia  uuid,
    creado      timestamptz not null default now()
);

create index if not exists movimientos_usuario_idx on public.movimientos (usuario_id, creado desc);

alter table public.movimientos enable row level security;
grant select on public.movimientos to authenticated;
drop policy if exists "ver mis movimientos" on public.movimientos;
create policy "ver mis movimientos" on public.movimientos for select to authenticated
    using (usuario_id = auth.uid() or public.es_admin());

create or replace function public.saldo_de(p_usuario uuid)
returns numeric
language sql
stable
security definer
set search_path = public
as $$ select coalesce(sum(importe), 0) from public.movimientos where usuario_id = p_usuario; $$;

revoke execute on function public.saldo_de(uuid) from public, anon, authenticated;

create or replace function public.mover_saldo(p_usuario uuid, p_importe numeric, p_tipo text, p_concepto text, p_ref uuid default null)
returns void
language sql
security definer
set search_path = public
as $$
    insert into public.movimientos (usuario_id, importe, tipo, concepto, referencia)
    values (p_usuario, round(p_importe, 2), p_tipo, left(p_concepto, 160), p_ref);
$$;

revoke execute on function public.mover_saldo(uuid, numeric, text, text, uuid) from public, anon, authenticated;

-- Saldo inicial de 1.000.000 CC para cada cuenta nueva
create or replace function public.saldo_bienvenida()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    perform public.mover_saldo(new.id, 1000000, 'bienvenida', 'Saldo inicial de CeutaCoins');
    return new;
end;
$$;

drop trigger if exists perfiles_saldo_bienvenida on public.perfiles;
create trigger perfiles_saldo_bienvenida
    after insert on public.perfiles
    for each row execute function public.saldo_bienvenida();

-- Cuentas que ya existían: también reciben su saldo inicial (una sola vez)
insert into public.movimientos (usuario_id, importe, tipo, concepto)
select p.id, 1000000, 'bienvenida', 'Saldo inicial de CeutaCoins'
from public.perfiles p
where not exists (select 1 from public.movimientos m where m.usuario_id = p.id and m.tipo = 'bienvenida');

-- Recarga simulada (en producción: pasarela de pago)
create or replace function public.recargar_saldo(p_importe numeric)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    if auth.uid() is null then
        raise exception 'Tienes que iniciar sesión.';
    end if;
    if p_importe is null or p_importe < 1 or p_importe > 100000 then
        raise exception 'Recarga entre 1 y 100.000 CC.';
    end if;
    perform public.mover_saldo(auth.uid(), p_importe, 'recarga', 'Recarga de CeutaCoins (simulada)');
end;
$$;

revoke execute on function public.recargar_saldo(numeric) from public, anon;
grant execute on function public.recargar_saldo(numeric) to authenticated;

-- El administrador regala saldo (p. ej. voluntarios de limpieza de playas, RSC)
create or replace function public.admin_bonificar(p_usuario uuid, p_importe numeric, p_concepto text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    if not public.es_admin() then
        raise exception 'Solo un administrador puede hacer esto.';
    end if;
    if p_importe is null or p_importe = 0 or abs(p_importe) > 1000000000 then
        raise exception 'Importe no válido.';
    end if;
    perform public.mover_saldo(p_usuario, p_importe, 'bonificacion',
        coalesce(nullif(btrim(p_concepto), ''), 'Bonificación de CeutaPlay'));
end;
$$;

revoke execute on function public.admin_bonificar(uuid, numeric, text) from public, anon;
grant execute on function public.admin_bonificar(uuid, numeric, text) to authenticated;

-- El administrador fija el saldo exacto de una cuenta (también la suya).
-- Se guarda como un movimiento de ajuste por la diferencia.
create or replace function public.admin_fijar_saldo(p_usuario uuid, p_saldo numeric, p_concepto text default '')
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_diferencia numeric;
begin
    if not public.es_admin() then
        raise exception 'Solo un administrador puede hacer esto.';
    end if;
    if p_saldo is null or p_saldo < 0 or p_saldo > 1000000000 then
        raise exception 'El saldo tiene que estar entre 0 y 1.000.000.000 CC.';
    end if;
    if not exists (select 1 from public.perfiles where id = p_usuario) then
        raise exception 'El usuario no existe.';
    end if;
    v_diferencia := round(p_saldo, 2) - public.saldo_de(p_usuario);
    if v_diferencia <> 0 then
        perform public.mover_saldo(p_usuario, v_diferencia, 'ajuste',
            coalesce(nullif(btrim(p_concepto), ''), 'Ajuste de saldo por el administrador'));
    end if;
end;
$$;

revoke execute on function public.admin_fijar_saldo(uuid, numeric, text) from public, anon;
grant execute on function public.admin_fijar_saldo(uuid, numeric, text) to authenticated;


-- =====================================================================
-- RESERVAS: duración, importe, reservas abiertas y tipos
-- =====================================================================

alter table public.reservas add column if not exists duracion_min integer not null default 60;
alter table public.reservas drop constraint if exists reservas_duracion_check;
alter table public.reservas add constraint reservas_duracion_check
    check (duracion_min between 30 and 180 and duracion_min % 30 = 0);
alter table public.reservas add column if not exists importe numeric(12,2) not null default 0;
alter table public.reservas add column if not exists publica boolean not null default false;
alter table public.reservas add column if not exists plazas smallint not null default 4 check (plazas between 1 and 22);
alter table public.reservas add column if not exists tipo text not null default 'normal';
alter table public.reservas drop constraint if exists reservas_tipo_check;
alter table public.reservas add constraint reservas_tipo_check check (tipo in ('normal', 'bloqueo', 'solidaria'));
alter table public.reservas add column if not exists nota text not null default '' check (char_length(nota) <= 140);

-- Antes había una pista por turno de 1 h; ahora se comprueba que no se solapen
alter table public.reservas drop constraint if exists reservas_instalacion_id_pista_fecha_hora_key;


-- ---------- Gestores de instalaciones ----------

create table if not exists public.gestores (
    usuario_id      uuid not null references public.perfiles (id) on delete cascade,
    instalacion_id  integer not null,
    primary key (usuario_id, instalacion_id)
);

alter table public.gestores enable row level security;
grant select on public.gestores to authenticated;
drop policy if exists "ver gestores" on public.gestores;
create policy "ver gestores" on public.gestores for select to authenticated
    using (usuario_id = auth.uid() or public.es_admin());

create or replace function public.es_gestor(p_instalacion integer)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (select 1 from public.gestores where usuario_id = auth.uid() and instalacion_id = p_instalacion);
$$;

grant execute on function public.es_gestor(integer) to authenticated;


-- ---------- Participantes (unirse a una reserva abierta) ----------

create table if not exists public.participantes (
    reserva_id  uuid not null references public.reservas (id) on delete cascade,
    usuario_id  uuid not null references public.perfiles (id) on delete cascade,
    estado      text not null default 'pendiente' check (estado in ('pendiente', 'aceptado', 'rechazado')),
    mensaje     text not null default '' check (char_length(mensaje) <= 140),
    creado      timestamptz not null default now(),
    primary key (reserva_id, usuario_id)
);

-- Funciones auxiliares (security definer) para evitar que las reglas de
-- reservas y participantes se llamen entre sí en bucle
create or replace function public.es_dueno_reserva(p_reserva uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$ select exists (select 1 from public.reservas where id = p_reserva and usuario_id = auth.uid()); $$;

create or replace function public.participa_en(p_reserva uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (select 1 from public.participantes
                   where reserva_id = p_reserva and usuario_id = auth.uid() and estado = 'aceptado');
$$;

create or replace function public.reserva_publica(p_reserva uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$ select exists (select 1 from public.reservas where id = p_reserva and publica); $$;

grant execute on function public.es_dueno_reserva(uuid), public.participa_en(uuid), public.reserva_publica(uuid) to authenticated;

alter table public.participantes enable row level security;
grant select on public.participantes to authenticated;
drop policy if exists "ver participantes" on public.participantes;
create policy "ver participantes" on public.participantes for select to authenticated
    using (usuario_id = auth.uid() or public.es_dueno_reserva(reserva_id)
           or public.participa_en(reserva_id)
           or (estado = 'aceptado' and public.reserva_publica(reserva_id))
           or public.es_admin());


-- ---------- Privacidad de las reservas ----------
-- Cada usuario ve: las suyas, las abiertas, aquellas a las que se ha unido,
-- y (gestores) las de su instalación. El resto solo como turno ocupado.

drop policy if exists "reservas visibles" on public.reservas;
create policy "reservas visibles" on public.reservas for select to authenticated
    using (usuario_id = auth.uid() or publica or public.participa_en(id)
           or public.es_gestor(instalacion_id) or public.es_admin());

-- Las reservas se crean y cancelan solo con las funciones de abajo (cobran
-- y reembolsan). Nada de escribir directamente en la tabla.
revoke insert, update, delete on public.reservas from authenticated, anon;

-- Turnos ocupados, sin datos personales (para la agenda y la disponibilidad)
drop function if exists public.turnos_ocupados();
drop function if exists public.turnos_ocupados(date, date);
create function public.turnos_ocupados(p_desde date default null, p_hasta date default null)
returns table (id uuid, instalacion_id integer, pista text, fecha date, hora text, duracion_min integer, tipo text)
language sql
stable
security definer
set search_path = public
as $$
    select r.id, r.instalacion_id, r.pista, r.fecha, r.hora, r.duracion_min, r.tipo
    from public.reservas r
    where r.fecha between coalesce(p_desde, public.ahora_ceuta()::date - 1)
                      and least(coalesce(p_hasta, public.ahora_ceuta()::date + 60), public.ahora_ceuta()::date + 120);
$$;

grant execute on function public.turnos_ocupados(date, date) to anon, authenticated;


-- =====================================================================
-- SUBASTAS: formatos, comisión y cierre
-- =====================================================================

alter table public.subastas add column if not exists tipo text not null default 'libre';
alter table public.subastas drop constraint if exists subastas_tipo_check;
alter table public.subastas add constraint subastas_tipo_check check (tipo in ('libre', 'reventa', 'automatica'));
alter table public.subastas add column if not exists pista text check (char_length(pista) <= 60);
alter table public.subastas add column if not exists reserva_id uuid references public.reservas (id) on delete set null;
alter table public.subastas add column if not exists comision_pct numeric(5,2) not null default 15;
alter table public.subastas add column if not exists ipsi_pct numeric(5,2) not null default 4;
alter table public.subastas add column if not exists cerrada boolean not null default false;
alter table public.subastas alter column vendedor_id drop not null;

create unique index if not exists subastas_automatica_unica
    on public.subastas (instalacion_id, pista, fecha, hora)
    where tipo = 'automatica' and not cancelada;

create unique index if not exists subastas_reventa_unica
    on public.subastas (reserva_id)
    where tipo = 'reventa' and not cancelada and not cerrada;

-- Comisión e IPSI vigentes (del panel de facturación; con bonificación por instalación)
create or replace function public.comision_subasta(p_instalacion integer default null)
returns table (comision numeric, ipsi numeric)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
    v jsonb;
begin
    if to_regclass('public.ajustes') is not null then
        execute 'select valor from public.ajustes where clave = ''facturacion''' into v;
    end if;
    v := coalesce(v, '{}'::jsonb);
    comision := coalesce((v -> 'bonificadas' ->> p_instalacion::text)::numeric,
                         (v ->> 'comisionSubastas')::numeric, 15);
    ipsi := coalesce((v ->> 'ipsi')::numeric, 4);
    return next;
end;
$$;

revoke execute on function public.comision_subasta(integer) from public, anon, authenticated;

create or replace function public.tarifas_subastas()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
    select jsonb_build_object('comisionSubastas', c.comision, 'ipsi', c.ipsi) from public.comision_subasta() c;
$$;

grant execute on function public.tarifas_subastas() to anon, authenticated;


-- ---------- Reglas al reservar (solapes y subastas) ----------

create or replace function public.reservas_validar()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_ini integer := public.minutos(new.hora);
    v_fin integer := public.minutos(new.hora) + new.duracion_min;
begin
    if tg_op = 'DELETE' then
        if exists (select 1 from public.subastas
                   where reserva_id = old.id and not cancelada and not cerrada) then
            raise exception 'Esta reserva está en subasta. Cancela antes la subasta (solo si aún no tiene pujas).';
        end if;
        return old;
    end if;

    -- Dos reservas a la vez en la misma pista: la segunda espera a la primera
    perform pg_advisory_xact_lock(hashtext('reserva|' || new.instalacion_id || '|' || new.pista || '|' || new.fecha));

    if exists (select 1 from public.reservas r
               where r.instalacion_id = new.instalacion_id and r.pista = new.pista and r.fecha = new.fecha
                 and r.id <> new.id
                 and public.minutos(r.hora) < v_fin and v_ini < public.minutos(r.hora) + r.duracion_min) then
        raise exception 'Esa pista ya está reservada en parte de ese horario.';
    end if;

    if exists (select 1 from public.subastas s
               where s.tipo = 'automatica' and not s.cancelada and not s.cerrada
                 and s.instalacion_id = new.instalacion_id and s.pista = new.pista and s.fecha = new.fecha
                 and public.minutos(s.hora) < v_fin and v_ini < public.minutos(s.hora) + 60) then
        raise exception 'Parte de ese horario está en subasta de última hora: puja por él en la sección de subastas.';
    end if;
    return new;
end;
$$;

drop trigger if exists reservas_y_subastas on public.reservas;
drop trigger if exists reservas_validar on public.reservas;
create trigger reservas_validar
    before insert or update of instalacion_id, pista, fecha, hora, duracion_min or delete on public.reservas
    for each row execute function public.reservas_validar();


-- ---------- Reservar y cancelar (cobro y reembolso) ----------

create or replace function public.reservar_pista(
    p_instalacion integer,
    p_pista       text,
    p_fecha       date,
    p_hora        text,
    p_duracion    integer,
    p_publica     boolean default false,
    p_plazas      integer default 4,
    p_nota        text default ''
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    v_pista  public.catalogo_pistas%rowtype;
    v_precio numeric;
    v_id     uuid;
begin
    if auth.uid() is null then
        raise exception 'Tienes que iniciar sesión.';
    end if;
    select * into v_pista from public.catalogo_pistas where instalacion_id = p_instalacion and pista = p_pista;
    if not found then
        raise exception 'Esa pista no existe.';
    end if;
    if not v_pista.reservable then
        raise exception 'Esta instalación es pública: se reserva en el Instituto Ceutí de Deportes.';
    end if;
    if p_hora is null or p_hora !~ '^\d{2}:\d{2}$' or public.minutos(p_hora) % 30 <> 0 then
        raise exception 'Las reservas empiezan a en punto o a y media.';
    end if;
    if p_duracion is null or p_duracion < 30 or p_duracion > 180 or p_duracion % 30 <> 0 then
        raise exception 'La duración tiene que ser de 30 min a 3 h, en tramos de 30 min.';
    end if;
    if public.minutos(p_hora) < public.minutos(v_pista.apertura)
       or public.minutos(p_hora) + p_duracion > public.minutos(v_pista.cierre) then
        raise exception 'Fuera del horario de la instalación (% a %).', v_pista.apertura, v_pista.cierre;
    end if;
    if public.inicio_turno(p_fecha, p_hora) <= now() then
        raise exception 'Elige un turno futuro.';
    end if;
    if p_fecha > public.ahora_ceuta()::date + 60 then
        raise exception 'Solo se puede reservar con 60 días de antelación como máximo.';
    end if;

    v_precio := public.precio_turno(v_pista.precio, p_fecha, p_hora, p_duracion);
    if public.saldo_de(auth.uid()) < v_precio then
        raise exception 'No tienes saldo suficiente (necesitas % CC).', v_precio;
    end if;

    insert into public.reservas (usuario_id, instalacion_id, pista, fecha, hora, duracion_min, importe,
                                 publica, mostrar_nombre, plazas, nota)
    values (auth.uid(), p_instalacion, p_pista, p_fecha, p_hora, p_duracion, v_precio,
            coalesce(p_publica, false), coalesce(p_publica, false),
            greatest(1, least(22, coalesce(p_plazas, 4))), left(coalesce(btrim(p_nota), ''), 140))
    returning id into v_id;

    perform public.mover_saldo(auth.uid(), -v_precio, 'reserva',
        v_pista.instalacion || ' · ' || p_pista || ' · ' || to_char(p_fecha, 'DD/MM') || ' ' || p_hora, v_id);
    return v_id;
end;
$$;

revoke execute on function public.reservar_pista(integer, text, date, text, integer, boolean, integer, text) from public, anon;
grant execute on function public.reservar_pista(integer, text, date, text, integer, boolean, integer, text) to authenticated;

-- Cancelar: con más de 24 h de antelación se devuelve todo
create or replace function public.cancelar_reserva(p_reserva uuid)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
    v_res      public.reservas%rowtype;
    v_devuelve numeric := 0;
begin
    select * into v_res from public.reservas where id = p_reserva for update;
    if not found then
        raise exception 'La reserva no existe.';
    end if;
    if v_res.usuario_id <> auth.uid() and not public.es_admin() then
        raise exception 'Solo puedes cancelar tus propias reservas.';
    end if;
    if public.es_admin() and v_res.usuario_id <> auth.uid() then
        v_devuelve := v_res.importe;                          -- el administrador la anula: se devuelve todo
    elsif public.inicio_turno(v_res.fecha, v_res.hora) - now() > interval '24 hours' then
        v_devuelve := v_res.importe;
    end if;
    delete from public.reservas where id = p_reserva;        -- el trigger impide borrar si está en subasta
    if v_devuelve > 0 then
        perform public.mover_saldo(v_res.usuario_id, v_devuelve, 'reembolso', 'Reembolso por cancelación', p_reserva);
    end if;
    return v_devuelve;
end;
$$;

revoke execute on function public.cancelar_reserva(uuid) from public, anon;
grant execute on function public.cancelar_reserva(uuid) to authenticated;

-- Cambiar si una reserva propia es abierta (otros pueden pedir unirse)
create or replace function public.configurar_reserva(p_reserva uuid, p_publica boolean, p_plazas integer, p_nota text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    update public.reservas
        set publica = coalesce(p_publica, false), mostrar_nombre = coalesce(p_publica, false),
            plazas = greatest(1, least(22, coalesce(p_plazas, plazas))),
            nota = left(coalesce(btrim(p_nota), ''), 140)
        where id = p_reserva and usuario_id = auth.uid();
    if not found then
        raise exception 'Solo puedes cambiar tus propias reservas.';
    end if;
end;
$$;

revoke execute on function public.configurar_reserva(uuid, boolean, integer, text) from public, anon;
grant execute on function public.configurar_reserva(uuid, boolean, integer, text) to authenticated;


-- ---------- Unirse a una reserva abierta ----------

create or replace function public.solicitar_unirse(p_reserva uuid, p_mensaje text default '')
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_res public.reservas%rowtype;
begin
    if auth.uid() is null then
        raise exception 'Tienes que iniciar sesión.';
    end if;
    select * into v_res from public.reservas where id = p_reserva;
    if not found or not v_res.publica then
        raise exception 'Esta reserva no está abierta a más jugadores.';
    end if;
    if v_res.usuario_id = auth.uid() then
        raise exception 'Es tu propia reserva.';
    end if;
    if public.inicio_turno(v_res.fecha, v_res.hora) <= now() then
        raise exception 'Esta reserva ya ha empezado.';
    end if;
    if (select count(*) from public.participantes where reserva_id = p_reserva and estado = 'aceptado') + 1 >= v_res.plazas then
        raise exception 'La reserva ya está completa.';
    end if;
    insert into public.participantes (reserva_id, usuario_id, mensaje)
    values (p_reserva, auth.uid(), left(coalesce(btrim(p_mensaje), ''), 140))
    on conflict (reserva_id, usuario_id) do update
        set estado = 'pendiente', mensaje = excluded.mensaje, creado = now()
        where public.participantes.estado = 'rechazado';
end;
$$;

create or replace function public.responder_solicitud(p_reserva uuid, p_usuario uuid, p_aceptar boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_res public.reservas%rowtype;
begin
    select * into v_res from public.reservas where id = p_reserva;
    if not found or v_res.usuario_id <> auth.uid() then
        raise exception 'Solo el dueño de la reserva puede responder.';
    end if;
    if p_aceptar and (select count(*) from public.participantes
                      where reserva_id = p_reserva and estado = 'aceptado') + 1 >= v_res.plazas then
        raise exception 'La reserva ya está completa.';
    end if;
    update public.participantes set estado = case when p_aceptar then 'aceptado' else 'rechazado' end
        where reserva_id = p_reserva and usuario_id = p_usuario;
    if not found then
        raise exception 'No existe esa solicitud.';
    end if;
end;
$$;

create or replace function public.salir_de_reserva(p_reserva uuid)
returns void
language sql
security definer
set search_path = public
as $$ delete from public.participantes where reserva_id = p_reserva and usuario_id = auth.uid(); $$;

revoke execute on function public.solicitar_unirse(uuid, text), public.responder_solicitud(uuid, uuid, boolean),
    public.salir_de_reserva(uuid) from public, anon;
grant execute on function public.solicitar_unirse(uuid, text), public.responder_solicitud(uuid, uuid, boolean),
    public.salir_de_reserva(uuid) to authenticated;


-- ---------- Gestores: bloquear turnos de su instalación ----------

create or replace function public.gestor_bloquear(p_instalacion integer, p_pista text, p_fecha date,
                                                  p_hora text, p_duracion integer, p_nota text default '')
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    v_id uuid;
begin
    if not (public.es_gestor(p_instalacion) or public.es_admin()) then
        raise exception 'Solo los gestores de esta instalación pueden bloquear turnos.';
    end if;
    insert into public.reservas (usuario_id, instalacion_id, pista, fecha, hora, duracion_min, importe, tipo, nota)
    values (auth.uid(), p_instalacion, p_pista, p_fecha, p_hora, p_duracion, 0, 'bloqueo',
            left(coalesce(btrim(p_nota), 'Bloqueado por la instalación'), 140))
    returning id into v_id;
    return v_id;
end;
$$;

create or replace function public.gestor_desbloquear(p_reserva uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    delete from public.reservas r
    where r.id = p_reserva and r.tipo = 'bloqueo'
      and (public.es_gestor(r.instalacion_id) or public.es_admin());
    if not found then
        raise exception 'No se ha podido desbloquear.';
    end if;
end;
$$;

create or replace function public.admin_asignar_gestor(p_usuario uuid, p_instalacion integer, p_asignar boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    if not public.es_admin() then
        raise exception 'Solo un administrador puede hacer esto.';
    end if;
    if p_asignar then
        insert into public.gestores (usuario_id, instalacion_id) values (p_usuario, p_instalacion)
        on conflict do nothing;
    else
        delete from public.gestores where usuario_id = p_usuario and instalacion_id = p_instalacion;
    end if;
end;
$$;

revoke execute on function public.gestor_bloquear(integer, text, date, text, integer, text),
    public.gestor_desbloquear(uuid), public.admin_asignar_gestor(uuid, integer, boolean) from public, anon;
grant execute on function public.gestor_bloquear(integer, text, date, text, integer, text),
    public.gestor_desbloquear(uuid), public.admin_asignar_gestor(uuid, integer, boolean) to authenticated;


-- =====================================================================
-- PISTA SOLIDARIA (RSC)
-- =====================================================================

create table if not exists public.entidades_solidarias (
    usuario_id  uuid primary key references public.perfiles (id) on delete cascade,
    nombre      text not null check (char_length(nombre) between 3 and 80),
    descripcion text not null default '' check (char_length(descripcion) <= 280),
    acreditada  boolean not null default false,
    creada      timestamptz not null default now()
);

create table if not exists public.peticiones_solidarias (
    id              uuid primary key default gen_random_uuid(),
    entidad_id      uuid not null references public.entidades_solidarias (usuario_id) on delete cascade,
    deporte         text not null,
    instalacion_id  integer,                         -- null: cualquier instalación de ese deporte
    fecha           date not null,
    desde           text not null check (desde ~ '^\d{2}:\d{2}$'),
    hasta           text not null check (hasta ~ '^\d{2}:\d{2}$'),
    estado          text not null default 'pendiente' check (estado in ('pendiente', 'cumplida', 'caducada', 'cancelada')),
    reserva_id      uuid references public.reservas (id) on delete set null,
    creada          timestamptz not null default now()
);

alter table public.entidades_solidarias enable row level security;
alter table public.peticiones_solidarias enable row level security;
grant select on public.entidades_solidarias, public.peticiones_solidarias to authenticated;

drop policy if exists "ver entidades" on public.entidades_solidarias;
create policy "ver entidades" on public.entidades_solidarias for select to authenticated
    using (acreditada or usuario_id = auth.uid() or public.es_admin());

drop policy if exists "ver peticiones" on public.peticiones_solidarias;
create policy "ver peticiones" on public.peticiones_solidarias for select to authenticated
    using (entidad_id = auth.uid() or public.es_admin());

create or replace function public.solicitar_entidad(p_nombre text, p_descripcion text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    if auth.uid() is null then
        raise exception 'Tienes que iniciar sesión.';
    end if;
    insert into public.entidades_solidarias (usuario_id, nombre, descripcion)
    values (auth.uid(), btrim(p_nombre), left(coalesce(btrim(p_descripcion), ''), 280))
    on conflict (usuario_id) do update set nombre = excluded.nombre, descripcion = excluded.descripcion;
end;
$$;

create or replace function public.admin_acreditar_entidad(p_usuario uuid, p_acreditar boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    if not public.es_admin() then
        raise exception 'Solo un administrador puede hacer esto.';
    end if;
    update public.entidades_solidarias set acreditada = p_acreditar where usuario_id = p_usuario;
    if not found then
        raise exception 'Ese usuario no ha solicitado ser entidad solidaria.';
    end if;
end;
$$;

create or replace function public.crear_peticion_solidaria(p_deporte text, p_instalacion integer, p_fecha date,
                                                           p_desde text, p_hasta text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    v_id uuid;
begin
    if not exists (select 1 from public.entidades_solidarias where usuario_id = auth.uid() and acreditada) then
        raise exception 'Solo las entidades acreditadas pueden pedir pista solidaria.';
    end if;
    if p_fecha < public.ahora_ceuta()::date or public.minutos(p_hasta) <= public.minutos(p_desde) then
        raise exception 'Revisa la fecha y la franja horaria.';
    end if;
    insert into public.peticiones_solidarias (entidad_id, deporte, instalacion_id, fecha, desde, hasta)
    values (auth.uid(), p_deporte, p_instalacion, p_fecha, p_desde, p_hasta)
    returning id into v_id;
    return v_id;
end;
$$;

create or replace function public.cancelar_peticion_solidaria(p_peticion uuid)
returns void
language sql
security definer
set search_path = public
as $$
    update public.peticiones_solidarias set estado = 'cancelada'
    where id = p_peticion and entidad_id = auth.uid() and estado = 'pendiente';
$$;

revoke execute on function public.solicitar_entidad(text, text), public.admin_acreditar_entidad(uuid, boolean),
    public.crear_peticion_solidaria(text, integer, date, text, text), public.cancelar_peticion_solidaria(uuid) from public, anon;
grant execute on function public.solicitar_entidad(text, text), public.admin_acreditar_entidad(uuid, boolean),
    public.crear_peticion_solidaria(text, integer, date, text, text), public.cancelar_peticion_solidaria(uuid) to authenticated;


-- =====================================================================
-- SUBASTAS: crear, pujar y cerrar
-- =====================================================================

-- ---------- Reventa: subastar una reserva propia ----------
-- p_duracion_min = 0 (o null): la subasta dura hasta que empieza la reserva

drop function if exists public.crear_subasta_reventa(uuid, integer, integer, integer, text);
create function public.crear_subasta_reventa(
    p_reserva        uuid,
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
    v_res     public.reservas%rowtype;
    v_pista   public.catalogo_pistas%rowtype;
    v_inicio  timestamptz;
    v_fin     timestamptz;
    v_com     record;
    v_id      uuid;
begin
    if auth.uid() is null then
        raise exception 'Tienes que iniciar sesión.';
    end if;
    select * into v_res from public.reservas where id = p_reserva for update;
    if not found or v_res.usuario_id <> auth.uid() or v_res.tipo <> 'normal' then
        raise exception 'Solo puedes subastar tus propias reservas.';
    end if;
    select * into v_pista from public.catalogo_pistas
        where instalacion_id = v_res.instalacion_id and pista = v_res.pista;
    if found and not v_pista.subastable then
        raise exception 'Las reservas de esta instalación no se pueden subastar.';
    end if;
    if p_precio_salida is null or p_precio_salida < 1 then
        raise exception 'El precio de salida debe ser de al menos 1 CC.';
    end if;
    if p_incremento is null or p_incremento < 1 then
        raise exception 'El incremento mínimo debe ser de al menos 1 CC.';
    end if;

    v_inicio := public.inicio_turno(v_res.fecha, v_res.hora);
    if v_inicio <= now() + interval '2 minutes' then
        raise exception 'Esta reserva empieza ya: no da tiempo a subastarla.';
    end if;
    if coalesce(p_duracion_min, 0) <= 0 then
        v_fin := v_inicio;                                  -- hasta el inicio de la reserva
    else
        if p_duracion_min > 7 * 24 * 60 then
            raise exception 'Elige la duración de la subasta.';
        end if;
        v_fin := now() + make_interval(mins => p_duracion_min);
        if v_fin > v_inicio then
            raise exception 'La subasta puede durar como máximo hasta que empiece la reserva.';
        end if;
    end if;
    if exists (select 1 from public.subastas
               where reserva_id = p_reserva and tipo = 'reventa' and not cancelada and not cerrada) then
        raise exception 'Esta reserva ya está en subasta.';
    end if;

    select * into v_com from public.comision_subasta(v_res.instalacion_id);

    insert into public.subastas
        (instalacion_id, titulo, deporte, fecha, hora, descripcion, precio_salida, incremento, fin,
         vendedor_id, tipo, pista, reserva_id, comision_pct, ipsi_pct)
    values
        (v_res.instalacion_id,
         left(coalesce(v_pista.instalacion, 'Instalación ' || v_res.instalacion_id), 100),
         left(coalesce(v_pista.deporte, 'Deporte'), 40),
         v_res.fecha, v_res.hora, left(coalesce(btrim(p_descripcion), ''), 200),
         p_precio_salida, p_incremento, v_fin, auth.uid(), 'reventa', v_res.pista, p_reserva,
         v_com.comision, v_com.ipsi)
    returning id into v_id;
    return v_id;
end;
$$;

revoke execute on function public.crear_subasta_reventa(uuid, integer, integer, integer, text) from public, anon;
grant execute on function public.crear_subasta_reventa(uuid, integer, integer, integer, text) to authenticated;


-- ---------- Pujar (ahora comprueba el saldo) ----------

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
    select * into v_mejor from public.pujas where subasta_id = p_subasta
        order by cantidad desc, fecha asc limit 1;
    if v_mejor.id is not null and v_mejor.usuario_id = auth.uid() then
        raise exception 'Ya tienes la puja más alta.';
    end if;
    v_minima := case when v_mejor.id is null then v_subasta.precio_salida
                     else v_mejor.cantidad + v_subasta.incremento end;
    if p_cantidad is null or p_cantidad < v_minima then
        raise exception 'La puja mínima es de % CC.', v_minima;
    end if;
    if public.saldo_de(auth.uid()) < p_cantidad then
        raise exception 'No tienes saldo suficiente para esa puja.';
    end if;
    insert into public.pujas (subasta_id, usuario_id, cantidad) values (p_subasta, auth.uid(), p_cantidad);
end;
$$;


-- ---------- Última hora: pujar por un turno libre ----------

create or replace function public.pujar_hueco(p_instalacion integer, p_fecha date, p_hora text, p_cantidad integer)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    v_pista   public.catalogo_pistas%rowtype;
    v_inicio  timestamptz;
    v_com     record;
    v_id      uuid;
begin
    if auth.uid() is null then
        raise exception 'Tienes que iniciar sesión.';
    end if;
    if p_fecha is null or p_hora is null or p_hora !~ '^\d{2}:\d{2}$' then
        raise exception 'Turno no válido.';
    end if;
    v_inicio := public.inicio_turno(p_fecha, p_hora);
    if now() < v_inicio - interval '12 hours' then
        raise exception 'Este turno todavía no está en subasta de última hora.';
    end if;
    if now() >= v_inicio - interval '15 minutes' then
        raise exception 'La subasta de este turno ya ha terminado.';
    end if;

    perform pg_advisory_xact_lock(hashtext('hueco|' || p_instalacion || '|' || p_fecha || '|' || p_hora));

    select c.* into v_pista from public.catalogo_pistas c
        where c.instalacion_id = p_instalacion and c.automatica
          and public.minutos(p_hora) >= public.minutos(c.apertura)
          and public.minutos(p_hora) + 60 <= public.minutos(c.cierre)
          and not exists (select 1 from public.reservas r
                          where r.instalacion_id = c.instalacion_id and r.pista = c.pista and r.fecha = p_fecha
                            and public.minutos(r.hora) < public.minutos(p_hora) + 60
                            and public.minutos(p_hora) < public.minutos(r.hora) + r.duracion_min)
          and not exists (select 1 from public.subastas s
                          where s.tipo = 'automatica' and not s.cancelada
                            and s.instalacion_id = c.instalacion_id and s.pista = c.pista
                            and s.fecha = p_fecha and s.hora = p_hora)
        order by c.pista
        limit 1;
    if not found then
        raise exception 'Ya no quedan pistas libres en ese turno.';
    end if;

    select * into v_com from public.comision_subasta(p_instalacion);

    insert into public.subastas
        (instalacion_id, titulo, deporte, fecha, hora, descripcion, precio_salida, incremento, fin,
         vendedor_id, tipo, pista, comision_pct, ipsi_pct)
    values
        (p_instalacion, left(v_pista.instalacion, 100), left(v_pista.deporte, 40), p_fecha, p_hora,
         'Subasta automática de última hora: pista libre a mitad de precio.',
         greatest(1, ceil(public.precio_turno(v_pista.precio, p_fecha, p_hora, 60) / 2.0)::integer), 1,
         v_inicio - interval '15 minutes', null, 'automatica', v_pista.pista, v_com.comision, v_com.ipsi)
    returning id into v_id;

    perform public.pujar(v_id, p_cantidad);
    return v_id;
end;
$$;

revoke execute on function public.pujar_hueco(integer, date, text, integer) from public, anon;
grant execute on function public.pujar_hueco(integer, date, text, integer) to authenticated;


-- ---------- Cerrar: adjudicar subastas, cobrar y ceder pistas solidarias ----------

create or replace function public.cerrar_subastas()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
    s        record;
    p        record;
    v_mejor  public.pujas%rowtype;
    v_neto   numeric;
    v_com    numeric;
    v_pista  record;
    v_hora   integer;
    v_rid    uuid;
    v_n      integer := 0;
begin
    for s in select * from public.subastas
             where not cancelada and not cerrada and fin <= now()
             order by fin
             for update skip locked loop
        select * into v_mejor from public.pujas where subasta_id = s.id
            order by cantidad desc, fecha asc limit 1;
        update public.subastas set cerrada = true where id = s.id;
        v_n := v_n + 1;
        continue when v_mejor.id is null;

        if s.tipo = 'automatica' then
            begin
                insert into public.reservas (usuario_id, instalacion_id, pista, fecha, hora, duracion_min, importe)
                values (v_mejor.usuario_id, s.instalacion_id, s.pista, s.fecha, s.hora, 60, v_mejor.cantidad)
                returning id into v_rid;
                perform public.mover_saldo(v_mejor.usuario_id, -v_mejor.cantidad, 'subasta',
                    'Subasta de última hora ganada · ' || s.titulo || ' · ' || s.pista, v_rid);
            exception when others then
                null;   -- la pista se ocupó por otra vía: no se cobra
            end;
        elsif s.tipo = 'reventa' and s.reserva_id is not null then
            update public.reservas set usuario_id = v_mejor.usuario_id, publica = false, mostrar_nombre = false
                where id = s.reserva_id and usuario_id = s.vendedor_id;
            if found then
                delete from public.participantes where reserva_id = s.reserva_id;
                v_com := round(v_mejor.cantidad * s.comision_pct / 100, 2);
                v_neto := v_mejor.cantidad - v_com - round(v_com * s.ipsi_pct / 100, 2);
                perform public.mover_saldo(v_mejor.usuario_id, -v_mejor.cantidad, 'subasta',
                    'Reventa ganada · ' || s.titulo || ' · ' || s.pista, s.reserva_id);
                perform public.mover_saldo(s.vendedor_id, v_neto, 'venta',
                    'Reventa vendida · ' || s.titulo || ' (comisión ' || s.comision_pct || ' % + IPSI)', s.reserva_id);
            end if;
        end if;
    end loop;

    -- Pista solidaria: peticiones de hoy con una pista de última hora libre
    -- que ya ha cerrado sin pujas (empieza en los próximos 15 minutos)
    update public.peticiones_solidarias set estado = 'caducada'
        where estado = 'pendiente' and fecha < public.ahora_ceuta()::date;

    for p in select * from public.peticiones_solidarias
             where estado = 'pendiente' and fecha = public.ahora_ceuta()::date
             for update skip locked loop
        v_rid := null;
        for v_pista in select c.* from public.catalogo_pistas c
                       where c.automatica and c.deporte = p.deporte
                         and (p.instalacion_id is null or c.instalacion_id = p.instalacion_id)
                       order by c.instalacion_id, c.pista loop
            -- la siguiente hora en punto que empieza dentro de 15 min
            v_hora := (extract(hour from public.ahora_ceuta())::integer + 1) * 60;
            continue when v_hora < public.minutos(p.desde) or v_hora + 60 > public.minutos(p.hasta)
                       or v_hora < public.minutos(v_pista.apertura) or v_hora + 60 > public.minutos(v_pista.cierre)
                       or public.inicio_turno(p.fecha, public.hora_texto(v_hora)) - now() > interval '15 minutes';
            begin
                insert into public.reservas (usuario_id, instalacion_id, pista, fecha, hora, duracion_min, importe, tipo, nota)
                values (p.entidad_id, v_pista.instalacion_id, v_pista.pista, p.fecha, public.hora_texto(v_hora),
                        60, 0, 'solidaria', 'Pista solidaria cedida por CeutaPlay')
                returning id into v_rid;
            exception when others then
                v_rid := null;  -- ocupada: se prueba la siguiente pista
            end;
            exit when v_rid is not null;
        end loop;
        if v_rid is not null then
            update public.peticiones_solidarias set estado = 'cumplida', reserva_id = v_rid where id = p.id;
        end if;
    end loop;
    return v_n;
end;
$$;

grant execute on function public.cerrar_subastas() to anon, authenticated;


-- =====================================================================
-- ADMINISTRACIÓN: listado de usuarios con saldo, gestión y RSC
-- =====================================================================

drop function if exists public.admin_listar_usuarios();
create function public.admin_listar_usuarios()
returns table (
    id uuid, nombre text, email text, creado timestamptz, es_admin boolean,
    reservas bigint, subastas bigint, pujas bigint,
    bloqueado boolean, motivo_bloqueo text, nombre_rechazado text,
    saldo numeric, gestiona integer[], entidad text, entidad_acreditada boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
    if not public.es_admin() then
        raise exception 'Solo un administrador puede hacer esto.';
    end if;
    return query
        select p.id, p.nombre, u.email::text, p.creado, p.es_admin,
               (select count(*) from public.reservas r where r.usuario_id = p.id and r.tipo = 'normal'),
               (select count(*) from public.subastas s where s.vendedor_id = p.id),
               (select count(*) from public.pujas  b where b.usuario_id  = p.id),
               coalesce(m.bloqueado, false), coalesce(m.motivo_bloqueo, ''), m.nombre_rechazado,
               public.saldo_de(p.id),
               coalesce((select array_agg(g.instalacion_id order by g.instalacion_id) from public.gestores g where g.usuario_id = p.id), '{}'),
               e.nombre, coalesce(e.acreditada, false)
        from public.perfiles p
        join auth.users u on u.id = p.id
        left join public.moderacion_usuarios m on m.usuario_id = p.id
        left join public.entidades_solidarias e on e.usuario_id = p.id
        order by p.creado desc;
end;
$$;

revoke execute on function public.admin_listar_usuarios() from public, anon;
grant execute on function public.admin_listar_usuarios() to authenticated;


-- =====================================================================
-- COMUNIDAD: actividad de cada jugador para los puntos y niveles
-- Solo devuelve recuentos (nunca qué reservas son ni cuándo), así la
-- privacidad de las reservas se mantiene. Igual que puntosDe() en store.js.
-- =====================================================================

create or replace function public.estadisticas_comunidad()
returns table (usuario_id uuid, jugadas integer, unidas integer, pujas integer,
               ganadas integer, vendidas integer, opiniones integer)
language sql
stable
security definer
set search_path = public
as $$
    with ganador as (
        select s.id, s.vendedor_id,
               (select p.usuario_id from public.pujas p where p.subasta_id = s.id
                order by p.cantidad desc, p.fecha asc limit 1) as usuario_id
        from public.subastas s
        where not s.cancelada and s.fin <= now()
    )
    select pf.id,
        (select count(*) from public.reservas r where r.usuario_id = pf.id and r.tipo = 'normal'
            and public.inicio_turno(r.fecha, r.hora) < now())::integer,
        (select count(*) from public.participantes x where x.usuario_id = pf.id and x.estado = 'aceptado')::integer,
        (select count(*) from public.pujas p where p.usuario_id = pf.id)::integer,
        (select count(*) from ganador g where g.usuario_id = pf.id)::integer,
        (select count(*) from ganador g where g.vendedor_id = pf.id and g.usuario_id is not null)::integer,
        (select count(*) from public.opiniones o where o.usuario_id = pf.id)::integer
    from public.perfiles pf
    where auth.uid() is not null;
$$;

revoke execute on function public.estadisticas_comunidad() from public, anon;
grant execute on function public.estadisticas_comunidad() to authenticated;


-- =====================================================================
-- TIEMPO REAL
-- =====================================================================

do $$
declare
    t text;
begin
    foreach t in array array['participantes', 'movimientos', 'gestores', 'peticiones_solidarias'] loop
        if not exists (select 1 from pg_publication_tables
                       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
            execute format('alter publication supabase_realtime add table public.%I', t);
        end if;
    end loop;
end;
$$;


-- ---------- (Opcional) cerrar subastas cada minuto con pg_cron ----------
-- Supabase → Database → Extensions → activa "pg_cron" y ejecuta:
--
--   select cron.schedule('cerrar-subastas', '* * * * *', 'select public.cerrar_subastas()');
--
-- Sin pg_cron también funciona: la web llama a cerrar_subastas() al cargar
-- y cada 20 segundos mientras está abierta.
