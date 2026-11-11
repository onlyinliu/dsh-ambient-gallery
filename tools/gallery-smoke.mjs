// Offline smoke test for the dsh-ambient-gallery client bundle.
//
// There is no browser control in this environment, so the honest checks are:
//   1. the bundle parses and only ever requires `react`,
//   2. `apply(ctx)` registers exactly the two surfaces we promise,
//   3. both components can be rendered with a plausible fake React + DOM.
// Anything visual is NOT verified here and must not be reported as verified.
//
// Usage: node tools/gallery-smoke.mjs <path-to-client.js>
import { readFileSync } from "node:fs";
import vm from "node:vm";

const file = process.argv[2];
const source = readFileSync(file, "utf8");

// Which look the canned profile asks for. The photo wall and the scenery
// modes render completely different trees, and both branches deserve to be
// executed at least once — a scene that throws on render is not a scene.
const CANNED_MODE = process.env.AGG_SMOKE_MODE ?? "gallery";

/* ---- fake canvas ---------------------------------------------------- */
const ctx2d = new Proxy(
	{},
	{
		get(target, key) {
			if (key === "createLinearGradient" || key === "createRadialGradient") {
				return () => ({ addColorStop() {} });
			}
			if (key === "getImageData") {
				return (x, y, w, h) => ({ data: new Uint8ClampedArray(Math.max(1, w * h * 4)) });
			}
			if (key === "putImageData" || key === "createPattern") return () => null;
			if (key in target) return target[key];
			return () => undefined;
		},
		set(target, key, value) {
			target[key] = value;
			return true;
		},
	},
);

function fakeCanvas(width, height) {
	const canvas = {
		width: width ?? 300,
		height: height ?? 150,
		getContext: () => ctx2d,
		toDataURL: () => "data:image/jpeg;base64,AAAA",
	};
	return canvas;
}

/* ---- fake DOM ------------------------------------------------------- */
const cleanups = [];

const styleEl = { id: "", textContent: "", remove() {}, setAttribute() {} };
// Created nodes are kept so the stylesheet can be read back as text: the
// stylesheet is the only place some promises (no floating panel, no pointer
// capture on the wall) can be checked without a browser.
const created = [];
const document = {
	baseURI: "http://127.0.0.1:55384/",
	head: { appendChild() {} },
	body: { appendChild() {} },
	visibilityState: "visible",
	documentElement: { dataset: {} },
	getElementById: () => null,
	createElement: (tag) => {
		if (tag === "canvas") return fakeCanvas();
		const node = { ...styleEl, tagName: tag };
		if (tag === "style") created.push(node);
		return node;
	},
	addEventListener: () => {},
	removeEventListener: () => {},
	querySelector: () => null,
};

/* ---- minimal React -------------------------------------------------- */
const React = {
	createElement: (type, props, ...children) => {
		if (typeof type === "function") {
			// Render one level so hook code and JSX construction actually run.
			return type({ ...(props ?? {}), children });
		}
		return { type, props: props ?? {}, children };
	},
	useState: (initial) => [typeof initial === "function" ? initial() : initial, () => {}],
	useReducer: (reducer, initial) => [initial, () => {}],
	// Effects run for real: the settings page loads the profile in one, and a
	// smoke test whose effects never run never sees a single frame.
	useEffect: (factory) => {
		const cleanup = factory();
		if (typeof cleanup === "function") cleanups.push(cleanup);
	},
	useLayoutEffect: () => {},
	useMemo: (factory) => factory(),
	useCallback: (fn) => fn,
	useRef: (initial) => ({ current: initial }),
	useContext: () => ({ t: (key) => key }),
	Fragment: "Fragment",
};
React.default = React;

/* ---- loader harness ------------------------------------------------- */
const trace = [];
const registrations = [];
const effects = [];
let disposed = 0;

const slots = {
	register: (registration, component) => {
		registrations.push({ registration, component });
		return () => {
			disposed += 1;
		};
	},
	inject: () => {},
	registerFactory: () => () => {},
	render: () => null,
};

const locale = {
	register: (namespace, dictionaries) => {
		trace.push(`locale:${namespace}:${Object.keys(dictionaries).join("+")}`);
		return () => {};
	},
	bind: (namespace) => (key) => `${namespace}.${key}`,
};

const ctx = {
	get: () => undefined,
	on: () => () => {},
	provide: () => {},
	effect: (factory, label) => {
		const dispose = factory();
		effects.push({ label, dispose });
		return () => {};
	},
	slots,
	locale,
};

