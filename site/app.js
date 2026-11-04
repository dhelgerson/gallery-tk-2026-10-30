/* Client gallery front-end. No dependencies, no build step.
 * Flow: fetch gate.json → (unlock) → fetch gallery.json → render. */
"use strict";

const $ = (id) => document.getElementById(id);

const state = {
  data: null,
  flat: [], // flattened photos across collections for lightbox navigation
  current: -1,
  favs: new Set(JSON.parse(localStorage.getItem(favKey()) || "[]")),
};

function favKey() {
  return "gallery:favs:" + location.pathname;
}
const UNLOCK_KEY = "gallery:unlocked";

function relUrl(p) {
  return new URL(p, document.baseURI).href;
}

async function fetchJson(name) {
  const res = await fetch(relUrl(name), { cache: "no-store" });
  if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`);
  return res.json();
}

async function sha256Hex(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function showFault(msg) {
  $("fault-msg").textContent = msg;
  $("fault").hidden = false;
  $("gate").hidden = true;
  $("site").hidden = true;
}

/* ---------------- gate ---------------- */

async function boot() {
  let gate;
  try {
    gate = await fetchJson("gate.json");
  } catch {
    return showFault("This gallery is still being set up. Please check back soon.");
  }

  $("gate-studio").textContent = gate.studio || "";
  $("gate-client").textContent = gate.client ? `For ${gate.client}` : "";
  $("gate-hint").textContent = gate.hint || "";

  if (!gate.enabled) return open();
  if (!gate.codeHash) return showFault("This gallery is still being set up. Please check back soon.");

  if (localStorage.getItem(UNLOCK_KEY) === gate.codeHash) return open();

  $("gate").hidden = false;
  $("gate-form").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const typed = $("gate-input").value.trim();
    if (!typed) return;
    const hash = await sha256Hex(typed);
    if (hash === gate.codeHash) {
      localStorage.setItem(UNLOCK_KEY, gate.codeHash);
      $("gate").hidden = true;
      open();
    } else {
      $("gate-error").hidden = false;
      $("gate-form").classList.remove("shake");
      void $("gate-form").offsetWidth; // restart animation
      $("gate-form").classList.add("shake");
      $("gate-input").select();
    }
  });
}

async function open() {
  try {
    state.data = await fetchJson("gallery.json");
  } catch {
    return showFault("Could not load the gallery. Please reload.");
  }
  render();
  $("site").hidden = false;
}

/* ---------------- rendering ---------------- */

function render() {
  const { studio, client, collections } = state.data;
  $("studio-name").textContent = studio.name;
  $("studio-name-footer").textContent = studio.name;
  if (studio.url) {
    const a = document.createElement("a");
    a.href = studio.url;
    a.textContent = "· website";
    $("studio-link-wrap").appendChild(a);
  }
  $("client-name").textContent = client.name;
  $("event-meta").textContent = [client.event, client.date, client.location].filter(Boolean).join(" · ");

  const main = $("collections");
  main.textContent = "";
  state.flat = [];

  for (const coll of collections) {
    const section = document.createElement("section");
    section.className = "collection";

    const head = document.createElement("div");
    head.className = "collection-head";
    const h2 = document.createElement("h2");
    h2.textContent = coll.title;
    head.appendChild(h2);
    if (coll.date) {
      const d = document.createElement("span");
      d.className = "coll-date";
      d.textContent = coll.date;
      head.appendChild(d);
    }
    head.appendChild(Object.assign(document.createElement("span"), { className: "spacer" }));
    if (coll.zipUrl) {
      const a = document.createElement("a");
      a.className = "btn btn-ghost btn-sm";
      a.href = coll.zipUrl;
      a.download = "";
      a.textContent = "⤓ Download all full-res";
      head.appendChild(a);
    }
    section.appendChild(head);

    if (coll.description) {
      const p = document.createElement("p");
      p.className = "collection-desc";
      p.textContent = coll.description;
      section.appendChild(p);
    }

    const grid = document.createElement("div");
    grid.className = "grid";
    coll.photos.forEach((photo, i) => {
      const idx = state.flat.length;
      state.flat.push({ coll, photo });

      const fig = document.createElement("figure");
      fig.dataset.key = `${coll.id}/${photo.file}`;
      fig.dataset.flat = String(idx);
      if (state.favs.has(fig.dataset.key)) fig.classList.add("is-fav");

      const img = document.createElement("img");
      img.src = photo.url;
      img.alt = `${coll.title} — photo ${i + 1}`;
      img.loading = "lazy";
      img.decoding = "async";
      fig.appendChild(img);
      fig.insertAdjacentHTML("beforeend", '<span class="fav-mark">&hearts;</span>');
      fig.addEventListener("click", () => openLightbox(idx));
      grid.appendChild(fig);
    });
    section.appendChild(grid);
    main.appendChild(section);
  }

  updateFavBar();
  wireLightbox();
  wireFavBar();
  $("lock-btn").addEventListener("click", () => {
    localStorage.removeItem(UNLOCK_KEY);
    location.reload();
  });
}

/* ---------------- lightbox ---------------- */

function openLightbox(idx) {
  state.current = idx;
  $("lightbox").hidden = false;
  document.body.style.overflow = "hidden";
  paintLightbox();
}

function closeLightbox() {
  $("lightbox").hidden = true;
  document.body.style.overflow = "";
}

function paintLightbox() {
  const { coll, photo } = state.flat[state.current];
  $("lb-img").src = photo.url;
  $("lb-img").alt = `${coll.title} — photo ${state.current + 1}`;
  $("lb-title").textContent = coll.title;
  $("lb-count").textContent = `${state.current + 1} / ${state.flat.length}`;

  const dl = $("lb-dl");
  if (photo.download) {
    dl.href = photo.download;
    dl.download = "";
    dl.hidden = false;
  } else {
    dl.hidden = true;
  }
  paintFavButton();
}

function paintFavButton() {
  const { coll, photo } = state.flat[state.current];
  const on = state.favs.has(`${coll.id}/${photo.file}`);
  $("lb-fav").innerHTML = on ? "&#9829; Saved" : "&#9825; Save";
}

function step(delta) {
  state.current = (state.current + delta + state.flat.length) % state.flat.length;
  paintLightbox();
}

function toggleFav() {
  const { coll, photo } = state.flat[state.current];
  const key = `${coll.id}/${photo.file}`;
  if (state.favs.has(key)) state.favs.delete(key);
  else state.favs.add(key);
  localStorage.setItem(favKey(), JSON.stringify([...state.favs]));

  const fig = document.querySelector(`figure[data-key="${CSS.escape(key)}"]`);
  if (fig) fig.classList.toggle("is-fav", state.favs.has(key));
  paintFavButton();
  updateFavBar();
}

function wireLightbox() {
  $("lb-close").addEventListener("click", closeLightbox);
  $("lb-prev").addEventListener("click", () => step(-1));
  $("lb-next").addEventListener("click", () => step(1));
  $("lb-fav").addEventListener("click", toggleFav);
  $("lightbox").addEventListener("click", (ev) => {
    if (ev.target === $("lightbox")) closeLightbox();
  });
  document.addEventListener("keydown", (ev) => {
    if ($("lightbox").hidden) return;
    if (ev.key === "Escape") closeLightbox();
    else if (ev.key === "ArrowLeft") step(-1);
    else if (ev.key === "ArrowRight") step(1);
    else if (ev.key.toLowerCase() === "f") toggleFav();
  });
  // basic swipe
  let x0 = null;
  $("lightbox").addEventListener("pointerdown", (ev) => { x0 = ev.clientX; });
  $("lightbox").addEventListener("pointerup", (ev) => {
    if (x0 === null) return;
    const dx = ev.clientX - x0;
    if (Math.abs(dx) > 50) step(dx < 0 ? 1 : -1);
    x0 = null;
  });
}

/* ---------------- favorites bar ---------------- */

function updateFavBar() {
  const bar = $("favbar");
  const n = state.favs.size;
  if (n === 0 || bar.dataset.dismissed === "1") {
    bar.hidden = true;
    return;
  }
  bar.hidden = false;
  $("fav-count").innerHTML = `<span class="heart">&hearts;</span> ${n} photo${n === 1 ? "" : "s"} saved`;
}

function wireFavBar() {
  $("fav-hide").addEventListener("click", () => {
    $("favbar").dataset.dismissed = "1";
    $("favbar").hidden = true;
  });
  $("fav-clear").addEventListener("click", () => {
    state.favs.clear();
    localStorage.setItem(favKey(), "[]");
    document.querySelectorAll("figure.is-fav").forEach((f) => f.classList.remove("is-fav"));
    if (!$("lightbox").hidden) paintFavButton();
    updateFavBar();
  });
  $("fav-send").addEventListener("click", sendFavs);
}

function sendFavs() {
  const { studio, client } = state.data;
  const lines = [];
  const byColl = new Map();
  for (const { coll, photo } of state.flat) {
    if (state.favs.has(`${coll.id}/${photo.file}`)) {
      if (!byColl.has(coll.title)) byColl.set(coll.title, []);
      byColl.get(coll.title).push(photo.file);
    }
  }
  for (const [title, files] of byColl) {
    lines.push(`${title}: ${files.join(", ")}`);
  }
  const body =
    `Hi ${studio.name.split(" ")[0]},\n\nHere are my favorite photos from the ${client.name} gallery:\n\n` +
    lines.join("\n") +
    "\n\nThanks!";
  location.href = `mailto:${studio.email}?subject=${encodeURIComponent(
    `My favorite photos — ${client.name}`
  )}&body=${encodeURIComponent(body)}`;
}

boot();
