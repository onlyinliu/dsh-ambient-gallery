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
const styleEl = { id: "", textContent: "", remove() {}, setAttribute() {} };
const document = {
	baseURI: "http://127.0.0.1:55384/",
	head: { appendChild() {} },
	body: { appendChild() {} },
	visibilityState: "visible",
	documentElement: { dataset: {} },
	getElementById: () => null,
	createElement: (tag) => (tag === "canvas" ? fakeCanvas() : { ...styleEl, tagName: tag }),
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
	useEffect: () => {},
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
	fetch: () => Promise.reject(new Error("no network in smoke test")),
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
	console.log("--- layout ---");
	const layout = checkLayout();
	console.log("  wall band (left/right)                 :", layout.band);
	console.log("  tiles found                            :", layout.count);
	console.log("  every tile inside 0-100%               :", layout.inside);
	console.log("  every tile capped at 26% x 34%         :", layout.capped);
	console.log("  no two tiles overlap                   :", layout.disjoint);
	console.log("  sizes are not uniform                  :", layout.uneven);
	console.log("  tiles cover well under the whole panel :", layout.coverage);
	if (!layout.ok) process.exitCode = 1;

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

function checkLayout() {
	const entry = registrations.find((item) => item.registration.name === "shell.overlay");
	const tree = entry.component({ children: undefined });
	let wall = null;
	const tiles = [];
	walk(tree, (node) => {
		const className = node.props?.className;
		if (className === "agg-wall") wall = node;
		if (className === "agg-cell") {
			const style = node.props?.style ?? {};
			const rect = {
				left: percent(style.left),
				top: percent(style.top),
				width: percent(style.width),
				height: percent(style.height),
			};
			if (rect.left !== null && rect.top !== null && rect.width !== null && rect.height !== null) tiles.push(rect);
		}
	});

	const band = wall ? `${wall.props.style.left}/${wall.props.style.right}` : "missing";
	const inside = tiles.every(
		(tile) => tile.left >= 0 && tile.top >= 0 && tile.left + tile.width <= 100.001 && tile.top + tile.height <= 100.001,
	);
	const capped = tiles.every((tile) => tile.width <= 26.001 && tile.height <= 34.001);
	let disjoint = true;
	for (let a = 0; a < tiles.length; a += 1) {
		for (let b = a + 1; b < tiles.length; b += 1) {
			const one = tiles[a];
			const two = tiles[b];
			const apart =
				one.left + one.width <= two.left ||
				two.left + two.width <= one.left ||
				one.top + one.height <= two.top ||
				two.top + two.height <= one.top;
			if (!apart) disjoint = false;
		}
	}
	const area = tiles.reduce((total, tile) => total + (tile.width * tile.height) / 100, 0);
	const coverage = area < 55;
	// "Not too regular": the widths and heights must actually differ, and the
	// tiles must not sit on a shared baseline grid.
	const widths = new Set(tiles.map((tile) => Math.round(tile.width * 10)));
	const heights = new Set(tiles.map((tile) => Math.round(tile.height * 10)));
	const uneven = widths.size > Math.max(2, Math.floor(tiles.length / 3)) && heights.size > Math.max(2, Math.floor(tiles.length / 3));
	const ok =
		band === "20%/20%" && tiles.length >= 12 && inside && capped && disjoint && uneven && coverage;
	return { band, count: tiles.length, inside, capped, disjoint, uneven, coverage, ok };
}