/* ---- browser globals ------------------------------------------------ */
const noopTimer = () => 0;
const window = {
	__ModuleLoader__: {
		load: (entry) => {
			trace.push(`module:${entry.id}`);
			const mod = entry.factory((specifier) => {
				trace.push(`require:${specifier}`);
				if (specifier === "react") return React;
				if (specifier === "react-dom") return { createPortal: (node) => node };
				throw new Error(`unregistered seed: ${specifier}`);
			});
			const exported = mod ?? {};
			trace.push(`inject:${JSON.stringify(exported.inject)}`);
			if (typeof exported.apply !== "function") throw new Error("apply is missing");
			exported.apply(ctx);
			trace.push("applied");
		},
	},
	localStorage: {
		store: new Map(),
		getItem(k) {
			return this.store.has(k) ? this.store.get(k) : null;
		},
		setItem(k, v) {
			this.store.set(k, String(v));
		},
		removeItem(k) {
			this.store.delete(k);
		},
	},
	document,
	matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }),
	setTimeout: noopTimer,
	clearTimeout: () => {},
	setInterval: noopTimer,
	clearInterval: () => {},
	requestAnimationFrame: () => 0,
	cancelAnimationFrame: () => {},
	// A canned profile: two pictures on one tile and a video on the next, so
	// the frame rows and their delete buttons are exercised with real data.
	fetch: () =>
		Promise.resolve({
			ok: true,
			status: 200,
			json: async () => ({
				version: 1,
				config: { mode: CANNED_MODE, shape: "rect", count: 20 },
				tiles: {
					0: { frames: [
						{ id: "aaa", kind: "image", name: "a.jpg", ext: ".jpg", url: "/m/aaa.jpg" },
						{ id: "bbb", kind: "image", name: "b.jpg", ext: ".jpg", url: "/m/bbb.jpg" },
					] },
					1: { frames: [
						{ id: "ccc", kind: "video", name: "c.mp4", ext: ".mp4", url: "/m/ccc.mp4" },
					] },
				},
			}),
		}),
	devicePixelRatio: 1,
	addEventListener: () => {},
	removeEventListener: () => {},
	location: { href: "http://127.0.0.1:55384/" },
};

const sandbox = {
	window,
	globalThis: null,
	console: { log: () => {}, warn: (m) => trace.push(`warn:${m}`), error: (m) => trace.push(`error:${m}`) },
	document,
	localStorage: window.localStorage,
	matchMedia: window.matchMedia,
	fetch: window.fetch,
	setTimeout: noopTimer,
	clearTimeout: () => {},
	setInterval: noopTimer,
	clearInterval: () => {},
	requestAnimationFrame: () => 0,
	cancelAnimationFrame: () => {},
	Uint8ClampedArray,
	Uint8Array,
	Float64Array,
	Proxy,
	Promise,
	Date,
	Math,
	Number,
	String,
	Boolean,
	Array,
	Object,
	JSON,
	Map,
	Set,
	WeakMap,
	Error,
	URL: globalThis.URL,
	URLSearchParams: globalThis.URLSearchParams,
	encodeURIComponent,
	decodeURIComponent,
	undefined,
};
sandbox.globalThis = sandbox;

vm.createContext(sandbox);
let failed = false;
try {
	vm.runInContext(source, sandbox, { filename: file });
} catch (error) {
	console.error("SMOKE FAIL:", error && error.stack);
	process.exitCode = 1;
	failed = true;
}

