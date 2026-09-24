// Tweet / X post card — full text (never truncated), photos, quote, date and stats.
import {
  ui, mono, applyFont, roundRectPath, shell, cardPalette, framedImage, circleImage, verifiedBadge, drawLogo,
  lines, fillLines, formatCount, formatDate, clamp, aspectOf, LINK_BLUE,
} from './kit.js';
import { breakWord } from '../../core/layout.js';

export const TWEET_NOMINAL = 600;
const NOMINAL = TWEET_NOMINAL;
const SIDE_BY_SIDE = 1.45; // card this much wider than nominal (in type units) → text left, photos right
const TOKEN_RE = /(\s+)/;
const LINKISH = /^(@\w+|#\w+|\$[A-Za-z]{1,6}\b|https?:\/\/\S+|[\w-]+\.(com|io|ai|dev|app|org|net|co)(\/\S*)?)/i;
const shortUrl = (t) => (/^https?:\/\//i.test(t) ? t.replace(/^https?:\/\/(www\.)?/i, '').replace(/(.{26}).+/, '$1…') : t);

/** Wraps rich text into lines of coloured tokens; newlines are preserved. */
function richLines(ctx, text, maxWidth) {
  const out = [];
  String(text)
    .split('\n')
    .forEach((para) => {
      const measure = (s) => ctx.measureText(s).width;
      const tokens = para
        .split(TOKEN_RE)
        .filter((t) => t !== '')
        .flatMap((t) => (/^\s+$/.test(t) || measure(shortUrl(t)) <= maxWidth ? [t] : breakWord(shortUrl(t), maxWidth, measure)));
      let line = [];
      let width = 0;
      tokens.forEach((raw) => {
        const space = /^\s+$/.test(raw);
        const shown = space ? ' ' : shortUrl(raw);
        const w = ctx.measureText(shown).width;
        if (!space && width + w > maxWidth && line.length) {
          out.push(line);
          line = [];
          width = 0;
        }
        if (space && !line.length) return;
        line.push({ text: shown, link: !space && LINKISH.test(raw) });
        width += w;
      });
      out.push(line);
    });
  while (out.length && !out[out.length - 1].length) out.pop();
  return out;
}

const ICONS = {
  replies: (ctx, x, y, s) => {
    ctx.beginPath();
    ctx.moveTo(x + s * 0.2, y + s * 0.9);
    ctx.lineTo(x + s * 0.28, y + s * 0.68);
    ctx.arc(x + s * 0.55, y + s * 0.45, s * 0.38, Math.PI * 0.75, Math.PI * 2.55);
    ctx.closePath();
    ctx.stroke();
  },
  reposts: (ctx, x, y, s) => {
    ctx.beginPath();
    ctx.moveTo(x + s * 0.18, y + s * 0.62);
    ctx.lineTo(x + s * 0.18, y + s * 0.28);
    ctx.lineTo(x + s * 0.72, y + s * 0.28);
    ctx.moveTo(x + s * 0.58, y + s * 0.14);
    ctx.lineTo(x + s * 0.72, y + s * 0.28);
    ctx.lineTo(x + s * 0.58, y + s * 0.42);
    ctx.moveTo(x + s * 0.82, y + s * 0.38);
    ctx.lineTo(x + s * 0.82, y + s * 0.72);
    ctx.lineTo(x + s * 0.28, y + s * 0.72);
    ctx.moveTo(x + s * 0.42, y + s * 0.58);
    ctx.lineTo(x + s * 0.28, y + s * 0.72);
    ctx.lineTo(x + s * 0.42, y + s * 0.86);
    ctx.stroke();
  },
  likes: (ctx, x, y, s) => {
    ctx.beginPath();
    ctx.moveTo(x + s * 0.5, y + s * 0.86);
    ctx.bezierCurveTo(x - s * 0.1, y + s * 0.45, x + s * 0.2, y - s * 0.05, x + s * 0.5, y + s * 0.3);
    ctx.bezierCurveTo(x + s * 0.8, y - s * 0.05, x + s * 1.1, y + s * 0.45, x + s * 0.5, y + s * 0.86);
    ctx.stroke();
  },
  views: (ctx, x, y, s) => {
    ctx.beginPath();
    [[0.2, 0.55], [0.42, 0.2], [0.64, 0.4], [0.86, 0.1]].forEach(([dx, top]) => {
      ctx.moveTo(x + s * dx, y + s * 0.88);
      ctx.lineTo(x + s * dx, y + s * top);
    });
    ctx.stroke();
  },
};

function mediaLayout(images, width, gap) {
  const n = images.length;
  if (!n) return { h: 0, cells: [] };
  if (n === 1) {
    const h = width / clamp(aspectOf(images[0], 16 / 9), 0.75, 2.2);
    return { h, cells: [{ x: 0, y: 0, w: width, h }] };
  }
  const half = (width - gap) / 2;
  if (n === 2) {
    const h = half * 1.15;
    return { h, cells: [{ x: 0, y: 0, w: half, h }, { x: half + gap, y: 0, w: half, h }] };
  }
  const h = width * 0.62;
  const rowH = (h - gap) / 2;
  if (n === 3) return { h, cells: [{ x: 0, y: 0, w: half, h }, { x: half + gap, y: 0, w: half, h: rowH }, { x: half + gap, y: rowH + gap, w: half, h: rowH }] };
  return { h, cells: [0, 1, 2, 3].map((i) => ({ x: (i % 2) * (half + gap), y: Math.floor(i / 2) * (rowH + gap), w: half, h: rowH })) };
}

/** Returns { h, paint(box) } for a tweet card of width `w`. */
export function layoutTweet(ctx, layer, w, assets, env, k = w / NOMINAL) {
  const t = layer.tweet ?? { text: layer.description, author: { name: layer.title, handle: '' }, media: [] };
  const pal = cardPalette(layer.cardTheme ?? 'light', env.theme);
  const pad = 32 * k;
  const full = w - pad * 2;
  const images = layer.showMedia === false ? [] : (assets.media ?? []).filter(Boolean);
  const side = images.length > 0 && w / k > NOMINAL * SIDE_BY_SIDE;
  const colGap = 28 * k;
  const inner = side ? (full - colGap) * 0.56 : full;
  const mediaW = side ? full - colGap - inner : full;
  const avatar = 60 * k;
  const textSize = (t.text.length > 420 ? 22 : 26) * k;
  const textLH = 1.36;

  applyFont(ctx, ui(400), textSize);
  const body = richLines(ctx, t.text, inner);
  const media = mediaLayout(images, mediaW, 6 * k);

  const quote = t.quote && t.quote.text ? t.quote : null;
  const quoteSize = 19 * k;
  applyFont(ctx, ui(400), quoteSize);
  const quoteLines = quote ? lines(ctx, quote.text, inner - 36 * k, 6) : [];
  const quoteH = quote ? 24 * k + 26 * k + quoteLines.length * quoteSize * 1.36 + 10 * k : 0;

  const date = layer.showDate === false ? '' : formatDate(t.createdAt);
  const stats = layer.showStats === false || !t.stats ? [] : ['replies', 'reposts', 'likes', 'views'].filter((key) => Number.isFinite(t.stats[key]));

  const headerH = avatar;
  const bodyH = body.length * textSize * textLH;
  const gap = 20 * k;
  let column = headerH + gap + bodyH;
  if (media.h && !side) column += gap + media.h;
  if (quoteH) column += gap + quoteH;
  if (date) column += gap + 22 * k;
  if (stats.length) column += 18 * k + 1 + 18 * k + 24 * k;
  const h = pad * 2 + Math.max(column, side ? media.h : 0);

  return {
    h,
    paint(box) {
      shell(ctx, box, 30 * k, pal, env.u);
      const x = box.x + pad;
      let y = box.y + (box.h - column) / 2; // centred next to photos in side-by-side mode

      // header
      circleImage(ctx, assets.avatar, x, y, avatar, t.author.name, LINK_BLUE);
      const nx = x + avatar + 14 * k;
      applyFont(ctx, ui(700), 23 * k, -0.01);
      ctx.fillStyle = pal.text;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      const maxName = inner - avatar - 14 * k - 60 * k;
      const [name] = lines(ctx, t.author.name ?? '', maxName, 1);
      ctx.fillText(name, nx, y + avatar * 0.3);
      if (t.author.verified) verifiedBadge(ctx, nx + ctx.measureText(name).width + 6 * k, y + avatar * 0.3 - 10 * k, 20 * k);
      applyFont(ctx, ui(400), 19 * k);
      ctx.fillStyle = pal.muted;
      ctx.fillText(t.author.handle ? `@${t.author.handle}` : 'x.com', nx, y + avatar * 0.74);
      drawLogo(ctx, 'x', x + inner - 26 * k, y + 4 * k, 26 * k, pal.text);
      if (side) {
        const mx = x + inner + colGap;
        const my = box.y + (box.h - media.h) / 2;
        media.cells.forEach((c, i) => framedImage(ctx, images[i], mx + c.x, my + c.y, c.w, c.h, 18 * k, pal.line));
      }
      y += headerH + gap;

      // text (rich)
      applyFont(ctx, ui(400), textSize);
      ctx.textBaseline = 'middle';
      body.forEach((tokens, i) => {
        let cx = x;
        const cy = y + (i + 0.5) * textSize * textLH;
        tokens.forEach((tok) => {
          ctx.fillStyle = tok.link ? LINK_BLUE : pal.text;
          ctx.fillText(tok.text, cx, cy);
          cx += ctx.measureText(tok.text).width;
        });
      });
      y += bodyH;

      if (media.h && !side) {
        y += gap;
        media.cells.forEach((c, i) => framedImage(ctx, images[i], x + c.x, y + c.y, c.w, c.h, 18 * k, pal.line));
        y += media.h;
      }

      if (quoteH) {
        y += gap;
        roundRectPath(ctx, x, y, inner, quoteH, 18 * k);
        ctx.lineWidth = Math.max(1, k);
        ctx.strokeStyle = pal.line;
        ctx.stroke();
        applyFont(ctx, ui(700), 18 * k);
        ctx.fillStyle = pal.text;
        ctx.textBaseline = 'middle';
        const qx = x + 18 * k;
        ctx.fillText(quote.name ?? '', qx, y + 24 * k);
        const nameW = ctx.measureText(quote.name ?? '').width;
        applyFont(ctx, ui(400), 17 * k);
        ctx.fillStyle = pal.muted;
        ctx.fillText(quote.handle ? `@${quote.handle}` : '', qx + nameW + 8 * k, y + 24 * k);
        applyFont(ctx, ui(400), quoteSize);
        fillLines(ctx, quoteLines, qx, y + 44 * k, quoteSize, 1.36, pal.text);
        y += quoteH;
      }

      if (date) {
        y += gap;
        applyFont(ctx, ui(400), 18 * k);
        ctx.fillStyle = pal.muted;
        ctx.textBaseline = 'middle';
        ctx.fillText(date, x, y + 11 * k);
        y += 22 * k;
      }

      if (stats.length) {
        y += 18 * k;
        ctx.fillStyle = pal.line;
        ctx.fillRect(x, y, inner, Math.max(1, k));
        y += 18 * k;
        const slot = inner / 4;
        stats.forEach((key, i) => {
          const sx = x + i * slot;
          const s = 20 * k;
          ctx.save();
          ctx.strokeStyle = key === 'likes' ? '#f91880' : pal.muted;
          ctx.lineWidth = 1.8 * k;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ICONS[key](ctx, sx, y + 2 * k, s);
          ctx.restore();
          applyFont(ctx, mono(500), 16 * k);
          ctx.fillStyle = pal.muted;
          ctx.textBaseline = 'middle';
          ctx.fillText(formatCount(t.stats[key]), sx + s + 8 * k, y + 12 * k);
        });
      }
    },
  };
}
