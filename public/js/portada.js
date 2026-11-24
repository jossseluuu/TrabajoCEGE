const slideTrack = document.getElementById("hero-slides");
const slideCaption = document.getElementById("hero-slide-caption");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
let currentSlide = 0;
let timer;

function showSlide(index) {
    const slides = [...slideTrack.children];
    if (!slides.length) {
        slideCaption.hidden = true;
        return;
    }

    currentSlide = (index + slides.length) % slides.length;
    slideTrack.style.transform = `translateX(-${currentSlide * 100}%)`;
    slides.forEach((slide, position) => slide.setAttribute("aria-hidden", String(position !== currentSlide)));
    slideCaption.textContent = slides[currentSlide].dataset.caption;
}

function scheduleSlides() {
    clearInterval(timer);
    if (!reducedMotion.matches && !document.hidden && slideTrack.children.length > 1) {
        timer = setInterval(() => showSlide(currentSlide + 1), 5000);
    }
}

for (const slide of [...slideTrack.children]) {
    function removeFailedPhoto() {
        const position = [...slideTrack.children].indexOf(slide);
        if (position < 0) return;
        slide.remove();
        if (position < currentSlide) currentSlide--;
        showSlide(Math.min(currentSlide, slideTrack.children.length - 1));
        scheduleSlides();
    }

    slide.addEventListener("error", removeFailedPhoto, { once: true });
    if (slide.complete && !slide.naturalWidth) removeFailedPhoto();
}

document.addEventListener("visibilitychange", scheduleSlides);
reducedMotion.addEventListener("change", scheduleSlides);

showSlide(currentSlide);
scheduleSlides();