if (!failed) {
	console.log("--- loader trace ---");
	for (const line of trace) console.log("  ", line);
	console.log("--- slot registrations ---");
	for (const { registration, component } of registrations) {
		console.log("  ", JSON.stringify(registration), "->", typeof component);
	}
	console.log("--- effects ---");
	for (const effect of effects) console.log("  ", effect.label, typeof effect.dispose);

	const names = registrations.map((entry) => entry.registration.name);
	const okOverlay = registrations.some(
		(entry) => entry.registration.name === "shell.overlay" && entry.registration.id === "dsh-ambient-gallery",
	);
	const okSettings = registrations.some(
		(entry) => entry.registration.name === "settings.section" && entry.registration.id === "dsh-ambient-gallery",
	);
	const okRequires = trace.filter((line) => line.startsWith("require:")).every((line) => line === "require:react");

	console.log("--- assertions ---");
	console.log("  shell.overlay id=dsh-ambient-gallery   :", okOverlay);
	console.log("  settings.section id=dsh-ambient-gallery:", okSettings);
	console.log("  requires only react                    :", okRequires);
	console.log("  registrations                          :", names.join(", "));
	if (!okOverlay || !okSettings || !okRequires) process.exitCode = 1;

	console.log("--- renders ---");
	for (const { registration, component } of registrations) {
		try {
			const tree = component({ children: undefined });
			console.log(`  render ${registration.name}:`, tree === null ? "null" : tree === undefined ? "undefined" : typeof tree);
		} catch (error) {
			console.log(`  render ${registration.name} FAILED:`, error && error.message);
			process.exitCode = 1;
		}
	}
	// Rendering above is what starts the profile request (an effect inside the
	// settings page); let it land before the frame list is inspected.
	await new Promise((resolve) => setTimeout(resolve, 50));
	if (CANNED_MODE !== "gallery") {
		console.log("--- scene ---");
		const scene = checkScene();
		console.log("  a scenery layer is rendered            :", scene.scenery);
		console.log("  its rectangular video screen is there  :", scene.screen);
		if (!scene.ok) process.exitCode = 1;
	} else {
	console.log("--- layout ---");
	const layout = checkLayout();
	console.log("  wall band (left/right)                 :", layout.band);
	console.log("  tiles found                            :", layout.count);
	console.log("  every tile inside 0-100%               :", layout.inside);
	console.log("  every tile capped at 21% x 26%         :", layout.capped);
	console.log("  no two tiles overlap                   :", layout.disjoint);
	console.log("  sizes are not uniform                  :", layout.uneven);
	console.log("  tilts are not uniform                  :", layout.tilted);
	console.log("  tops are not on a shared baseline      :", layout.scattered);
	console.log("  every photo hangs from its own thread  :", layout.hung, `(${layout.threads})`);
	console.log("  tiles cover well under the whole panel :", layout.coverage);
	if (!layout.ok) process.exitCode = 1;
	}

	console.log("--- surfaces ---");
	const surfaces = checkSurfaces();
	console.log("  no floating control panel in the css   :", surfaces.noPanel);
	console.log("  no floating toggle button in the css   :", surfaces.noToggle);
	console.log("  the wall never captures the pointer    :", surfaces.clickThrough);
	console.log("  all three scenes are styled            :", surfaces.scenes);
	console.log("  mode picker offers all four looks      :", surfaces.modes, `(${surfaces.modeCount})`);
	console.log(
		CANNED_MODE === "gallery" ? "  shape picker offers all six cuts       :" : "  shape picker is absent for scenery      :",
		surfaces.shapes,
		`(${surfaces.shapeCount})`,
	);
	console.log("  every tile has a thumbnail row         :", surfaces.rows, `(${surfaces.rowCount} rows)`);
	console.log("  every listed frame has exactly one x   :", surfaces.removable, `(${surfaces.frameCount} frames, ${surfaces.removeCount} x)`);
	console.log("  the canned profile reached the page    :", surfaces.frames, `(${surfaces.frameCount})`);
	console.log("  every tile has add-image + add-video   :", surfaces.pickers, `(${surfaces.pickerCount} buttons)`);
	if (!surfaces.ok) process.exitCode = 1;

	console.log("--- shortcut ---");
	const shortcut = checkShortcut();
	console.log("  a recorder is rendered                 :", shortcut.recorder);
	console.log("  it shows the default combination       :", shortcut.label, `(${shortcut.text})`);
	console.log("  it is not armed until clicked          :", shortcut.disarmed);
	if (!shortcut.recorder || !shortcut.label || !shortcut.disarmed) process.exitCode = 1;

	console.log("--- visual verification ---");
	console.log("  NOT AVAILABLE: no browser control in this environment.");
}

/* ---- layout assertions ---------------------------------------------- */
// The user asked for ornaments, not a table: tiles must be uneven, small,
// and confined to the middle band of the panel. The rendered tree carries
// that as plain inline percentages, so it can be checked without a browser.
function walk(node, visit) {
	if (Array.isArray(node)) {
		for (const child of node) walk(child, visit);
		return;
	}
	if (node === null || typeof node !== "object") return;
	visit(node);
	const children = node.children ?? node.props?.children;
	if (Array.isArray(children)) {
		for (const child of children) walk(child, visit);
	} else if (children !== undefined) {
		walk(children, visit);
	}
}

function percent(value) {
	if (typeof value !== "string" || !value.endsWith("%")) return null;
	const number = Number(value.slice(0, -1));
	return Number.isFinite(number) ? number : null;
}

function degrees(value) {
	if (typeof value !== "string" || !value.endsWith("deg")) return null;
	const number = Number(value.slice(0, -3));
	return Number.isFinite(number) ? number : null;
}

