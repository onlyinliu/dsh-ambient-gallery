/**
 * dsh-ambient-gallery — Host half.
 *
 * A deliberately small storage service for the browser half: the gallery is a
 * *client* decoration (it lives in `shell.overlay`), but pictures and videos
 * cannot live in `localStorage` — a handful of phone photos blow past the ~5 MB
 * quota, and a base64 video is both slow and duplicated in memory. So the Host
 * owns a media directory and a single JSON state file, and the client talks to
 * it over same-origin HTTP.
 *
 * Routes (all under `/plugins/dsh-ambient-gallery`):
 *   GET  /state           → `{ config, tiles }` — the whole persisted profile
 *   POST /state           → merge + persist, answers with the saved profile
 *   POST /import          → raw body becomes one media file, answers with its row
 *   GET  /media/<file>    → serves the stored file, with Range support so the
 *                           video cell can seek/buffer like any player
 *
 * Design notes
 * - Files are content-addressed by a random id, never by the client's filename:
 *   a name is display metadata, not a path component. Only the sanitised
 *   basename is stored inside the row, and only the id reaches the filesystem.
 * - Every mutating route is loopback-guarded (Host + Origin), matching the rest
 *   of the plugin surface: this service must never be reachable from a page on
 *   another origin.
 * - Nothing here depends on a DSH service beyond `webServer`, so the plugin
 *   keeps working on any profile that mounts the web listener.
 */

import { createReadStream, promises as fs } from "node:fs";
import { homedir } from "node:os";
import { extname, join } from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";

/** Route prefix owned by this plugin. */
const BASE = "/plugins/dsh-ambient-gallery";

/** Bound on the JSON profile body (a few hundred frame rows at most). */
const STATE_LIMIT = 512 * 1024;

/** Bound on one imported file: generous for a phone video, still finite. */
const MEDIA_LIMIT = 256 * 1024 * 1024;

/** Media files never execute; the EOL below is the only reason for this list. */
const IMAGE_EXT = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif", ".avif", ".bmp"]);
const VIDEO_EXT = new Set([".mp4", ".webm", ".ogv", ".m4v", ".mov", ".mkv"]);

const MIME = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".avif": "image/avif",
  ".bmp": "image/bmp",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".ogv": "video/ogg",
  ".m4v": "video/mp4",
  ".mov": "video/quicktime",
  ".mkv": "video/x-matroska",
};

/** Root of everything this plugin writes. */
const ROOT = join(homedir(), ".dsh", "ambient-gallery");
const MEDIA_DIR = join(ROOT, "media");
const STATE_PATH = join(ROOT, "state.json");

/** Shipped profile: what the gallery looks like before the user touches it. */
const DEFAULT_CONFIG = {
  mode: "gallery",
  shape: "rect",
  count: 20,
  gap: 18,
  radius: 8,
  opacity: 0.24,
  blend: "soft-light",
  blur: 0,
  intervalMs: 9000,
  visible: true,
  videoKey: "Shift+V",
  bandLeft: 20,
  bandRight: 80,
};

const BLENDS = new Set(["soft-light", "luminosity", "screen", "overlay", "normal"]);
/** The four looks the client can draw. Anything else falls back to photos. */
const MODES = new Set(["gallery", "karaoke", "cockpit", "orbit"]);
/** How a photo's rectangle is cut out. */
const SHAPES = new Set(["rect", "square", "circle", "triangle", "diamond", "hexagon"]);

/* ------------------------------------------------------------------ */
/* HTTP helpers                                                        */
/* ------------------------------------------------------------------ */

function json(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(payload),
    "Cache-Control": "no-store",
  });
  res.end(payload);
}

function isLoopbackHostname(hostname) {
  const name = String(hostname).toLowerCase().replace(/^\[|\]$/gu, "");
  return name === "127.0.0.1" || name === "localhost" || name === "::1";
}

/** Reject requests whose Host header does not name this loopback listener. */
function hostTrusted(req) {
  const host = req.headers.host;
  if (typeof host !== "string" || host.length === 0) return true;
  return isLoopbackHostname(host.replace(/:\d+$/u, ""));
}

/** Reject cross-site browser origins; same-origin GETs carry no Origin header. */
function originTrusted(req) {
  const origin = req.headers.origin;
  if (typeof origin !== "string" || origin.length === 0) return true;
  try {
    return isLoopbackHostname(new URL(origin).hostname);
  } catch {
    return false;
  }
}

