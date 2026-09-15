// Slide content lives in the markup (#carouselData in index.html) rather
// than here, so editing the carousel's text/images doesn't require
// touching JS.
const slideEls = Array.from(document.querySelectorAll("#carouselData > li"));
const slides = slideEls.map((li) => ({
  title: li.querySelector("h3")?.textContent.trim() || "",
  description: li.querySelector("p")?.textContent.trim() || "",
  image: li.dataset.image || "",
}));

const markedActive = slideEls.findIndex((li) => li.hasAttribute("data-active"));
let activeIndex = markedActive !== -1 ? markedActive : Math.floor(slides.length / 2);
let isAnimating = false;
const TRANSITION_MS = 500;
const EASING = "cubic-bezier(0.65, 0, 0.35, 1)";

const viewport = document.querySelector(".carousel__viewport");
const track = document.getElementById("carouselTrack");
const dotsContainer = document.getElementById("dots");
const prevBtn = document.querySelector(".nav-btn--prev");
const nextBtn = document.querySelector(".nav-btn--next");

function mod(n, m) {
  return ((n % m) + m) % m;
}

function buildCard(slide, role) {
  const card = document.createElement("div");
  card.dataset.role = role;
  card.className = `card card--${role === "center" ? "center" : "side"}`;

  const img = document.createElement("img");
  img.className = "card__img";
  img.src = slide.image;
  img.alt = slide.title;
  card.appendChild(img);

  const overlay = document.createElement("div");
  overlay.className = "card__overlay";
  card.appendChild(overlay);

  if (role === "center") {
    const expandBtn = document.createElement("button");
    expandBtn.className = "expand-btn";
    expandBtn.type = "button";
    expandBtn.setAttribute("aria-label", "Expand");
    expandBtn.innerHTML = '<img src="assets/arrow-icon.svg" alt="" />';
    card.appendChild(expandBtn);
  }

  const body = document.createElement("div");
  body.className = "card__body";

  const title = document.createElement("h3");
  title.className = "card__title";
  title.textContent = slide.title;
  body.appendChild(title);

  if (role === "center" && slide.description) {
    const desc = document.createElement("p");
    desc.className = "card__desc";
    desc.textContent = slide.description;
    body.appendChild(desc);
  }

  card.appendChild(body);
  return card;
}

/** Swap an existing card element to a new role in place (used for the two
 * cards that continue on screen but change slot — e.g. center -> prev). */
function setCardRole(card, slide, role) {
  card.dataset.role = role;
  card.classList.remove("card--center", "card--side");
  card.classList.add(role === "center" ? "card--center" : "card--side");

  const existingExpand = card.querySelector(".expand-btn");
  if (role === "center" && !existingExpand) {
    const expandBtn = document.createElement("button");
    expandBtn.className = "expand-btn";
    expandBtn.type = "button";
    expandBtn.setAttribute("aria-label", "Expand");
    expandBtn.innerHTML = '<img src="assets/arrow-icon.svg" alt="" />';
    card.appendChild(expandBtn);
  } else if (role !== "center" && existingExpand) {
    existingExpand.remove();
  }

  const body = card.querySelector(".card__body");
  const desc = body.querySelector(".card__desc");
  if (role === "center" && slide.description && !desc) {
    const p = document.createElement("p");
    p.className = "card__desc";
    p.textContent = slide.description;
    body.appendChild(p);
  } else if (role !== "center" && desc) {
    desc.remove();
  }
}

function layoutStatic() {
  track.innerHTML = "";
  track.style.height = "";
  const prevSlide = slides[mod(activeIndex - 1, slides.length)];
  const centerSlide = slides[activeIndex];
  const nextSlide = slides[mod(activeIndex + 1, slides.length)];

  track.appendChild(buildCard(prevSlide, "prev"));
  track.appendChild(buildCard(centerSlide, "center"));
  track.appendChild(buildCard(nextSlide, "next"));

  renderDots();
}

function renderDots() {
  dotsContainer.innerHTML = "";
  slides.forEach((_, i) => {
    const dot = document.createElement("button");
    dot.className = "dot" + (i === activeIndex ? " is-active" : "");
    dot.type = "button";
    dot.setAttribute("aria-label", `Go to slide ${i + 1}`);
    dot.addEventListener("click", () => {
      const forwardSteps = mod(i - activeIndex, slides.length);
      const direction = forwardSteps <= slides.length / 2 ? 1 : -1;
      goTo(i, direction);
    });
    dotsContainer.appendChild(dot);
  });
}

