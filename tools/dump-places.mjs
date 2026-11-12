// Dump the geometry produced by the real placements() function.
//
// The wall's arrangement lives inside lib/client.js (a browser bundle that
// cannot be imported directly). Rather than re-implement the maths — which
// would drift from the shipped code the moment either side changes — this
// extracts the three pure functions by brace matching and evaluates them.
//
// Usage: node tools/dump-places.mjs [count ...]   (default: 5 8 12)
// Writes tools/_places.json, which tools/preview-layout.py draws.
import fs from "node:fs";

const SOURCE = new URL("../lib/client.js", import.meta.url);
const OUTPUT = new URL("./_places.json", import.meta.url);

function extract(source, name) {
	const start = source.indexOf(`function ${name}(`);
	if (start < 0) throw new Error(`function ${name} not found in lib/client.js`);
	let depth = 0;
	for (let i = source.indexOf("{", start); i < source.length; i += 1) {
		if (source[i] === "{") depth += 1;
		else if (source[i] === "}") {
			depth -= 1;
			if (depth === 0) return source.slice(start, i + 1);
		}
	}
	throw new Error(`unbalanced braces in ${name}`);
}

const source = fs.readFileSync(SOURCE, "utf8");
const body = ["mulberry32", "hashOf", "placements"].map((name) => extract(source, name)).join("\n");
const { placements } = new Function(`${body}\nreturn { placements };`)();

const counts = process.argv.slice(2).map(Number).filter((n) => Number.isFinite(n) && n > 0);
const wanted = counts.length > 0 ? counts : [5, 8, 12];

const dump = {};
for (const count of wanted) dump[count] = placements(count, 18);
fs.writeFileSync(OUTPUT, JSON.stringify(dump));

console.log(
	`tools/_places.json: ${wanted.map((n) => `${n} -> ${dump[n].length} photos`).join(", ")}`,
);
