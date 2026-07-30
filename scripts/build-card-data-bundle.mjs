import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "..");
const dataDirectory = path.join(projectRoot, "data", "cards");
const outputFile = path.join(projectRoot, "js", "cards", "cardDataBundle.js");
const files = [
    "characters.json",
    "stages.json",
    "events.json",
    "leaders.json",
    "onepiece.json"
];

const bundle = {};

for (const file of files) {
    bundle[file] = JSON.parse(
        await readFile(path.join(dataDirectory, file), "utf8")
    );
}

const output = [
    "// Generated from data/cards/*.json for file:// and offline use.",
    `window.CARD_DATA_BUNDLE = ${JSON.stringify(bundle)};`,
    ""
].join("\n");

await writeFile(outputFile, output, "utf8");