function guard(req, res) {
  if (!hostTrusted(req)) {
    json(res, 403, { error: "host-not-trusted" });
    return false;
  }
  if (!originTrusted(req)) {
    json(res, 403, { error: "origin-not-trusted" });
    return false;
  }
  return true;
}

function safeMessage(error) {
  return (error instanceof Error ? error.message : String(error)).slice(0, 400);
}

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error("request body too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

/* ------------------------------------------------------------------ */
/* Profile: validation is one-way (unknown shape → shipped default)    */
/* ------------------------------------------------------------------ */

function clampInt(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, Math.round(number)));
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

/**
 * The shortcut is compared against real keyboard events, so a value that is
 * merely "a string" is a value that silently never fires. It is validated
 * here to the same grammar the client writes: modifiers plus one key, and at
 * least one modifier — a bare letter would swallow ordinary typing.
 */
const SHORTCUT_MODIFIERS = ["Ctrl", "Alt", "Shift", "Meta"];
const SHORTCUT_NAMED = ["Space", "Enter", "Tab", "Backspace", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Escape"];

function sanitizeVideoKey(value) {
  const parts = String(value ?? "")
    .split("+")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  if (parts.length < 2) return DEFAULT_CONFIG.videoKey;
  const key = parts[parts.length - 1];
  const mods = parts.slice(0, -1);
  const named = SHORTCUT_NAMED.find((name) => name.toLowerCase() === key.toLowerCase());
  const letter = /^[a-z0-9]$/iu.test(key) ? key.toUpperCase() : "";
  if (named === undefined && letter === "") return DEFAULT_CONFIG.videoKey;
  const kept = SHORTCUT_MODIFIERS.filter((modifier) => mods.some((mod) => mod.toLowerCase() === modifier.toLowerCase()));
  if (kept.length === 0) return DEFAULT_CONFIG.videoKey;
  return [...kept, named ?? letter].join("+");
}

function sanitizeConfig(raw) {
  const source = raw !== null && typeof raw === "object" ? raw : {};
  // The horizontal band is stored as a pair so it can never invert: the
  // client clamps edges independently while the user drags a slider.
  const bandLeft = clampInt(source.bandLeft, 0, 60, DEFAULT_CONFIG.bandLeft);
  const bandRight = clampInt(source.bandRight, 40, 100, DEFAULT_CONFIG.bandRight);
  return {
    mode: MODES.has(source.mode) ? source.mode : DEFAULT_CONFIG.mode,
    shape: SHAPES.has(source.shape) ? source.shape : DEFAULT_CONFIG.shape,
    count: clampInt(source.count, 3, 24, DEFAULT_CONFIG.count),
    gap: clampInt(source.gap, 0, 64, DEFAULT_CONFIG.gap),
    radius: clampInt(source.radius, 0, 48, DEFAULT_CONFIG.radius),
    opacity: clampNumber(source.opacity, 0, 1, DEFAULT_CONFIG.opacity),
    blend: BLENDS.has(source.blend) ? source.blend : DEFAULT_CONFIG.blend,
    blur: clampInt(source.blur, 0, 24, DEFAULT_CONFIG.blur),
    intervalMs: clampInt(source.intervalMs, 1500, 120000, DEFAULT_CONFIG.intervalMs),
    visible: source.visible === false ? false : true,
    videoKey: sanitizeVideoKey(source.videoKey ?? DEFAULT_CONFIG.videoKey),
    bandLeft: Math.min(bandLeft, bandRight - 10),
    bandRight: Math.max(bandRight, bandLeft + 10),
  };
}

/** One persisted frame row. `id` doubles as the media filename stem. */
function sanitizeFrame(raw) {
  if (raw === null || typeof raw !== "object") return null;
  const id = typeof raw.id === "string" ? raw.id.replace(/[^A-Za-z0-9_-]/gu, "") : "";
  const kind = raw.kind === "video" ? "video" : raw.kind === "image" ? "image" : "";
  const name = typeof raw.name === "string" ? raw.name.slice(0, 120) : "";
  const ext = typeof raw.ext === "string" && /^\.[a-z0-9]{1,5}$/u.test(raw.ext) ? raw.ext : "";
  if (id.length === 0 || kind === "" || ext.length === 0) return null;
  return { id, kind, name, ext, url: `${BASE}/media/${id}${ext}` };
}

function sanitizeTiles(raw) {
  const out = {};
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return out;
  for (const [key, value] of Object.entries(raw)) {
    if (!/^\d{1,2}$/u.test(key)) continue;
    const list = Array.isArray(value?.frames) ? value.frames : [];
    // The per-cell cap is the product decision (twenty rotating pictures) and
    // is enforced here as well as in the client, because the state file is
    // hand-editable and a hostile profile should not grow without bound.
    // Newest wins: a cell is a rolling window, so the frames the user just
    // picked are the ones that survive and the oldest rotate out.
    const seen = new Set();
    const frames = [];
    for (const frame of list.map(sanitizeFrame)) {
      if (frame === null || seen.has(frame.id)) continue;
      seen.add(frame.id);
      frames.push(frame);
    }
    const capped = frames.slice(-20);
    if (capped.length > 0) out[key] = { frames: capped };
  }
  return out;
}

function emptyProfile() {
  return { version: 1, config: { ...DEFAULT_CONFIG }, tiles: {} };
}

async function readProfile() {
  await ensureSeeded();
  try {
    const text = await fs.readFile(STATE_PATH, "utf8");
    const parsed = JSON.parse(text);
    return {
      version: 1,
      config: sanitizeConfig(parsed?.config),
      tiles: sanitizeTiles(parsed?.tiles),
    };
  } catch {
    // Missing or unreadable state is the pristine gallery, not an error: the
    // client renders its generated art in that case, which is the shipped look.
    return emptyProfile();
  }
}

let writeQueue = Promise.resolve();

/** Serialise writes so two rapid clicks cannot interleave the temp+rename. */
function writeProfile(profile) {
  const run = async () => {
    await fs.mkdir(MEDIA_DIR, { recursive: true });
    const temp = `${STATE_PATH}.${randomUUID()}.tmp`;
    await fs.writeFile(temp, JSON.stringify(profile, null, 2), "utf8");
    await fs.rename(temp, STATE_PATH);
  };
  const next = writeQueue.then(run, run);
  writeQueue = next.catch(() => {});
  return next;
}

/* ------------------------------------------------------------------ */
/* Shipped photographs                                                 */
/* ------------------------------------------------------------------ */

/**
 * The plugin carries a few photographs with it.
 *
 * They are ordinary files inside the package, not links to the web: the
 * gallery has to look finished on a machine with no internet, and a remote
 * picture that fails to load is worse than none — it is a hole in the wall.
 * On the very first run they are copied into the media directory and turned
 * into frames, exactly as if the user had picked them, so everything
 * downstream (rotation, per-cell cap, delete) treats them identically.
 */
const PHOTOS_DIR = fileURLToPath(new URL("../assets/photos/", import.meta.url));

/**
 * One photo per tile would leave the wall perfectly still on a fresh install,
 * and the rotation is half of what this plugin is. Every tile therefore gets a
 * handful of shipped photographs, offset so no two neighbours open on the same
 * picture — the wall reads as a wall, and it moves.
 */
const SHIPPED_CELLS = 20;
const SHIPPED_PER_CELL = 3;
const SHIPPED_OFFSETS = [0, 7, 14];

async function shippedPhotos() {
  let names;
  try {
    names = (await fs.readdir(PHOTOS_DIR)).filter((name) => /\.(jpe?g|png|webp)$/iu.test(name)).sort();
  } catch {
    return [];
  }
  return names;
}

let seedPromise = null;

/**
 * Seed once, and only once, and only when the profile file does not exist.
 *
 * The existence of `state.json` — not the emptiness of `tiles` — is the
 * signal: a user who clears the wall means it, and re-seeding on the next
 * boot would argue with them forever.
 */
function ensureSeeded() {
  if (seedPromise === null) {
    seedPromise = seedShipped().catch(() => {});
  }
  return seedPromise;
}

async function seedShipped() {
  try {
    await fs.access(STATE_PATH);
    return;
  } catch {
    /* no profile yet — this is the first boot */
  }
  const names = await shippedPhotos();
  if (names.length === 0) return;
  await fs.mkdir(MEDIA_DIR, { recursive: true });
  const tiles = {};
  for (let index = 0; index < SHIPPED_CELLS; index += 1) {
    const frames = [];
    for (const offset of SHIPPED_OFFSETS) {
      const name = names[(index + offset) % names.length];
      const ext = extname(name).toLowerCase();
      const kind = kindFor(ext);
      if (kind === "") continue;
      const id = `shipped-${index}-${randomUUID().replace(/-/gu, "")}`;
      try {
        await fs.copyFile(join(PHOTOS_DIR, name), join(MEDIA_DIR, `${id}${ext}`));
      } catch {
        continue;
      }
      frames.push({ id, kind, name, ext, url: `${BASE}/media/${id}${ext}` });
    }
    if (frames.length > 0) tiles[String(index)] = { frames };
  }
  if (Object.keys(tiles).length === 0) return;
  const profile = { version: 1, config: { ...DEFAULT_CONFIG }, tiles };
  await writeProfile(profile);
}

/* ------------------------------------------------------------------ */
/* Media                                                               */
/* ------------------------------------------------------------------ */

function extensionFor(name, contentType) {
  const fromName = extname(String(name ?? "")).toLowerCase();
  if (IMAGE_EXT.has(fromName) || VIDEO_EXT.has(fromName)) return fromName;
  const mime = String(contentType ?? "").split(";")[0].trim().toLowerCase();
  if (mime === "image/png") return ".png";
  if (mime === "image/jpeg") return ".jpg";
  if (mime === "image/webp") return ".webp";
  if (mime === "image/gif") return ".gif";
  if (mime === "image/avif") return ".avif";
  if (mime === "video/mp4") return ".mp4";
  if (mime === "video/webm") return ".webm";
  if (mime === "video/quicktime") return ".mov";
  return "";
}

function kindFor(ext) {
  if (VIDEO_EXT.has(ext)) return "video";
  if (IMAGE_EXT.has(ext)) return "image";
  return "";
}

async function serveMedia(req, res, pathname) {
  const file = pathname.slice(`${BASE}/media/`.length);
  // The id grammar is the only thing that can become a filename, so a path
  // traversal attempt dies here rather than in `join`.
  if (!/^[A-Za-z0-9_-]+\.[a-z0-9]{1,5}$/u.test(file)) {
    json(res, 404, { error: "not found" });
    return;
  }
  const ext = extname(file);
  const mime = MIME[ext] ?? "application/octet-stream";
  const target = join(MEDIA_DIR, file);
  let stat;
  try {
    stat = await fs.stat(target);
  } catch {
    json(res, 404, { error: "not found" });
    return;
  }
  const size = stat.size;
  const range = req.headers.range;
  const headers = {
    "Content-Type": mime,
    "Accept-Ranges": "bytes",
    // Imported files are immutable (new import → new id), so a long cache is
    // honest and keeps the rotation from re-downloading the same photos.
    "Cache-Control": "private, max-age=31536000, immutable",
  };
  if (typeof range === "string") {
    const match = /^bytes=(\d*)-(\d*)$/u.exec(range.trim());
    if (match === null) {
      res.writeHead(416, { ...headers, "Content-Range": `bytes */${size}` });
      res.end();
      return;
    }
    const startText = match[1];
    const endText = match[2];
    let start = startText.length === 0 ? size - Number(endText) : Number(startText);
    let end = startText.length === 0 || endText.length === 0 ? size - 1 : Number(endText);
    if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || start >= size) {
      res.writeHead(416, { ...headers, "Content-Range": `bytes */${size}` });
      res.end();
      return;
    }
    end = Math.min(end, size - 1);
    res.writeHead(206, {
      ...headers,
      "Content-Range": `bytes ${start}-${end}/${size}`,
      "Content-Length": end - start + 1,
    });
    if (req.method === "HEAD") {
      res.end();
      return;
    }
    createReadStream(target, { start, end }).pipe(res);
    return;
  }
  res.writeHead(200, { ...headers, "Content-Length": size });
  if (req.method === "HEAD") {
    res.end();
    return;
  }
  createReadStream(target).pipe(res);
}

