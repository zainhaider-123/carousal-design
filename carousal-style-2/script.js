// Testimonial content lives in the markup (#testimonialsData) rather than
// here, so editing the quotes/names doesn't require touching JS.
const dataEls = Array.from(document.querySelectorAll("#testimonialsData > li"));
const testimonials = dataEls.map((li) => ({
  quote: li.querySelector("p")?.textContent.trim() || "",
  name: li.querySelector("span")?.textContent.trim() || "",
}));

const cardsLayer = document.getElementById("cards");
const heartsLayer = document.getElementById("hearts");
const curvePath = document.querySelector("#curvePath") || document.querySelector(".stage__curve path");
const prevBtn = document.querySelector(".nav-btn--prev");
const nextBtn = document.querySelector(".nav-btn--next");

// Exact Figma "Vector 355" viewBox (node 89:1029), and exactly how that
// vector is placed on the stage (see .stage__curve in styles.css) — percent
// of the stage's own box, matching the Figma frame down to the px.
const VIEWBOX = { w: 2559.9, h: 614.371 };
const WAVE = { leftPct: -13.9583, topPct: 17.0177, widthPct: 133.2924, heightPct: 71.2288 };
const totalLength = curvePath.getTotalLength();

// The five stops a card can occupy, expressed as fractions of the curve's
// arc length: [offscreen-left, left-peek, center, right-peek, offscreen-right].
// The peek/center t-values were solved numerically (not eyeballed) to be the
// points on the real curve closest to the real Figma ellipse centers for the
// left peek, center, and right peek testimonial circles (nodes 89:1033,
// 89:1031, 89:1035) — see scratch solver used while building this.
const STOPS_T = [0, 0.1655, 0.5049, 0.8611, 1];
// Matching visual scale/opacity at each of those five stops.
const STOPS_SCALE = [0.15, 0.6, 1, 0.6, 0.15];
const STOPS_OPACITY = [0, 1, 1, 1, 0];

function mod(n, m) {
  return ((n % m) + m) % m;
}

// Piecewise-linear interpolation of a value across the 5 stops, keyed by a
// continuous "pos" in [-2, 2] (0 = center, ±1 = peek, ±2 = offscreen).
function interpStops(stops, pos) {
  const idx = pos + 2;
  const lower = Math.max(0, Math.min(stops.length - 2, Math.floor(idx)));
  const upper = lower + 1;
  const frac = Math.min(1, Math.max(0, idx - lower));
  return stops[lower] + (stops[upper] - stops[lower]) * frac;
}

function pointAtPos(pos) {
  const t = interpStops(STOPS_T, pos);
  const p = curvePath.getPointAtLength(t * totalLength);
  // .stage__curve applies transform: scaleY(-1) to match Figma's own flip
  // on this layer, so mirror the y coordinate the same way before mapping
  // it into the wave wrapper's percent-of-stage box.
  const flippedY = VIEWBOX.h - p.y;
  return {
    left: WAVE.leftPct + (p.x / VIEWBOX.w) * WAVE.widthPct,
    top: WAVE.topPct + (flippedY / VIEWBOX.h) * WAVE.heightPct,
  };
}

