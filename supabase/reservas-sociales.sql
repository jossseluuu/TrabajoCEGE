-- Ejecutar una vez en proyectos CeutaPlay ya configurados.
-- Las reservas existentes siguen sin mostrar el nombre en la agenda.
alter table public.reservas
    add column if not exists mostrar_nombre boolean not null default false;
