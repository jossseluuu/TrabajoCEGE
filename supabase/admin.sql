-- =====================================================================
-- CeutaPlay · Administradores
--
-- Ejecutar en Supabase → SQL Editor → New query → pegar todo → Run.
-- Se puede ejecutar varias veces. Requiere haber ejecutado antes schema.sql.
--
-- Qué añade:
--   · perfiles.es_admin  → marca qué usuarios son administradores
--   · es_admin()         → ¿el usuario de la sesión es administrador?
--   · Los administradores pueden: ver todos los usuarios (con su correo),
--     cancelar cualquier subasta (aunque tenga pujas), borrar cualquier
--     reserva y borrar opiniones.
--
-- Nadie puede hacerse administrador desde la web: la columna es_admin solo
-- se cambia desde aquí (los usuarios no tienen permiso de escritura sobre
-- la tabla perfiles).
-- =====================================================================


alter table public.perfiles
    add column if not exists es_admin boolean not null default false;


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


-- ---------- Listado de usuarios (con correo y actividad) ----------

drop function if exists public.admin_listar_usuarios();
create function public.admin_listar_usuarios()
returns table (
    id        uuid,
    nombre    text,
    email     text,
    creado    timestamptz,
    es_admin  boolean,
    reservas  bigint,
    subastas  bigint,
    pujas     bigint
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
               (select count(*) from public.pujas  b where b.usuario_id  = p.id)
        from public.perfiles p
        join auth.users u on u.id = p.id
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
