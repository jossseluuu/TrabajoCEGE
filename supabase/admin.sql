-- =====================================================================
-- CeutaPlay · Administración y moderación
--
-- Ejecutar en Supabase → SQL Editor → New query → pegar todo → Run.
-- Se puede ejecutar varias veces. Requiere haber ejecutado antes schema.sql.
--
-- Qué añade:
--   · perfiles.es_admin      → marca qué usuarios son administradores
--   · es_admin()             → ¿el usuario de la sesión es administrador?
--   · nombres_prohibidos     → lista de términos que no se permiten en el
--                              nombre visible (editable desde el panel)
--   · moderacion_usuarios    → cuentas suspendidas y nombres rechazados
--   · ajustes                → comisiones e IPSI del panel de facturación
--   · Los administradores pueden: ver todos los usuarios (con su correo),
--     suspender/reactivar cuentas, renombrar usuarios, cancelar cualquier
--     subasta, anular pujas, borrar reservas y borrar opiniones.
--
-- Nadie puede hacerse administrador desde la web: la columna es_admin solo
-- se cambia desde aquí (los usuarios no tienen permiso de escritura sobre
-- la tabla perfiles).
-- =====================================================================


alter table public.perfiles
    add column if not exists es_admin boolean not null default false;

-- Fecha de las opiniones (para el panel de interacción)
alter table public.opiniones
    add column if not exists creada timestamptz not null default now();


create or replace function public.es_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select coalesce((select es_admin from public.perfiles where id = auth.uid()), false);
$$;

revoke execute on function public.es_admin() from public, anon;
grant execute on function public.es_admin() to authenticated;


-- =====================================================================
-- NOMBRES PROHIBIDOS
-- =====================================================================

create table if not exists public.nombres_prohibidos (
    termino  text primary key check (char_length(termino) between 3 and 40),
    modo     text not null default 'contiene' check (modo in ('contiene', 'palabra')),
    creado   timestamptz not null default now()
);

alter table public.nombres_prohibidos enable row level security;
grant select, insert, update, delete on public.nombres_prohibidos to authenticated;

drop policy if exists "admin gestiona nombres prohibidos" on public.nombres_prohibidos;
create policy "admin gestiona nombres prohibidos" on public.nombres_prohibidos for all to authenticated
    using (public.es_admin()) with check (public.es_admin());

-- Lista inicial (la misma que NOMBRES_PROHIBIDOS_BASE en public/js/data.js).
-- "contiene": en cualquier parte del nombre · "palabra": solo palabra completa
insert into public.nombres_prohibidos (termino, modo) values
    ('admin', 'contiene'), ('administrador', 'contiene'), ('moderador', 'contiene'),
    ('ceutaplay', 'contiene'), ('soporte', 'palabra'), ('oficial', 'palabra'),
    ('root', 'palabra'), ('staff', 'palabra'),
    ('mierda', 'contiene'), ('cabron', 'contiene'), ('gilipollas', 'contiene'),
    ('imbecil', 'contiene'), ('idiota', 'contiene'), ('subnormal', 'contiene'),
    ('retrasado', 'contiene'), ('mongolo', 'contiene'), ('capullo', 'contiene'),
    ('pringado', 'contiene'), ('hijoputa', 'contiene'), ('malparido', 'contiene'),
    ('puta', 'palabra'), ('puto', 'palabra'), ('zorra', 'palabra'), ('joder', 'contiene'),
    ('maricon', 'contiene'), ('negrata', 'contiene'), ('sudaca', 'contiene'),
    ('panchito', 'contiene'), ('hitler', 'contiene'), ('nazi', 'palabra'),
    ('kkk', 'contiene'), ('terrorista', 'contiene'),
    ('polla', 'palabra'), ('verga', 'palabra'), ('culo', 'palabra'), ('cono', 'palabra'),
    ('follar', 'contiene'), ('porno', 'contiene'), ('pedofilo', 'contiene'), ('violador', 'contiene'),
    ('fuck', 'contiene'), ('shit', 'contiene'), ('bitch', 'contiene'), ('nigger', 'contiene'),
    ('nigga', 'contiene'), ('whore', 'contiene'), ('cunt', 'palabra')