/* ------------------------------------------------------------------ */
/* Routes                                                              */
/* ------------------------------------------------------------------ */

async function handleState(req, res) {
  if (!guard(req, res)) return;
  if (req.method === "GET" || req.method === "HEAD") {
    json(res, 200, await readProfile());
    return;
  }
  if (req.method !== "POST") {
    json(res, 405, { error: "method not allowed" });
    return;
  }
  let body;
  try {
    body = JSON.parse((await readBody(req, STATE_LIMIT)).toString("utf8"));
  } catch (error) {
    json(res, 400, { error: safeMessage(error) });
    return;
  }
  // Merge rather than replace: an omitted key means "leave it alone", so a
  // client that only knows about the config cannot silently wipe the tiles.
  const current = await readProfile();
  const next = {
    version: 1,
    config: sanitizeConfig(body?.config === undefined ? current.config : { ...current.config, ...body.config }),
    tiles: sanitizeTiles(body?.tiles === undefined ? current.tiles : body.tiles),
  };
  await writeProfile(next);
  json(res, 200, next);
}

async function handleImport(req, res) {
  if (!guard(req, res)) return;
  if (req.method !== "POST") {
    json(res, 405, { error: "method not allowed" });
    return;
  }
  const name = typeof req.headers["x-file-name"] === "string" ? decodeURIComponent(req.headers["x-file-name"]) : "";
  const ext = extensionFor(name, req.headers["content-type"]);
  const kind = kindFor(ext);
  if (kind === "") {
    json(res, 415, { error: "unsupported-file-type" });
    return;
  }
  let buffer;
  try {
    buffer = await readBody(req, MEDIA_LIMIT);
  } catch (error) {
    json(res, 413, { error: safeMessage(error) });
    return;
  }
  if (buffer.length === 0) {
    json(res, 400, { error: "empty-file" });
    return;
  }
  await fs.mkdir(MEDIA_DIR, { recursive: true });
  const id = randomUUID().replace(/-/gu, "");
  const saved = `${id}${ext}`;
  await fs.writeFile(join(MEDIA_DIR, saved), buffer);
  json(res, 200, {
    frame: {
      id,
      kind,
      name: name.split(/[\\/]/u).pop().slice(0, 120) || `${kind}${ext}`,
      ext,
      url: `${BASE}/media/${saved}`,
      bytes: buffer.length,
    },
  });
}

