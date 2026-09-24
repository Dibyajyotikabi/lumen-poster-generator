# Lumen — Poster & Thumbnail Studio

A fast, local studio for YouTube thumbnails, blog featured images, LinkedIn banners and social posts.

## Features

- **Unlimited text** — any number of text layers, any length. Drag, resize and snap on the canvas; wrap a word in `*stars*` to highlight it.
- **1,900+ live Google fonts** — searchable, previewed in your own words, with hover-to-preview on the canvas.
- **Auto-style** — reads your text's mood and picks a font pairing, palette and light style.
- **Generated backgrounds** — 12 light styles (aura, spotlight, rays, eclipse, blur, aurora, waves, rings, halftone, grid, mesh, plain) with grain and vignette.
- **Wallpaper & images** — use your macOS wallpaper, the macOS wallpaper library, or any uploaded / pasted / dropped image, with blur, dim, zoom and colour matching.
- **Background removal** — one click removes the background (U²-Net), then click to keep the product or remove a hand, text or logo (SlimSAM). Runs privately in your browser; nothing is uploaded.
- **Links** — paste any link (⌘V): the page's image becomes a soft, blurred backdrop with matched colours, plus a beautiful link card (card, compact or minimal). Works with articles, YouTube, GitHub and more.
- **Profiles** — save multiple people (LinkedIn, X, GitHub, YouTube, Instagram, website) with photos; show them as chip, card, hero or avatar.
- **Text effects** — shadow, glow, outline, 3D, fade, pill and marker backgrounds.
- **Layouts, undo/redo, export** — one-click layouts, 9 size presets + custom, PNG/JPG/WebP at 1× or 2×.

## Run

Requires Node 20+ (no dependencies). Mac wallpaper features require running locally on macOS; everything else also works on the hosted version (Vercel serverless functions in `api/`).

```bash
npm start
```

Then open http://localhost:5173.

## Test

```bash
npm test
```

## Shortcuts

`T` text · `A` auto-style · `G` new light · `⌘Z` undo · `⌘D` duplicate · `⌘S` export · arrows nudge · `Delete` remove

## License

MIT © Dibyajyoti Kabi

## Credits

Background removal uses [U²-Net](https://github.com/xuebinqin/U-2-Net) (Apache-2.0) and [SlimSAM](https://huggingface.co/Xenova/slimsam-77-uniform) (Apache-2.0) via ONNX Runtime Web and Transformers.js. Fonts from Google Fonts via Fontsource.