on conflict (termino) do nothing;


-- minúsculas, sin tildes y deshaciendo trucos ("1d10t4" → "idiota").
-- Igual que normalizarNombre() en public/js/store.js
create or replace function public.normalizar_nombre(p_texto text)
returns text
language sql
immutable
as $$
    select translate(lower(coalesce(p_texto, '')),
                     'áàäâãéèëêíìïîóòöôõúùüûñç013457@$',
                     'aaaaaeeeeiiiiooooouuuuncoieastas');
$$;


-- Devuelve el motivo por el que un nombre no se permite, o null si es válido.
-- Igual que motivoNombre() en public/js/store.js
create or replace function public.motivo_nombre_no_permitido(p_nombre text)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
    v_nombre   text := btrim(coalesce(p_nombre, ''));
    v_palabras text[];
    v_junto    text;
    v_juntoc   text;
    v_t        text;
    v_tc       text;
    r          record;
    c_msg      constant text := 'Ese nombre no está permitido en CeutaPlay. Elige otro, por favor.';
begin
    if char_length(v_nombre) < 2 or char_length(v_nombre) > 40 then
        return 'El nombre debe tener entre 2 y 40 caracteres.';
    end if;
    if v_nombre ~* '(@|https?:|www\.|\.(com|es|net|org|io)\M)' then
        return 'No se permiten correos ni enlaces en el nombre.';
    end if;
    if v_nombre ~ '(.)\1{3,}' then
        return 'El nombre tiene demasiados caracteres repetidos seguidos.';
    end if;

    v_palabras := array_remove(regexp_split_to_array(public.normalizar_nombre(v_nombre), '[^a-z0-9]+'), '');
    v_junto    := array_to_string(v_palabras, '');
    v_juntoc   := regexp_replace(v_junto, '(.)\1+', '\1', 'g');

    for r in select termino, modo from public.nombres_prohibidos loop
        v_t := regexp_replace(public.normalizar_nombre(r.termino), '[^a-z0-9]', '', 'g');
        continue when v_t = '';
        v_tc := regexp_replace(v_t, '(.)\1+', '\1', 'g');   -- "puuuta" → "puta"
        if r.modo = 'palabra' then
            if v_t = any (v_palabras) or v_junto = v_t then
                return c_msg;
            end if;
            if char_length(v_tc) >= 4 and (v_juntoc = v_tc or exists (
                select 1 from unnest(v_palabras) p where regexp_replace(p, '(.)\1+', '\1', 'g') = v_tc)) then
                return c_msg;
            end if;
        else
            if position(v_t in v_junto) > 0
               or (char_length(v_tc) >= 4 and position(v_tc in v_juntoc) > 0) then
                return c_msg;
            end if;
        end if;
    end loop;
    return null;
end;
$$;

revoke execute on function public.motivo_nombre_no_permitido(text) from public;
grant execute on function public.motivo_nombre_no_permitido(text) to authenticated;

-- Para el formulario de registro (se llama antes de crear la cuenta)
create or replace function public.comprobar_nombre(p_nombre text)
returns text
language sql
stable
security definer
set search_path = public
as $$ select public.motivo_nombre_no_permitido(p_nombre); $$;

revoke execute on function public.comprobar_nombre(text) from public;
grant execute on function public.comprobar_nombre(text) to anon, authenticated;


-- =====================================================================
-- MODERACIÓN DE USUARIOS (suspensiones y nombres rechazados)
-- Tabla aparte de perfiles porque perfiles es pública.
-- =====================================================================

create table if not exists public.moderacion_usuarios (
    usuario_id        uuid primary key references auth.users (id) on delete cascade,
    bloqueado         boolean not null default false,
    motivo_bloqueo    text not null default '' check (char_length(motivo_bloqueo) <= 200),
    nombre_rechazado  text,
    actualizado       timestamptz not null default now()
);

alter table public.moderacion_usuarios enable row level security;
grant select on public.moderacion_usuarios to authenticated;

-- Cada usuario ve su propio estado; el administrador, el de todos
drop policy if exists "ver moderacion" on public.moderacion_usuarios;
create policy "ver moderacion" on public.moderacion_usuarios for select to authenticated
    using (usuario_id = auth.uid() or public.es_admin());


