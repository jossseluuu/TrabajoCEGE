-- =====================================================================
-- CeutaPlay · Formatos de subasta (última hora y reventa)
--
-- Ejecutar en Supabase → SQL Editor → New query → pegar todo → Run,
-- DESPUÉS de schema.sql y admin.sql. Se puede ejecutar varias veces.
--
-- Dos formatos:
--
--  · AUTOMÁTICA (última hora): una pista que sigue libre cuando faltan 12 h
--    o menos para el turno sale sola a subasta con un precio de salida de la
--    mitad de su precio normal. Se cierra 15 min antes del partido y el
--    ganador se queda la reserva. No hace falta ningún proceso programado:
--    la subasta se crea en el servidor con la primera puja (pujar_hueco) y
--    mientras tanto la web la muestra calculándola a partir del catálogo.
--
--  · REVENTA: un usuario que no puede ir subasta su reserva
--    (crear_subasta_reventa). Al cerrar, la reserva pasa al ganador y el
--    vendedor recibe el precio final menos la comisión de CeutaPlay y el
--    IPSI de esa comisión.
--
-- La comisión y el IPSI se guardan en cada subasta al crearla (salen del
-- panel de facturación: tabla ajustes, creada en admin.sql).
--
-- cerrar_subastas() adjudica las subastas terminadas (crea o traspasa la
-- reserva). La web la llama sola al cargar y cuando termina una subasta;
-- opcionalmente se puede programar con pg_cron (ver el final del archivo).
--
-- Si cambias pistas, precios u horarios en public/js/data.js, actualiza
-- también el catálogo de este archivo y vuelve a ejecutarlo.
-- =====================================================================


-- ---------- Catálogo de pistas (el servidor necesita precios y horarios) ----------

create table if not exists public.catalogo_pistas (
    instalacion_id  integer not null,
    pista           text    not null,
    instalacion     text    not null,
    deporte         text    not null,
    precio          integer not null check (precio >= 0),
    horas           text[]  not null,
    subastable      boolean not null default true,   -- se puede revender
    automatica      boolean not null default false,  -- sale sola a subasta de última hora
    primary key (instalacion_id, pista)
);

alter table public.catalogo_pistas enable row level security;
grant select on public.catalogo_pistas to anon, authenticated;
drop policy if exists "catalogo visible" on public.catalogo_pistas;
create policy "catalogo visible" on public.catalogo_pistas for select using (true);

-- Generado a partir de public/js/data.js
insert into public.catalogo_pistas
    (instalacion_id, pista, instalacion, deporte, precio, horas, subastable, automatica)
