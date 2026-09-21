const swiper = new Swiper(".t-swiper", {
  loop: true,
  effect: "fade",
  fadeEffect: { crossFade: true },
  speed: 550,
  grabCursor: true,
  autoHeight: true,
  pagination: {
    el: ".t-pagination",
    clickable: true,
  },
  navigation: {
    prevEl: ".t-nav--prev",
    nextEl: ".t-nav--next",
  },
  keyboard: { enabled: true },
  a11y: { enabled: true },
});
