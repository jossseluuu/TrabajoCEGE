# TrabajoGabi – CeutaPlay

Web de reserva de pistas deportivas en Ceuta (trabajo de CEGE). Es una web **estática** (HTML + CSS + JavaScript) que se publica automáticamente en **GitHub Pages** mediante **GitHub Actions**.

🌐 **Web publicada:** <https://jossseluuu.github.io/TrabajoCEGE/>

---

## ⚠️ Por qué ya no se usa Django

El proyecto empezó con Django, pero **GitHub Pages solo puede servir archivos estáticos** (HTML, CSS, JS, imágenes). No ejecuta Python, así que una app de Django no puede funcionar ahí.

Como la web no usaba base de datos ni formularios que se envíen a un servidor (todos los datos estaban escritos a mano en `views.py`), se ha pasado a HTML/CSS/JS puro:

| Antes (Django)                          | Ahora (estático)                      |
|-----------------------------------------|---------------------------------------|
| `core/templates/core/home.html`         | `public/index.html`                   |
| `core/static/core/css/styles.css`       | `public/css/styles.css`               |
| `core/static/core/js/main.js`           | `public/js/main.js`                   |
| Datos en `core/views.py`                | `public/js/data.js`                   |
| `{% for %}`, `{{ variable }}`           | Las tarjetas se generan con JavaScript |
| `{% now "Y" %}`, fechas mín./máx.        | Se calculan con JavaScript            |

El código de Django sigue en el historial de git (commit `fb97ffb`) por si en el futuro hace falta un backend real (usuarios, reservas guardadas, pagos…). En ese caso habría que alojarlo en un servicio que ejecute Python (Render, Railway, PythonAnywhere…), no en GitHub Pages.

---

## 📁 Estructura

```text
TrabajoGabi/
├── .github/
│   └── workflows/
│       └── deploy.yml        ← publica main, dev y devep en GitHub Pages
├── supabase/
│   ├── schema.sql            ← base de datos del servidor (pegar en Supabase)
│   ├── admin.sql             ← permisos de administrador y panel admin
│   ├── subastas.sql          ← subastas de última hora y reventa (ejecutar después de admin.sql)
│   ├── opiniones.sql         ← actualización: opiniones compartidas
│   └── reservas-sociales.sql ← actualización: mostrar nombre en la agenda
├── public/                   ← TODO lo que hay aquí es lo que se publica
│   ├── index.html            ← página principal (instalaciones + subastas)
│   ├── login.html            ← iniciar sesión
│   ├── registro.html         ← crear cuenta
│   ├── perfil.html           ← mis reservas y mis subastas
│   ├── reservas.html         ← reservar pistas (con opiniones y agenda)
│   ├── mapa.html             ← mapa de instalaciones
│   ├── admin.html            ← panel de administración (solo admins)
│   ├── img/
│   ├── css/
│   │   └── styles.css
│   └── js/
│       ├── config.js         ← URL y clave del servidor (Supabase)
│       ├── data.js           ← deportes, instalaciones y datos de ejemplo (editar aquí)
│       ├── store.js          ← capa de datos: cuentas, subastas, pujas y reservas
│       ├── main.js           ← pinta las instalaciones y gestiona el buscador
│       ├── nav.js            ← cabecera común de todas las páginas (menú y sesión)
│       ├── auth.js           ← ventana de login/registro de la portada
│       ├── subastas.js       ← subastas: listado, crear, pujar, cuenta atrás
│       ├── login.js          ← páginas login.html y registro.html
│       ├── booking-storage.js← utilidades de reservas
│       ├── reservas.js       ← página de reservas
│       ├── perfil.js         ← página de perfil
│       ├── admin.js          ← panel de administración
│       ├── mapa.js, opiniones.js, portada.js
└── README.md
```

---

## 🔐 Cuentas, 🔥 subastas y 🎾 reservas