-- Si alguien se registra con un nombre no permitido (saltándose la web),
-- se le pone "Usuario XXXXXX" y el nombre queda guardado para revisarlo.
-- Si se cambia el nombre de un perfil existente a uno prohibido, se rechaza.
create or replace function public.validar_nombre_perfil()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_motivo text;
begin
    if tg_op = 'UPDATE' and new.nombre is not distinct from old.nombre then
        return new;
    end if;
    v_motivo := public.motivo_nombre_no_permitido(new.nombre);
    if v_motivo is null then
        return new;
    end if;
    if tg_op = 'INSERT' then
        insert into public.moderacion_usuarios (usuario_id, nombre_rechazado)
        values (new.id, left(new.nombre, 40))
        on conflict (usuario_id) do update set nombre_rechazado = excluded.nombre_rechazado, actualizado = now();
        new.nombre := 'Usuario ' || upper(left(replace(new.id::text, '-', ''), 6));
        return new;
    end if;
    raise exception '%', v_motivo;
end;
$$;

drop trigger if exists perfiles_validar_nombre on public.perfiles;
create trigger perfiles_validar_nombre
    before insert or update of nombre on public.perfiles
    for each row execute function public.validar_nombre_perfil();


-- Las cuentas suspendidas no pueden crear subastas, pujar, reservar ni opinar
create or replace function public.impedir_usuarios_bloqueados()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if auth.uid() is not null
       and exists (select 1 from public.moderacion_usuarios where usuario_id = auth.uid() and bloqueado)
       and not public.es_admin() then
        raise exception 'Tu cuenta está suspendida. Escribe a CeutaPlay si crees que es un error.';
    end if;
    return new;
end;
$$;

do $$
declare
    t text;
begin
    foreach t in array array['subastas', 'pujas', 'reservas', 'opiniones'] loop
        execute format('drop trigger if exists impedir_bloqueados on public.%I', t);
        -- en opiniones también al editarlas; en el resto solo al crear
        -- (así una cuenta suspendida aún puede cancelar sus reservas)
        execute format('create trigger impedir_bloqueados before insert %s on public.%I
                        for each row execute function public.impedir_usuarios_bloqueados()',
                       case when t = 'opiniones' then 'or update' else '' end, t);
    end loop;
end;
$$;


-- =====================================================================
-- AJUSTES (comisiones e IPSI del panel de facturación)
-- =====================================================================

create table if not exists public.ajustes (
    clave        text primary key,
    valor        jsonb not null,
    actualizado  timestamptz not null default now()
);

alter table public.ajustes enable row level security;
grant select, insert, update on public.ajustes to authenticated;

drop policy if exists "admin gestiona ajustes" on public.ajustes;
create policy "admin gestiona ajustes" on public.ajustes for all to authenticated
    using (public.es_admin()) with check (public.es_admin());


-- =====================================================================
-- ACCIONES DEL ADMINISTRADOR
-- =====================================================================

-- ---------- Reservas y opiniones: el administrador puede borrarlas ----------

drop policy if exists "admin borra reservas" on public.reservas;
create policy "admin borra reservas" on public.reservas for delete to authenticated
    using (public.es_admin());

grant delete on public.opiniones to authenticated;

drop policy if exists "admin borra opiniones" on public.opiniones;
create policy "admin borra opiniones" on public.opiniones for delete to authenticated
    using (public.es_admin());


-- ---------- Cancelar cualquier subasta ----------