function rectRelativeTo(el, originRect) {
  const r = el.getBoundingClientRect();
  return {
    left: r.left - originRect.left,
    top: r.top - originRect.top,
    width: r.width,
    height: r.height,
  };
}

function pin(el, rect, opacity) {
  el.classList.add("card--floating");
  el.style.transition = "none";
  el.style.left = `${rect.left}px`;
  el.style.top = `${rect.top}px`;
  el.style.width = `${rect.width}px`;
  el.style.height = `${rect.height}px`;
  el.style.opacity = opacity == null ? "1" : String(opacity);
}

function animateTo(el, rect, opacity) {
  el.style.transition = `left ${TRANSITION_MS}ms ${EASING}, top ${TRANSITION_MS}ms ${EASING}, width ${TRANSITION_MS}ms ${EASING}, height ${TRANSITION_MS}ms ${EASING}, opacity ${TRANSITION_MS}ms ${EASING}`;
  el.style.left = `${rect.left}px`;
  el.style.top = `${rect.top}px`;
  el.style.width = `${rect.width}px`;
  el.style.height = `${rect.height}px`;
  el.style.opacity = opacity == null ? "1" : String(opacity);
}

/**
 * Moves exactly one slide at a time, like a normal carousel: the three
 * on-screen cards individually slide/resize into their new slot, one card
 * slides out past the edge, and one new card slides in from the opposite
 * edge — instead of the whole group jumping as a block.
 */
function goTo(targetIndex, direction) {
  const nextActive = mod(targetIndex, slides.length);
  if (nextActive === activeIndex || isAnimating) return;
  isAnimating = true;

  const trackRect = track.getBoundingClientRect();
  const [prevEl, centerEl, nextEl] = Array.from(track.children);

  // Cards are about to switch to position:absolute, which would otherwise
  // collapse the track (and shift its origin) since it'd have no in-flow
  // children left to size itself from. Pin its box first.
  track.style.height = `${trackRect.height}px`;

  const prevRect = rectRelativeTo(prevEl, trackRect);
  const centerRect = rectRelativeTo(centerEl, trackRect);
  const nextRect = rectRelativeTo(nextEl, trackRect);
  const gap = ((centerRect.left - (prevRect.left + prevRect.width)) + (nextRect.left - (centerRect.left + centerRect.width))) / 2;

  const offscreenLeft = { ...prevRect, left: prevRect.left - (prevRect.width + gap) };
  const offscreenRight = { ...nextRect, left: nextRect.left + (nextRect.width + gap) };

  const enteringSlide = slides[mod(activeIndex + (direction === 1 ? 2 : -2), slides.length)];
  const enteringRole = direction === 1 ? "next" : "prev";
  const enteringEl = buildCard(enteringSlide, enteringRole);

  let exitingEl;

  if (direction === 1) {
    exitingEl = prevEl;
    setCardRole(centerEl, slides[activeIndex], "prev");
    setCardRole(nextEl, slides[mod(activeIndex + 1, slides.length)], "center");

    pin(exitingEl, prevRect);
    pin(centerEl, centerRect);
    pin(nextEl, nextRect);
    pin(enteringEl, offscreenRight, 0);
    track.appendChild(enteringEl);

    void track.offsetWidth; // reflow

    animateTo(exitingEl, offscreenLeft, 0);
    animateTo(centerEl, prevRect);
    animateTo(nextEl, centerRect);
    animateTo(enteringEl, nextRect, 1);
  } else {
    exitingEl = nextEl;
    setCardRole(centerEl, slides[activeIndex], "next");
    setCardRole(prevEl, slides[mod(activeIndex - 1, slides.length)], "center");

    pin(exitingEl, nextRect);
    pin(centerEl, centerRect);
    pin(prevEl, prevRect);
    pin(enteringEl, offscreenLeft, 0);
    track.insertBefore(enteringEl, prevEl);

    void track.offsetWidth; // reflow

    animateTo(exitingEl, offscreenRight, 0);
    animateTo(centerEl, nextRect);
    animateTo(prevEl, centerRect);
    animateTo(enteringEl, prevRect, 1);
  }

  window.setTimeout(() => {
    activeIndex = nextActive;
    layoutStatic();
    isAnimating = false;
  }, TRANSITION_MS);
}

track.addEventListener("click", (e) => {
  const card = e.target.closest(".card--side");
  if (!card || isAnimating) return;
  const role = card.dataset.role;
  goTo(activeIndex + (role === "next" ? 1 : -1), role === "next" ? 1 : -1);
});

prevBtn.addEventListener("click", () => goTo(activeIndex - 1, -1));
nextBtn.addEventListener("click", () => goTo(activeIndex + 1, 1));

layoutStatic();