- **Registro e inicio de sesión** desde la ventana de la página principal o desde `login.html` / `registro.html` (son las mismas cuentas).
- **Subastas entre usuarios:** cualquier usuario puede subastar una reserva (instalación, fecha, hora, precio de salida, incremento mínimo y duración; hay una opción de *2 minutos* para la demostración en clase). Los demás pujan; cada puja debe superar la anterior en el incremento mínimo. No se puede pujar en tu propia subasta ni superarte a ti mismo.
- Cuenta atrás en directo, aviso de *"Te han superado"*, ganador al terminar, filtros (**En curso**, **Finalizadas**, **Mis subastas**, **Mis pujas**) y cancelación mientras no haya pujas.
- **Reservas** (`reservas.html`): una pista solo puede tenerla un usuario por turno. La agenda muestra la ocupación semanal y la actividad por día. Al reservar se puede elegir mostrar el nombre en la agenda.
- **Perfil** (`perfil.html`): reservas activas y anteriores, subastas creadas, pujas en curso y subastas ganadas.
- **Dos formatos de subasta:**
  - **⚡ Última hora (automática):** en las instalaciones con reserva directa (pádel y tenis, configurable en `SUBASTA_AUTOMATICA` de `data.js`), toda pista que sigue libre cuando faltan 12 h o menos sale sola a subasta con un precio de salida de la **mitad de su precio normal**. Se cierra 15 min antes del partido y el ganador recibe la reserva. Mientras no hay pujas la subasta se calcula en la web; con la primera puja se crea en el servidor.
  - **🔁 Reventa:** quien no puede ir subasta **su reserva** («Subastar mi reserva»). Al cerrar, la reserva pasa al ganador y el vendedor recibe el precio final **menos la comisión de CeutaPlay y el IPSI de esa comisión** (el formulario le enseña cuánto recibirá). Sin pujas, la reserva sigue siendo suya. Mientras está en subasta no se puede cancelar.
  - La comisión y el IPSI salen del panel de facturación y se guardan en cada subasta al crearla. El panel separa lo que se liquida a las instalaciones (reservas y última hora) de lo que se paga a los usuarios (reventas).
- **Subastas mejoradas:** resumen (en curso, terminan pronto, pujas, ahorro medio), filtro por deporte y orden, ahorro frente al precio normal de la pista, barra de tiempo, avisos en directo cuando te superan o ganas, y crear la subasta a partir de una de tus reservas. El formulario ya no deja elegir horas pasadas ni duraciones que terminen después del partido.
- **Administración** (`admin.html`, en el menú aparece **Panel admin**). Secciones:
  - **Resumen:** cifras clave, avisos pendientes (nombres a revisar, opiniones ofensivas, subastas sin pujas a punto de terminar) y actividad reciente.
  - **Facturación:** modelo de comisión por transacción. Comisión de reservas y de subastas, IPSI sobre la comisión y comisiones bonificadas por instalación (RSC: escuelas base, deporte femenino). Ingresos por mes, liquidación por instalación (imprimible / PDF) y exportación de movimientos a CSV.
  - **Subastas:** tasa de éxito, precio medio, candidatas a *pista solidaria*, filtros, ver las pujas, anular una puja y cancelar subastas.
  - **Reservas:** listado con precio y borrado.
  - **Usuarios:** suspender / reactivar cuentas (una cuenta suspendida no puede reservar, pujar, subastar ni opinar) y renombrar.
  - **Interacción:** usuarios activos, opiniones (con aviso de lenguaje no permitido y borrado) y registro de toda la actividad.
  - **Nombres prohibidos:** lista editable de términos que no se permiten en el nombre de usuario (insultos, odio, contenido sexual, suplantar al equipo…). Se comprueba al registrarse, tanto en la web como en el servidor, sin tildes y deshaciendo trucos como `1d10t4` o `i.d.i.o.t.a`. Cada término puede ser «en cualquier parte» o «solo palabra completa» (para no bloquear nombres reales como *Zorrilla* o *Diputado*).

### 🛡️ Cuenta de administrador

