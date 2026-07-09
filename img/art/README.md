# TypeQuest Lost Legends Pack — land export (lost-legends)

Portable, engine-neutral art bundle produced by `npm run export-land`. Format
`cesarfc-land-pack`. 38 assets (26 props, 12 icons).

## Layout
- `props/<id>.png` — placeable world objects (transparent PNG, alpha-trimmed + 8px pad).
- `icons/<id>.png` — centered UI/HUD emblems (transparent PNG, square-ish).
- `manifest.json` — the index (below).

## manifest.json
```
{ "format": "cesarfc-land-pack", "version", "style",
  "assets": [ { "id", "kind", "biome", "file", "wpx", "hpx", "footprint", "anchor", "tags" } ] }
```
- `file` is relative to this folder — use it directly as an `<img src>` or a CSS
  `background-image`.
- `wpx`/`hpx` are the exported pixel dimensions (already padded).
- `footprint` is the prop's grid size `[w,h]` in tiles (icons default `[1,1]`).
- `anchor` is the normalized origin. For props it is the FEET (`[0.5, 1]` = bottom-center):
  place the sprite so `anchor` sits on the target tile. Icons have `anchor: null`
  (draw centered, they are not grounded).
- `tags` are free-string hints (e.g. `structure`, `flora`, `reward`).

## Consuming in vanilla JS
```js
const pack = await (await fetch("./manifest.json")).json();
const byId = Object.fromEntries(pack.assets.map(a => [a.id, a]));
const a = byId["tq-bubbly-tree"];
const img = new Image();
img.src = "./" + a.file;              // props/tq-bubbly-tree.png
// draw so the feet (anchor) land on tile (tx,ty), tileSize px:
img.onload = () => ctx.drawImage(img,
  tx * tileSize - a.wpx * a.anchor[0],
  ty * tileSize - a.hpx * a.anchor[1]);
```
Icons: `<img src="icons/tq-trophy.png">` or a CSS `background-image`, drawn centered.
