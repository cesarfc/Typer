# Art credits

TypeQuest's code and SVG artwork (trainer characters, map structures in
`js/sprites.js`, all UI) are original to this project.

## Lost Legends art pack (`img/art/`)

The map buildings, props, decor and UI/HUD icons in the "Lost Legends"
flat-cartoon style are **original art generated through our own pipeline**
(`~/Projects/cesarfc/Characters` land export, `cesarfc-land-pack` format,
`lost-legends` style — see `img/art/manifest.json` and `img/art/README.md`).
They belong to this project. Consumed as transparent PNGs via `artSprite`
/ `artIcon` in `js/sprites.js`.

## Pixel tilesheets (`img/tiles/`) — no longer displayed

- `buildings.png` and `setpieces.png` — pixel art by **Kelvin Shadewing**
  (buildings, fountain, bushes, pines, mushrooms, rocks, bench), obtained via
  the open-source [Tuxemon](https://github.com/Tuxemon/Tuxemon) project
  (`mods/tuxemon/gfx/tilesets/`, files `KelvinShadewing_Buildings.png` and
  `Set_Pieces_by_Kelvin_Shadewing.png`). Used and redistributed with
  attribution per the artist's free-use license; see
  [kelvinshadewing.net](https://kelvinshadewing.net) and the Tuxemon
  repository for license details. Thank you!
- As of the Lost Legends restyle these pixel tiles are **no longer shown** —
  every map tile now renders the Lost Legends art above. The `tileSprite`
  code path and files are kept only as a broken-image fallback (`data-fb`).

## Pokemon artwork (`img/pokemon/`, not in the repository)

Official Pokemon artwork is downloaded locally by `tools/get-sprites.mjs`
from the community [PokeAPI sprites](https://github.com/PokeAPI/sprites)
repository for personal use, and is deliberately **not** committed here —
that artwork belongs to Nintendo / The Pokemon Company.