async function handleDelete(req, res, query) {
  if (!guard(req, res)) return;
  if (req.method !== "POST" && req.method !== "DELETE") {
    json(res, 405, { error: "method not allowed" });
    return;
  }
  const id = query.get("id") ?? "";
  if (!/^[A-Za-z0-9_-]+$/u.test(id)) {
    json(res, 400, { error: "bad id" });
    return;
  }
  const current = await readProfile();
  let removed = 0;
  for (const tile of Object.values(current.tiles)) {
    tile.frames = tile.frames.filter((frame) => {
      if (frame.id !== id) return true;
      removed += 1;
      return false;
    });
  }
  await writeProfile(current);
  if (removed > 0) {
    // Best effort: the profile row is the truth, the file is a cache of it.
    try {
      await fs.rm(join(MEDIA_DIR, `${id}${extensionOf(id, current)}`), { force: true });
    } catch {
      /* a stale file costs disk, not correctness */
    }
  }
  json(res, 200, { removed, profile: current });
}

/** After a row was dropped, find its extension from the directory listing. */
function extensionOf(id, profile) {
  for (const tile of Object.values(profile.tiles ?? {})) {
    for (const frame of tile.frames ?? []) if (frame.id === id && frame.ext) return frame.ext;
  }
  return "";
}