values
    (1, 'Pista 1', 'Pádel La Marina', 'Pádel', 20, array['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00'], true, true),
    (1, 'Pista 2', 'Pádel La Marina', 'Pádel', 20, array['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00'], true, true),
    (1, 'Pista 3', 'Pádel La Marina', 'Pádel', 20, array['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00'], true, true),
    (4, 'Doble 1', 'Pádel Jardines de la Hípica', 'Pádel', 15, array['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00'], true, true),
    (4, 'Doble 2', 'Pádel Jardines de la Hípica', 'Pádel', 15, array['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00'], true, true),
    (4, 'Individual', 'Pádel Jardines de la Hípica', 'Pádel', 15, array['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00'], true, true),
    (5, 'Pista de demostración', 'Pádel Loma Colmenar', 'Pádel', 12, array['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00'], true, true),
    (2, 'Campo José Benoliel', 'Campo Federativo José Benoliel', 'Fútbol', 45, array['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00'], true, false),
    (9, 'Pista de fútbol sala', 'Pista Polideportiva José Zurrón', 'Fútbol', 12, array['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00'], true, false),
    (10, 'Tuhami Al Lal', 'Campos de Fútbol del Príncipe', 'Fútbol', 25, array['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00'], true, false),
    (10, 'Aiman Aomar', 'Campos de Fútbol del Príncipe', 'Fútbol', 25, array['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00'], true, false),
    (11, 'Pista de fútbol sala', 'Pista Polígono Virgen de África', 'Fútbol', 12, array['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00'], true, false),
    (12, 'Campo José Martínez Pirri', 'Campo José Martínez Pirri', 'Fútbol', 45, array['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00'], true, false),
    (13, 'Campo Emilio Cózar', 'Campo Emilio Cózar', 'Fútbol', 25, array['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00'], true, false),
    (14, 'Pista polideportiva', 'Pista Deportiva Juan XXIII', 'Fútbol', 15, array['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00'], true, false),
    (15, 'Pista cubierta de fútbol sala', 'Polideportivo Santa Amelia', 'Fútbol', 20, array['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00'], true, false),
    (3, 'Pista 1', 'Tenis La Marina', 'Tenis', 15, array['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00'], true, true),
    (3, 'Pista 2', 'Tenis La Marina', 'Tenis', 15, array['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00'], true, true),
    (6, 'Pista 1', 'Club de Tenis y Pádel Loma Margarita', 'Tenis', 15, array['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00'], true, true),
    (6, 'Pista 2', 'Club de Tenis y Pádel Loma Margarita', 'Tenis', 15, array['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00'], true, true),
    (6, 'Pista 3', 'Club de Tenis y Pádel Loma Margarita', 'Tenis', 15, array['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00'], true, true),
    (6, 'Pista 4', 'Club de Tenis y Pádel Loma Margarita', 'Tenis', 15, array['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00'], true, true),
    (6, 'Pista 5', 'Club de Tenis y Pádel Loma Margarita', 'Tenis', 15, array['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00'], true, true),
    (6, 'Pista 6', 'Club de Tenis y Pádel Loma Margarita', 'Tenis', 15, array['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00'], true, true),
    (7, 'Pista 1', 'Club de Tenis Perla del Mediterráneo', 'Tenis', 15, array['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00'], true, true),
    (7, 'Pista 2', 'Club de Tenis Perla del Mediterráneo', 'Tenis', 15, array['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00'], true, true),
    (7, 'Pista 3', 'Club de Tenis Perla del Mediterráneo', 'Tenis', 15, array['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00'], true, true),
    (8, 'Pista 1', 'Club de Tenis Ceuta', 'Tenis', 15, array['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00'], true, true),
    (8, 'Pista 2', 'Club de Tenis Ceuta', 'Tenis', 15, array['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00'], true, true),
    (8, 'Pista 3', 'Club de Tenis Ceuta', 'Tenis', 15, array['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00'], true, true),
    (16, 'Kayak 1', 'Kayak con Ceuta Kayak', 'Kayak', 12, array['10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'], false, false),
    (16, 'Kayak 2', 'Kayak con Ceuta Kayak', 'Kayak', 12, array['10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'], false, false),
    (16, 'Kayak 3', 'Kayak con Ceuta Kayak', 'Kayak', 12, array['10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'], false, false),
    (17, 'Tabla 1', 'Paddle surf con Ceuta Kayak', 'Paddle surf', 15, array['10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'], false, false),
    (17, 'Tabla 2', 'Paddle surf con Ceuta Kayak', 'Paddle surf', 15, array['10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'], false, false),
    (17, 'Tabla 3', 'Paddle surf con Ceuta Kayak', 'Paddle surf', 15, array['10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'], false, false),
    (18, 'Piragua 1', 'Piragüismo con Ceuta Kayak', 'Piragüismo', 14, array['10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'], false, false),
    (18, 'Piragua 2', 'Piragüismo con Ceuta Kayak', 'Piragüismo', 14, array['10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'], false, false)

on conflict (instalacion_id, pista) do update set
    instalacion = excluded.instalacion, deporte = excluded.deporte, precio = excluded.precio,
    horas = excluded.horas, subastable = excluded.subastable, automatica = excluded.automatica;


-- ---------- Nuevas columnas de las subastas ----------

alter table public.subastas add column if not exists tipo text not null default 'libre';
alter table public.subastas drop constraint if exists subastas_tipo_check;
alter table public.subastas add constraint subastas_tipo_check check (tipo in ('libre', 'reventa', 'automatica'));
alter table public.subastas add column if not exists pista text check (char_length(pista) <= 60);
alter table public.subastas add column if not exists reserva_id uuid references public.reservas (id) on delete set null;
alter table public.subastas add column if not exists comision_pct numeric(5,2) not null default 15;
alter table public.subastas add column if not exists ipsi_pct numeric(5,2) not null default 4;
-- true cuando ya se ha adjudicado (o ha terminado sin pujas)
alter table public.subastas add column if not exists cerrada boolean not null default false;
-- las automáticas no tienen vendedor (las vende la instalación)
alter table public.subastas alter column vendedor_id drop not null;

