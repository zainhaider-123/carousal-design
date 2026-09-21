// effect:'creative' runs Swiper in virtualTranslate mode, and in that
// mode Swiper's loop module does not clone slides for the wrap-around
// seam — so with loop:true the real previous slide simply doesn't
// exist in the DOM when viewing the first slide (same for "next" on
// the last slide), and its peek can't show. Building the loop by hand
// instead: clone the last slide before the first and the first slide
// after the last, run Swiper with loop:false over that buffered list,
// and silently re-center (speed 0) whenever a clone becomes active.
const wrapper = document.querySelector(".t-swiper .swiper-wrapper");
const realSlides = Array.from(wrapper.children);
const slideCount = realSlides.length;

const lastClone = realSlides[slideCount - 1].cloneNode(true);
const firstClone = realSlides[0].cloneNode(true);
lastClone.setAttribute("aria-hidden", "true");
firstClone.setAttribute("aria-hidden", "true");
wrapper.insertBefore(lastClone, wrapper.firstChild);
wrapper.appendChild(firstClone);

// Pagination bullets map to the 5 real testimonials, not the 7 buffered
// DOM slides, so they're built and driven by hand rather than through
// Swiper's own pagination module.
const paginationEl = document.querySelector(".t-pagination");
const bullets = realSlides.map((_, realIndex) => {
  const bullet = document.createElement("span");
  bullet.className = "swiper-pagination-bullet";
  bullet.setAttribute("role", "button");
  bullet.setAttribute("aria-label", `Go to slide ${realIndex + 1}`);
  bullet.addEventListener("click", () => swiper.slideTo(realIndex + 1));
  paginationEl.appendChild(bullet);
  return bullet;
});

function setActiveBullet(realIndex) {
  bullets.forEach((bullet, i) =>
    bullet.classList.toggle("swiper-pagination-bullet-active", i === realIndex)
  );
}

const swiper = new Swiper(".t-swiper", {
  loop: false,
  initialSlide: 1,
  effect: "creative",
  creativeEffect: {
    limitProgress: 1,
    prev: {
      // Same geometry the old static decor rectangles used: scaled to
      // 88% and shifted by ~11.1% of the (unscaled) slide width, which
      // works out to the card peeking ~5% of the active card's own
      // width past its edge — now it's the real previous slide sitting
      // there instead of a decorative placeholder.
      translate: ["-11.1%", 0, 0],
      scale: 0.88,
    },
    next: {
      translate: ["11.1%", 0, 0],
      scale: 0.88,
    },
  },
  speed: 550,
  grabCursor: true,
  navigation: {
    prevEl: ".t-nav--prev",
    nextEl: ".t-nav--next",
  },
  keyboard: { enabled: true },
  a11y: { enabled: true },
  on: {
    init(sw) {
      // Derive from sw.activeIndex rather than assuming initialSlide's
      // value always lands exactly where configured — it silently
      // didn't at narrow viewports before the display:none fix below.
      setActiveBullet(((sw.activeIndex - 1) % slideCount + slideCount) % slideCount);
    },
    slideChangeTransitionEnd(sw) {
      // Calling slideTo() synchronously from inside this same event
      // doesn't reliably take effect (re-entrancy into Swiper's own
      // transition handling) — deferring it a tick is the standard fix.
      if (sw.activeIndex === 0) {
        setTimeout(() => {
          sw.slideTo(slideCount, 0, false);
          setActiveBullet(slideCount - 1);
        }, 0);
      } else if (sw.activeIndex === slideCount + 1) {
        setTimeout(() => {
          sw.slideTo(1, 0, false);
          setActiveBullet(0);
        }, 0);
      } else {
        setActiveBullet(sw.activeIndex - 1);
      }
    },
  },
});