/* ------------------------------------------------------------------ */
/* Plugin entry                                                        */
/* ------------------------------------------------------------------ */

export const inject = ["webServer"];

export function apply(ctx) {
  ctx.effect(() => {
    const disposers = [];
    const add = (route, handler) => {
      try {
        disposers.push(ctx.webServer.register({ kind: route === "prefix" ? "prefix" : "exact", path: handler.path, handler: handler.run }));
      } catch (error) {
        ctx.logger?.warn?.(`dsh-ambient-gallery: failed to register ${handler.path}: ${safeMessage(error)}`);
      }
    };

    add("exact", {
      path: `${BASE}/state`,
      run: (req, res) => {
        handleState(req, res).catch((error) => {
          try {
            json(res, 500, { error: safeMessage(error) });
          } catch {}
        });
      },
    });

    add("exact", {
      path: `${BASE}/import`,
      run: (req, res) => {
        handleImport(req, res).catch((error) => {
          try {
            json(res, 500, { error: safeMessage(error) });
          } catch {}
        });
      },
    });

    add("exact", {
      path: `${BASE}/remove`,
      run: (req, res) => {
        const query = new URL(req.url ?? "/", "http://127.0.0.1").searchParams;
        handleDelete(req, res, query).catch((error) => {
          try {
            json(res, 500, { error: safeMessage(error) });
          } catch {}
        });
      },
    });

    add("prefix", {
      path: `${BASE}/media`,
      run: (req, res) => {
        if (!guard(req, res)) return;
        if (req.method !== "GET" && req.method !== "HEAD") {
          json(res, 405, { error: "method not allowed" });
          return;
        }
        const pathname = new URL(req.url ?? "/", "http://127.0.0.1").pathname;
        serveMedia(req, res, pathname).catch((error) => {
          try {
            json(res, 500, { error: safeMessage(error) });
          } catch {}
        });
      },
    });

    return () => {
      for (const dispose of disposers) {
        try {
          dispose();
        } catch {
          /* teardown is best effort */
        }
      }
    };
  }, "dsh-ambient-gallery routes");
}