1. Ejecuta [`supabase/admin.sql`](supabase/admin.sql) y después [`supabase/subastas.sql`](supabase/subastas.sql) en el SQL Editor de Supabase (y **vuelve a ejecutarlo** cada vez que cambie: crea las tablas de nombres prohibidos, moderación y ajustes de facturación). Marca como administrador a `admin@ceutaplay.es`; para añadir otro, cambia el correo de la última línea y vuelve a ejecutarla.
2. La contraseña **no está en el repositorio**: se guarda en `privado/credenciales-admin.md`, que está en el `.gitignore`. Pídesela a quien gestione el proyecto.

### Dos modos de funcionamiento

| Modo | Cuándo | Qué pasa |
|------|--------|----------|
| 🟢 **Servidor** | `public/js/config.js` tiene la URL y la clave de Supabase | Todos los dispositivos ven las mismas cuentas, subastas, pujas y reservas, **en tiempo real**. Las reglas se comprueban en el servidor. |
| 🟡 **Local** | `config.js` vacío | Todo se guarda en el navegador. Útil para probar sin servidor; trae cuentas de prueba (`ana@ceutaplay.es`, `luis@ceutaplay.es`, `marta@ceutaplay.es` y el administrador `admin@ceutaplay.es`, contraseña `demo1234`) y algunas reservas de ejemplo para el panel de facturación. |

El pie de la página principal indica en qué modo está funcionando.

---

## 🗄️ Conectar el servidor (Supabase) — solo la primera vez

En proyectos que ya tienen las tablas, ejecuta [la actualización de reservas sociales](supabase/reservas-sociales.sql) en el SQL Editor para activar la opción de mostrar el nombre. Las reservas previas aparecen en la agenda sin nombre.

En proyectos ya configurados, ejecuta [la actualización de opiniones](supabase/opiniones.sql) para compartir las valoraciones entre usuarios. En modo local se guardan en el navegador.