-- Una sola subasta automática abierta por pista y turno
create unique index if not exists subastas_automatica_unica
    on public.subastas (instalacion_id, pista, fecha, hora)
    where tipo = 'automatica' and not cancelada;

-- Una reserva solo puede estar en una subasta abierta
create unique index if not exists subastas_reventa_unica
    on public.subastas (reserva_id)
    where tipo = 'reventa' and not cancelada and not cerrada;


-- ---------- Comisión e IPSI vigentes (del panel de facturación) ----------

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

-- Para que la web muestre cuánto recibirá quien revende su reserva
create or replace function public.tarifas_subastas()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
    select jsonb_build_object('comisionSubastas', c.comision, 'ipsi', c.ipsi)
    from public.comision_subasta() c;
$$;

revoke execute on function public.comision_subasta(integer) from public, anon, authenticated;
grant execute on function public.tarifas_subastas() to anon, authenticated;


-- ---------- Reventa: subastar una reserva propia ----------

create or replace function public.crear_subasta_reventa(
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
    v_reserva  public.reservas%rowtype;
    v_pista    public.catalogo_pistas%rowtype;
    v_inicio   timestamptz;
    v_fin      timestamptz;
    v_com      record;
    v_id       uuid;
begin
    if auth.uid() is null then
        raise exception 'Tienes que iniciar sesión.';
    end if;
    select * into v_reserva from public.reservas where id = p_reserva for update;
    if not found or v_reserva.usuario_id <> auth.uid() then
        raise exception 'Solo puedes subastar tus propias reservas.';
    end if;
    select * into v_pista from public.catalogo_pistas
        where instalacion_id = v_reserva.instalacion_id and pista = v_reserva.pista;
    if found and not v_pista.subastable then
        raise exception 'Las reservas de esta instalación no se pueden subastar.';
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

    v_inicio := (v_reserva.fecha + v_reserva.hora::time) at time zone 'Europe/Madrid';
    v_fin := now() + make_interval(mins => p_duracion_min);
    if v_inicio <= v_fin then
        raise exception 'La subasta tiene que terminar antes de que empiece el partido.';
    end if;
    if exists (select 1 from public.subastas
               where reserva_id = p_reserva and tipo = 'reventa' and not cancelada and not cerrada) then
        raise exception 'Esta reserva ya está en subasta.';
    end if;

    select * into v_com from public.comision_subasta(v_reserva.instalacion_id);

    insert into public.subastas
        (instalacion_id, titulo, deporte, fecha, hora, descripcion, precio_salida, incremento, fin,
         vendedor_id, tipo, pista, reserva_id, comision_pct, ipsi_pct)
    values
        (v_reserva.instalacion_id,
         left(coalesce(v_pista.instalacion, 'Instalación ' || v_reserva.instalacion_id), 100),
         left(coalesce(v_pista.deporte, 'Deporte'), 40),
         v_reserva.fecha, v_reserva.hora, left(coalesce(btrim(p_descripcion), ''), 200),
         p_precio_salida, p_incremento, v_fin, auth.uid(), 'reventa', v_reserva.pista, p_reserva,
         v_com.comision, v_com.ipsi)
    returning id into v_id;
    return v_id;
end;
$$;

revoke execute on function public.crear_subasta_reventa(uuid, integer, integer, integer, text) from public, anon;
grant execute on function public.crear_subasta_reventa(uuid, integer, integer, integer, text) to authenticated;


-- ---------- Última hora: pujar por un turno libre ----------
-- Crea la subasta automática (si es la primera puja) en una pista libre de
-- ese turno y registra la puja.

create or replace function public.pujar_hueco(
    p_instalacion integer,
    p_fecha       date,
    p_hora        text,
    p_cantidad    integer
)
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
    v_inicio := (p_fecha + p_hora::time) at time zone 'Europe/Madrid';
    if now() < v_inicio - interval '12 hours' then
        raise exception 'Este turno todavía no está en subasta de última hora.';
    end if;
    if now() >= v_inicio - interval '15 minutes' then
        raise exception 'La subasta de este turno ya ha terminado.';
    end if;

    -- Evita que dos personas creen a la vez la misma subasta
    perform pg_advisory_xact_lock(hashtext(p_instalacion || '|' || p_fecha || '|' || p_hora));

    select c.* into v_pista from public.catalogo_pistas c
        where c.instalacion_id = p_instalacion and c.automatica and p_hora = any (c.horas)
          and not exists (select 1 from public.reservas r
                          where r.instalacion_id = c.instalacion_id and r.pista = c.pista
                            and r.fecha = p_fecha and r.hora = p_hora)
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
         greatest(1, ceil(v_pista.precio / 2.0)::integer), 1, v_inicio - interval '15 minutes',
         null, 'automatica', v_pista.pista, v_com.comision, v_com.ipsi)
    returning id into v_id;

    perform public.pujar(v_id, p_cantidad);
    return v_id;
