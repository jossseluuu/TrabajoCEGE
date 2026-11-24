const reviewFacility = document.getElementById("facility");
const reviewForm = document.getElementById("review-form");
const reviewComment = document.getElementById("review-comment");
const reviewSubmit = reviewForm.querySelector('button[type="submit"]');
const reviewSummary = document.getElementById("review-summary");
const reviewStatus = document.getElementById("review-status");
const reviewList = document.getElementById("review-list");
const ratingFormat = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 1 });
let reviewRequest = 0;

function renderReview(review) {
    const item = document.createElement("li");
    const author = document.createElement("strong");
    author.textContent = review.nombre || "Usuario de CeutaPlay";
    const rating = document.createElement("span");
    rating.className = "review-display-stars";
    const stars = document.createElement("span");
    stars.setAttribute("aria-hidden", "true");
    stars.textContent = "★".repeat(review.puntuacion) + "☆".repeat(5 - review.puntuacion);
    rating.append(stars, ` ${review.puntuacion}/5`);
    const comment = document.createElement("p");
    comment.textContent = review.comentario;
    item.append(author, rating, comment);
    return item;
}

async function loadReviews() {
    const user = Store.usuarioActual();
    if (!user) return;

    const request = ++reviewRequest;
    reviewForm.hidden = true;
    reviewForm.reset();
    reviewSubmit.disabled = false;
    reviewList.replaceChildren();
    reviewStatus.textContent = "";
    reviewSummary.textContent = "Cargando opiniones…";

    try {
        const reviews = await Store.listarOpiniones(Number(reviewFacility.value));
        if (request !== reviewRequest) return;
        if (reviews === null) {
            reviewSummary.textContent = "Las opiniones se podrán publicar cuando se activen en el servidor.";
            return;
        }

        if (reviews.length) {
            const average = reviews.reduce((total, review) => total + review.puntuacion, 0) / reviews.length;
            reviewSummary.textContent = `${ratingFormat.format(average)} de 5 · ${reviews.length} ${reviews.length === 1 ? "opinión" : "opiniones"}`;
        } else {
            reviewSummary.textContent = "Todavía no hay opiniones para esta instalación.";
        }
        const own = reviews.find((review) => review.usuarioId === user.id);
        if (own) {
            reviewForm.elements.namedItem("score").value = String(own.puntuacion);
            reviewComment.value = own.comentario;
        }
        reviewSubmit.textContent = own ? "Guardar cambios" : "Publicar opinión";
        reviewList.replaceChildren(...reviews.map(renderReview));
        reviewForm.hidden = false;
    } catch (error) {
        if (request === reviewRequest) reviewSummary.textContent = `No se pudieron cargar las opiniones. ${error.message}`;
    }
}

reviewFacility.addEventListener("change", loadReviews);
reviewForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const request = reviewRequest;
    reviewSubmit.disabled = true;
    reviewStatus.textContent = "";
    try {
        await Store.guardarOpinion({
            instalacionId: Number(reviewFacility.value),
            puntuacion: Number(new FormData(reviewForm).get("score")),
            comentario: reviewComment.value,
        });
        if (request !== reviewRequest) return;
        const refresh = loadReviews();
        const refreshRequest = reviewRequest;
        await refresh;
        if (refreshRequest === reviewRequest) reviewStatus.textContent = "Opinión guardada.";
    } catch (error) {
        if (request === reviewRequest) {
            reviewStatus.textContent = error.message;
            reviewSubmit.disabled = false;
        }
    }
});

Store.inicializar().then(loadReviews);