create or replace function public.admin_cancelar_subasta(p_subasta uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    if not public.es_admin() then
        raise exception 'Solo un administrador puede hacer esto.';
    end if;
    update public.subastas set cancelada = true where id = p_subasta;
    if not found then
        raise exception 'La subasta no existe.';
    end if;
end;
$$;

revoke execute on function public.admin_cancelar_subasta(uuid) from public, anon;
grant execute on function public.admin_cancelar_subasta(uuid) to authenticated;


-- ---------- Anular una puja (fraude, error…) de una subasta en curso ----------

create or replace function public.admin_borrar_puja(p_puja bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_subasta public.subastas%rowtype;
begin
    if not public.es_admin() then
        raise exception 'Solo un administrador puede hacer esto.';
    end if;
    select s.* into v_subasta from public.subastas s
        join public.pujas p on p.subasta_id = s.id
        where p.id = p_puja
        for update of s;
    if not found then
        raise exception 'La puja no existe.';
    end if;
    if v_subasta.cancelada or now() >= v_subasta.fin then
        raise exception 'Solo se pueden anular pujas de subastas en curso.';
    end if;
    delete from public.pujas where id = p_puja;
end;
$$;

revoke execute on function public.admin_borrar_puja(bigint) from public, anon;
grant execute on function public.admin_borrar_puja(bigint) to authenticated;


-- ---------- Suspender / reactivar una cuenta ----------

create or replace function public.admin_bloquear_usuario(p_usuario uuid, p_bloquear boolean, p_motivo text default '')
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    if not public.es_admin() then
        raise exception 'Solo un administrador puede hacer esto.';
    end if;
    if p_usuario = auth.uid() then
        raise exception 'No puedes suspender tu propia cuenta.';
    end if;
    if p_bloquear and exists (select 1 from public.perfiles where id = p_usuario and es_admin) then
        raise exception 'No se puede suspender a otro administrador.';
    end if;
    if not exists (select 1 from public.perfiles where id = p_usuario) then
        raise exception 'El usuario no existe.';
    end if;
    insert into public.moderacion_usuarios (usuario_id, bloqueado, motivo_bloqueo)
    values (p_usuario, p_bloquear, case when p_bloquear then left(coalesce(btrim(p_motivo), ''), 200) else '' end)
    on conflict (usuario_id) do update
        set bloqueado = excluded.bloqueado, motivo_bloqueo = excluded.motivo_bloqueo, actualizado = now();
end;
$$;

revoke execute on function public.admin_bloquear_usuario(uuid, boolean, text) from public, anon;
grant execute on function public.admin_bloquear_usuario(uuid, boolean, text) to authenticated;


-- ---------- Cambiar el nombre visible de un usuario ----------

create or replace function public.admin_renombrar_usuario(p_usuario uuid, p_nombre text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    if not public.es_admin() then
        raise exception 'Solo un administrador puede hacer esto.';
    end if;
    -- el trigger perfiles_validar_nombre rechaza nombres no permitidos
    update public.perfiles set nombre = btrim(p_nombre) where id = p_usuario;
    if not found then
        raise exception 'El usuario no existe.';
    end if;
    update public.moderacion_usuarios set nombre_rechazado = null, actualizado = now()
    where usuario_id = p_usuario;
end;
$$;

revoke execute on function public.admin_renombrar_usuario(uuid, text) from public, anon;
grant execute on function public.admin_renombrar_usuario(uuid, text) to authenticated;


-- ---------- Listado de usuarios (con correo, actividad y moderación) ----------

drop function if exists public.admin_listar_usuarios();
create function public.admin_listar_usuarios()
returns table (
    id                uuid,
    nombre            text,
    email             text,
    creado            timestamptz,
    es_admin          boolean,
    reservas          bigint,
    subastas          bigint,
    pujas             bigint,
    bloqueado         boolean,
    motivo_bloqueo    text,
    nombre_rechazado  text
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
               (select count(*) from public.reservas r where r.usuario_id = p.id),
               (select count(*) from public.subastas s where s.vendedor_id = p.id),
               (select count(*) from public.pujas  b where b.usuario_id  = p.id),
               coalesce(m.bloqueado, false), coalesce(m.motivo_bloqueo, ''), m.nombre_rechazado
        from public.perfiles p
        join auth.users u on u.id = p.id
        left join public.moderacion_usuarios m on m.usuario_id = p.id
        order by p.creado desc;
end;
$$;

revoke execute on function public.admin_listar_usuarios() from public, anon;
grant execute on function public.admin_listar_usuarios() to authenticated;


-- ---------- Nombrar administrador ----------
-- Para añadir más administradores, cambia el correo y vuelve a ejecutar
-- solo esta línea.

update public.perfiles set es_admin = true
where id = (select id from auth.users where email = 'admin@ceutaplay.es');