end;
$$;

revoke execute on function public.pujar_hueco(integer, date, text, integer) from public, anon;
grant execute on function public.pujar_hueco(integer, date, text, integer) to authenticated;


-- ---------- Adjudicar las subastas terminadas ----------

create or replace function public.cerrar_subastas()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
    s       record;
    v_mejor public.pujas%rowtype;
    v_n     integer := 0;
begin
    for s in select * from public.subastas
             where not cancelada and not cerrada and fin <= now()
             order by fin
             for update skip locked loop
        select * into v_mejor from public.pujas
            where subasta_id = s.id order by cantidad desc, fecha asc limit 1;

        update public.subastas set cerrada = true where id = s.id;

        if v_mejor.id is not null then
            if s.tipo = 'automatica' then
                insert into public.reservas (usuario_id, instalacion_id, pista, fecha, hora)
                values (v_mejor.usuario_id, s.instalacion_id, s.pista, s.fecha, s.hora)
                on conflict (instalacion_id, pista, fecha, hora) do nothing;
            elsif s.tipo = 'reventa' and s.reserva_id is not null then
                update public.reservas
                    set usuario_id = v_mejor.usuario_id, mostrar_nombre = false
                    where id = s.reserva_id and usuario_id = s.vendedor_id;
            end if;
        end if;
        v_n := v_n + 1;
    end loop;
    return v_n;
end;
$$;

grant execute on function public.cerrar_subastas() to anon, authenticated;


-- ---------- Turnos ocupados (sin datos personales) ----------
-- Las reservas solo las ven los usuarios con sesión; esto permite que quien
-- aún no ha entrado vea bien qué turnos están en subasta de última hora.

create or replace function public.turnos_ocupados()
returns table (instalacion_id integer, pista text, fecha date, hora text)
language sql
stable
security definer
set search_path = public
as $$
    select r.instalacion_id, r.pista, r.fecha, r.hora
    from public.reservas r
    where r.fecha between (now() at time zone 'Europe/Madrid')::date
                      and (now() at time zone 'Europe/Madrid')::date + 1;
$$;

grant execute on function public.turnos_ocupados() to anon, authenticated;


-- ---------- Reglas sobre las reservas ----------

-- No se puede reservar directamente una pista que está en subasta de última hora
-- ni cancelar una reserva mientras está en subasta.
create or replace function public.reservas_y_subastas()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if tg_op = 'INSERT' then
        if exists (select 1 from public.subastas
                   where tipo = 'automatica' and not cancelada and not cerrada
                     and instalacion_id = new.instalacion_id and pista = new.pista
                     and fecha = new.fecha and hora = new.hora) then
            raise exception 'Esa pista está en subasta de última hora: puja por ella en la sección de subastas.';
        end if;
        return new;
    end if;
    if exists (select 1 from public.subastas
               where reserva_id = old.id and not cancelada and not cerrada) then
        raise exception 'Esta reserva está en subasta. Cancela antes la subasta (solo si aún no tiene pujas).';
    end if;
    return old;
end;
$$;

drop trigger if exists reservas_y_subastas on public.reservas;
create trigger reservas_y_subastas
    before insert or delete on public.reservas
    for each row execute function public.reservas_y_subastas();


-- ---------- (Opcional) cerrar subastas cada minuto con pg_cron ----------
-- Supabase → Database → Extensions → activa "pg_cron" y ejecuta:
--
--   select cron.schedule('cerrar-subastas', '* * * * *', 'select public.cerrar_subastas()');
--
-- Sin pg_cron también funciona: la web llama a cerrar_subastas() al cargar.
