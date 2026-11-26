-- =====================================================================
-- CeutaPlay · Datos de ejemplo (ficticios) para el servidor de pruebas
--
-- GENERADO con: node supabase/generar-seed.js > supabase/seed.sql
-- No lo edites a mano: cambia los datos en public/js/data.js y regénéralo.
--
-- Ejecutar DESPUÉS de schema.sql, admin.sql y plataforma.sql.
-- Crea usuarios ficticios (contraseña: demo1234), reservas, reseñas,
-- participantes y subastas. Si ya se ha ejecutado, no hace nada.
-- No crea ni toca la cuenta de administrador.
--
-- Úsalo solo en un proyecto de pruebas: son cuentas con contraseña conocida.
-- =====================================================================

do $$
declare
    v_ana uuid;
    v_luis uuid;
    v_marta uuid;
    v_karim uuid;
    v_lucia uuid;
    v_youssef uuid;
    v_paula uuid;
    v_hamza uuid;
    v_sara uuid;
    v_ivan uuid;
    v_nora uuid;
    v_gestor uuid;
    v_entidad uuid;
    v_res uuid;
    v_sub uuid;
    v_hoy date := (now() at time zone 'Europe/Madrid')::date;
begin
    if exists (select 1 from auth.users where email = 'ana@ceutaplay.es') then
        raise notice 'Los datos de ejemplo ya estaban creados.';
        return;
    end if;

    -- Los nombres de ejemplo se ponen tal cual (sin pasar por el filtro de nombres)
    alter table public.perfiles disable trigger perfiles_validar_nombre;

    -- ---------- usuarios ----------
    v_ana := gen_random_uuid();
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
        confirmation_token, recovery_token, email_change, email_change_token_new)
    values ('00000000-0000-0000-0000-000000000000', v_ana, 'authenticated', 'authenticated', 'ana@ceutaplay.es',
        extensions.crypt('demo1234', extensions.gen_salt('bf')), now(),
        '{"provider":"email","providers":["email"]}', jsonb_build_object('nombre', 'Ana Martín'),
        now() - interval '60 days', now(), '', '', '', '');
    insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), v_ana, v_ana::text,
        jsonb_build_object('sub', v_ana::text, 'email', 'ana@ceutaplay.es', 'email_verified', true), 'email', now(), now(), now());
    update public.perfiles set nombre = 'Ana Martín', bio = 'Pádel tres veces por semana en La Marina. Busco pareja de nivel medio para jugar por las tardes.', deporte_favorito = 'Pádel'
        where id = v_ana;

    v_luis := gen_random_uuid();
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
        confirmation_token, recovery_token, email_change, email_change_token_new)
    values ('00000000-0000-0000-0000-000000000000', v_luis, 'authenticated', 'authenticated', 'luis@ceutaplay.es',
        extensions.crypt('demo1234', extensions.gen_salt('bf')), now(),
        '{"provider":"email","providers":["email"]}', jsonb_build_object('nombre', 'Luis Benítez'),
        now() - interval '57 days', now(), '', '', '', '');
    insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), v_luis, v_luis::text,
        jsonb_build_object('sub', v_luis::text, 'email', 'luis@ceutaplay.es', 'email_verified', true), 'email', now(), now(), now());
    update public.perfiles set nombre = 'Luis Benítez', bio = 'Fútbol 7 con los compañeros del trabajo y algo de tenis los domingos.', deporte_favorito = 'Fútbol'
        where id = v_luis;

    v_marta := gen_random_uuid();
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
        confirmation_token, recovery_token, email_change, email_change_token_new)
    values ('00000000-0000-0000-0000-000000000000', v_marta, 'authenticated', 'authenticated', 'marta@ceutaplay.es',
        extensions.crypt('demo1234', extensions.gen_salt('bf')), now(),
        '{"provider":"email","providers":["email"]}', jsonb_build_object('nombre', 'Marta Ríos'),
        now() - interval '54 days', now(), '', '', '', '');
    insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), v_marta, v_marta::text,
        jsonb_build_object('sub', v_marta::text, 'email', 'marta@ceutaplay.es', 'email_verified', true), 'email', now(), now(), now());
    update public.perfiles set nombre = 'Marta Ríos', bio = 'Si no hay levante, me encontrarás en la Ribera con la tabla. También juego al tenis.', deporte_favorito = 'Paddle surf'
        where id = v_marta;

    v_karim := gen_random_uuid();
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
        confirmation_token, recovery_token, email_change, email_change_token_new)
    values ('00000000-0000-0000-0000-000000000000', v_karim, 'authenticated', 'authenticated', 'karim@ceutaplay.es',
        extensions.crypt('demo1234', extensions.gen_salt('bf')), now(),
        '{"provider":"email","providers":["email"]}', jsonb_build_object('nombre', 'Karim Ahmed'),
        now() - interval '51 days', now(), '', '', '', '');
    insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), v_karim, v_karim::text,
        jsonb_build_object('sub', v_karim::text, 'email', 'karim@ceutaplay.es', 'email_verified', true), 'email', now(), now(), now());
    update public.perfiles set nombre = 'Karim Ahmed', bio = 'Jugador de pádel desde hace 6 años. Nivel 4. Me apunto a partidos de última hora.', deporte_favorito = 'Pádel'
        where id = v_karim;

    v_lucia := gen_random_uuid();
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
        confirmation_token, recovery_token, email_change, email_change_token_new)
    values ('00000000-0000-0000-0000-000000000000', v_lucia, 'authenticated', 'authenticated', 'lucia@ceutaplay.es',
        extensions.crypt('demo1234', extensions.gen_salt('bf')), now(),
        '{"provider":"email","providers":["email"]}', jsonb_build_object('nombre', 'Lucía Gómez'),
        now() - interval '48 days', now(), '', '', '', '');
    insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), v_lucia, v_lucia::text,
        jsonb_build_object('sub', v_lucia::text, 'email', 'lucia@ceutaplay.es', 'email_verified', true), 'email', now(), now(), now());
    update public.perfiles set nombre = 'Lucía Gómez', bio = 'Entreno tenis en Loma Margarita. Me encanta jugar dobles mixtos.', deporte_favorito = 'Tenis'
        where id = v_lucia;

    v_youssef := gen_random_uuid();
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
        confirmation_token, recovery_token, email_change, email_change_token_new)
    values ('00000000-0000-0000-0000-000000000000', v_youssef, 'authenticated', 'authenticated', 'youssef@ceutaplay.es',
        extensions.crypt('demo1234', extensions.gen_salt('bf')), now(),
        '{"provider":"email","providers":["email"]}', jsonb_build_object('nombre', 'Youssef Mohamed'),
        now() - interval '45 days', now(), '', '', '', '');
    insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), v_youssef, v_youssef::text,
        jsonb_build_object('sub', v_youssef::text, 'email', 'youssef@ceutaplay.es', 'email_verified', true), 'email', now(), now(), now());
    update public.perfiles set nombre = 'Youssef Mohamed', bio = 'Estudiante de la UGR en Ceuta. Pádel y kayak cuando el tiempo acompaña.', deporte_favorito = 'Pádel'
        where id = v_youssef;

    v_paula := gen_random_uuid();
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
        confirmation_token, recovery_token, email_change, email_change_token_new)
    values ('00000000-0000-0000-0000-000000000000', v_paula, 'authenticated', 'authenticated', 'paula@ceutaplay.es',
        extensions.crypt('demo1234', extensions.gen_salt('bf')), now(),
        '{"provider":"email","providers":["email"]}', jsonb_build_object('nombre', 'Paula Navarro'),
        now() - interval '42 days', now(), '', '', '', '');
    insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), v_paula, v_paula::text,
        jsonb_build_object('sub', v_paula::text, 'email', 'paula@ceutaplay.es', 'email_verified', true), 'email', now(), now(), now());
    update public.perfiles set nombre = 'Paula Navarro', bio = 'Tenis y running. Organizo partidos los sábados por la mañana, ¡únete!', deporte_favorito = 'Tenis'
        where id = v_paula;

    v_hamza := gen_random_uuid();
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
        confirmation_token, recovery_token, email_change, email_change_token_new)
    values ('00000000-0000-0000-0000-000000000000', v_hamza, 'authenticated', 'authenticated', 'hamza@ceutaplay.es',
        extensions.crypt('demo1234', extensions.gen_salt('bf')), now(),
        '{"provider":"email","providers":["email"]}', jsonb_build_object('nombre', 'Hamza Larbi'),
        now() - interval '39 days', now(), '', '', '', '');
    insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), v_hamza, v_hamza::text,
        jsonb_build_object('sub', v_hamza::text, 'email', 'hamza@ceutaplay.es', 'email_verified', true), 'email', now(), now(), now());
    update public.perfiles set nombre = 'Hamza Larbi', bio = 'Monitor de deportes náuticos en verano. El resto del año, pádel.', deporte_favorito = 'Kayak'
        where id = v_hamza;

    v_sara := gen_random_uuid();
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
        confirmation_token, recovery_token, email_change, email_change_token_new)
    values ('00000000-0000-0000-0000-000000000000', v_sara, 'authenticated', 'authenticated', 'sara@ceutaplay.es',
        extensions.crypt('demo1234', extensions.gen_salt('bf')), now(),
        '{"provider":"email","providers":["email"]}', jsonb_build_object('nombre', 'Sara Ortega'),
        now() - interval '36 days', now(), '', '', '', '');
    insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), v_sara, v_sara::text,
        jsonb_build_object('sub', v_sara::text, 'email', 'sara@ceutaplay.es', 'email_verified', true), 'email', now(), now(), now());
    update public.perfiles set nombre = 'Sara Ortega', bio = 'Empecé con el pádel hace un año y ya no puedo parar. Busco gente para aprender.', deporte_favorito = 'Pádel'
        where id = v_sara;

    v_ivan := gen_random_uuid();
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
        confirmation_token, recovery_token, email_change, email_change_token_new)
    values ('00000000-0000-0000-0000-000000000000', v_ivan, 'authenticated', 'authenticated', 'ivan@ceutaplay.es',
        extensions.crypt('demo1234', extensions.gen_salt('bf')), now(),
        '{"provider":"email","providers":["email"]}', jsonb_build_object('nombre', 'Iván Ruiz'),
        now() - interval '33 days', now(), '', '', '', '');
    insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), v_ivan, v_ivan::text,
        jsonb_build_object('sub', v_ivan::text, 'email', 'ivan@ceutaplay.es', 'email_verified', true), 'email', now(), now(), now());
    update public.perfiles set nombre = 'Iván Ruiz', bio = 'Tenista de club. Si te falta uno para dobles, avísame.', deporte_favorito = 'Tenis'
        where id = v_ivan;

    v_nora := gen_random_uuid();
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
        confirmation_token, recovery_token, email_change, email_change_token_new)
    values ('00000000-0000-0000-0000-000000000000', v_nora, 'authenticated', 'authenticated', 'nora@ceutaplay.es',
        extensions.crypt('demo1234', extensions.gen_salt('bf')), now(),
        '{"provider":"email","providers":["email"]}', jsonb_build_object('nombre', 'Nora Haddou'),
        now() - interval '30 days', now(), '', '', '', '');
    insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), v_nora, v_nora::text,
        jsonb_build_object('sub', v_nora::text, 'email', 'nora@ceutaplay.es', 'email_verified', true), 'email', now(), now(), now());
    update public.perfiles set nombre = 'Nora Haddou', bio = 'Piragüismo en la bahía sur y pádel con amigas los jueves.', deporte_favorito = 'Piragüismo'
        where id = v_nora;

    v_gestor := gen_random_uuid();
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
        confirmation_token, recovery_token, email_change, email_change_token_new)
    values ('00000000-0000-0000-0000-000000000000', v_gestor, 'authenticated', 'authenticated', 'gestor@ceutaplay.es',
        extensions.crypt('demo1234', extensions.gen_salt('bf')), now(),
        '{"provider":"email","providers":["email"]}', jsonb_build_object('nombre', 'Gestión La Marina'),
        now() - interval '27 days', now(), '', '', '', '');
    insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), v_gestor, v_gestor::text,
        jsonb_build_object('sub', v_gestor::text, 'email', 'gestor@ceutaplay.es', 'email_verified', true), 'email', now(), now(), now());
    update public.perfiles set nombre = 'Gestión La Marina', bio = 'Gestores de las pistas de pádel y tenis de La Marina.', deporte_favorito = ''
        where id = v_gestor;
    insert into public.gestores (usuario_id, instalacion_id) values (v_gestor, 1);
    insert into public.gestores (usuario_id, instalacion_id) values (v_gestor, 3);

    v_entidad := gen_random_uuid();
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
        confirmation_token, recovery_token, email_change, email_change_token_new)
    values ('00000000-0000-0000-0000-000000000000', v_entidad, 'authenticated', 'authenticated', 'entidad@ceutaplay.es',
        extensions.crypt('demo1234', extensions.gen_salt('bf')), now(),
        '{"provider":"email","providers":["email"]}', jsonb_build_object('nombre', 'Asociación Estrella del Sur'),
        now() - interval '24 days', now(), '', '', '', '');
    insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), v_entidad, v_entidad::text,
        jsonb_build_object('sub', v_entidad::text, 'email', 'entidad@ceutaplay.es', 'email_verified', true), 'email', now(), now(), now());
    update public.perfiles set nombre = 'Asociación Estrella del Sur', bio = 'Asociación juvenil. Usamos la pista solidaria para nuestros grupos de deporte.', deporte_favorito = ''
        where id = v_entidad;
    insert into public.entidades_solidarias (usuario_id, nombre, descripcion, acreditada)
    values (v_entidad, 'Asociación Juvenil Estrella del Sur', 'Deporte para jóvenes de los barrios del sur de Ceuta.', true);

    alter table public.perfiles enable trigger perfiles_validar_nombre;

    -- ---------- reservas (cobradas en CeutaCoins) ----------
    insert into public.reservas (usuario_id, instalacion_id, pista, fecha, hora, duracion_min, importe, publica, mostrar_nombre, plazas, nota, creada)
    values (v_ana, 1, 'Pista 1', v_hoy + -40, '19:00', 90, public.precio_turno(20, v_hoy + -40, '19:00', 90),
        false, false, 4, '', now() + interval '-43 days')
    returning id into v_res;
    insert into public.movimientos (usuario_id, importe, tipo, concepto, referencia, creado)
    values (v_ana, -public.precio_turno(20, v_hoy + -40, '19:00', 90), 'reserva', 'Pádel La Marina · Pista 1', v_res, now() + interval '-43 days');
    insert into public.reservas (usuario_id, instalacion_id, pista, fecha, hora, duracion_min, importe, publica, mostrar_nombre, plazas, nota, creada)
    values (v_karim, 4, 'Doble 1', v_hoy + -33, '18:00', 60, public.precio_turno(15, v_hoy + -33, '18:00', 60),
        false, false, 4, '', now() + interval '-36 days')
    returning id into v_res;
    insert into public.movimientos (usuario_id, importe, tipo, concepto, referencia, creado)
    values (v_karim, -public.precio_turno(15, v_hoy + -33, '18:00', 60), 'reserva', 'Pádel Jardines de la Hípica · Doble 1', v_res, now() + interval '-36 days');
    insert into public.reservas (usuario_id, instalacion_id, pista, fecha, hora, duracion_min, importe, publica, mostrar_nombre, plazas, nota, creada)
    values (v_lucia, 6, 'Pista 4', v_hoy + -27, '10:00', 120, public.precio_turno(15, v_hoy + -27, '10:00', 120),
        false, false, 4, '', now() + interval '-30 days')
    returning id into v_res;
    insert into public.movimientos (usuario_id, importe, tipo, concepto, referencia, creado)
    values (v_lucia, -public.precio_turno(15, v_hoy + -27, '10:00', 120), 'reserva', 'Club de Tenis y Pádel Loma Margarita · Pista 4', v_res, now() + interval '-30 days');
    insert into public.reservas (usuario_id, instalacion_id, pista, fecha, hora, duracion_min, importe, publica, mostrar_nombre, plazas, nota, creada)
    values (v_paula, 7, 'Pista 2', v_hoy + -21, '09:30', 90, public.precio_turno(15, v_hoy + -21, '09:30', 90),
        false, false, 4, '', now() + interval '-24 days')
    returning id into v_res;
    insert into public.movimientos (usuario_id, importe, tipo, concepto, referencia, creado)
    values (v_paula, -public.precio_turno(15, v_hoy + -21, '09:30', 90), 'reserva', 'Club de Tenis Perla del Mediterráneo · Pista 2', v_res, now() + interval '-24 days');
    insert into public.reservas (usuario_id, instalacion_id, pista, fecha, hora, duracion_min, importe, publica, mostrar_nombre, plazas, nota, creada)
    values (v_marta, 17, 'Tabla 2', v_hoy + -18, '11:00', 60, public.precio_turno(15, v_hoy + -18, '11:00', 60),
        false, false, 4, '', now() + interval '-21 days')
    returning id into v_res;
    insert into public.movimientos (usuario_id, importe, tipo, concepto, referencia, creado)
    values (v_marta, -public.precio_turno(15, v_hoy + -18, '11:00', 60), 'reserva', 'Paddle surf con Ceuta Kayak · Tabla 2', v_res, now() + interval '-21 days');
    insert into public.reservas (usuario_id, instalacion_id, pista, fecha, hora, duracion_min, importe, publica, mostrar_nombre, plazas, nota, creada)
    values (v_hamza, 16, 'Kayak 1', v_hoy + -15, '12:00', 120, public.precio_turno(12, v_hoy + -15, '12:00', 120),
        false, false, 4, '', now() + interval '-18 days')
    returning id into v_res;
    insert into public.movimientos (usuario_id, importe, tipo, concepto, referencia, creado)
    values (v_hamza, -public.precio_turno(12, v_hoy + -15, '12:00', 120), 'reserva', 'Kayak con Ceuta Kayak · Kayak 1', v_res, now() + interval '-18 days');
    insert into public.reservas (usuario_id, instalacion_id, pista, fecha, hora, duracion_min, importe, publica, mostrar_nombre, plazas, nota, creada)
    values (v_sara, 5, 'Pista de demostración', v_hoy + -12, '17:30', 60, public.precio_turno(12, v_hoy + -12, '17:30', 60),
        false, false, 4, '', now() + interval '-15 days')
    returning id into v_res;
    insert into public.movimientos (usuario_id, importe, tipo, concepto, referencia, creado)
    values (v_sara, -public.precio_turno(12, v_hoy + -12, '17:30', 60), 'reserva', 'Pádel Loma Colmenar · Pista de demostración', v_res, now() + interval '-15 days');
    insert into public.reservas (usuario_id, instalacion_id, pista, fecha, hora, duracion_min, importe, publica, mostrar_nombre, plazas, nota, creada)
    values (v_ivan, 8, 'Pista 1', v_hoy + -9, '19:00', 60, public.precio_turno(15, v_hoy + -9, '19:00', 60),
        false, false, 4, '', now() + interval '-12 days')
    returning id into v_res;
    insert into public.movimientos (usuario_id, importe, tipo, concepto, referencia, creado)
    values (v_ivan, -public.precio_turno(15, v_hoy + -9, '19:00', 60), 'reserva', 'Club de Tenis Ceuta · Pista 1', v_res, now() + interval '-12 days');
    insert into public.reservas (usuario_id, instalacion_id, pista, fecha, hora, duracion_min, importe, publica, mostrar_nombre, plazas, nota, creada)
    values (v_youssef, 1, 'Pista 2', v_hoy + -6, '20:00', 90, public.precio_turno(20, v_hoy + -6, '20:00', 90),
        false, false, 4, '', now() + interval '-9 days')
    returning id into v_res;
    insert into public.movimientos (usuario_id, importe, tipo, concepto, referencia, creado)
    values (v_youssef, -public.precio_turno(20, v_hoy + -6, '20:00', 90), 'reserva', 'Pádel La Marina · Pista 2', v_res, now() + interval '-9 days');
    insert into public.reservas (usuario_id, instalacion_id, pista, fecha, hora, duracion_min, importe, publica, mostrar_nombre, plazas, nota, creada)
    values (v_nora, 18, 'Piragua 1', v_hoy + -4, '10:00', 60, public.precio_turno(14, v_hoy + -4, '10:00', 60),
        false, false, 4, '', now() + interval '-7 days')
    returning id into v_res;
    insert into public.movimientos (usuario_id, importe, tipo, concepto, referencia, creado)
    values (v_nora, -public.precio_turno(14, v_hoy + -4, '10:00', 60), 'reserva', 'Piragüismo con Ceuta Kayak · Piragua 1', v_res, now() + interval '-7 days');
    insert into public.reservas (usuario_id, instalacion_id, pista, fecha, hora, duracion_min, importe, publica, mostrar_nombre, plazas, nota, creada)
    values (v_luis, 3, 'Pista 1', v_hoy + -2, '18:00', 60, public.precio_turno(15, v_hoy + -2, '18:00', 60),
        false, false, 4, '', now() + interval '-5 days')
    returning id into v_res;
    insert into public.movimientos (usuario_id, importe, tipo, concepto, referencia, creado)
    values (v_luis, -public.precio_turno(15, v_hoy + -2, '18:00', 60), 'reserva', 'Tenis La Marina · Pista 1', v_res, now() + interval '-5 days');
    insert into public.reservas (usuario_id, instalacion_id, pista, fecha, hora, duracion_min, importe, publica, mostrar_nombre, plazas, nota, creada)
    values (v_ana, 1, 'Pista 3', v_hoy + -1, '19:30', 60, public.precio_turno(20, v_hoy + -1, '19:30', 60),
        false, false, 4, '', now() + interval '-4 days')
    returning id into v_res;
    insert into public.movimientos (usuario_id, importe, tipo, concepto, referencia, creado)
    values (v_ana, -public.precio_turno(20, v_hoy + -1, '19:30', 60), 'reserva', 'Pádel La Marina · Pista 3', v_res, now() + interval '-4 days');
    insert into public.reservas (usuario_id, instalacion_id, pista, fecha, hora, duracion_min, importe, publica, mostrar_nombre, plazas, nota, creada)
    values (v_ana, 1, 'Pista 2', v_hoy + 1, '19:00', 90, public.precio_turno(20, v_hoy + 1, '19:00', 90),
        true, true, 4, 'Partido de nivel medio. ¡Nos faltan dos!', now() + interval '-2 days')
    returning id into v_res;
    insert into public.movimientos (usuario_id, importe, tipo, concepto, referencia, creado)
    values (v_ana, -public.precio_turno(20, v_hoy + 1, '19:00', 90), 'reserva', 'Pádel La Marina · Pista 2', v_res, now() + interval '-2 days');
    insert into public.participantes (reserva_id, usuario_id, estado, mensaje) values (v_res, v_karim, 'aceptado', '¡Me apunto!');
    insert into public.participantes (reserva_id, usuario_id, estado, mensaje) values (v_res, v_sara, 'pendiente', '¿Puedo ir aunque esté empezando?');
    insert into public.reservas (usuario_id, instalacion_id, pista, fecha, hora, duracion_min, importe, publica, mostrar_nombre, plazas, nota, creada)
    values (v_paula, 7, 'Pista 1', v_hoy + 2, '10:00', 120, public.precio_turno(15, v_hoy + 2, '10:00', 120),
        true, true, 4, 'Dobles de los sábados. Buen ambiente.', now() + interval '-1 days')
    returning id into v_res;
    insert into public.movimientos (usuario_id, importe, tipo, concepto, referencia, creado)
    values (v_paula, -public.precio_turno(15, v_hoy + 2, '10:00', 120), 'reserva', 'Club de Tenis Perla del Mediterráneo · Pista 1', v_res, now() + interval '-1 days');
    insert into public.participantes (reserva_id, usuario_id, estado, mensaje) values (v_res, v_ivan, 'aceptado', 'Cuenta conmigo');
    insert into public.participantes (reserva_id, usuario_id, estado, mensaje) values (v_res, v_lucia, 'aceptado', '');
    insert into public.reservas (usuario_id, instalacion_id, pista, fecha, hora, duracion_min, importe, publica, mostrar_nombre, plazas, nota, creada)
    values (v_karim, 4, 'Doble 2', v_hoy + 3, '18:30', 60, public.precio_turno(15, v_hoy + 3, '18:30', 60),
        true, true, 4, 'Pádel nivel 4, partido rápido después del trabajo.', now() + interval '0 days')
    returning id into v_res;
    insert into public.movimientos (usuario_id, importe, tipo, concepto, referencia, creado)
    values (v_karim, -public.precio_turno(15, v_hoy + 3, '18:30', 60), 'reserva', 'Pádel Jardines de la Hípica · Doble 2', v_res, now() + interval '0 days');
    insert into public.participantes (reserva_id, usuario_id, estado, mensaje) values (v_res, v_youssef, 'pendiente', 'Nivel 3,5, ¿vale?');
    insert into public.reservas (usuario_id, instalacion_id, pista, fecha, hora, duracion_min, importe, publica, mostrar_nombre, plazas, nota, creada)
    values (v_lucia, 6, 'Pista 2', v_hoy + 4, '17:00', 90, public.precio_turno(15, v_hoy + 4, '17:00', 90),
        true, true, 4, 'Dobles mixtos, falta una pareja.', now() + interval '1 days')
    returning id into v_res;
    insert into public.movimientos (usuario_id, importe, tipo, concepto, referencia, creado)
    values (v_lucia, -public.precio_turno(15, v_hoy + 4, '17:00', 90), 'reserva', 'Club de Tenis y Pádel Loma Margarita · Pista 2', v_res, now() + interval '1 days');
    insert into public.reservas (usuario_id, instalacion_id, pista, fecha, hora, duracion_min, importe, publica, mostrar_nombre, plazas, nota, creada)
    values (v_youssef, 5, 'Pista de demostración', v_hoy + 5, '16:00', 60, public.precio_turno(12, v_hoy + 5, '16:00', 60),
        false, false, 4, '', now() + interval '2 days')
    returning id into v_res;
    insert into public.movimientos (usuario_id, importe, tipo, concepto, referencia, creado)
    values (v_youssef, -public.precio_turno(12, v_hoy + 5, '16:00', 60), 'reserva', 'Pádel Loma Colmenar · Pista de demostración', v_res, now() + interval '2 days');
    insert into public.reservas (usuario_id, instalacion_id, pista, fecha, hora, duracion_min, importe, publica, mostrar_nombre, plazas, nota, creada)
    values (v_hamza, 16, 'Kayak 2', v_hoy + 2, '11:00', 120, public.precio_turno(12, v_hoy + 2, '11:00', 120),
        true, true, 3, 'Salida en kayak por la Ribera si no sopla levante.', now() + interval '-1 days')
    returning id into v_res;
    insert into public.movimientos (usuario_id, importe, tipo, concepto, referencia, creado)
    values (v_hamza, -public.precio_turno(12, v_hoy + 2, '11:00', 120), 'reserva', 'Kayak con Ceuta Kayak · Kayak 2', v_res, now() + interval '-1 days');
    insert into public.reservas (usuario_id, instalacion_id, pista, fecha, hora, duracion_min, importe, publica, mostrar_nombre, plazas, nota, creada)
    values (v_luis, 3, 'Pista 2', v_hoy + 6, '20:00', 60, public.precio_turno(15, v_hoy + 6, '20:00', 60),
        false, false, 4, '', now() + interval '3 days')
    returning id into v_res;
    insert into public.movimientos (usuario_id, importe, tipo, concepto, referencia, creado)
    values (v_luis, -public.precio_turno(15, v_hoy + 6, '20:00', 60), 'reserva', 'Tenis La Marina · Pista 2', v_res, now() + interval '3 days');
    insert into public.reservas (usuario_id, instalacion_id, pista, fecha, hora, duracion_min, importe, publica, mostrar_nombre, plazas, nota, creada)
    values (v_marta, 6, 'Pista 5', v_hoy + 3, '09:00', 60, public.precio_turno(15, v_hoy + 3, '09:00', 60),
        false, false, 4, '', now() + interval '0 days')
    returning id into v_res;
    insert into public.movimientos (usuario_id, importe, tipo, concepto, referencia, creado)
    values (v_marta, -public.precio_turno(15, v_hoy + 3, '09:00', 60), 'reserva', 'Club de Tenis y Pádel Loma Margarita · Pista 5', v_res, now() + interval '0 days');
    insert into public.reservas (usuario_id, instalacion_id, pista, fecha, hora, duracion_min, importe, publica, mostrar_nombre, plazas, nota, creada)
    values (v_sara, 1, 'Pista 3', v_hoy + 7, '18:00', 90, public.precio_turno(20, v_hoy + 7, '18:00', 90),
        true, true, 4, 'Partido para principiantes, sin presión.', now() + interval '4 days')
    returning id into v_res;
    insert into public.movimientos (usuario_id, importe, tipo, concepto, referencia, creado)
    values (v_sara, -public.precio_turno(20, v_hoy + 7, '18:00', 90), 'reserva', 'Pádel La Marina · Pista 3', v_res, now() + interval '4 days');
    insert into public.reservas (usuario_id, instalacion_id, pista, fecha, hora, duracion_min, importe, publica, mostrar_nombre, plazas, nota, creada)
    values (v_nora, 8, 'Pista 3', v_hoy + 8, '19:30', 60, public.precio_turno(15, v_hoy + 8, '19:30', 60),
        false, false, 4, '', now() + interval '5 days')
    returning id into v_res;
    insert into public.movimientos (usuario_id, importe, tipo, concepto, referencia, creado)
    values (v_nora, -public.precio_turno(15, v_hoy + 8, '19:30', 60), 'reserva', 'Club de Tenis Ceuta · Pista 3', v_res, now() + interval '5 days');

    -- un bloqueo del gestor (mantenimiento)
    insert into public.reservas (usuario_id, instalacion_id, pista, fecha, hora, duracion_min, importe, tipo, nota)
    values (v_gestor, 1, 'Pista 3', v_hoy + 2, '09:00', 120, 0, 'bloqueo', 'Mantenimiento del césped');

    -- ---------- reseñas ----------
    insert into public.opiniones (instalacion_id, usuario_id, puntuacion, comentario, creada)
    values (1, v_ana, 5, 'Pistas cuidadas y vistas al mar. Por la tarde se llena, mejor reservar con tiempo.', now() + interval '-39 days')
    on conflict do nothing;
    insert into public.opiniones (instalacion_id, usuario_id, puntuacion, comentario, creada)
    values (1, v_karim, 4, 'Buen cristal y buena luz. Los vestuarios podrían estar mejor.', now() + interval '-30 days')
    on conflict do nothing;
    insert into public.opiniones (instalacion_id, usuario_id, puntuacion, comentario, creada)
    values (1, v_youssef, 5, 'La subasta de última hora me salió a mitad de precio. ¡Genial!', now() + interval '-5 days')
    on conflict do nothing;
    insert into public.opiniones (instalacion_id, usuario_id, puntuacion, comentario, creada)
    values (4, v_karim, 4, 'Ambiente tranquilo y bien de precio.', now() + interval '-32 days')
    on conflict do nothing;
    insert into public.opiniones (instalacion_id, usuario_id, puntuacion, comentario, creada)
    values (5, v_sara, 3, 'Está bien para empezar, aunque solo hay una pista.', now() + interval '-11 days')
    on conflict do nothing;
    insert into public.opiniones (instalacion_id, usuario_id, puntuacion, comentario, creada)
    values (6, v_lucia, 5, 'Las mejores pistas de tenis de Ceuta. Muy buen mantenimiento.', now() + interval '-26 days')
    on conflict do nothing;
    insert into public.opiniones (instalacion_id, usuario_id, puntuacion, comentario, creada)
    values (6, v_marta, 4, 'Muchas pistas disponibles, casi siempre hay hueco.', now() + interval '-20 days')
    on conflict do nothing;
    insert into public.opiniones (instalacion_id, usuario_id, puntuacion, comentario, creada)
    values (7, v_paula, 4, 'Buen club y buen trato. Aparcar es un poco complicado.', now() + interval '-20 days')
    on conflict do nothing;
    insert into public.opiniones (instalacion_id, usuario_id, puntuacion, comentario, creada)
    values (8, v_ivan, 4, 'Pistas rápidas, ideales para jugar de noche.', now() + interval '-8 days')
    on conflict do nothing;
    insert into public.opiniones (instalacion_id, usuario_id, puntuacion, comentario, creada)
    values (3, v_luis, 4, 'Tenis junto al mar. Con viento cuesta un poco más.', now() + interval '-1 days')
    on conflict do nothing;
    insert into public.opiniones (instalacion_id, usuario_id, puntuacion, comentario, creada)
    values (17, v_marta, 5, 'Tablas en muy buen estado y la bahía en calma. Repetiré.', now() + interval '-17 days')
    on conflict do nothing;
    insert into public.opiniones (instalacion_id, usuario_id, puntuacion, comentario, creada)
    values (16, v_hamza, 5, 'Salida perfecta por la Ribera. Atentos al parte del levante.', now() + interval '-14 days')
    on conflict do nothing;
    insert into public.opiniones (instalacion_id, usuario_id, puntuacion, comentario, creada)
    values (18, v_nora, 4, 'Piraguas cómodas. El monitor explica muy bien.', now() + interval '-3 days')
    on conflict do nothing;

    -- ---------- subastas de reventa (cada una sobre una reserva del vendedor) ----------
    begin
        insert into public.reservas (usuario_id, instalacion_id, pista, fecha, hora, duracion_min, importe)
        values (v_ana, 1, 'Pista 3', v_hoy + 0, lpad(least(20, greatest(10, extract(hour from now() at time zone 'Europe/Madrid')::integer + 4))::text, 2, '0') || ':00', 60, 20)
        returning id into v_res;
        insert into public.subastas (instalacion_id, titulo, deporte, fecha, hora, descripcion, precio_salida, incremento, fin,
            vendedor_id, tipo, pista, reserva_id, comision_pct, ipsi_pct)
        select instalacion_id, 'Pádel La Marina', 'Pádel', fecha, hora, 'No puedo ir a mi reserva, la subasto. Incluye palas.', 10, 1,
            least(now() + interval '90 minutes', public.inicio_turno(fecha, hora)),
            usuario_id, 'reventa', pista, id, 15, 4
        from public.reservas where id = v_res
        returning id into v_sub;
        insert into public.pujas (subasta_id, usuario_id, cantidad, fecha)
        values (v_sub, v_luis, 12, now() - interval '10 minutes');
        insert into public.pujas (subasta_id, usuario_id, cantidad, fecha)
        values (v_sub, v_marta, 14, now() - interval '5 minutes');
    exception when others then
        raise notice 'Subasta de ejemplo omitida: %', sqlerrm;
    end;
    begin
        insert into public.reservas (usuario_id, instalacion_id, pista, fecha, hora, duracion_min, importe)
        values (v_lucia, 6, 'Pista 6', v_hoy + 2, lpad(least(20, greatest(10, extract(hour from now() at time zone 'Europe/Madrid')::integer + 6))::text, 2, '0') || ':00', 60, 15)
        returning id into v_res;
        insert into public.subastas (instalacion_id, titulo, deporte, fecha, hora, descripcion, precio_salida, incremento, fin,
            vendedor_id, tipo, pista, reserva_id, comision_pct, ipsi_pct)
        select instalacion_id, 'Club de Tenis y Pádel Loma Margarita', 'Tenis', fecha, hora, 'Me ha surgido un viaje. Pista de tenis cubierta.', 8, 1,
            least(now() + interval '240 minutes', public.inicio_turno(fecha, hora)),
            usuario_id, 'reventa', pista, id, 15, 4
        from public.reservas where id = v_res
        returning id into v_sub;
    exception when others then
        raise notice 'Subasta de ejemplo omitida: %', sqlerrm;
    end;
    begin
        insert into public.reservas (usuario_id, instalacion_id, pista, fecha, hora, duracion_min, importe)
        values (v_ivan, 3, 'Pista 2', v_hoy + 1, lpad(least(20, greatest(10, extract(hour from now() at time zone 'Europe/Madrid')::integer + 18))::text, 2, '0') || ':00', 60, 15)
        returning id into v_res;
        insert into public.subastas (instalacion_id, titulo, deporte, fecha, hora, descripcion, precio_salida, incremento, fin,
            vendedor_id, tipo, pista, reserva_id, comision_pct, ipsi_pct)
        select instalacion_id, 'Tenis La Marina', 'Tenis', fecha, hora, 'Pista de tenis para mañana por la mañana.', 8, 1,
            least(now() + interval '20 minutes', public.inicio_turno(fecha, hora)),
            usuario_id, 'reventa', pista, id, 15, 4
        from public.reservas where id = v_res
        returning id into v_sub;
        insert into public.pujas (subasta_id, usuario_id, cantidad, fecha)
        values (v_sub, v_ana, 9, now() - interval '10 minutes');
        insert into public.pujas (subasta_id, usuario_id, cantidad, fecha)
        values (v_sub, v_paula, 10, now() - interval '5 minutes');
    exception when others then
        raise notice 'Subasta de ejemplo omitida: %', sqlerrm;
    end;

    -- ---------- una petición de pista solidaria para hoy ----------
    insert into public.peticiones_solidarias (entidad_id, deporte, fecha, desde, hasta)
    values (v_entidad, 'Pádel', v_hoy, '16:00', '20:00');

    raise notice 'Datos de ejemplo creados.';
end;
$$;
