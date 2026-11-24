-- Ejecutar en Supabase para habilitar las opiniones compartidas.
create table if not exists public.opiniones (
    instalacion_id integer not null check (instalacion_id > 0),
    usuario_id uuid not null default auth.uid() references public.perfiles (id) on delete cascade,
    puntuacion smallint not null check (puntuacion between 1 and 5),
    comentario text not null check (char_length(btrim(comentario)) between 1 and 500),
    primary key (instalacion_id, usuario_id)
);

alter table public.opiniones enable row level security;
grant select, insert, update on public.opiniones to authenticated;

drop policy if exists "leer opiniones" on public.opiniones;
create policy "leer opiniones" on public.opiniones for select to authenticated using (true);

drop policy if exists "crear mi opinion" on public.opiniones;
create policy "crear mi opinion" on public.opiniones for insert to authenticated
    with check (usuario_id = auth.uid());

drop policy if exists "editar mi opinion" on public.opiniones;
create policy "editar mi opinion" on public.opiniones for update to authenticated
    using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());
