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
│       └── deploy.yml     ← workflow que publica la web en GitHub Pages
├── public/                ← TODO lo que hay aquí es lo que se publica
│   ├── index.html         ← página principal
│   ├── css/
│   │   └── styles.css
│   └── js/
│       ├── data.js        ← deportes, instalaciones, usuarios y subastas de ejemplo (editar aquí)
│       ├── store.js       ← "base de datos": usuarios, sesión y subastas (localStorage)
│       ├── main.js        ← pinta las instalaciones y gestiona el buscador
│       ├── auth.js        ← login, registro y menú de usuario
│       └── subastas.js    ← subastas entre usuarios: listado, crear, pujar, cuenta atrás
└── README.md
```

---

## 🔐 Login y 🔥 subastas entre usuarios

- **Registro e inicio de sesión** con nombre, correo y contraseña (la contraseña se guarda cifrada con SHA-256 + sal, nunca en texto plano).
- **Crear subasta** (hay que haber iniciado sesión): instalación, fecha y hora del partido, precio de salida, incremento mínimo y duración (incluye una opción de *2 minutos* para hacer la demostración en clase).
- **Pujar** (hay que haber iniciado sesión): cada puja debe superar la anterior en el incremento mínimo. No se puede pujar en tu propia subasta ni volver a pujar si ya vas ganando.
- Cuenta atrás en directo. Al terminar, la subasta pasa a *Finalizadas* y se muestra el ganador.
- Filtros: **En curso**, **Finalizadas**, **Mis subastas** y **Mis pujas**. Aviso de *"Te han superado"* si alguien puja más que tú.
- El creador puede **cancelar** su subasta mientras no tenga pujas.

**Cuentas de prueba** (contraseña `demo1234`): `ana@ceutaplay.es`, `luis@ceutaplay.es`, `marta@ceutaplay.es`.

### Cómo enseñar una puja entre dos usuarios

La sesión dura lo que la pestaña (salvo que marques *Recordarme*), así que:

1. Abre la web en una pestaña e inicia sesión como **Luis**.
2. Abre la web en **otra pestaña** del mismo navegador e inicia sesión como **Ana**.
3. Puja con uno y verás que en la otra pestaña el precio se actualiza al momento y aparece *"Te han superado"*.

El enlace **"Restablecer datos de ejemplo"** del pie de página borra todo y vuelve a crear los usuarios y subastas de prueba.

### ⚠️ Limitación importante

GitHub Pages no tiene servidor ni base de datos, así que los datos se guardan **en el navegador de cada persona** (`localStorage`). Eso significa que:

- Los usuarios y pujas de un ordenador **no los ve otro ordenador** (sí otras pestañas del mismo navegador).
- No es seguro para una web real: cualquiera puede modificar los datos desde las herramientas del navegador.

Para que usuarios de distintos dispositivos pujen entre sí haría falta un backend (por ejemplo Firebase o Supabase, que tienen plan gratuito y funcionan con GitHub Pages). Todo el acceso a datos está aislado en `public/js/store.js`, así que solo habría que reescribir ese archivo.

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

- **Añadir/editar instalaciones, deportes, usuarios o subastas de ejemplo:** solo hay que tocar `public/js/data.js`. Los datos de ejemplo solo se crean la primera vez que se abre la web; para ver los cambios pulsa *"Restablecer datos de ejemplo"* en el pie de página.
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
