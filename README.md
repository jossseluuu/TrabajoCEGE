# TrabajoGabi – CeutaPlay

Web de reserva de pistas deportivas en Ceuta (trabajo de CEGE). Es una web **estática** (HTML + CSS + JavaScript) que se publica automáticamente en **GitHub Pages** mediante **GitHub Actions**.

🌐 **Web publicada:** <https://ana2005ugr.github.io/TrabajoGabi/>

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
│       ├── data.js        ← deportes, instalaciones y subastas (editar aquí)
│       └── main.js        ← pinta las tarjetas y gestiona el buscador
└── README.md
```

---

## 🚀 Activar GitHub Pages (solo la primera vez)

Esto lo tiene que hacer alguien con permisos de administración en el repositorio:

1. En GitHub, ve al repositorio → **Settings** → **Pages**.
2. En **Build and deployment → Source**, elige **GitHub Actions**.
3. Listo. A partir de ahora, cada `push` a `main` publica la web.

Para ver si el despliegue ha ido bien: pestaña **Actions** del repositorio. Cuando termine en verde ✅, la web estará actualizada en la URL de arriba (puede tardar uno o dos minutos).

También se puede lanzar a mano: **Actions → Desplegar en GitHub Pages → Run workflow**.

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

- **Añadir/editar instalaciones, deportes o subastas:** solo hay que tocar `public/js/data.js`.
- **Cambiar textos o secciones:** `public/index.html`.
- **Cambiar estilos:** `public/css/styles.css`.

Después:

```bash
git add .
git commit -m "Describe el cambio"
git push
```

y GitHub Actions publica la nueva versión automáticamente.

> **Importante:** usa siempre **rutas relativas** (`css/styles.css`, `js/main.js`, `img/foto.png`) y no rutas que empiecen por `/`. La web se sirve en `/TrabajoGabi/`, así que una ruta como `/css/styles.css` no funcionaría en GitHub Pages.
