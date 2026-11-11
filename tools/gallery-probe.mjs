// End-to-end HTTP probe for the dsh-ambient-gallery Host half.
//
// Exercises the parts that can be checked without a browser: the 20-frame cap,
// per-frame de-duplication, merge semantics, media range serving and the video
// path. Writes only into the plugin's own state directory.
//
// Usage: node tools/gallery-probe.mjs [baseUrl]
const BASE_URL = process.argv[2] ?? "http://127.0.0.1:55384";
const BASE = "/plugins/dsh-ambient-gallery";

let failures = 0;
function check(label, ok, detail) {
	console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail === undefined ? "" : `  ${detail}`}`);
	if (!ok) failures += 1;
}

/* A 1x1 PNG is enough: the Host never decodes image bytes. */
function pngBytes(tint) {
	const { deflateSync } = globalThis.__zlib;
	const raw = Buffer.from([0x00, tint & 0xff, 0x40, 0x80]);
	const idat = deflateSync(raw);
	const chunk = (type, data) => {
		const len = Buffer.alloc(4);
		len.writeUInt32BE(data.length);
		const typeBuf = Buffer.from(type, "ascii");
		const crc = Buffer.alloc(4);
		crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])) >>> 0);
		return Buffer.concat([len, typeBuf, data, crc]);
	};
	let table = null;
	function crc32(buf) {
		if (table === null) {
			table = new Uint32Array(256);
			for (let n = 0; n < 256; n += 1) {
				let c = n;
				for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
				table[n] = c >>> 0;
			}
		}
		let c = 0xffffffff;
		for (const byte of buf) c = table[(c ^ byte) & 0xff] ^ (c >>> 8);
		return (c ^ 0xffffffff) >>> 0;
	}
	const ihdr = Buffer.alloc(13);
	ihdr.writeUInt32BE(1, 0);
	ihdr.writeUInt32BE(1, 4);
	ihdr[8] = 8;
	ihdr[9] = 2;
	return Buffer.concat([
		Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
		chunk("IHDR", ihdr),
		chunk("IDAT", idat),
		chunk("IEND", Buffer.alloc(0)),
	]);
}

async function getState() {
	const res = await fetch(`${BASE_URL}${BASE}/state`, { cache: "no-store" });
	if (!res.ok) throw new Error(`state ${res.status}`);
	return res.json();
}

async function importFile(name, bytes) {
	const res = await fetch(`${BASE_URL}${BASE}/import`, {
		method: "POST",
		headers: { "Content-Type": "application/octet-stream", "X-File-Name": encodeURIComponent(name) },
		body: bytes,
	});
	const body = await res.json().catch(() => ({}));
	return { status: res.status, body };
}

async function postState(body) {
	const res = await fetch(`${BASE_URL}${BASE}/state`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});
	return { status: res.status, body: await res.json().catch(() => ({})) };
}

const { deflateSync } = await import("node:zlib");
globalThis.__zlib = { deflateSync };

/* Start from a clean wall so every assertion below is deterministic. */
await postState({ tiles: {} });
const before = await getState();
check("state responds with a profile", Array.isArray(Object.keys(before.tiles ?? {})), `cells=${Object.keys(before.tiles ?? {}).length}`);
check("probe starts from an empty wall", Object.keys(before.tiles ?? {}).length === 0, `cells=${Object.keys(before.tiles ?? {}).length}`);

/* ---- 1. import 21 images into one cell: the cap must hold ---------- */
const CELL = "5";
const imported = [];
for (let i = 0; i < 21; i += 1) {
	const result = await importFile(`frame-${i}.png`, pngBytes(i * 11));
	if (result.status !== 200) {
		check(`import frame-${i}`, false, JSON.stringify(result.body).slice(0, 120));
		break;
	}
	imported.push(result.body.frame);
}
check("21 imports accepted by /import", imported.length === 21, `accepted=${imported.length}`);

/* Push all 21 through /state in one write; the Host must slice to 20. */
const full = (frame) => ({ id: frame.id, kind: frame.kind, name: frame.name, ext: frame.ext });
const pushed = await postState({ tiles: { [CELL]: { frames: imported.map(full) } } });
check("POST /state accepts 21 frames", pushed.status === 200, `status=${pushed.status}`);
const capped = pushed.body?.tiles?.[CELL]?.frames ?? [];
check("server caps the cell at 20 frames", capped.length === 20, `stored=${capped.length}`);
check(
	"cap keeps the newest 20, dropping the oldest",
	capped.length === 20 && capped[capped.length - 1].id === imported[20].id && !capped.some((f) => f.id === imported[0].id),
	`first=${capped[0]?.id?.slice(0, 6)} last=${capped[capped.length - 1]?.id?.slice(0, 6)}`,
);

/* ---- 2. duplicate ids must not consume two slots ------------------- */
const dup = await postState({
	tiles: { [CELL]: { frames: [...capped.map(full), full(capped[0])] } },
});
const dupFrames = dup.body?.tiles?.[CELL]?.frames ?? [];
check("a repeated id does not double-count", dupFrames.length === 20, `stored=${dupFrames.length}`);

/* ---- 3. merge semantics: omitted keys survive ---------------------- */
const merge = await postState({ config: { opacity: 0.31 } });
check("config merge keeps untouched keys", merge.body?.config?.count === before.config.count, `count=${merge.body?.config?.count}`);
check("config merge applies the new key", Math.abs((merge.body?.config?.opacity ?? -1) - 0.31) < 1e-9, `opacity=${merge.body?.config?.opacity}`);
check("config merge leaves tiles alone", (merge.body?.tiles?.[CELL]?.frames ?? []).length === 20, `cell ${CELL} frames=${(merge.body?.tiles?.[CELL]?.frames ?? []).length}`);

/* ---- 4. out-of-range values are clamped, not rejected -------------- */
const clamped = await postState({ config: { count: 99, opacity: 4, intervalMs: 10, videoKey: "nope" } });
const cfg = clamped.body?.config ?? {};
check("count clamped to 24", cfg.count === 24, `count=${cfg.count}`);
check("opacity clamped to 1", cfg.opacity === 1, `opacity=${cfg.opacity}`);
check("intervalMs clamped to >=1500", cfg.intervalMs === 1500, `intervalMs=${cfg.intervalMs}`);
check("an unusable shortcut falls back", cfg.videoKey === "Shift+V", `videoKey=${cfg.videoKey}`);

/* ---- 4a. mode and shape are whitelisted, not free text ------------- */
// Both are painted straight into the DOM, so an unknown value must fall back
// to the shipped default instead of reaching the wall.
const modeBad = await postState({ config: { mode: "disco", shape: "star" } });
check("an unknown mode falls back", modeBad.body?.config?.mode === "gallery", `mode=${modeBad.body?.config?.mode}`);
check("an unknown shape falls back", modeBad.body?.config?.shape === "rect", `shape=${modeBad.body?.config?.shape}`);
const modeOk = await postState({ config: { mode: "orbit", shape: "hexagon" } });
check("a known mode round-trips", modeOk.body?.config?.mode === "orbit", `mode=${modeOk.body?.config?.mode}`);
check("a known shape round-trips", modeOk.body?.config?.shape === "hexagon", `shape=${modeOk.body?.config?.shape}`);
await postState({ config: { mode: "gallery", shape: "rect" } });

/* ---- 4b. the shortcut is validated to something that can fire ------ */
// A combination without a modifier would swallow ordinary typing, and a key
// the browser never reports would never fire; both fall back to the default.
const keyBare = await postState({ config: { videoKey: "v" } });
check("a bare letter is not a shortcut", keyBare.body?.config?.videoKey === "Shift+V", `videoKey=${keyBare.body?.config?.videoKey}`);
const keyOdd = await postState({ config: { videoKey: "Shift+nope" } });
check("an unknown key falls back", keyOdd.body?.config?.videoKey === "Shift+V", `videoKey=${keyOdd.body?.config?.videoKey}`);
const keyNamed = await postState({ config: { videoKey: "alt+shift+space" } });
check("named keys are kept and normalised", keyNamed.body?.config?.videoKey === "Alt+Shift+Space", `videoKey=${keyNamed.body?.config?.videoKey}`);
const keyBack = await postState({ config: { videoKey: "Ctrl+K" } });
check("a custom shortcut round-trips", keyBack.body?.config?.videoKey === "Ctrl+K", `videoKey=${keyBack.body?.config?.videoKey}`);
await postState({ config: { videoKey: "Shift+V" } });

/* ---- 5. bad keys are dropped --------------------------------------- */
const badKeys = await postState({ tiles: { "../evil": { frames: [] }, "999": { frames: [] }, [CELL]: { frames: capped.map(full) } } });
check("path-like cell keys are dropped", badKeys.body?.tiles?.["../evil"] === undefined);
check("three-digit cell keys are dropped", badKeys.body?.tiles?.["999"] === undefined);

/* ---- 6. media serving: GET, HEAD, Range, traversal ----------------- */
const probe = capped[0];
const mediaPath = `${BASE_URL}${probe.url}`;
const g = await fetch(mediaPath);
check("GET /media returns 200", g.status === 200, `status=${g.status}`);
check("GET /media sends Accept-Ranges", g.headers.get("accept-ranges") === "bytes", g.headers.get("accept-ranges"));
check("GET /media is cacheable-but-private", (g.headers.get("cache-control") ?? "").includes("private"), g.headers.get("cache-control"));
const head = await fetch(mediaPath, { method: "HEAD" });
check("HEAD /media returns 200", head.status === 200, `status=${head.status}`);
const ranged = await fetch(mediaPath, { headers: { Range: "bytes=10-19" } });
check("Range request returns 206", ranged.status === 206, `status=${ranged.status}`);
const rangedBody = await ranged.arrayBuffer();
check("Range returns exactly the asked bytes", rangedBody.byteLength === 10, `bytes=${rangedBody.byteLength}`);
const over = await fetch(mediaPath, { headers: { Range: "bytes=999999-1000000" } });
check("out-of-range returns 416", over.status === 416, `status=${over.status}`);
const traversal = await fetch(`${BASE_URL}${BASE}/media/..%2f..%2fstate.json`);
check("path traversal is refused", traversal.status === 404, `status=${traversal.status}`);
const wrongMethod = await fetch(mediaPath, { method: "POST" });
check("POST /media is refused", wrongMethod.status === 405, `status=${wrongMethod.status}`);

/* ---- 7. a video frame is recognised as video ---------------------- */
const fakeVideo = Buffer.concat([Buffer.from("\x00\x00\x00\x18ftypmp42", "binary"), Buffer.alloc(256, 7)]);
const videoImport = await importFile("clip.mp4", fakeVideo);
check("video import accepted", videoImport.status === 200 && videoImport.body?.frame?.kind === "video", JSON.stringify(videoImport.body?.frame ?? videoImport.body).slice(0, 120));
if (videoImport.status === 200) {
	const withVideo = await postState({ tiles: { "1": { frames: [full(videoImport.body.frame)] } } });
	const stored = withVideo.body?.tiles?.["1"]?.frames?.[0];
	check("video frame keeps kind=video through /state", stored?.kind === "video", JSON.stringify(stored).slice(0, 120));
	check("video frame gets a media url", typeof stored?.url === "string" && stored.url.startsWith(`${BASE}/media/`), stored?.url);
}

/* ---- 8. frame-count ceiling of 20 on a fresh cell ----------------- */
const fresh = await postState({ tiles: { "7": { frames: imported.slice(0, 5).map(full) } } });
check("a fresh cell accepts 5 frames", (fresh.body?.tiles?.["7"]?.frames ?? []).length === 5);

/* ---- 9. the three real scene backdrops ship and are served -------- */
for (const name of ["karaoke", "cockpit", "orbit"]) {
	const sceneRes = await fetch(`${BASE_URL}${BASE}/scenes/${name}.jpg`);
	const buf = sceneRes.ok ? await sceneRes.arrayBuffer() : new ArrayBuffer(0);
	check(`GET /scenes/${name}.jpg returns a JPEG`, sceneRes.status === 200 && sceneRes.headers.get("content-type") === "image/jpeg" && buf.byteLength > 10000, `status=${sceneRes.status} bytes=${buf.byteLength}`);
}
const sceneTraversal = await fetch(`${BASE_URL}${BASE}/scenes/..%2f..%2fstate.json`);
check("scene path traversal is refused", sceneTraversal.status === 404, `status=${sceneTraversal.status}`);
const scenePost = await fetch(`${BASE_URL}${BASE}/scenes/orbit.jpg`, { method: "POST" });
check("POST /scenes is refused", scenePost.status === 405, `status=${scenePost.status}`);

/* ---- cleanup: leave no test frames behind -------------------------- */
await postState({ tiles: {} });
let removed = 0;
for (const frame of imported) {
	const res = await fetch(`${BASE_URL}${BASE}/remove?id=${frame.id}`, { method: "POST" });
	if (res.ok) removed += 1;
}
console.log(`cleanup: cleared tiles, removed ${removed}/${imported.length} test files`);

console.log(failures === 0 ? "\nALL_PROBE_CHECKS_PASSED" : `\n${failures} PROBE CHECK(S) FAILED`);
process.exitCode = failures === 0 ? 0 : 1;