function checkLayout() {
	const entry = registrations.find((item) => item.registration.name === "shell.overlay");
	const tree = entry.component({ children: undefined });
	let wall = null;
	let threads = 0;
	const tiles = [];
	walk(tree, (node) => {
		const className = node.props?.className;
		if (className === "agg-wall") wall = node;
		// The hanging thread is what turns a floating rectangle into a print
		// pinned to a wall; one per photograph, always.
		if (className === "agg-thread") threads += 1;
		if (className === "agg-cell") {
			const style = node.props?.style ?? {};
			const rect = {
				left: percent(style.left),
				top: percent(style.top),
				width: percent(style.width),
				height: percent(style.height),
				tilt: degrees(style["--agg-tilt"]),
			};
			if (rect.left !== null && rect.top !== null && rect.width !== null && rect.height !== null) tiles.push(rect);
		}
	});

	// A tilted rectangle sticks out past its own box, so every geometric check
	// uses the rotated bounding box — the same one placements() collided with.
	const box = (tile) => {
		const rad = (Math.abs(tile.tilt ?? 0) * Math.PI) / 180;
		const cos = Math.cos(rad);
		const sin = Math.sin(rad);
		const w = tile.width * cos + tile.height * sin;
		const h = tile.width * sin + tile.height * cos;
		const cx = tile.left + tile.width / 2;
		const cy = tile.top + tile.height / 2;
		return { left: cx - w / 2, top: cy - h / 2, width: w, height: h };
	};

	const band = wall ? `${wall.props.style.left}/${wall.props.style.right}` : "missing";
	const boxes = tiles.map(box);
	const inside = boxes.every(
		(b) => b.left >= -0.001 && b.top >= -0.001 && b.left + b.width <= 100.001 && b.top + b.height <= 100.001,
	);
	// "Not too big": a photo on a wall, not a slab.
	const capped = tiles.every((tile) => tile.width <= 21.001 && tile.height <= 26.001);
	let disjoint = true;
	for (let a = 0; a < boxes.length; a += 1) {
		for (let b = a + 1; b < boxes.length; b += 1) {
			const one = boxes[a];
			const two = boxes[b];
			const apart =
				one.left + one.width <= two.left ||
				two.left + two.width <= one.left ||
				one.top + one.height <= two.top ||
				two.top + two.height <= one.top;
			if (!apart) disjoint = false;
		}
	}
	const area = tiles.reduce((total, tile) => total + (tile.width * tile.height) / 100, 0);
	// An ornament covers a small share of the wall; a mosaic would fill it.
	const coverage = area < 40;
	// "Not too regular": sizes differ, and the tiles do not share a baseline
	// or a tilt — nothing may line up with anything else.
	const widths = new Set(tiles.map((tile) => Math.round(tile.width * 10)));
	const heights = new Set(tiles.map((tile) => Math.round(tile.height * 10)));
	const tilts = new Set(tiles.map((tile) => Math.round((tile.tilt ?? 0) * 10)));
	const tops = new Set(tiles.map((tile) => Math.round(tile.top)));
	const uneven =
		widths.size >= Math.max(3, Math.floor(tiles.length * 0.6)) &&
		heights.size >= Math.max(3, Math.floor(tiles.length * 0.6));
	const tilted = tilts.size >= Math.max(3, Math.floor(tiles.length * 0.6));
	const scattered = tops.size >= Math.max(3, Math.floor(tiles.length * 0.7));
	// Every photograph hangs from its own thread — the thread count is the
	// cheap proof that the "pinned to a wall" reading survives refactors.
	const hung = threads === tiles.length && threads > 0;
	const ok =
		band === "20%/20%" && tiles.length >= 8 && inside && capped && disjoint && uneven && tilted && scattered && hung && coverage;
	return { band, count: tiles.length, threads, inside, capped, disjoint, uneven, tilted, scattered, hung, coverage, ok };
}

/* ---- scenery assertions --------------------------------------------- */
// The three scenery modes have no photographs at all: they are a CSS scene
// plus one rectangular screen kept free for video. Rendered with a fake
// profile, the tree has to contain exactly that.
function checkScene() {
	const entry = registrations.find((item) => item.registration.name === "shell.overlay");
	const tree = entry.component({ children: undefined });
	let scenery = false;
	let screen = false;
	let screenVideo = false;
	walk(tree, (node) => {
		const className = node.props?.className;
		if (typeof className === "string" && className.startsWith("agg-mode ")) scenery = true;
		if (className === "agg-screen") screen = true;
		if (node.type === "video" && node.props?.className === undefined) screenVideo = true;
	});
	return { scenery, screen, ok: scenery && screen };
}