GitHub Pages solo sirve archivos; los datos compartidos viven en [Supabase](https://supabase.com) (gratis), al que la web se conecta directamente desde el navegador.

1. **Crear el proyecto:** entra en <https://supabase.com>, crea una cuenta y pulsa **New project**. Elige un nombre (p. ej. `ceutaplay`), una contraseña para la base de datos (guárdala) y la región **West EU** o **Central EU**. Espera a que termine de crearse (1–2 minutos).
2. **Crear las tablas:** en el menú de la izquierda, **SQL Editor** → **New query**. Copia todo el contenido de [`supabase/schema.sql`](supabase/schema.sql), pégalo y pulsa **Run**. Debe terminar con *"Success. No rows returned"*.
3. **Quitar la confirmación por correo** (recomendado para el trabajo): **Authentication** → **Sign In / Providers** → **Email** → desactiva **Confirm email** → **Save**. Si se deja activado, cada usuario tendrá que confirmar su correo antes de entrar (y el plan gratuito solo envía unos pocos correos por hora).
4. **Copiar las claves:** **Project Settings** → **API Keys** (o el botón **Connect**). Copia:
   - **Project URL** → `https://xxxxxxxx.supabase.co`
   - La clave **publishable** (o **anon**, en proyectos antiguos)
5. **Pegarlas en la web:** abre `public/js/config.js` y rellena `url` y `anonKey`. Haz commit y push. En uno o dos minutos la web publicada mostrará en el pie *"🟢 Conectado al servidor"*.

> La clave publishable/anon es **pública por diseño** (va en la web); la seguridad la ponen las reglas de `schema.sql`. **Nunca** pongas en `config.js` la clave *secret* / *service_role*.

**Qué protege el servidor** (aunque alguien manipule la web desde su navegador):

- Solo se puede pujar con sesión iniciada, por encima del mínimo, en subastas activas y que no sean tuyas. Si dos personas pujan a la vez, se procesan una detrás de otra.
- Nadie puede modificar ni alargar subastas, ni borrar o inventarse pujas, ni cancelar subastas ajenas.
- Las reservas solo las puede crear o cancelar su dueño, y una pista no se puede reservar dos veces en el mismo turno.

**A tener en cuenta:** en el plan gratuito, Supabase **pausa el proyecto tras 7 días sin uso**. Si la web deja de cargar datos, entra en el panel de Supabase y pulsa **Restore project**. Para ver o borrar datos: **Table Editor** (tablas `perfiles`, `subastas`, `pujas`, `reservas`) y **Authentication → Users**.

### Cómo enseñar una puja entre dos usuarios

- **Con servidor:** abre la web en el móvil y en el ordenador (o en dos navegadores), entra con una cuenta distinta en cada uno y puja: el otro dispositivo lo ve al momento.
- **Sin servidor (modo local):** usa dos pestañas del mismo navegador, cada una con un usuario (sin marcar *Recordarme*, la sesión es por pestaña). El enlace *"Restablecer datos de ejemplo"* del pie vuelve a crear los datos de prueba.

---

## 🚀 Activar GitHub Pages (solo la primera vez)

Esto lo tiene que hacer alguien con permisos de administración en el repositorio:

1. En GitHub, ve al repositorio → **Settings** → **Pages**.
2. En **Build and deployment → Source**, elige **GitHub Actions**.
3. Listo. A partir de ahora, cada `push` a `main` publica la web.

Para ver si el despliegue ha ido bien: pestaña **Actions** del repositorio. Cuando termine en verde ✅, la web estará actualizada en la URL de arriba (puede tardar uno o dos minutos).

También se puede lanzar a mano: **Actions → Desplegar en GitHub Pages → Run workflow**.

---

## 🌿 Ver cada rama publicada

Cada rama se publica en su propia carpeta del mismo sitio:

| Rama    | Enlace                                               |
|---------|------------------------------------------------------|
| `main`  | <https://jossseluuu.github.io/TrabajoCEGE/>          |
| `dev`   | <https://jossseluuu.github.io/TrabajoCEGE/dev/>      |
| `devep` | <https://jossseluuu.github.io/TrabajoCEGE/devep/>    |

Cualquier `push` a una de las tres ramas vuelve a publicar las tres (tarda uno o dos minutos). Detalles:

- El archivo `.github/workflows/deploy.yml` tiene que ser **igual en las tres ramas**. Si se cambia en una, hay que llevar el cambio a las demás.
- GitHub solo permite desplegar Pages desde `main`, por eso un push a `dev` o `devep` lanza el despliegue "desde main" (en la pestaña *Actions* verás dos ejecuciones: la del aviso y la del despliegue).
- Para añadir otra rama, añádela en las dos listas de `deploy.yml` (`branches:` y el `for rama in ...`).

---

## 💻 Verla en local

No hace falta instalar nada. Cualquiera de estas opciones vale:

- **Lo más fácil:** abrir `public/index.html` con doble clic en el navegador.
- **VS Code:** instalar la extensión *Live Server*, clic derecho en `public/index.html` → *Open with Live Server*.
- **Con Python** (si lo tienes instalado):

  ```bash
  python -m http.server 8000 --directory public
  ```

  y abrir <http://localhost:8000>

---

## ✏️ Cómo hacer cambios

- **Añadir/editar instalaciones o deportes:** `public/js/data.js`. Los usuarios y subastas de ejemplo de ese archivo solo se usan en modo local.
- **Cambiar reglas de subastas o reservas:** en el servidor, `supabase/schema.sql` (y volver a ejecutarlo en el SQL Editor); en modo local, `public/js/store.js`.
- **Cambiar textos o secciones:** `public/index.html`.
- **Cambiar estilos:** `public/css/styles.css`.

Después:

```bash
git add .
git commit -m "Describe el cambio"
git push
```

y GitHub Actions publica la nueva versión automáticamente.

> **Importante:** usa siempre **rutas relativas** (`css/styles.css`, `js/main.js`, `img/foto.png`) y no rutas que empiecen por `/`. La web se sirve en `/TrabajoCEGE/`, así que una ruta como `/css/styles.css` no funcionaría en GitHub Pages.