function easeInOutCubic(x) {
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

// ---------- Cards ----------

let activeIndex = 0;
let isAnimating = false;
const DURATION = 650;

// card = { el, dataIndex, pos }
let cards = [];

function buildCardEl(dataIndex) {
  const t = testimonials[mod(dataIndex, testimonials.length)];
  const el = document.createElement("div");
  el.className = "t-card";
  el.style.setProperty("--card-bg-image", "url(assets/card-bg.png)");

  const inner = document.createElement("div");
  inner.className = "t-card__inner";

  const stars = document.createElement("img");
  stars.className = "t-card__stars";
  stars.src = "assets/stars-large.svg";
  stars.alt = "5 star rating";
  inner.appendChild(stars);

  const quote = document.createElement("p");
  quote.className = "t-card__quote";
  quote.textContent = t.quote;
  inner.appendChild(quote);

  const name = document.createElement("p");
  name.className = "t-card__name";
  name.textContent = `- ${t.name}`;
  inner.appendChild(name);

  el.appendChild(inner);

  el.addEventListener("click", () => {
    const card = cards.find((c) => c.el === el);
    if (!card || isAnimating) return;
    if (Math.round(card.pos) === 1) goTo(1);
    else if (Math.round(card.pos) === -1) goTo(-1);
  });

  return el;
}

function renderCard(card) {
  const { left, top } = pointAtPos(card.pos);
  const scale = interpStops(STOPS_SCALE, card.pos);
  const opacity = interpStops(STOPS_OPACITY, card.pos);
  const rounded = Math.round(card.pos);

  card.el.style.left = `${left}%`;
  card.el.style.top = `${top}%`;
  card.el.style.setProperty("--scale", scale.toFixed(3));
  card.el.style.opacity = opacity.toFixed(3);
  card.el.style.zIndex = String(100 - Math.round(Math.abs(card.pos) * 10));
  card.el.classList.toggle("t-card--peek", rounded === -1 || rounded === 1);
  card.el.classList.toggle("t-card--center", rounded === 0);
  card.el.style.pointerEvents = Math.abs(card.pos) <= 1.1 ? "auto" : "none";
}

// Exact centers of the heart layers (nodes 89:1048, 89:1045), percent of the
// stage box — computed the same way as WAVE above, not eyeballed.
const HEART_SPOTS = [
  { left: 20.006, top: 87.658 },
  { left: 77.216, top: 19.879 },
];

function renderHearts() {
  heartsLayer.innerHTML = "";
  HEART_SPOTS.forEach((spot) => {
    const heart = document.createElement("img");
    heart.className = "stage__heart";
    heart.src = "assets/icon-heart.svg";
    heart.alt = "";
    heart.setAttribute("aria-hidden", "true");
    heart.style.left = `${spot.left}%`;
    heart.style.top = `${spot.top}%`;
    heartsLayer.appendChild(heart);
  });
}

function layoutStatic() {
  cardsLayer.innerHTML = "";
  cards = [-2, -1, 0, 1, 2].map((pos) => {
    const dataIndex = activeIndex + pos;
    const el = buildCardEl(dataIndex);
    cardsLayer.appendChild(el);
    return { el, dataIndex, pos };
  });
  cards.forEach(renderCard);
  renderHearts();
}

/**
 * Slides every card one stop further along the curve (direction = 1 for
 * "next", -1 for "prev"), recycling whichever card falls off the far end
 * into a freshly-built card entering from the opposite end.
 */
function goTo(direction) {
  if (isAnimating) return;
  isAnimating = true;

  const exitPos = direction === 1 ? -2 : 2;
  const enterPos = direction === 1 ? 2 : -2;
  const exitingIndex = cards.findIndex((c) => c.pos === exitPos);
  if (exitingIndex !== -1) {
    cards[exitingIndex].el.remove();
    cards.splice(exitingIndex, 1);
  }

  // The surviving cards each slide one stop toward the new center.
  const starts = new Map(cards.map((c) => [c, c.pos]));
  const targets = new Map(cards.map((c) => [c, c.pos - direction]));

  // The freshly-built card fills the vacated far slot directly — it has
  // nothing to slide from yet, it just waits there (invisible) until the
  // *next* transition brings it into view.
  const enteringDataIndex = activeIndex + 2 * direction + (direction === 1 ? 1 : -1);
  const enteringEl = buildCardEl(enteringDataIndex);
  cardsLayer.appendChild(enteringEl);
  const enteringCard = { el: enteringEl, dataIndex: enteringDataIndex, pos: enterPos };
  renderCard(enteringCard);
  cards.push(enteringCard);
  starts.set(enteringCard, enterPos);
  targets.set(enteringCard, enterPos);

  const startTime = performance.now();

  function frame(now) {
    const raw = Math.min(1, (now - startTime) / DURATION);
    const eased = easeInOutCubic(raw);

    cards.forEach((c) => {
      c.pos = starts.get(c) + (targets.get(c) - starts.get(c)) * eased;
      renderCard(c);
    });

    if (raw < 1) {
      requestAnimationFrame(frame);
    } else {
      activeIndex = mod(activeIndex + direction, testimonials.length);
      isAnimating = false;
    }
  }

  requestAnimationFrame(frame);
}

prevBtn.addEventListener("click", () => goTo(-1));
nextBtn.addEventListener("click", () => goTo(1));

document.addEventListener("keydown", (e) => {
  if (e.key === "ArrowLeft") goTo(-1);
  if (e.key === "ArrowRight") goTo(1);
});

layoutStatic();
window.addEventListener("resize", renderHearts);