/* ---- surface assertions --------------------------------------------- */
// The user's report was about interaction, so the interaction promises are
// checked as directly as this environment allows: the stylesheet must not
// contain a floating panel or toggle, the wall root must stay click-through,
// and every control must live on the one settings page.
function checkSurfaces() {
	const css = created.map((node) => String(node.textContent ?? "")).join("\n");
	const noPanel = !css.includes(".agg-panel");
	const noToggle = !css.includes(".agg-toggle");
	// `.agg-root{...pointer-events:none...}` is the contract that the wall can
	// never eat a click meant for the app; assert it on the rule itself.
	const rootRule = (css.match(/\.agg-root\{[^}]*\}/u) ?? [""])[0];
	const clickThrough = rootRule.includes("pointer-events:none");

	const settings = registrations.find((item) => item.registration.name === "settings.section");
	const tree = settings.component({ children: undefined });
	const segs = [];
	const tiles = [];
	let pickerCount = 0;
	let thumbButtons = 0;
	walk(tree, (node) => {
		const className = node.props?.className;
		if (className === "agg-seg") segs.push(node);
		if (className === "agg-tile") tiles.push(node);
		if (className === "agg-thumb-x") thumbButtons += 1;
		if (className === "agg-btn" && node.props?.["data-small"] === "1") pickerCount += 1;
	});
	// Two pickers: which look, and (only for the photo wall) how it is cut.
	const modeSeg = segs[0];
	const shapeSeg = segs[1];
	const segCount = (seg) => (seg?.children ?? seg?.props?.children ?? []).flat(3).length;
	const modeCount = segCount(modeSeg);
	const shapeCount = segCount(shapeSeg);
	// A frame is "listed" when its thumbnail appears; each listed frame must
	// own exactly one × so the user can delete that one picture and nothing
	// else. In this sandbox the profile is empty, so both counts are zero —
	// the assertion still holds, and the printout says which numbers it saw.
	let frameCount = 0;
	for (const tile of tiles) {
		walk(tile, (node) => {
			if (node.props?.className === "agg-thumb") frameCount += 1;
		});
	}
	// The three scenery modes are pure CSS + DOM, so the stylesheet is the
	// proof they exist at all: one class per scene, plus the video screen
	// every one of them has to keep free.
	const scenes = [".agg-karaoke", ".agg-cockpit", ".agg-orbit", ".agg-earth", ".agg-screen"].filter((name) =>
		css.includes(name),
	).length;
	const modes = modeCount === 4;
	// The shape picker belongs to the photo wall and is deliberately absent in
	// the scenery modes — there is nothing there to cut into a hexagon. So the
	// expectation depends on which look this run asked for.
	const shapes = CANNED_MODE === "gallery" ? shapeCount === 6 : shapeCount === 0;
	const rows = tiles.length === 20;
	const removable = thumbButtons === frameCount;
	const pickers = pickerCount === tiles.length * 2;
	return {
		noPanel,
		noToggle,
		clickThrough,
		scenes: scenes === 5,
		modes,
		shapes,
		rows,
		removable,
		frames: frameCount === 3,
		pickers,
		modeCount,
		shapeCount,
		rowCount: tiles.length,
		frameCount,
		removeCount: thumbButtons,
		pickerCount,
		ok:
			noPanel &&
			noToggle &&
			clickThrough &&
			scenes === 5 &&
			modes &&
			shapes &&
			rows &&
			removable &&
			frameCount === 3 &&
			pickers,
	};
}

/* ---- shortcut assertions -------------------------------------------- */
// The shortcut is the one thing the wall deliberately listens for, so it is
// worth proving the recorder actually reaches the settings page with a
// combination that can fire — a shortcut nobody can find is a dead control.
function checkShortcut() {
	const entry = registrations.find((item) => item.registration.name === "settings.section");
	const tree = entry.component({ children: undefined });
	let button = null;
	walk(tree, (node) => {
		const className = node.props?.className;
		if (typeof className === "string" && className.includes("agg-key")) button = node;
	});
	if (button === null) return { recorder: false, label: false, disarmed: false, text: "" };
	const text = [button.children].flat(3).filter((part) => typeof part === "string").join("");
	return {
		recorder: true,
		label: /^[A-Za-z0-9]+(\+[A-Za-z0-9]+)+$/u.test(text),
		disarmed: button.props?.["data-armed"] === "0",
		text,
	};
}
