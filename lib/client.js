// dsh-ambient-gallery — browser half (client plugin bundle).
//
// Loaded by dsh-client-modules at /plugins/dsh-ambient-gallery/client.js and
// executed through the vendored cordis Loader's lazy-CJS module table
// (window.__ModuleLoader__.load). `react` is the only platform seed; every
// control below is written from scratch against `--dsw-alias-*` theme tokens.
//
// What it draws: a wall of photographs strung across the middle of the app
// frame, sitting in `shell.overlay` — the one seat the shell renders outside
// every column's scroll container. The CSS of that seat (`z-index:20`,
// absolute, inset 0) puts the wall *above* the columns in paint order, which
// is exactly why the wall paints itself like a background instead of like
// content: the root is `pointer-events:none`, every tile sits at low opacity
// under `mix-blend-mode`, and the result reads as a watermark the text flows
// over without ever eating a click.
//
// Everything that can be configured lives on one surface: the settings page.
// The wall itself never handles a pointer, so there is no arrange mode to
// enter, no floating control panel to collide with the page below it, and no
// state in which the overlay swallows a keystroke meant for the composer.
//
// Three ambiance modes replace the photographs with code-drawn scenery —
// karaoke lights, a cockpit HUD, the Earth seen from orbit — and each of them
// keeps one small rectangular screen that can play a local video.
//
// Two surfaces, one id:
//   * `shell.overlay`    — the wall itself, plus a toast for the shortcut.
//   * `settings.section` — every control, including the per-photo manager.

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
		/** Per-tile cap. The Host enforces the same number; keep them equal. */
		const MAX_FRAMES = 20;
		/** Generated variants a tile rotates through before the user picks art. */
		const GENERATED_VARIANTS = 3;

		/* ---------------------------------------------------------------- */
		/* Dictionary                                                       */
		/* ---------------------------------------------------------------- */

		const ZH = {
			"wall.title": "氛围图墙",
			"wall.frames": "{count} 张",
			"wall.full": "一次最多放入 20 张，多出的已忽略",
			"wall.clear": "清空图墙",
			"wall.generated": "生成图",
			"wall.videoPaused": "视频已暂停，这张照片回到轮播",
			"wall.videoPlaying": "视频已恢复播放",
			"screen.empty": "这张屏幕在等一个视频",
			"ctl.visible": "显示图墙",
			"ctl.mode": "样式",
			"ctl.shape": "照片形状",
			"ctl.count": "照片数量",
			"ctl.bandLeft": "左边界",
			"ctl.bandRight": "右边界",
			"ctl.opacity": "浓度",
			"ctl.blend": "混合",
			"ctl.blur": "模糊",
			"ctl.interval": "轮播间隔",
			"ctl.gap": "间距",
			"ctl.radius": "圆角",
			"ctl.videoKey": "视频快捷键",
			"ctl.videoKeyHint": "点这里再按下组合键",
			"ctl.reset": "恢复默认",
			"mode.gallery": "照片墙",
			"mode.karaoke": "卡拉 OK",
			"mode.cockpit": "驾驶舱",
			"mode.orbit": "太空看地球",
			"shape.rect": "长方形",
			"shape.square": "方形",
			"shape.circle": "圆形",
			"shape.triangle": "三角形",
			"shape.diamond": "菱形",
			"shape.hexagon": "六边形",
			"photos.title": "照片内容",
			"photos.hint": "每个框最多 20 张，超出时最旧的自动轮换出去。点缩略图右上角的 × 可以删掉那一张。",
			"photos.addImage": "加图片",
			"photos.addVideo": "加视频",
			"photos.remove": "删掉这张",
			"photos.empty": "空框（会显示生成图）",
			"photos.cell": "第 {index} 个框",
			"settings.title": "氛围图墙",
			"settings.desc":
				"挂在主面板中段的一墙照片：大小不一、各自倾斜、彼此留白。也可以换成三套代码画的场景——卡拉 OK 的灯、战斗机驾驶舱、太空里看地球，每一套都留一块小长方形的屏幕放本地视频。",
			"settings.aboutHint":
				"图墙以极低浓度混合在界面之上，永远不接管鼠标和键盘（视频快捷键除外），所以文字照常选中、输入框照常输入。",
		};

		const EN = {
			"wall.title": "Ambient gallery",
			"wall.frames": "{count} pictures",
			"wall.full": "At most 20 pictures per drop — the rest were ignored",
			"wall.clear": "Clear the wall",
			"wall.generated": "Generated art",
			"wall.videoPaused": "Video paused — this photo joins the rotation",
			"wall.videoPlaying": "Video playing again",
			"screen.empty": "This screen is waiting for a video",
			"ctl.visible": "Show the wall",
			"ctl.mode": "Style",
			"ctl.shape": "Photo shape",
			"ctl.count": "Pictures",
			"ctl.bandLeft": "Band starts",
			"ctl.bandRight": "Band ends",
			"ctl.opacity": "Density",
			"ctl.blend": "Blend",
			"ctl.blur": "Blur",
			"ctl.interval": "Rotation",
			"ctl.gap": "Gap",
			"ctl.radius": "Corners",
			"ctl.videoKey": "Video shortcut",
			"ctl.videoKeyHint": "click, then press the keys",
			"ctl.reset": "Reset to shipped look",
			"mode.gallery": "Photo wall",
			"mode.karaoke": "Karaoke",
			"mode.cockpit": "Cockpit",
			"mode.orbit": "Earth from orbit",
			"shape.rect": "Rectangle",
			"shape.square": "Square",
			"shape.circle": "Circle",
			"shape.triangle": "Triangle",
			"shape.diamond": "Diamond",
			"shape.hexagon": "Hexagon",
			"photos.title": "What is in the frames",
			"photos.hint": "Up to 20 pictures per frame; past that the oldest rotate out. The × on a thumbnail removes just that picture.",
			"photos.addImage": "Add pictures",
			"photos.addVideo": "Add a video",
			"photos.remove": "Remove this one",
			"photos.empty": "Empty frame (generated art shows instead)",
			"photos.cell": "Frame {index}",
			"settings.title": "Ambient gallery",
			"settings.desc":
				"A wall of photographs across the middle of the panel — different sizes, each at its own angle, all with room to breathe. It can also become one of three drawn scenes: karaoke lights, a fighter cockpit, or the Earth seen from orbit. Each of them keeps a small rectangular screen for a local video.",
			"settings.aboutHint":
				"The wall blends in above the interface and never takes the mouse or the keyboard (except the video shortcut), so text still selects and the composer still types.",
		};

		const SHAPES = ["rect", "square", "circle", "triangle", "diamond", "hexagon"];
		const MODES = ["gallery", "karaoke", "cockpit", "orbit"];

		const DEFAULT_CONFIG = {
			mode: "gallery",
			shape: "rect",
			count: 20,
			gap: 18,
			radius: 6,
			opacity: 0.24,
			blend: "soft-light",
			blur: 0,
			intervalMs: 9000,
			visible: true,
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
				"filter:blur(var(--agg-blur,0px));transition:transform .35s cubic-bezier(.2,.7,.3,1)}",
				".agg-layer{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block;",
				"opacity:0;transition:opacity 1.6s ease;will-change:opacity}",
				".agg-layer[data-visible=\"1\"]{opacity:1}",
				".agg-video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block;background:transparent}",
				// The thread is the tell: a photograph on a wall hangs from
				// something. One hairline per photo, faint enough to be felt
				// rather than read.
				".agg-thread{position:absolute;top:0;width:1px;pointer-events:none;",
				"background:linear-gradient(to bottom,transparent,color-mix(in srgb,var(--dsw-alias-label-tertiary) 70%,transparent));",
				"opacity:.42}",
				".agg-badge{position:absolute;left:8px;bottom:8px;display:flex;gap:6px;align-items:center;",
				"font:500 10px/1.4 system-ui,-apple-system,\"Segoe UI\",sans-serif;color:var(--dsw-alias-label-primary);",
				"background:color-mix(in srgb,var(--dsw-alias-bg-overlay) 70%,transparent);",
				"border:1px solid var(--dsw-alias-border-l2);border-radius:999px;padding:2px 8px;",
				"opacity:0}",
				".agg-vbadge{position:absolute;left:8px;top:8px;font:600 9px/1 system-ui,sans-serif;letter-spacing:.08em;",
				"text-transform:uppercase;color:var(--dsw-alias-label-secondary);",
				"background:color-mix(in srgb,var(--dsw-alias-bg-overlay) 70%,transparent);border-radius:999px;padding:3px 7px}",
				".agg-toast{position:absolute;left:50%;bottom:96px;transform:translateX(-50%);pointer-events:none;",
				"padding:7px 14px;border-radius:999px;font:500 12px/1.4 system-ui,sans-serif;color:var(--dsw-alias-label-primary);",
				"background:var(--dsw-alias-bg-overlay);border:1px solid var(--dsw-alias-border-l2);",
				"box-shadow:0 10px 30px rgba(0,0,0,.25);animation:agg-toast-in .2s ease}",
				"@keyframes agg-toast-in{from{opacity:0;transform:translate(-50%,6px)}to{opacity:1;transform:translate(-50%,0)}}",
				/* ---- the video screen shared by the three scenery modes ---- */
				".agg-screen{position:absolute;overflow:hidden;box-sizing:border-box;border-radius:10px;",
				"border:1px solid color-mix(in srgb,var(--dsw-alias-border-l3) 80%,transparent);",
				"background:rgba(4,8,14,.72);box-shadow:0 10px 30px rgba(0,0,0,.35)",
				"}",
				".agg-screen video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}",
				".agg-screen-empty{position:absolute;inset:0;display:grid;place-items:center;text-align:center;padding:8px;",
				"font:500 10px/1.5 system-ui,sans-serif;letter-spacing:.04em;color:rgba(226,236,248,.62)}",
				".agg-screen-scan{position:absolute;inset:0;pointer-events:none;",
				"background:repeating-linear-gradient(to bottom,rgba(255,255,255,.05) 0 1px,transparent 1px 3px);",
				"animation:agg-scan 5.5s linear infinite}",
				"@keyframes agg-scan{from{background-position-y:0}to{background-position-y:60px}}",
				/* ---- karaoke ---- */
				".agg-mode{position:absolute;inset:0;overflow:hidden}",
				".agg-karaoke{background:radial-gradient(120% 90% at 50% 8%,#1b0f2b 0%,#0a0713 62%,#05040a 100%)}",
				".agg-beam{position:absolute;top:-30%;left:50%;width:16%;height:150%;transform-origin:50% 0;",
				"filter:blur(10px);opacity:.55;mix-blend-mode:screen}",
				".agg-beam-a{background:linear-gradient(to bottom,rgba(255,72,178,.85),rgba(255,72,178,0) 82%)",
				"animation:agg-swing-a 9s ease-in-out infinite}",
				".agg-beam-b{background:linear-gradient(to bottom,rgba(84,214,255,.8),rgba(84,214,255,0) 86%)",
				"animation:agg-swing-b 11s ease-in-out infinite}",
				".agg-beam-c{background:linear-gradient(to bottom,rgba(255,214,102,.75),rgba(255,214,102,0) 78%)",
				"animation:agg-swing-c 13s ease-in-out infinite}",
				"@keyframes agg-swing-a{0%,100%{transform:rotate(-26deg)}50%{transform:rotate(20deg)}}",
				"@keyframes agg-swing-b{0%,100%{transform:rotate(24deg)}50%{transform:rotate(-18deg)}}",
				"@keyframes agg-swing-c{0%,100%{transform:rotate(-8deg)}50%{transform:rotate(30deg)}}",
				".agg-spot{position:absolute;border-radius:50%;filter:blur(14px);mix-blend-mode:screen}",
				".agg-spot-a{left:12%;top:16%;width:26%;height:34%;background:radial-gradient(circle,rgba(255,96,196,.5),transparent 66%);",
				"animation:agg-pulse 7s ease-in-out infinite}",
				".agg-spot-b{right:8%;bottom:10%;width:30%;height:38%;background:radial-gradient(circle,rgba(96,214,255,.45),transparent 68%);",
				"animation:agg-pulse 9s ease-in-out infinite reverse}",
				"@keyframes agg-pulse{0%,100%{opacity:.45;transform:scale(.92)}50%{opacity:.9;transform:scale(1.06)}}",
				".agg-floor{position:absolute;left:-10%;right:-10%;bottom:-6%;height:34%;",
				"background:linear-gradient(to top,rgba(255,255,255,.14),transparent);",
				"filter:blur(6px);mix-blend-mode:screen}",
				/* ---- cockpit ---- */
				".agg-cockpit{background:radial-gradient(120% 100% at 50% 0%,#0d1620 0%,#070d14 55%,#04070b 100%)}",
				".agg-hud-grid{position:absolute;inset:0;opacity:.3;",
				"background-image:linear-gradient(rgba(126,214,255,.22) 1px,transparent 1px),",
				"linear-gradient(90deg,rgba(126,214,255,.18) 1px,transparent 1px);",
				"background-size:44px 44px,44px 44px;",
				"-webkit-mask-image:radial-gradient(70% 70% at 50% 50%,#000 20%,transparent 88%);",
				"mask-image:radial-gradient(70% 70% at 50% 50%,#000 20%,transparent 88%)}",
				".agg-hud-horizon{position:absolute;left:6%;right:6%;top:52%;height:1px;background:rgba(140,224,255,.55);",
				"box-shadow:0 0 12px rgba(120,210,255,.55)}",
				".agg-hud-tick{position:absolute;top:52%;width:1px;height:9px;background:rgba(140,224,255,.4)}",
				".agg-hud-reticle{position:absolute;left:50%;top:50%;width:120px;height:120px;margin:-60px 0 0 -60px;",
				"border:1px solid rgba(140,224,255,.4);border-radius:50%}",
				".agg-hud-reticle:before,.agg-hud-reticle:after{content:\"\";position:absolute;background:rgba(140,224,255,.4)}",
				".agg-hud-reticle:before{left:50%;top:-10px;width:1px;height:20px}",
				".agg-hud-reticle:after{top:50%;left:-10px;height:1px;width:20px}",
				".agg-hud-tape{position:absolute;left:3%;top:12%;bottom:12%;width:34px;",
				"background:repeating-linear-gradient(to bottom,rgba(140,224,255,.35) 0 1px,transparent 1px 14px);opacity:.5}",
				".agg-hud-sweep{position:absolute;left:0;right:0;height:24%;",
				"background:linear-gradient(to bottom,transparent,rgba(120,210,255,.12),transparent);",
				"animation:agg-sweep 6s ease-in-out infinite}",
				"@keyframes agg-sweep{0%,100%{top:-10%}50%{top:78%}}",
				/* ---- orbit ---- */
				".agg-orbit{background:radial-gradient(120% 110% at 78% 6%,#0a1426 0%,#050a14 55%,#02040a 100%)}",
				".agg-stars{position:absolute;inset:0;opacity:.85;",
				"background-image:radial-gradient(1.2px 1.2px at 12% 18%,#fff,transparent),",
				"radial-gradient(1px 1px at 34% 62%,#dfe9ff,transparent),",
				"radial-gradient(1.4px 1.4px at 68% 26%,#fff,transparent),",
				"radial-gradient(1px 1px at 86% 54%,#cfe0ff,transparent),",
				"radial-gradient(1.1px 1.1px at 52% 78%,#fff,transparent),",
				"radial-gradient(1px 1px at 22% 86%,#e6f0ff,transparent)",
				"}",
				".agg-earth{position:absolute;left:14%;right:14%;bottom:-56%;height:110%;border-radius:50%;",
				"background:radial-gradient(circle at 38% 26%,#4fb0e8 0%,#2470b8 34%,#123f79 62%,#0a2246 82%,#061428 100%);",
				"box-shadow:0 0 60px rgba(64,164,232,.45),inset -20px -30px 80px rgba(0,0,0,.55)}",
				".agg-earth:after{content:\"\";position:absolute;inset:0;border-radius:50%;",
				"background:radial-gradient(circle at 30% 24%,rgba(255,255,255,.28),transparent 46%)}",
				".agg-atmo{position:absolute;left:10%;right:10%;bottom:-58%;height:112%;border-radius:50%;",
				"box-shadow:0 0 34px 10px rgba(96,186,255,.36);opacity:.85}",
				".agg-sun{position:absolute;right:8%;top:6%;width:16%;height:16%;border-radius:50%;",
				"background:radial-gradient(circle,rgba(255,248,226,.95),rgba(255,214,140,.45) 40%,transparent 70%);",
				"filter:blur(2px);animation:agg-glow 6s ease-in-out infinite}",
				"@keyframes agg-glow{0%,100%{opacity:.72;transform:scale(.96)}50%{opacity:1;transform:scale(1.05)}}",
				/* ---- settings page ---- */
				".agg-section{display:flex;flex-direction:column;gap:18px;padding:4px 2px 28px;",
				"color:var(--dsw-alias-label-primary);font:400 13px/1.6 system-ui,-apple-system,\"Segoe UI\",sans-serif}",
				".agg-section h3{margin:0;font-size:15px;font-weight:600}",
				".agg-section p{margin:0;color:var(--dsw-alias-label-secondary);max-width:62ch}",
				".agg-card{border:1px solid var(--dsw-alias-border-l2);border-radius:14px;padding:14px 16px;",
				"background:var(--dsw-alias-bg-layer-1);display:flex;flex-direction:column;gap:12px}",
				".agg-card-title{font-size:12px;letter-spacing:.04em;text-transform:uppercase;",
				"color:var(--dsw-alias-label-tertiary)}",
				".agg-row{display:flex;align-items:center;justify-content:space-between;gap:16px}",
				".agg-row>span{min-width:96px}",
				".agg-row input[type=range]{flex:1;accent-color:var(--dsw-alias-brand-primary)}",
				".agg-val{min-width:56px;text-align:right;font-variant-numeric:tabular-nums;color:var(--dsw-alias-label-secondary)}",
				".agg-note{font-size:12px;color:var(--dsw-alias-label-tertiary);max-width:64ch}",
				".agg-switch{display:inline-flex;align-items:center;gap:8px;cursor:pointer}",
				".agg-switch input{accent-color:var(--dsw-alias-brand-primary);width:16px;height:16px}",
				".agg-seg{display:flex;flex-wrap:wrap;gap:6px}",
				".agg-btn{border:1px solid var(--dsw-alias-border-l2);background:",
				"color-mix(in srgb,var(--dsw-alias-bg-layer-2) 72%,transparent);color:inherit;border-radius:10px;",
				"padding:5px 11px;font:inherit;cursor:pointer;transition:background .18s ease,border-color .18s ease}",
				".agg-btn:hover{background:var(--dsw-alias-bg-layer-3);border-color:var(--dsw-alias-border-l3)}",
				".agg-btn[data-active=\"1\"]{background:var(--dsw-alias-brand-primary);color:#fff;border-color:transparent}",
				".agg-btn[data-small=\"1\"]{padding:3px 8px;font-size:12px}",
				".agg-key{font:600 11px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.04em;",
				"min-width:74px;text-align:center}",
				".agg-key[data-armed=\"1\"]{border-color:var(--dsw-alias-brand-primary);",
				"box-shadow:0 0 0 2px color-mix(in srgb,var(--dsw-alias-brand-primary) 28%,transparent)}",
				".agg-tiles{display:flex;flex-direction:column;gap:10px;max-height:420px;overflow:auto;padding-right:4px}",
				".agg-tile{display:flex;align-items:center;gap:10px;padding:6px 0;border-top:1px solid var(--dsw-alias-border-l1)}",
				".agg-tile:first-child{border-top:none}",
				".agg-tile-label{min-width:72px;font-size:12px;color:var(--dsw-alias-label-tertiary)}",
				".agg-thumbs{display:flex;flex-wrap:wrap;gap:6px;flex:1;align-items:center}",
				".agg-thumb{position:relative;width:44px;height:44px;border-radius:8px;overflow:hidden;",
				"border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2)}",
				".agg-thumb img{width:100%;height:100%;object-fit:cover;display:block}",
				".agg-thumb-x{position:absolute;right:0;top:0;width:16px;height:16px;display:grid;place-items:center;",
				"border:none;padding:0;cursor:pointer;font:700 10px/1 system-ui,sans-serif;color:#fff;",
				"background:rgba(10,12,18,.72);border-bottom-left-radius:6px}",
				".agg-thumb-x:hover{background:var(--dsw-alias-state-error-primary,#c0392b)}",
				".agg-thumb-empty{width:auto;padding:0 10px;height:44px;display:grid;place-items:center;",
				"font-size:11px;color:var(--dsw-alias-label-tertiary);border:1px dashed var(--dsw-alias-border-l2);",
				"border-radius:8px}",
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
		/* Generated art                                                    */
		/* ---------------------------------------------------------------- */

		function mulberry32(seed) {
			let value = seed >>> 0;
			return () => {
				value = (value + 0x6d2b79f5) >>> 0;
				let t = value;
				t = Math.imul(t ^ (t >>> 15), t | 1);
				t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
				return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
			};
		}

		function hashOf(text) {
			let hash = 2166136261;
			const source = String(text);
			for (let index = 0; index < source.length; index += 1) {
				hash ^= source.charCodeAt(index);
				hash = Math.imul(hash, 16777619);
			}
			return hash >>> 0;
		}

		const PALETTES = [
			[206, 32],
			[268, 316],
			[168, 198],
			[22, 44],
			[190, 258],
			[318, 26],
			[140, 178],
			[248, 292],
		];

		const ART_CACHE = new Map();

		function generateArt(seedText, variant) {
			const key = `${seedText}:${variant}`;
			if (ART_CACHE.has(key)) return ART_CACHE.get(key);
			let url = "";
			try {
				const canvas = document.createElement("canvas");
				const width = 640;
				const height = 460;
				canvas.width = width;
				canvas.height = height;
				const g = canvas.getContext("2d");
				const random = mulberry32(hashOf(`${seedText}:${variant}`));
				const palette = PALETTES[Math.floor(random() * PALETTES.length)];
				const hueA = palette[0] + random() * 12;
				const hueB = palette[1] + random() * 12;

				const backdrop = g.createLinearGradient(0, 0, width, height);
				backdrop.addColorStop(0, `hsl(${hueA} 46% 22%)`);
				backdrop.addColorStop(0.55, `hsl(${(hueA + hueB) / 2} 52% 30%)`);
				backdrop.addColorStop(1, `hsl(${hueB} 44% 18%)`);
				g.fillStyle = backdrop;
				g.fillRect(0, 0, width, height);

				for (let index = 0; index < 3; index += 1) {
					const pool = g.createRadialGradient(
						random() * width,
						random() * height,
						0,
						random() * width,
						random() * height,
						width * (0.3 + random() * 0.5),
					);
					pool.addColorStop(0, `hsla(${index % 2 === 0 ? hueB : hueA} 88% 70% / 0.42)`);
					pool.addColorStop(1, "rgba(0,0,0,0)");
					g.fillStyle = pool;
					g.fillRect(0, 0, width, height);
				}

				const motif = variant % 3;
				if (motif === 0) {
					for (let index = 0; index < 5; index += 1) {
						g.beginPath();
						g.arc(
							random() * width,
							random() * height,
							(0.12 + index * 0.09) * width * (0.7 + random() * 0.6),
							0,
							Math.PI * 2,
						);
						g.strokeStyle = `hsla(${hueB} 85% ${74 - index * 4}% / ${0.1 + random() * 0.1})`;
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
						g.strokeStyle = `hsla(${hueA} 80% 70% / 0.12)`;
						g.lineWidth = 18 + index * 6;
						g.stroke();
					}
					g.restore();
				}

				for (let index = 0; index < 240; index += 1) {
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

		function generatedFrames(tileKey) {
			const out = [];
			for (let variant = 0; variant < GENERATED_VARIANTS; variant += 1) {
				const url = generateArt(tileKey, variant);
				if (url !== "") out.push({ id: `gen-${tileKey}-${variant}`, kind: "image", url, name: "", ext: "" });
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
			toast: "",
			/**
			 * Whether the video tile is currently muted out of existence.
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

		function useStore() {
			const [, force] = useState(0);
			useEffect(() => {
				const off = subscribe(() => force((value) => value + 1));
				return () => {
					off();
				};
			}, []);
			return STORE;
		}

		/**
		 * The shortcut's whole job: flip the video tile in and out of the
		 * wall. Pausing does not hide the tile — it hands the tile back to
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

		function endpoint(path) {
			try {
				return new URL(`${BASE}${path}`, document.baseURI).pathname;
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

		async function importFiles(tileKey, fileList) {
			const files = [...(fileList ?? [])].filter(Boolean);
			if (files.length === 0) return;
			// A full tile is not a dead end: the picks still go in and the
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
			// Newest wins: the tile is a rolling window, so the pictures just
			// picked are the ones that stay and the oldest rotate out. Keeping
			// the head instead would look like the pick silently failed.
			const merged = [...(nextTiles[tileKey]?.frames ?? []), ...added].slice(-MAX_FRAMES);
			nextTiles[tileKey] = { frames: merged };
			STORE.profile = { config: config(), tiles: nextTiles };
			emit();
			await persist({ tiles: nextTiles });
		}

		async function removeFrame(tileKey, frameId) {
			const nextTiles = { ...tiles() };
			const frames = (nextTiles[tileKey]?.frames ?? []).filter((frame) => frame.id !== frameId);
			if (frames.length === 0) delete nextTiles[tileKey];
			else nextTiles[tileKey] = { frames };
			STORE.profile = { config: config(), tiles: nextTiles };
			emit();
			await persist({ tiles: nextTiles });
			// The Host owns the bytes; ask it to drop them, but never let a
			// missing file turn a successful removal into an error.
			try {
				await fetch(endpoint(`/remove?id=${encodeURIComponent(frameId)}`), { method: "POST" });
			} catch {}
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
		 * Every tile starts its own timer with a small deterministic offset, so
		 * the wall ripples instead of blinking in unison — the difference between
		 * "a wall of pictures" and "a wall of metronomes".
		 */
		function useRotation(length, intervalMs, tileKey, paused) {
			const [state, setState] = useState({ current: 0, previous: -1, epoch: 0 });

			useEffect(() => {
				setState({ current: 0, previous: -1, epoch: 0 });
			}, [tileKey]);

			useEffect(() => {
				if (paused || length <= 1) return undefined;
				let timer = null;
				let cancelled = false;
				const offset = (hashOf(tileKey) % 7) * 0.11;
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
			}, [length, intervalMs, tileKey, paused]);

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

		/** How each shape is cut out of its rectangle. */
		const SHAPE_CSS = {
			rect: (radius) => ({ borderRadius: `${radius}px` }),
			square: (radius) => ({ borderRadius: `${radius}px` }),
			circle: () => ({ borderRadius: "50%" }),
			triangle: () => ({ clipPath: "polygon(50% 0%,100% 100%,0% 100%)" }),
			diamond: () => ({ clipPath: "polygon(50% 0%,100% 50%,50% 100%,0% 50%)" }),
			hexagon: () => ({ clipPath: "polygon(25% 2%,75% 2%,100% 50%,75% 98%,25% 98%,0% 50%)" }),
		};

		/** Shapes want their own proportions; circles and squares want 1:1. */
		function aspectsFor(shape) {
			if (shape === "square" || shape === "circle" || shape === "diamond") return [1];
			if (shape === "triangle" || shape === "hexagon") return [1.1, 1.25];
			return [4 / 3, 3 / 2, 5 / 4];
		}

		/**
		 * Photos pinned to a wall, not cells in a table. Each one is dropped
		 * at a hand-set spot inside the band with its own size and tilt, and
		 * rejection sampling keeps them from touching. When the band is too
		 * crowded for the requested count the tiles shrink a little on every
		 * failed sweep rather than overlap — an ornament, never a mosaic, and
		 * nothing ever lines up with anything else.
		 */
		function placements(count, gap, shape) {
			const random = mulberry32(hashOf(`photos:${count}:${shape}`));
			const ASPECTS = aspectsFor(shape);
			// Room to breathe is what makes it read as decor. It scales very
			// gently with the gap control so the slider stays useful.
			const breath = 1.1 + Math.min(3.6, gap * 0.07);
			const places = [];
			let width = 15;
			for (let index = 0; index < count; index += 1) {
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

		function PictureTile(props) {
			const { tileKey, shape, place } = props;
			const store = useStore();
			const current = config();
			const visible = useDocumentVisible();
			const reduced = useReducedMotion();

			const frames = tiles()[tileKey]?.frames ?? null;
			const [art, setArt] = useState(null);

			// The shortcut hides the video without hiding the tile: it falls
			// back to whatever pictures it also holds, and if it holds none it
			// gets generated art — so a paused video tile keeps taking part in
			// the wall exactly like every other tile.
			const videoHidden = store.videoPaused === true;
			const framesHaveStills = frames !== null && frames.some((frame) => frame.kind !== "video");
			const needsArt = frames === null || frames.length === 0 || (videoHidden && !framesHaveStills);

			// Generated art is rasterised on the next frame rather than during
			// the first render: twenty canvases inline would delay the paint.
			useEffect(() => {
				if (!needsArt) {
					setArt(null);
					return undefined;
				}
				let alive = true;
				const handle = window.requestAnimationFrame(() => {
					if (alive) setArt(generatedFrames(tileKey));
				});
				return () => {
					alive = false;
					window.cancelAnimationFrame(handle);
				};
			}, [tileKey, needsArt]);

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

			const rotation = useRotation(stills.length, current.intervalMs, tileKey, reduced || !visible);
			const active = stills[rotation.current] ?? null;
			const previous = stills[rotation.previous] ?? null;

			const tileStyle = {
				...SHAPE_CSS[shape]?.(current.radius),
				opacity: current.opacity,
				mixBlendMode: current.blend,
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

			return h(
				"div",
				{
					className: "agg-cell",
					style: tileStyle,
					"aria-hidden": "true",
					"data-shape": shape,
				},
				children,
			);
		}

		/** The one rectangular screen every scenery mode keeps free for video. */
		const SCREEN_PLACE = { left: 58, top: 14, width: 30, height: 20 };

		function VideoScreen(props) {
			const { frame, opacity, blend } = props;
			const children = [];
			if (frame !== null && frame !== undefined) {
				children.push(
					h("video", {
						key: "video",
						src: frame.url,
						autoPlay: true,
						muted: true,
						loop: true,
						playsInline: true,
						preload: "metadata",
					}),
				);
				children.push(h("div", { key: "scan", className: "agg-screen-scan" }));
			} else {
				children.push(h("div", { key: "empty", className: "agg-screen-empty" }, translate("screen.empty")));
				children.push(h("div", { key: "scan", className: "agg-screen-scan" }));
			}
			return h(
				"div",
				{
					className: "agg-screen",
					style: {
						left: `${SCREEN_PLACE.left}%`,
						top: `${SCREEN_PLACE.top}%`,
						width: `${SCREEN_PLACE.width}%`,
						height: `${SCREEN_PLACE.height}%`,
						opacity,
						mixBlendMode: blend,
					},
					"aria-hidden": "true",
				},
				children,
			);
		}

		function Scenery(props) {
			const { mode } = props;
			if (mode === "karaoke") {
				return h(
					"div",
					{ className: "agg-mode agg-karaoke", "aria-hidden": "true" },
					h("div", { className: "agg-beam agg-beam-a" }),
					h("div", { className: "agg-beam agg-beam-b" }),
					h("div", { className: "agg-beam agg-beam-c" }),
					h("div", { className: "agg-spot agg-spot-a" }),
					h("div", { className: "agg-spot agg-spot-b" }),
					h("div", { className: "agg-floor" }),
				);
			}
			if (mode === "cockpit") {
				const ticks = [];
				for (let index = 0; index < 9; index += 1) {
					ticks.push(h("div", { key: `tick-${index}`, className: "agg-hud-tick", style: { left: `${10 + index * 10}%` } }));
				}
				return h(
					"div",
					{ className: "agg-mode agg-cockpit", "aria-hidden": "true" },
					h("div", { className: "agg-hud-grid" }),
					h("div", { className: "agg-hud-horizon" }),
					...ticks,
					h("div", { className: "agg-hud-reticle" }),
					h("div", { className: "agg-hud-tape" }),
					h("div", { className: "agg-hud-sweep" }),
				);
			}
			return h(
				"div",
				{ className: "agg-mode agg-orbit", "aria-hidden": "true" },
				h("div", { className: "agg-stars" }),
				h("div", { className: "agg-sun" }),
				h("div", { className: "agg-atmo" }),
				h("div", { className: "agg-earth" }),
			);
		}

		function Wall() {
			const store = useStore();
			const current = config();

			useEffect(() => {
				void fetchProfile();
			}, []);

			// One shortcut, one meaning: it flips the video tile between
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

			const count = Math.max(1, Math.round(current.count ?? 20));
			// The band keeps the ornament off the reading gutters: 20% to 80%
			// of the panel's width by default, and always at least a sliver.
			const bandLeft = Math.min(Math.max(0, Number(current.bandLeft ?? 20)), 60);
			const bandRight = Math.min(Math.max(bandLeft + 10, Number(current.bandRight ?? 80)), 100);
			const mode = MODES.includes(current.mode) ? current.mode : "gallery";
			const shape = SHAPES.includes(current.shape) ? current.shape : "rect";
			const showWall = current.visible !== false;

			const gallery = useMemo(() => {
				if (mode !== "gallery") return { places: [], threads: [], tiles: [] };
				const places = placements(count, current.gap, shape);
				const threads = [];
				const tiles = [];
				for (let index = 0; index < places.length; index += 1) {
					const place = places[index];
					threads.push(
						h("div", {
							key: `thread-${index}`,
							className: "agg-thread",
							style: { left: `${place.cx}%`, height: `${place.top}%` },
						}),
					);
					tiles.push(
						h(PictureTile, {
							key: index,
							tileKey: String(index),
							shape,
							place,
						}),
					);
				}
				return { places, threads, tiles };
			}, [mode, count, current.gap, shape]);

			// Scenery modes still honour the shortcut: one video, wherever it
			// was put, is what the little screen shows.
			const videoFrame = useMemo(() => {
				if (store.videoPaused === true) return null;
				const all = Object.values(tiles());
				for (const tile of all) {
					const found = (tile?.frames ?? []).find((frame) => frame.kind === "video");
					if (found !== undefined) return found;
				}
				return null;
			}, [store.profile, store.videoPaused]);

			const body =
				mode === "gallery"
					? [...gallery.threads, ...gallery.tiles]
					: [
							h(Scenery, { key: "scenery", mode }),
							h(VideoScreen, {
								key: "screen",
								frame: videoFrame,
								opacity: Math.min(1, current.opacity + 0.16),
								blend: current.blend,
							}),
						];

			return h(
				"div",
				{ className: "agg-root", "data-agg": "root", "data-mode": mode },
				showWall
					? h(
							"div",
							{
								className: "agg-wall",
								style: {
									left: `${bandLeft}%`,
									right: `${100 - bandRight}%`,
									opacity: 1,
									visibility: "visible",
								},
							},
							body,
						)
					: null,
				store.toast !== "" ? h("div", { className: "agg-toast" }, store.toast) : null,
			);
		}

		function Field(props) {
			const { label, value, min, max, step, onChange, format: showValue } = props;
			return h(
				"label",
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

		function Segmented(props) {
			const { options, value, onSelect } = props;
			return h(
				"div",
				{ className: "agg-seg" },
				options.map((option) =>
					h(
						"button",
						{
							key: option.id,
							type: "button",
							className: "agg-btn",
							"data-active": option.id === value ? "1" : "0",
							onClick: () => onSelect(option.id),
						},
						translate(option.label),
					),
				),
			);
		}

		/**
		 * The per-photo manager. Every frame is a thumbnail with its own ×;
		 * every tile has its own "add pictures" / "add a video" pair. This is
		 * the only place the wall is edited, which is what removes the need
		 * for a floating panel over the app.
		 */
		function TileManager(props) {
			const { count } = props;
			const fileRef = useRef(null);
			const pending = useRef({ tileKey: "", mode: "image" });
			const currentTiles = tiles();

			const pick = (tileKey, mode) => {
				pending.current = { tileKey, mode };
				const input = fileRef.current;
				if (input !== null && input !== undefined) {
					input.accept = mode === "video" ? "video/*" : "image/*";
					input.value = "";
					input.click();
				}
			};

			const onFiles = (event) => {
				const files = event.target?.files;
				const { tileKey } = pending.current;
				if (files !== null && files !== undefined && files.length > 0 && tileKey !== "") {
					void importFiles(tileKey, files);
				}
				try {
					event.target.value = "";
				} catch {}
			};

			const rows = [];
			for (let index = 0; index < count; index += 1) {
				const tileKey = String(index);
				const frames = currentTiles[tileKey]?.frames ?? [];
				const thumbs = frames.map((frame) =>
					h(
						"div",
						{ key: frame.id, className: "agg-thumb", title: frame.name || translate("wall.generated") },
						typeof frame.url === "string" && frame.url !== ""
							? h("img", { src: frame.url, alt: "", draggable: false })
							: null,
						h(
							"button",
							{
								type: "button",
								className: "agg-thumb-x",
								title: translate("photos.remove"),
								onClick: () => {
									void removeFrame(tileKey, frame.id);
								},
							},
							"×",
						),
					),
				);
				if (frames.length === 0) {
					thumbs.push(h("div", { key: "empty", className: "agg-thumb-empty" }, translate("photos.empty")));
				}
				rows.push(
					h(
						"div",
						{ key: tileKey, className: "agg-tile", "data-tile": tileKey },
						h("span", { className: "agg-tile-label" }, format(translate("photos.cell"), { index: index + 1 })),
						h("div", { className: "agg-thumbs" }, thumbs),
						h(
							"div",
							{ style: { display: "flex", gap: "6px", flexShrink: 0 } },
							h(
								"button",
								{ type: "button", className: "agg-btn", "data-small": "1", onClick: () => pick(tileKey, "image") },
								h(IconPlus, { size: 11 }),
								h("span", { style: { marginLeft: "4px" } }, translate("photos.addImage")),
							),
							h(
								"button",
								{ type: "button", className: "agg-btn", "data-small": "1", onClick: () => pick(tileKey, "video") },
								h(IconVideo, { size: 11 }),
								h("span", { style: { marginLeft: "4px" } }, translate("photos.addVideo")),
							),
						),
					),
				);
			}

			return h(
				"div",
				{ className: "agg-card" },
				h("div", { className: "agg-card-title" }, translate("photos.title")),
				h("div", { className: "agg-note" }, translate("photos.hint")),
				h("input", { ref: fileRef, type: "file", multiple: true, style: { display: "none" }, onChange: onFiles }),
				h("div", { className: "agg-tiles" }, rows),
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

			const count = Math.max(1, Math.round(current.count ?? 20));
			const mode = MODES.includes(current.mode) ? current.mode : "gallery";

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
					h(
						"div",
						{ className: "agg-row" },
						h("span", null, translate("ctl.mode")),
						h(Segmented, {
							options: MODES.map((id) => ({ id, label: `mode.${id}` })),
							value: mode,
							onSelect: (id) => updateConfig({ mode: id }),
						}),
					),
					mode === "gallery"
						? h(
								"div",
								{ className: "agg-row" },
								h("span", null, translate("ctl.shape")),
								h(Segmented, {
									options: SHAPES.map((id) => ({ id, label: `shape.${id}` })),
									value: SHAPES.includes(current.shape) ? current.shape : "rect",
									onSelect: (id) => updateConfig({ shape: id }),
								}),
							)
						: null,
					h(Field, {
						label: translate("ctl.count"),
						value: count,
						min: 3,
						max: 24,
						step: 1,
						onChange: (value) => updateConfig({ count: value }),
					}),
					h(Field, {
						label: translate("ctl.bandLeft"),
						value: Math.round(current.bandLeft ?? 20),
						min: 0,
						max: 60,
						step: 1,
						onChange: (value) => updateConfig({ bandLeft: Math.min(value, Math.round(current.bandRight ?? 80) - 10) }),
						format: (value) => `${value}%`,
					}),
					h(Field, {
						label: translate("ctl.bandRight"),
						value: Math.round(current.bandRight ?? 80),
						min: 40,
						max: 100,
						step: 1,
						onChange: (value) => updateConfig({ bandRight: Math.max(value, Math.round(current.bandLeft ?? 20) + 10) }),
						format: (value) => `${value}%`,
					}),
					h(Field, {
						label: translate("ctl.opacity"),
						value: Math.round(current.opacity * 100),
						min: 0,
						max: 100,
						step: 1,
						onChange: (value) => updateConfig({ opacity: value / 100 }),
						format: (value) => `${value}%`,
					}),
					h(Field, {
						label: translate("ctl.blur"),
						value: current.blur,
						min: 0,
						max: 24,
						step: 1,
						onChange: (value) => updateConfig({ blur: value }),
						format: (value) => `${value}px`,
					}),
					h(Field, {
						label: translate("ctl.gap"),
						value: current.gap,
						min: 0,
						max: 64,
						step: 2,
						onChange: (value) => updateConfig({ gap: value }),
						format: (value) => `${value}px`,
					}),
					h(Field, {
						label: translate("ctl.radius"),
						value: current.radius,
						min: 0,
						max: 48,
						step: 2,
						onChange: (value) => updateConfig({ radius: value }),
						format: (value) => `${value}px`,
					}),
					h(Field, {
						label: translate("ctl.interval"),
						value: Math.round(current.intervalMs / 1000),
						min: 2,
						max: 60,
						step: 1,
						onChange: (value) => updateConfig({ intervalMs: value * 1000 }),
						format: (value) => `${value}s`,
					}),
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
						h("span", null, translate("ctl.videoKey")),
						h(KeyRecorder, {
							value: normalizeVideoKey(current.videoKey),
							onChange: (value) => updateConfig({ videoKey: value }),
						}),
					),
				),
				h(TileManager, { count }),
				h(
					"div",
					{ className: "agg-card" },
					h(
						"div",
						{ className: "agg-row" },
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
