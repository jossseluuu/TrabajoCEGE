document.addEventListener("DOMContentLoaded", () => {

    const form = document.getElementById("search-form");
    const cards = document.querySelectorAll(".card");
    const emptyResults = document.getElementById("empty-results");

    form.addEventListener("submit", (event) => {
        event.preventDefault();

        const selectedSport = document.getElementById("deporte").value;

        let visibleCards = 0;

        cards.forEach((card) => {
            const cardSport = card.dataset.deporte;

            const visible = !selectedSport || cardSport === selectedSport;

            card.hidden = !visible;

            if (visible) {
                visibleCards++;
            }
        });

        emptyResults.hidden = visibleCards > 0;

        document.getElementById("instalaciones").scrollIntoView({
            behavior: "smooth"
        });
    });

});