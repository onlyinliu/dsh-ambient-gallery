// dsh-ambient-gallery — browser half (client plugin bundle).
//
// Loaded by dsh-client-modules at /plugins/dsh-ambient-gallery/client.js and
// executed through the vendored cordis Loader's lazy-CJS module table
// (window.__ModuleLoader__.load). `react` is the only platform seed; every
// control below is written from scratch against `--dsw-alias-*` theme tokens.
//
// What it draws: a wall of picture cells across the whole app frame, sitting in
// `shell.overlay` — the one seat the shell renders outside every column's
// scroll container. The CSS of that seat (`z-index:20`, absolute, inset 0) puts
// the wall *above* the columns in paint order, which is exactly why the wall
// paints itself like a background instead of like content: the root is
// `pointer-events:none`, every cell is low opacity under `mix-blend-mode`, and
// the result reads as a watermark the text flows over without ever eating a
// click. Interactivity is opt-in behind an edit mode so the transcript, the
// composer and every scrollbar keep receiving every event they always did.
//
// Two surfaces, one id:
//   * `shell.overlay`  — the wall itself plus its edit-mode chrome.
//   * `settings.section` — the same controls with room to explain them.

window.__ModuleLoader__.load({
	id: "dsh-ambient-gallery",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

		let React = null;
		try {
			React = require("react");
		} catch (error) {
			React = null;
		}
		if (React === null || typeof React.createElement !== "function") {
			// Stay invisible instead of taking the web shell down.
			try {
				console.warn("[dsh-ambient-gallery] react is unavailable — plugin disabled for this session");
			} catch {}
			exports.apply = () => {};
			exports.inject = [];
			return module.exports;
		}

		const h = React.createElement;
		const useState = React.useState;
		const useEffect = React.useEffect;
		const useMemo = React.useMemo;
		const useRef = React.useRef;
		const useCallback = React.useCallback;

		/** Locale namespace; also the dictionaries' own key. */
		const NS = "dsh-ambient-gallery";
		/** Route prefix owned by the Host half. */
		const BASE = "/plugins/dsh-ambient-gallery";
		/** Per-cell cap. The Host enforces the same number; keep them equal. */
		const MAX_FRAMES = 20;
		/** Generated variants a cell rotates through before the user picks art. */
		const GENERATED_VARIANTS = 3;
		/** localStorage keys are namespaced so nothing else collides with them. */
		const EDIT_KEY = "dsh-ambient-gallery:edit";

		/* ---------------------------------------------------------------- */
		/* Dictionary                                                       */
		/* ---------------------------------------------------------------- */

		const ZH = {
			"wall.title": "氛围图墙",
			"wall.edit": "布置图墙",
			"wall.done": "完成",
			"wall.hint": "点一下任意一张照片就能换成自己的图，最多 20 张；它们会在这张照片里轮播。",
			"wall.pickImage": "选择图片",
			"wall.pickVideo": "选择视频",
			"wall.dropHere": "松开即可加入",
			"wall.frames": "{count} 张",
			"wall.full": "一次最多放入 20 张，多出的已忽略",
			"wall.clear": "清空",
			"wall.empty": "还没有图片",
			"wall.videoCell": "视频照片",
			"wall.generated": "生成图",
			"wall.loading": "正在读取图墙…",
			"wall.failed": "图墙服务不可用（Host 半未加载）",
			"wall.hiddenTag": "已隐藏",
			"ctl.visible": "显示图墙",
			"ctl.count": "照片数量",
			"ctl.bandLeft": "左边界",
			"ctl.bandRight": "右边界",
			"ctl.opacity": "浓度",
			"ctl.blend": "混合",
			"ctl.blur": "模糊",
			"ctl.interval": "轮播间隔",
			"ctl.gap": "间距",
			"ctl.radius": "圆角",
			"ctl.videoCell": "哪张照片播视频",
			"ctl.videoCellOff": "关闭",
			"ctl.videoKey": "视频快捷键",
			"ctl.videoKeyHint": "点这里再按下组合键",
			"wall.videoPaused": "视频已暂停，这张照片回到轮播",
			"wall.videoPlaying": "视频已恢复播放",
			"ctl.reset": "恢复默认",
			"ctl.clearCell": "清空这张照片",
			"ctl.removeFrame": "移除此图",
			"settings.title": "氛围图墙",
			"settings.desc":
				"像钉在墙上的一串照片：大小不一、各自倾斜、彼此留白，横向只落在面板 20%–80% 的中段。每张照片最多放 20 张图，按设定的节奏交替淡入；其中一张可以播放本地视频，安静循环，不打扰阅读。",
			"settings.openEdit": "进入布置模式",
			"settings.aboutHint":
				"图墙以极低浓度混合在界面之上、输入框之下视觉层，不会拦截任何点击或按键；只有进入布置模式后，图墙才会临时接管鼠标。",
			"unit.ms": "毫秒",
			"unit.px": "像素",
			"unit.percent": "%",
		};

		const EN = {
			"wall.title": "Ambient gallery",
			"wall.edit": "Arrange",
			"wall.done": "Done",
			"wall.hint": "Click any photo to pick local pictures — up to 20 per photo. They rotate there.",
			"wall.pickImage": "Pick pictures",
			"wall.pickVideo": "Pick a video",
			"wall.dropHere": "Drop to add",
			"wall.frames": "{count} pictures",
			"wall.full": "At most 20 pictures per drop — the rest were ignored",
			"wall.clear": "Clear",
			"wall.empty": "No pictures yet",
			"wall.videoCell": "Video photo",
			"wall.generated": "Generated art",
			"wall.loading": "Reading the gallery…",
			"wall.failed": "Gallery service unavailable (host half not loaded)",
			"wall.hiddenTag": "Hidden",
			"ctl.visible": "Show the wall",
			"ctl.count": "Pictures",
			"ctl.bandLeft": "Band starts",
			"ctl.bandRight": "Band ends",
			"ctl.opacity": "Density",
			"ctl.blend": "Blend",
			"ctl.blur": "Blur",
			"ctl.interval": "Rotation",
			"ctl.gap": "Gap",
			"ctl.radius": "Corners",
			"ctl.videoCell": "Video on photo",
			"ctl.videoCellOff": "Off",
			"ctl.videoKey": "Video shortcut",
			"ctl.videoKeyHint": "click, then press the keys",
			"wall.videoPaused": "Video paused — this photo joins the rotation",
			"wall.videoPlaying": "Video playing again",
			"ctl.reset": "Reset to shipped look",
			"ctl.clearCell": "Clear this photo",
			"ctl.removeFrame": "Remove this picture",
			"settings.title": "Ambient gallery",
			"settings.desc":
				"A string of photographs pinned to the wall: each a different size, each hung at its own angle, all with room to breathe, kept to the middle 20%–80% band of the panel. Every photo holds up to 20 images that cross-fade on a schedule; one of them can play a local video, looping quietly so reading stays easy.",
			"settings.openEdit": "Enter arrange mode",
			"settings.aboutHint":
				"The wall blends in at very low density above the interface but below your attention, and it never intercepts a click or a keystroke. Only arrange mode briefly lends it the mouse.",
			"unit.ms": "ms",
			"unit.px": "px",
			"unit.percent": "%",
		};

		const DEFAULT_CONFIG = {
			count: 8,
			gap: 18,
			radius: 6,
			opacity: 0.2,
			blend: "soft-light",
			blur: 0,
			intervalMs: 9000,
			visible: true,
			videoCell: 5,
			videoKey: "Shift+V",
			bandLeft: 20,
			bandRight: 80,
		};

		/**
		 * A shortcut is stored as `Modifier+Modifier+Key`, all modifiers
		 * spelled the way `KeyboardEvent` spells them. Anything outside the
		 * grammar is dropped, because this string is compared against real
		 * events and a typo would mean a shortcut that never fires.
		 */
		const MODIFIERS = ["Ctrl", "Alt", "Shift", "Meta"];
		const MODIFIER_FLAGS = { Ctrl: "ctrlKey", Alt: "altKey", Shift: "shiftKey", Meta: "metaKey" };
		const NAMED_KEYS = [
			"Space",
			"Enter",
			"Tab",
			"Backspace",
			"ArrowUp",
			"ArrowDown",
			"ArrowLeft",
			"ArrowRight",
			"Escape",
		];

		function normalizeVideoKey(value) {
			const parts = String(value ?? "")
				.split("+")
				.map((part) => part.trim())
				.filter((part) => part.length > 0);
			if (parts.length === 0) return DEFAULT_CONFIG.videoKey;
			const key = parts[parts.length - 1];
			const mods = parts.slice(0, -1);
			const named = NAMED_KEYS.find((name) => name.toLowerCase() === key.toLowerCase());
			const letter = /^[a-z0-9]$/iu.test(key) ? key.toUpperCase() : "";
			if (named === undefined && letter === "") return DEFAULT_CONFIG.videoKey;
			const kept = MODIFIERS.filter((modifier) => mods.some((mod) => mod.toLowerCase() === modifier.toLowerCase()));
			// A bare key would swallow ordinary typing, so at least one
			// modifier is required — a shortcut must be deliberate.
			if (kept.length === 0) return DEFAULT_CONFIG.videoKey;
			return [...kept, named ?? letter].join("+");
		}

		/**
		 * Named keys are spelled the way a person writes them, but a keyboard
		 * event spells the space bar as a literal " ". `event.key === "Space"`
		 * is therefore never true, and a shortcut that can be assigned but
		 * never fires is worse than no shortcut at all.
		 */
		const NAMED_ALIASES = { Space: [" ", "Spacebar"] };

		function keyMatches(spec, event) {
			const parts = normalizeVideoKey(spec).split("+");
			const key = parts[parts.length - 1];
			const mods = parts.slice(0, -1);
			for (const modifier of MODIFIERS) {
				const wanted = mods.includes(modifier);
				const actual = event[MODIFIER_FLAGS[modifier]] === true;
				if (wanted !== actual) return false;
			}
			const pressed = typeof event.key === "string" ? event.key : "";
			if (key.length === 1) return pressed.toUpperCase() === key.toUpperCase();
			if (NAMED_ALIASES[key] !== undefined) return NAMED_ALIASES[key].includes(pressed);
			return pressed === key;
		}

		const BLEND_OPTIONS = ["soft-light", "luminosity", "screen", "overlay", "normal"];

		/* ---------------------------------------------------------------- */
		/* Style                                                            */
		/* ---------------------------------------------------------------- */

		const STYLE_ID = "dsh-ambient-gallery-style";

		function stylesheet() {
			return [
				".agg-root{position:absolute;inset:0;pointer-events:none;user-select:none;overflow:hidden}",
				// The band is deliberately narrower than the column: the wall is
				// decor on the middle of the panel, never a full-bleed backdrop.
				".agg-wall{position:absolute;top:3%;bottom:9%;",
				"-webkit-mask-image:linear-gradient(to right,transparent,#000 9%,#000 91%,transparent);",
				"mask-image:linear-gradient(to right,transparent,#000 9%,#000 91%,transparent);",
				"transition:opacity .45s ease}",
				".agg-cell{position:absolute;overflow:hidden;background:transparent;box-sizing:border-box;",
				"box-shadow:0 9px 26px rgba(0,0,0,.16);",
				"transform:rotate(var(--agg-tilt,0deg));",
				"filter:blur(var(--agg-blur,0px));transition:transform .35s cubic-bezier(.2,.7,.3,1),box-shadow .35s ease}",
				".agg-layer{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block;",
				"opacity:0;transition:opacity 1.6s ease;will-change:opacity}",
				".agg-layer[data-visible=\"1\"]{opacity:1}",
				".agg-video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block;background:transparent}",
				".agg-ring{position:absolute;inset:0;border-radius:inherit;pointer-events:none;",
				"box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--dsw-alias-border-l2) 60%,transparent);opacity:0;transition:opacity .2s ease}",
				".agg-edit .agg-cell{pointer-events:auto;cursor:pointer;transform:rotate(var(--agg-tilt,0deg)) scale(.97)}",
				".agg-edit .agg-cell:hover{transform:rotate(var(--agg-tilt,0deg)) scale(1.02);box-shadow:0 10px 34px rgba(0,0,0,.28);z-index:2}",
				".agg-edit .agg-cell:hover .agg-ring{opacity:1}",
				".agg-edit .agg-wall{opacity:1!important;mix-blend-mode:normal!important}",
				// The thread is the tell: a photograph on a wall hangs from
				// something. It is one hairline per photo, faint enough to be
				// felt rather than read, and it fades in on edit so the tile
				// itself stays the subject.
				".agg-thread{position:absolute;top:0;width:1px;pointer-events:none;",
				"background:linear-gradient(to bottom,transparent,color-mix(in srgb,var(--dsw-alias-label-tertiary) 70%,transparent));",
				"opacity:.42;transition:opacity .3s ease}",
				".agg-edit .agg-thread{opacity:.85}",
				".agg-edit .agg-layer,.agg-edit .agg-video{opacity:.55!important}",
				".agg-badge{position:absolute;left:8px;bottom:8px;display:flex;gap:6px;align-items:center;",
				"font:500 11px/1.4 system-ui,-apple-system,\"Segoe UI\",sans-serif;color:var(--dsw-alias-label-primary);",
				"background:color-mix(in srgb,var(--dsw-alias-bg-overlay) 78%,transparent);",
				"border:1px solid var(--dsw-alias-border-l2);border-radius:999px;padding:3px 9px;backdrop-filter:blur(8px);",
				"opacity:0;transition:opacity .2s ease;white-space:nowrap}",
				".agg-edit .agg-cell:hover .agg-badge{opacity:1}",
				".agg-vbadge{position:absolute;left:8px;top:8px;font:600 10px/1 system-ui,sans-serif;letter-spacing:.08em;",
				"text-transform:uppercase;color:var(--dsw-alias-label-secondary);",
				"background:color-mix(in srgb,var(--dsw-alias-bg-overlay) 70%,transparent);border-radius:999px;padding:4px 8px;",
				"opacity:0;transition:opacity .2s ease}",
				".agg-edit .agg-cell[data-video=\"1\"] .agg-vbadge{opacity:1}",
				".agg-panel{position:absolute;left:50%;bottom:22px;transform:translateX(-50%);pointer-events:auto;",
				"display:flex;gap:14px;align-items:center;flex-wrap:wrap;justify-content:center;max-width:min(920px,92vw);",
				"padding:12px 16px;border-radius:18px;background:var(--dsw-alias-bg-overlay);",
				"border:1px solid var(--dsw-alias-border-l2);box-shadow:0 18px 48px rgba(0,0,0,.32);",
				"backdrop-filter:blur(18px) saturate(1.2);color:var(--dsw-alias-label-primary);",
				"font:400 12px/1.5 system-ui,-apple-system,\"Segoe UI\",sans-serif}",
				".agg-panel-title{display:flex;align-items:center;gap:8px;font-weight:600;font-size:13px}",
				".agg-hint{opacity:.72;max-width:420px}",
				".agg-field{display:flex;flex-direction:column;gap:2px;min-width:74px}",
				".agg-field>span{font-size:10px;letter-spacing:.04em;text-transform:uppercase;opacity:.6}",
				".agg-field input[type=range]{width:100%;accent-color:var(--dsw-alias-brand-primary)}",
				".agg-field select,.agg-field input[type=number]{",
				"background:color-mix(in srgb,var(--dsw-alias-bg-base) 70%,transparent);",
				"color:inherit;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;padding:3px 6px;font:inherit}",
				".agg-btn{pointer-events:auto;border:1px solid var(--dsw-alias-border-l2);background:",
				"color-mix(in srgb,var(--dsw-alias-bg-layer-2) 72%,transparent);color:inherit;border-radius:10px;",
				"padding:5px 11px;font:inherit;cursor:pointer;transition:background .18s ease,border-color .18s ease}",
				".agg-btn:hover{background:var(--dsw-alias-bg-layer-3);border-color:var(--dsw-alias-border-l3)}",
				".agg-btn[data-primary=\"1\"]{background:var(--dsw-alias-brand-primary);color:#fff;border-color:transparent}",
				// The recorder reads as a key cap, not as a button: the user has
				// to be able to tell "what fires this" from "do this".
				".agg-key{font:600 11px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.04em;",
				"min-width:74px;text-align:center}",
				".agg-key[data-armed=\"1\"]{border-color:var(--dsw-alias-brand-primary);",
				"box-shadow:0 0 0 2px color-mix(in srgb,var(--dsw-alias-brand-primary) 28%,transparent)}",
				".agg-toggle{position:absolute;right:18px;bottom:18px;pointer-events:auto;width:34px;height:34px;",
				"border-radius:50%;display:grid;place-items:center;cursor:pointer;border:1px solid var(--dsw-alias-border-l2);",
				"background:color-mix(in srgb,var(--dsw-alias-bg-overlay) 72%,transparent);color:var(--dsw-alias-label-secondary);",
				"opacity:.34;transition:opacity .22s ease,transform .22s ease;backdrop-filter:blur(10px)}",
				".agg-toggle:hover{opacity:1;transform:scale(1.06);color:var(--dsw-alias-label-primary)}",
				".agg-toast{position:absolute;left:50%;bottom:96px;transform:translateX(-50%);pointer-events:none;",
				"padding:7px 14px;border-radius:999px;font:500 12px/1.4 system-ui,sans-serif;color:var(--dsw-alias-label-primary);",
				"background:var(--dsw-alias-bg-overlay);border:1px solid var(--dsw-alias-border-l2);",
				"box-shadow:0 10px 30px rgba(0,0,0,.25);animation:agg-toast-in .2s ease}",
				"@keyframes agg-toast-in{from{opacity:0;transform:translate(-50%,6px)}to{opacity:1;transform:translate(-50%,0)}}",
				".agg-section{display:flex;flex-direction:column;gap:18px;padding:4px 2px 28px;",
				"color:var(--dsw-alias-label-primary);font:400 13px/1.6 system-ui,-apple-system,\"Segoe UI\",sans-serif}",
				".agg-section h3{margin:0;font-size:15px;font-weight:600}",
				".agg-section p{margin:0;color:var(--dsw-alias-label-secondary);max-width:62ch}",
				".agg-card{border:1px solid var(--dsw-alias-border-l2);border-radius:14px;padding:14px 16px;",
				"background:var(--dsw-alias-bg-layer-1);display:flex;flex-direction:column;gap:12px}",
				".agg-row{display:flex;align-items:center;justify-content:space-between;gap:16px}",
				".agg-row>span{min-width:96px}",
				".agg-row input[type=range]{flex:1;accent-color:var(--dsw-alias-brand-primary)}",
				".agg-val{min-width:56px;text-align:right;font-variant-numeric:tabular-nums;color:var(--dsw-alias-label-secondary)}",
				".agg-note{font-size:12px;color:var(--dsw-alias-label-tertiary);max-width:64ch}",
				".agg-chip{display:inline-flex;align-items:center;gap:6px;padding:2px 9px;border-radius:999px;",
				"border:1px solid var(--dsw-alias-border-l2);font-size:11px;color:var(--dsw-alias-label-secondary)}",
				".agg-switch{display:inline-flex;align-items:center;gap:8px;cursor:pointer}",
				".agg-switch input{accent-color:var(--dsw-alias-brand-primary);width:16px;height:16px}",
			].join("");
		}

		function ensureStyle() {
			try {
				const existing = document.getElementById(STYLE_ID);
				if (existing !== null && existing !== undefined) return existing;
				const el = document.createElement("style");
				el.id = STYLE_ID;
				el.textContent = stylesheet();
				(document.head || document.body).appendChild(el);
				return el;
			} catch {
				return null;
			}
		}

		/* ---------------------------------------------------------------- */
		/* Generated art — the shipped look needs no assets at all           */
		/* ---------------------------------------------------------------- */

		/** Deterministic PRNG, so a cell's art is the same on every reload. */
		function mulberry32(seed) {
			let a = seed >>> 0;
			return function random() {
				a = (a + 0x6d2b79f5) | 0;
				let t = Math.imul(a ^ (a >>> 15), 1 | a);
				t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
				return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
			};
		}

		function hashOf(text) {
			let hash = 2166136261;
			for (let index = 0; index < text.length; index += 1) {
				hash ^= text.charCodeAt(index);
				hash = Math.imul(hash, 16777619);
			}
			return hash >>> 0;
		}

		/** Curated hue pairs: quiet enough to sit under text in either theme. */
		const PALETTES = [
			[212, 268],
			[188, 226],
			[24, 342],
			[150, 196],
			[276, 320],
			[36, 12],
			[206, 168],
			[318, 262],
		];

		const ART_CACHE = new Map();

		function generateArt(seedText, variant) {
			const key = `${seedText}#${variant}`;
			const cached = ART_CACHE.get(key);
			if (cached !== undefined) return cached;
			let url = "";
			try {
				const width = 640;
				const height = 460;
				const canvas = document.createElement("canvas");
				canvas.width = width;
				canvas.height = height;
				const g = canvas.getContext("2d");
				const random = mulberry32(hashOf(seedText) + variant * 7919);
				const pair = PALETTES[Math.floor(random() * PALETTES.length)];
				const hueA = pair[0];
				const hueB = pair[1];

				const base = g.createLinearGradient(0, 0, width, height);
				base.addColorStop(0, `hsl(${hueA} ${52 + random() * 18}% ${26 + random() * 16}%)`);
				base.addColorStop(1, `hsl(${hueB} ${46 + random() * 22}% ${44 + random() * 20}%)`);
				g.fillStyle = base;
				g.fillRect(0, 0, width, height);

				// Soft light pools give the flat gradient some depth.
				const pools = 2 + Math.floor(random() * 3);
				for (let index = 0; index < pools; index += 1) {
					const cx = random() * width;
					const cy = random() * height;
					const radius = (0.35 + random() * 0.55) * Math.max(width, height);
					const glow = g.createRadialGradient(cx, cy, 0, cx, cy, radius);
					const hue = index % 2 === 0 ? hueA : hueB;
					glow.addColorStop(0, `hsla(${hue} 78% ${62 + random() * 18}% / ${0.34 + random() * 0.26})`);
					glow.addColorStop(1, `hsla(${hue} 70% 45% / 0)`);
					g.fillStyle = glow;
					g.fillRect(0, 0, width, height);
				}

				// One crisp geometric motif: rings, arcs or bands. Cheap to draw,
				// and it keeps the wall from reading as pure noise.
				const motif = Math.floor(random() * 3);
				if (motif === 0) {
					const rings = 3 + Math.floor(random() * 4);
					for (let index = 0; index < rings; index += 1) {
						g.beginPath();
						g.arc(
							random() * width,
							random() * height,
							(0.12 + index * 0.09) * width * (0.7 + random() * 0.6),
							0,
							Math.PI * 2,
						);
						g.strokeStyle = `hsla(${hueB} 85% ${74 - index * 4}% / ${0.10 + random() * 0.10})`;
						g.lineWidth = 1 + random() * 2.5;
						g.stroke();
					}
				} else if (motif === 1) {
					g.save();
					g.translate(width * (0.2 + random() * 0.6), height * (0.2 + random() * 0.6));
					g.rotate(random() * Math.PI);
					const bars = 5 + Math.floor(random() * 5);
					for (let index = 0; index < bars; index += 1) {
						g.fillStyle = `hsla(${index % 2 === 0 ? hueA : hueB} 80% 72% / 0.08)`;
						g.fillRect(-width, index * 26 - bars * 13, width * 2, 9 + random() * 12);
					}
					g.restore();
				} else {
					g.save();
					for (let index = 0; index < 4; index += 1) {
						g.beginPath();
						g.arc(0, 0, width * (0.4 + index * 0.22), 0.15, Math.PI * 0.85);
						g.strokeStyle = `hsla(${hueA} 80% ${70}% / 0.12)`;
						g.lineWidth = 18 + index * 6;
						g.stroke();
					}
					g.restore();
				}

				// Fine grain keeps the blend from banding on wide gradients.
				const grains = 260;
				for (let index = 0; index < grains; index += 1) {
					g.fillStyle = `hsla(0 0% 100% / ${0.02 + random() * 0.05})`;
					g.fillRect(random() * width, random() * height, 1.2, 1.2);
				}

				const vignette = g.createRadialGradient(
					width / 2,
					height / 2,
					Math.min(width, height) * 0.28,
					width / 2,
					height / 2,
					Math.max(width, height) * 0.72,
				);
				vignette.addColorStop(0, "rgba(0,0,0,0)");
				vignette.addColorStop(1, "rgba(0,0,0,0.34)");
				g.fillStyle = vignette;
				g.fillRect(0, 0, width, height);

				url = canvas.toDataURL("image/jpeg", 0.72);
			} catch {
				url = "";
			}
			ART_CACHE.set(key, url);
			return url;
		}

		function generatedFrames(cellKey) {
			const out = [];
			for (let variant = 0; variant < GENERATED_VARIANTS; variant += 1) {
				const url = generateArt(cellKey, variant);
				if (url !== "") out.push({ id: `gen-${cellKey}-${variant}`, kind: "image", url, name: "", ext: "" });
			}
			return out;
		}

		/* ---------------------------------------------------------------- */
		/* Store: one profile shared by the wall and the settings page       */
		/* ---------------------------------------------------------------- */

		const STORE = {
			profile: null,
			error: "",
			loading: true,
			edit: false,
			toast: "",
			/**
			 * Whether the video photo is currently muted out of existence.
			 * Deliberately *not* persisted: it is a "shush it for a moment"
			 * gesture, and a file that boots silently would look broken.
			 */
			videoPaused: false,
			listeners: new Set(),
		};

		function subscribe(listener) {
			STORE.listeners.add(listener);
			return () => {
				STORE.listeners.delete(listener);
			};
		}

		function emit() {
			for (const listener of [...STORE.listeners]) {
				try {
					listener();
				} catch {}
			}
		}

		function setEdit(value) {
			STORE.edit = value === true;
			try {
				window.localStorage.setItem(EDIT_KEY, STORE.edit ? "1" : "0");
			} catch {}
			emit();
		}

		/**
		 * The shortcut's whole job: flip the video photo in and out of the
		 * wall. Pausing does not hide the photo — it hands the photo back to
		 * the rotation, so the wall keeps its shape and only the content
		 * changes, exactly like any other tile.
		 */
		function toggleVideo() {
			STORE.videoPaused = STORE.videoPaused !== true;
			toast(STORE.videoPaused ? translate("wall.videoPaused") : translate("wall.videoPlaying"));
		}

		let toastTimer = null;
		function toast(message) {
			STORE.toast = message;
			emit();
			try {
				if (toastTimer !== null) window.clearTimeout(toastTimer);
				toastTimer = window.setTimeout(() => {
					STORE.toast = "";
					toastTimer = null;
					emit();
				}, 2600);
			} catch {}
		}

		function useStore() {
			const [, force] = useState(0);
			useEffect(() => subscribe(() => force((value) => value + 1)), []);
			return STORE;
		}

		/** `new URL(…, document.baseURI)` keeps a sub-path deployment working. */
		function endpoint(path) {
			try {
				const url = new URL(`${BASE}${path}`, document.baseURI);
				return `${url.pathname}${url.search}`;
			} catch {
				return `${BASE}${path}`;
			}
		}

		async function fetchProfile() {
			STORE.loading = true;
			emit();
			try {
				const response = await fetch(endpoint("/state"), { cache: "no-store" });
				if (!response.ok) throw new Error(`HTTP ${response.status}`);
				const data = await response.json();
				STORE.profile = {
					config: { ...DEFAULT_CONFIG, ...(data?.config ?? {}) },
					tiles: data?.tiles ?? {},
				};
				STORE.error = "";
			} catch (error) {
				STORE.error = String(error && error.message ? error.message : error);
				if (STORE.profile === null) {
					// Degrade to the shipped look: generated art still renders, and
					// edits are refused rather than lost silently.
					STORE.profile = { config: { ...DEFAULT_CONFIG }, tiles: {} };
				}
			} finally {
				STORE.loading = false;
				emit();
			}
		}

		async function persist(body) {
			try {
				const response = await fetch(endpoint("/state"), {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(body),
				});
				if (!response.ok) throw new Error(`HTTP ${response.status}`);
				const data = await response.json();
				STORE.profile = {
					config: { ...DEFAULT_CONFIG, ...(data?.config ?? {}) },
					tiles: data?.tiles ?? {},
				};
				STORE.error = "";
				emit();
				return true;
			} catch (error) {
				STORE.error = String(error && error.message ? error.message : error);
				emit();
				return false;
			}
		}

		function config() {
			return STORE.profile?.config ?? DEFAULT_CONFIG;
		}

		function tiles() {
			return STORE.profile?.tiles ?? {};
		}

		function updateConfig(patch) {
			const next = { ...config(), ...patch };
			// Optimistic: the wall repaints on the click, the round trip settles it.
			STORE.profile = { config: next, tiles: tiles() };
			emit();
			void persist({ config: patch });
		}

		async function importFiles(cellKey, fileList) {
			const files = [...(fileList ?? [])].filter(Boolean);
			if (files.length === 0) return;
			// A full cell is not a dead end: the picks still go in and the
			// oldest frames rotate out. Only the batch itself is bounded, so a
			// 200-file drop cannot hammer the Host one request at a time.
			if (files.length > MAX_FRAMES) toast(translate("wall.full"));
			const added = [];
			for (const file of files.slice(0, MAX_FRAMES)) {
				try {
					const response = await fetch(endpoint("/import"), {
						method: "POST",
						headers: {
							"Content-Type": file.type || "application/octet-stream",
							"X-File-Name": encodeURIComponent(file.name || "picture"),
						},
						body: file,
					});
					if (!response.ok) throw new Error(`HTTP ${response.status}`);
					const data = await response.json();
					if (data?.frame?.url) {
						added.push(data.frame);
					}
				} catch (error) {
					toast(String(error && error.message ? error.message : error));
					break;
				}
			}
			if (added.length === 0) return;
			const nextTiles = { ...tiles() };
			// Newest wins: the cell is a rolling window, so the pictures just
			// picked are the ones that stay and the oldest rotate out. Keeping
			// the head instead would look like the pick silently failed.
			const merged = [...(nextTiles[cellKey]?.frames ?? []), ...added].slice(-MAX_FRAMES);
			nextTiles[cellKey] = { frames: merged };
			STORE.profile = { config: config(), tiles: nextTiles };
			emit();
			await persist({ tiles: nextTiles });
		}

		async function clearCell(cellKey) {
			const nextTiles = { ...tiles() };
			delete nextTiles[cellKey];
			STORE.profile = { config: config(), tiles: nextTiles };
			emit();
			await persist({ tiles: nextTiles });
		}

		async function clearAll() {
			STORE.profile = { config: config(), tiles: {} };
			emit();
			await persist({ tiles: {} });
		}

		/** `t` is bound by apply(); the store may be written to before that. */
		let translate = (key) => ZH[key] ?? key;

		/* ---------------------------------------------------------------- */
		/* Rotation                                                         */
		/* ---------------------------------------------------------------- */

		function useDocumentVisible() {
			const [visible, setVisible] = useState(true);
			useEffect(() => {
				const read = () => setVisible(document.visibilityState !== "hidden");
				read();
				document.addEventListener("visibilitychange", read);
				return () => document.removeEventListener("visibilitychange", read);
			}, []);
			return visible;
		}

		function useReducedMotion() {
			const [reduced, setReduced] = useState(false);
			useEffect(() => {
				try {
					const query = window.matchMedia("(prefers-reduced-motion: reduce)");
					const read = () => setReduced(query.matches);
					read();
					query.addEventListener("change", read);
					return () => query.removeEventListener("change", read);
				} catch {
					return undefined;
				}
			}, []);
			return reduced;
		}

		/**
		 * Cross-fade through `length` frames.
		 *
		 * Every cell starts its own timer with a small deterministic offset, so
		 * the wall ripples instead of blinking in unison — the difference between
		 * "a wall of pictures" and "a wall of metronomes".
		 */
		function useRotation(length, intervalMs, cellKey, paused) {
			const [state, setState] = useState({ current: 0, previous: -1, epoch: 0 });

			useEffect(() => {
				setState({ current: 0, previous: -1, epoch: 0 });
			}, [cellKey]);

			useEffect(() => {
				if (paused || length <= 1) return undefined;
				let timer = null;
				let cancelled = false;
				const offset = (hashOf(cellKey) % 7) * 0.11;
				const start = window.setTimeout(() => {
					if (cancelled) return;
					const step = () => {
						if (cancelled) return;
						setState((previous) => ({
							current: (previous.current + 1) % length,
							previous: previous.current,
							epoch: previous.epoch + 1,
						}));
					};
					step();
					timer = window.setInterval(step, intervalMs);
				}, Math.round(intervalMs * (0.25 + offset)));
				return () => {
					cancelled = true;
					window.clearTimeout(start);
					if (timer !== null) window.clearInterval(timer);
				};
			}, [length, intervalMs, cellKey, paused]);

			return state;
		}

		/* ---------------------------------------------------------------- */
		/* Icons                                                            */
		/* ---------------------------------------------------------------- */

		function IconPicture(props) {
			return h(
				"svg",
				{
					viewBox: "0 0 16 16",
					width: props?.size ?? 16,
					height: props?.size ?? 16,
					fill: "none",
					stroke: "currentColor",
					strokeWidth: 1.4,
					strokeLinecap: "round",
					strokeLinejoin: "round",
					"aria-hidden": "true",
				},
				h("rect", { x: 2, y: 2.6, width: 12, height: 10.8, rx: 2 }),
				h("circle", { cx: 5.7, cy: 6.2, r: 1.15 }),
				h("path", { d: "M2.2 12.1l3.6-3.3 2.6 2.4 2.2-2 3.2 3" }),
			);
		}

		function IconVideo(props) {
			return h(
				"svg",
				{
					viewBox: "0 0 16 16",
					width: props?.size ?? 16,
					height: props?.size ?? 16,
					fill: "none",
					stroke: "currentColor",
					strokeWidth: 1.4,
					strokeLinecap: "round",
					strokeLinejoin: "round",
					"aria-hidden": "true",
				},
				h("rect", { x: 1.8, y: 4.2, width: 8.6, height: 7.6, rx: 1.8 }),
				h("path", { d: "M10.6 8l3.6-2.2v4.4L10.6 8z" }),
			);
		}

		function IconPlus(props) {
			return h(
				"svg",
				{
					viewBox: "0 0 16 16",
					width: props?.size ?? 16,
					height: props?.size ?? 16,
					fill: "none",
					stroke: "currentColor",
					strokeWidth: 1.6,
					strokeLinecap: "round",
					"aria-hidden": "true",
				},
				h("path", { d: "M8 3.4v9.2M3.4 8h9.2" }),
			);
		}

		/* ---------------------------------------------------------------- */
		/* Wall                                                             */
		/* ---------------------------------------------------------------- */

		function format(template, values) {
			return String(template).replace(/\{(\w+)\}/gu, (match, key) =>
				values !== null && values !== undefined && values[key] !== undefined ? String(values[key]) : match,
			);
		}

		/**
		 * Photos pinned to a wall, not cells in a table. Each one is dropped
		 * at a hand-set spot inside the band with its own size and tilt, and
		 * rejection sampling keeps them from touching. When the band is too
		 * crowded for the requested count the tiles shrink a little on every
		 * failed sweep rather than overlap — an ornament, never a mosaic, and
		 * nothing ever lines up with anything else.
		 */
		function placements(count, gap) {
			const random = mulberry32(hashOf(`photos:${count}`));
			// A photograph is wider than it is tall; 4:3, 3:2 and 5:4 all read
			// as "snapshot on a wall" rather than "window in a grid".
			const ASPECTS = [4 / 3, 3 / 2, 5 / 4];
			// Room to breathe is what makes it read as decor. It scales very
			// gently with the gap control so the slider stays useful.
			const breath = 1.1 + Math.min(3.6, gap * 0.07);
			const places = [];
			let width = 15;
			for (let index = 0; index < count; index += 1) {
				// The video tile reads best a touch larger, since people look at
				// motion first; the rest vary freely.
				const aspect = ASPECTS[Math.floor(random() * ASPECTS.length)];
				let place = null;
				for (let attempt = 0; attempt < 320 && place === null; attempt += 1) {
					// Only shrink after a full sweep of misses: more photos is
					// still possible, they just get a little smaller.
					if (attempt > 0 && attempt % 80 === 0) width *= 0.87;
					const w = Math.min(21, width * (0.7 + random() * 0.6));
					const h = w / aspect;
					// Nothing bigger than a photo on a wall: cap both axes so a
					// small count cannot turn one tile into a slab.
					if (h > 26) continue;
					const left = 1.5 + random() * (97 - w);
					const top = 2 + random() * (96 - h);
					const tilt = (random() - 0.5) * 11;
					// A tilted rectangle occupies more than its own box, so the
					// collision test uses the rotated bounding box.
					const rad = (Math.abs(tilt) * Math.PI) / 180;
					const cos = Math.cos(rad);
					const sin = Math.sin(rad);
					const boxW = w * cos + h * sin;
					const boxH = w * sin + h * cos;
					const cx = left + w / 2;
					const cy = top + h / 2;
					const clear = places.every((other) => {
						const dx = Math.abs(cx - other.cx);
						const dy = Math.abs(cy - other.cy);
						return dx >= (boxW + other.boxW) / 2 + breath || dy >= (boxH + other.boxH) / 2 + breath;
					});
					if (!clear) continue;
					place = { left, top, width: w, height: h, tilt, boxW, boxH, cx, cy };
				}
				// 320 failed sweeps means the band is full at any size worth
				// showing: stop rather than pile tiles on top of each other.
				if (place === null) break;
				places.push(place);
			}
			return places;
		}

		function Cell(props) {
			const { cellKey, index, isVideoCell, gated, picking, place } = props;
			const store = useStore();
			const current = config();
			const visible = useDocumentVisible();
			const reduced = useReducedMotion();
			const edit = store.edit;

			const frames = tiles()[cellKey]?.frames ?? null;
			const [art, setArt] = useState(null);

			// The shortcut hides the video without hiding the photo: the tile
			// falls back to whatever pictures it also holds, and if it holds
			// none it gets generated art — so a paused video photo keeps
			// taking part in the wall exactly like every other tile.
			const videoHidden = store.videoPaused === true && !edit;
			const framesHaveStills =
				frames !== null && frames.some((frame) => frame.kind !== "video");
			const needsArt = frames === null || frames.length === 0 || (videoHidden && !framesHaveStills);

			// Generated art is rasterised on the next frame rather than during the
			// first render: twelve canvases inline would delay the shell's paint.
			useEffect(() => {
				if (!needsArt) {
					setArt(null);
					return undefined;
				}
				let alive = true;
				const handle = window.requestAnimationFrame(() => {
					if (alive) setArt(generatedFrames(cellKey));
				});
				return () => {
					alive = false;
					window.cancelAnimationFrame(handle);
				};
			}, [cellKey, needsArt]);

			// A paused video photo must still show *something*: its own
			// pictures if it has any, generated art if the video was the only
			// thing in it. That keeps the wall's shape intact while the
			// content quietly changes.
			const stillsOf = (rows) => (rows ?? []).filter((frame) => frame.kind !== "video");
			const ownStills = stillsOf(frames);
			const list = videoHidden
				? ownStills.length > 0
					? ownStills
					: art ?? []
				: frames !== null && frames.length > 0
					? frames
					: art ?? [];
			const videoFrame = videoHidden ? null : list.find((frame) => frame.kind === "video") ?? null;
			const stills = videoFrame === null ? list : list.filter((frame) => frame.kind !== "video");

			const rotation = useRotation(stills.length, current.intervalMs, cellKey, reduced || !visible || edit);
			const active = stills[rotation.current] ?? null;
			const previous = stills[rotation.previous] ?? null;

			const onPick = useCallback(() => {
				if (!edit) return;
				picking(cellKey, isVideoCell && videoFrame === null ? "video" : "image");
			}, [edit, cellKey, isVideoCell, videoFrame, picking]);

			const onDrop = useCallback(
				(event) => {
					if (!edit) return;
					event.preventDefault();
					event.stopPropagation();
					const files = event.dataTransfer?.files;
					if (files !== undefined && files !== null && files.length > 0) void importFiles(cellKey, files);
				},
				[edit, cellKey],
			);

			const cellStyle = {
				borderRadius: `${current.radius}px`,
				opacity: edit ? 1 : current.opacity,
				mixBlendMode: edit ? "normal" : current.blend,
				"--agg-blur": `${current.blur}px`,
				"--agg-tilt": `${place.tilt}deg`,
				left: `${place.left}%`,
				top: `${place.top}%`,
				width: `${place.width}%`,
				height: `${place.height}%`,
			};

			const children = [];
			if (videoFrame !== null) {
				children.push(
					h("video", {
						key: "video",
						className: "agg-video",
						src: videoFrame.url,
						autoPlay: true,
						muted: true,
						loop: true,
						playsInline: true,
						preload: "metadata",
						controls: edit,
						"data-visible": "1",
					}),
				);
			}
			if (previous !== null && previous !== active) {
				children.push(h("img", { key: `prev-${previous.id}`, className: "agg-layer", src: previous.url, alt: "", draggable: false }));
			}
			if (active !== null) {
				children.push(
					h("img", {
						key: `active-${active.id}-${rotation.epoch}`,
						className: "agg-layer",
						src: active.url,
						alt: "",
						draggable: false,
						"data-visible": "1",
					}),
				);
			}

			children.push(h("div", { key: "ring", className: "agg-ring" }));

			if (isVideoCell) {
				children.push(
					h("div", { key: "vbadge", className: "agg-vbadge" }, videoFrame === null ? translate("wall.pickVideo") : translate("wall.videoCell")),
				);
			}

			children.push(
				h(
					"div",
					{ key: "badge", className: "agg-badge" },
					h(IconPlus, { size: 12 }),
					h(
						"span",
						null,
						frames !== null && frames.length > 0
							? format(translate("wall.frames"), { count: frames.length })
							: translate("wall.generated"),
					),
				),
			);

			return h(
				"div",
				{
					className: "agg-cell",
					style: cellStyle,
					"data-video": isVideoCell ? "1" : "0",
					"aria-hidden": "true",
					onClick: onPick,
					onDragOver: (event) => {
						if (!edit) return;
						event.preventDefault();
					},
					onDrop,
					title: edit ? (isVideoCell ? translate("wall.pickVideo") : translate("wall.pickImage")) : "",
				},
				children,
			);
		}

		function Wall() {
			const store = useStore();
			const current = config();
			const fileRef = useRef(null);
			const pending = useRef({ cellKey: "", mode: "image" });
			const visible = useDocumentVisible();
			const reduced = useReducedMotion();

			// Edit mode is remembered per profile: it is a workspace preference,
			// not a document fact, so it never goes into the shared state file.
			useEffect(() => {
				try {
					if (window.localStorage.getItem(EDIT_KEY) === "1") setEdit(true);
				} catch {}
				void fetchProfile();
			}, []);

			// One shortcut, one meaning: it flips the video photo between
			// playing and standing down. It wins over text fields on purpose —
			// a shortcut the app cannot honour while the caret sits in the
			// composer is a shortcut that never works, and the composer holds
			// the caret most of the time. The single exemption is the recorder
			// itself, which has to be able to read the keys back.
			const shortcut = current.videoKey;
			useEffect(() => {
				const onKeyDown = (event) => {
					if (event.defaultPrevented || event.repeat || event.isComposing) return;
					if (CAPTURE.active) return;
					if (!keyMatches(shortcut, event)) return;
					event.preventDefault();
					event.stopPropagation();
					toggleVideo();
				};
				window.addEventListener("keydown", onKeyDown, true);
				return () => window.removeEventListener("keydown", onKeyDown, true);
			}, [shortcut]);

			const picking = useCallback((cellKey, mode) => {
				pending.current = { cellKey, mode };
				const input = fileRef.current;
				if (input !== null && input !== undefined) {
					input.accept = mode === "video" ? "video/*" : "image/*";
					input.value = "";
					input.click();
				}
			}, []);

			const onFiles = useCallback((event) => {
				const files = event.target?.files;
				const { cellKey } = pending.current;
				if (files !== null && files !== undefined && files.length > 0 && cellKey !== "") {
					void importFiles(cellKey, files);
				}
				try {
					event.target.value = "";
				} catch {}
			}, []);

			const count = Math.max(1, Math.round(current.count ?? 8));
			// The band keeps the ornament off the reading gutters: 20% to 80%
			// of the panel's width by default, and always at least a sliver.
			const bandLeft = Math.min(Math.max(0, Number(current.bandLeft ?? 20)), 60);
			const bandRight = Math.min(Math.max(bandLeft + 10, Number(current.bandRight ?? 80)), 100);
			const videoIndex =
				current.videoCell !== null && current.videoCell !== undefined && current.videoCell >= 0
					? Math.min(count - 1, Math.round(current.videoCell))
					: -1;
			const showWall = current.visible !== false && !reduced;

			const cells = [];
			const threads = [];
			// Fewer spots than photos can happen when the band is tight and the
			// count is high; the wall simply shows what fits.
			const places = placements(count, current.gap);
			for (let index = 0; index < places.length; index += 1) {
				const place = places[index];
				threads.push(
					h("div", {
						key: `thread-${index}`,
						className: "agg-thread",
						style: { left: `${place.cx}%`, height: `${place.top}%` },
					}),
				);
				cells.push(
					h(Cell, {
						key: index,
						cellKey: String(index),
						index,
						isVideoCell: index === videoIndex,
						gated: !visible,
						picking,
						place,
					}),
				);
			}

			return h(
				"div",
				{ className: store.edit ? "agg-root agg-edit" : "agg-root", "data-agg": "root" },
				h("input", {
					ref: fileRef,
					type: "file",
					multiple: true,
					style: { display: "none" },
					onChange: onFiles,
				}),
				showWall || store.edit
					? h(
							"div",
							{
								className: "agg-wall",
								style: {
									left: `${bandLeft}%`,
									right: `${100 - bandRight}%`,
									opacity: 1,
									visibility: current.visible === false && !store.edit ? "hidden" : "visible",
								},
							},
							[...threads, ...cells],
						)
					: null,
				store.edit
					? h(EditBar, { count, shown: places.length, videoIndex, onPickVideo: () => picking(String(videoIndex < 0 ? 0 : videoIndex), "video") })
					: h(
							"button",
							{
								type: "button",
								className: "agg-toggle",
								onClick: () => setEdit(true),
								title: translate("wall.edit"),
								"aria-label": translate("wall.edit"),
							},
							h(IconPicture, { size: 15 }),
						),
				store.toast !== "" ? h("div", { className: "agg-toast" }, store.toast) : null,
				store.error !== "" && store.edit
					? h("div", { className: "agg-toast", style: { bottom: "150px" } }, translate("wall.failed"))
					: null,
			);
		}

		function EditBar(props) {
			const store = useStore();
			const current = config();
			const { count, shown, videoIndex, onPickVideo } = props;
			return h(
				"div",
				{ className: "agg-panel" },
				h(
					"div",
					{ className: "agg-panel-title" },
					h(IconPicture, { size: 15 }),
					h("span", null, translate("wall.title")),
					h("span", { className: "agg-chip" }, `${shown}/${count}`),
				),
				h("div", { className: "agg-hint" }, translate("wall.hint")),
				Field({
					label: translate("ctl.count"),
					value: count,
					min: 3,
					max: 16,
					step: 1,
					onChange: (value) => updateConfig({ count: value }),
				}),
				Field({
					label: translate("ctl.bandLeft"),
					value: Math.round(current.bandLeft ?? 20),
					min: 0,
					max: 60,
					step: 1,
					format: (value) => `${value}%`,
					onChange: (value) => updateConfig({ bandLeft: Math.min(value, Math.round(current.bandRight ?? 80) - 10) }),
				}),
				Field({
					label: translate("ctl.bandRight"),
					value: Math.round(current.bandRight ?? 80),
					min: 40,
					max: 100,
					step: 1,
					format: (value) => `${value}%`,
					onChange: (value) => updateConfig({ bandRight: Math.max(value, Math.round(current.bandLeft ?? 20) + 10) }),
				}),
				Field({
					label: translate("ctl.opacity"),
					value: Math.round(current.opacity * 100),
					min: 0,
					max: 100,
					step: 1,
					format: (value) => `${value}%`,
					onChange: (value) => updateConfig({ opacity: value / 100 }),
				}),
				Field({
					label: translate("ctl.interval"),
					value: Math.round(current.intervalMs / 1000),
					min: 2,
					max: 60,
					step: 1,
					format: (value) => `${value}s`,
					onChange: (value) => updateConfig({ intervalMs: value * 1000 }),
				}),
				Field({
					label: translate("ctl.blur"),
					value: current.blur,
					min: 0,
					max: 24,
					step: 1,
					format: (value) => `${value}px`,
					onChange: (value) => updateConfig({ blur: value }),
				}),
				h(
					"label",
					{ className: "agg-field" },
					h("span", null, translate("ctl.blend")),
					h(
						"select",
						{
							value: current.blend,
							onChange: (event) => updateConfig({ blend: event.target.value }),
						},
						BLEND_OPTIONS.map((option) => h("option", { key: option, value: option }, option)),
					),
				),
				h(
					"label",
					{ className: "agg-field" },
					h("span", null, translate("ctl.videoKey")),
					h(KeyRecorder, {
						value: normalizeVideoKey(current.videoKey),
						onChange: (value) => updateConfig({ videoKey: value }),
					}),
				),
				videoIndex >= 0
					? h(
							"button",
							{ type: "button", className: "agg-btn", onClick: onPickVideo, title: translate("wall.pickVideo") },
							h(IconVideo, { size: 13 }),
							h("span", { style: { marginLeft: "6px" } }, translate("wall.videoCell")),
						)
					: null,
				h(
					"button",
					{
						type: "button",
						className: "agg-btn",
						onClick: () => {
							void clearAll();
						},
					},
					translate("wall.clear"),
				),
				h(
					"button",
					{ type: "button", className: "agg-btn", "data-primary": "1", onClick: () => setEdit(false) },
					translate("wall.done"),
				),
			);
		}

		function Field(props) {
			const { label, value, min, max, step, onChange, format: showValue } = props;
			return h(
				"label",
				{ className: "agg-field" },
				h("span", null, `${label} · ${showValue !== undefined ? showValue(value) : value}`),
				h("input", {
					type: "range",
					min,
					max,
					step,
					value,
					onChange: (event) => onChange(Number(event.target.value)),
				}),
			);
		}

		/**
		 * One recorder can be open at a time, and while it is open the wall's
		 * own shortcut must not fire — pressing `Shift+V` into the recorder is
		 * how you *assign* the shortcut, not how you use it.
		 */
		const CAPTURE = { active: false };

		/**
		 * Shortcut recorder.
		 *
		 * Clicking arms it; the next combination is written straight through
		 * `normalizeVideoKey`, so the value shown is always a value that can
		 * actually fire. Escape disarms without changing anything — the only
		 * exit that does not silently bind the key the user pressed to get out.
		 */
		function KeyRecorder(props) {
			const { value, onChange } = props;
			const [armed, setArmed] = useState(false);
			// The parent hands down a fresh closure on every render; keeping it
			// in a ref means arming a recorder does not re-register the listener
			// underneath the user's fingers.
			const changeRef = useRef(onChange);
			changeRef.current = onChange;

			useEffect(() => {
				CAPTURE.active = armed;
				if (!armed) return () => { CAPTURE.active = false; };
				const onKeyDown = (event) => {
					event.preventDefault();
					event.stopPropagation();
					if (event.key === "Escape") {
						setArmed(false);
						return;
					}
					const pressed = typeof event.key === "string" ? event.key : "";
					if (MODIFIERS.some((modifier) => modifier === pressed)) return;
					const mods = MODIFIERS.filter((modifier) => event[MODIFIER_FLAGS[modifier]] === true);
					const named = NAMED_KEYS.find((name) => name.toLowerCase() === pressed.toLowerCase())
						?? (pressed === " " || pressed === "Spacebar" ? "Space" : undefined);
					const letter = /^[a-z0-9]$/iu.test(pressed) ? pressed.toUpperCase() : "";
					if (mods.length === 0 || (named === undefined && letter === "")) return;
					changeRef.current(normalizeVideoKey([...mods, named ?? letter].join("+")));
					setArmed(false);
				};
				window.addEventListener("keydown", onKeyDown, true);
				return () => {
					CAPTURE.active = false;
					window.removeEventListener("keydown", onKeyDown, true);
				};
			}, [armed]);

			return h(
				"button",
				{
					type: "button",
					className: "agg-btn agg-key",
					"data-agg-capture": "1",
					"data-armed": armed ? "1" : "0",
					onClick: () => setArmed((previous) => !previous),
					title: translate("ctl.videoKeyHint"),
				},
				armed ? translate("ctl.videoKeyHint") : value,
			);
		}

		/* ---------------------------------------------------------------- */
		/* Settings section                                                 */
		/* ---------------------------------------------------------------- */

		function SettingsSection() {
			const store = useStore();
			const current = config();

			useEffect(() => {
				if (store.profile === null) void fetchProfile();
			}, [store.profile]);

			const row = (label, value, min, max, step, onChange, showValue) =>
				h(
					"div",
					{ className: "agg-row" },
					h("span", null, label),
					h("input", {
						type: "range",
						min,
						max,
						step,
						value,
						onChange: (event) => onChange(Number(event.target.value)),
					}),
					h("span", { className: "agg-val" }, showValue !== undefined ? showValue(value) : String(value)),
				);

			return h(
				"div",
				{ className: "agg-section" },
				h("h3", null, translate("settings.title")),
				h("p", null, translate("settings.desc")),
				h(
					"div",
					{ className: "agg-card" },
					h(
						"label",
						{ className: "agg-switch" },
						h("input", {
							type: "checkbox",
							checked: current.visible !== false,
							onChange: (event) => updateConfig({ visible: event.target.checked }),
						}),
						h("span", null, translate("ctl.visible")),
					),
					row(translate("ctl.count"), Math.round(current.count ?? 8), 3, 16, 1, (value) => updateConfig({ count: value })),
					row(
						translate("ctl.bandLeft"),
						Math.round(current.bandLeft ?? 20),
						0,
						60,
						1,
						(value) => updateConfig({ bandLeft: Math.min(value, Math.round(current.bandRight ?? 80) - 10) }),
						(value) => `${value}%`,
					),
					row(
						translate("ctl.bandRight"),
						Math.round(current.bandRight ?? 80),
						40,
						100,
						1,
						(value) => updateConfig({ bandRight: Math.max(value, Math.round(current.bandLeft ?? 20) + 10) }),
						(value) => `${value}%`,
					),
					row(
						translate("ctl.opacity"),
						Math.round(current.opacity * 100),
						0,
						100,
						1,
						(value) => updateConfig({ opacity: value / 100 }),
						(value) => `${value}%`,
					),
					row(translate("ctl.blur"), current.blur, 0, 24, 1, (value) => updateConfig({ blur: value }), (value) => `${value}px`),
					row(translate("ctl.gap"), current.gap, 0, 64, 2, (value) => updateConfig({ gap: value }), (value) => `${value}px`),
					row(
						translate("ctl.radius"),
						current.radius,
						0,
						48,
						2,
						(value) => updateConfig({ radius: value }),
						(value) => `${value}px`,
					),
					row(
						translate("ctl.interval"),
						Math.round(current.intervalMs / 1000),
						2,
						60,
						1,
						(value) => updateConfig({ intervalMs: value * 1000 }),
						(value) => `${value}s`,
					),
					h(
						"div",
						{ className: "agg-row" },
						h("span", null, translate("ctl.blend")),
						h(
							"select",
							{
								style: {
									flex: 1,
									background: "var(--dsw-alias-bg-layer-2)",
									color: "inherit",
									border: "1px solid var(--dsw-alias-border-l2)",
									borderRadius: "8px",
									padding: "4px 8px",
								},
								value: current.blend,
								onChange: (event) => updateConfig({ blend: event.target.value }),
							},
							BLEND_OPTIONS.map((option) => h("option", { key: option, value: option }, option)),
						),
					),
					h(
						"div",
						{ className: "agg-row" },
						h("span", null, translate("ctl.videoCell")),
						h(
							"select",
							{
								style: {
									flex: 1,
									background: "var(--dsw-alias-bg-layer-2)",
									color: "inherit",
									border: "1px solid var(--dsw-alias-border-l2)",
									borderRadius: "8px",
									padding: "4px 8px",
								},
								value: String(current.videoCell),
								onChange: (event) => updateConfig({ videoCell: Number(event.target.value) }),
							},
							[
								h("option", { key: "-1", value: "-1" }, translate("ctl.videoCellOff")),
								...Array.from(
									{ length: Math.max(1, Math.round(current.count ?? 8)) },
									(_, index) => h("option", { key: String(index), value: String(index) }, `#${index + 1}`),
								),
							],
						),
					),
					h(
						"div",
						{ className: "agg-row" },
						h("span", null, translate("ctl.videoKey")),
						h(KeyRecorder, {
							value: normalizeVideoKey(current.videoKey),
							onChange: (value) => updateConfig({ videoKey: value }),
						}),
					),
				),
				h(
					"div",
					{ className: "agg-card" },
					h(
						"div",
						{ className: "agg-row" },
						h(
							"button",
							{ type: "button", className: "agg-btn", "data-primary": "1", onClick: () => setEdit(true) },
							translate("settings.openEdit"),
						),
						h(
							"button",
							{
								type: "button",
								className: "agg-btn",
								onClick: () => {
									updateConfig({ ...DEFAULT_CONFIG });
									void clearAll();
								},
							},
							translate("ctl.reset"),
						),
						h(
							"button",
							{
								type: "button",
								className: "agg-btn",
								onClick: () => {
									void clearAll();
								},
							},
							translate("wall.clear"),
						),
					),
					h("div", { className: "agg-note" }, translate("settings.aboutHint")),
					h(
						"div",
						{ className: "agg-note" },
						`${translate("wall.frames", { count: Object.values(tiles()).reduce((sum, tile) => sum + (tile?.frames?.length ?? 0), 0) })}`,
					),
				),
			);
		}

		/* ---------------------------------------------------------------- */
		/* Plugin body                                                      */
		/* ---------------------------------------------------------------- */

		const inject = ["slots", "locale"];

		function apply(ctx) {
			let t = (key) => ZH[key] ?? key;
			try {
				ctx.effect(() => {
					const dispose = ctx.locale?.register?.(NS, { zh: ZH, en: EN });
					return typeof dispose === "function" ? dispose : () => {};
				}, "dsh-ambient-gallery: dictionaries");
				if (typeof ctx.locale?.bind === "function") {
					const bound = ctx.locale.bind(NS);
					if (typeof bound === "function") {
						t = bound;
						translate = bound;
					}
				}
			} catch (error) {
				try {
					console.warn("[dsh-ambient-gallery] locale registration failed:", error && error.message);
				} catch {}
			}
			translate = (key, values) => {
				const template = t(key);
				return values === undefined ? template : format(template, values);
			};

			try {
				ctx.effect(() => {
					const el = ensureStyle();
					return () => {
						try {
							if (el !== null && el !== undefined) el.remove();
						} catch {}
					};
				}, "dsh-ambient-gallery: stylesheet");
			} catch {
				/* styling is cosmetic — never fail the plugin over it */
			}

			const disposers = [];

			try {
				const off = ctx.slots.register(
					{
						name: "shell.overlay",
						id: NS,
						order: 40,
						label: "Ambient Gallery",
					},
					Wall,
				);
				if (typeof off === "function") disposers.push(off);
			} catch (error) {
				try {
					console.error("[dsh-ambient-gallery] overlay registration failed:", error && error.message);
				} catch {}
			}

			try {
				const off = ctx.slots.register(
					{
						name: "settings.section",
						id: NS,
						order: 12,
						label: typeof t === "function" ? String(t("settings.title")) : "Ambient Gallery",
						locale: NS,
					},
					SettingsSection,
				);
				if (typeof off === "function") disposers.push(off);
			} catch (error) {
				try {
					console.error("[dsh-ambient-gallery] settings section registration failed:", error && error.message);
				} catch {}
			}

			try {
				ctx.effect(
					() => () => {
						for (const dispose of disposers) {
							try {
								dispose();
							} catch {}
						}
					},
					"dsh-ambient-gallery: slot disposal",
				);
			} catch {
				/* teardown is best effort */
			}
		}

		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	},
});
