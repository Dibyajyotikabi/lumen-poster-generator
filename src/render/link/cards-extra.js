// Extra link designs: browser window, bold headline card, and a big-quote post.
import { isDark, mix } from '../../core/color.js';
import { ensureFont } from '../../fonts/loader.js';
import { ui, mono, applyFont, roundRectPath, shell, cardPalette, coverImage, circleImage, verifiedBadge, drawLogo, lines, fillLines, clamp, aspectOf, LINK_BLUE } from './kit.js';

export const EXTRA_NOMINAL = 560;
const serif = () => ensureFont({ id: 'instrument-serif', family: 'Instrument Serif', weight: 400, italic: false });

function favicon(ctx, icon, x, y, s, accent, domain) {
  roundRectPath(ctx, x, y, s, s, s * 0.24);
  if (icon) {
    ctx.save();
    ctx.clip();
    ctx.fillStyle = '#fff';
    ctx.fill();
    coverImage(ctx, icon, x, y, s, s);
    ctx.restore();
    return;
  }
  ctx.fillStyle = accent;
  ctx.fill();
  applyFont(ctx, ui(700), s * 0.58);
  ctx.fillStyle = isDark(accent) ? '#fff' : '#111';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText((domain?.[0] ?? '·').toUpperCase(), x + s / 2, y + s * 0.54);
}

export const EXTRA_LAYOUTS = {
  /** macOS-style browser window with the page's hero image. */
  browser(ctx, layer, w, assets, env, k = w / EXTRA_NOMINAL) {
    const pal = cardPalette(layer.cardTheme === 'auto' ? 'light' : layer.cardTheme, env.theme);
    const bar = 46 * k;
    const pad = 26 * k;
    const img = assets.image;
    const imgH = img ? w / clamp(aspectOf(img), 1.4, 2.2) : 0;
    applyFont(ctx, ui(700), 30 * k, -0.02);
    const title = lines(ctx, layer.title || layer.domain, w - pad * 2, 4);
    applyFont(ctx, ui(400), 17 * k);
    const desc = layer.showDescription !== false && layer.description ? lines(ctx, layer.description, w - pad * 2, 3) : [];
    const textH = title.length * 30 * k * 1.14 + (desc.length ? 12 * k + desc.length * 17 * k * 1.45 : 0);
    const h = bar + imgH + pad + textH + pad;
    return {
      h,
      paint(box) {
        const r = 18 * k;
        shell(ctx, box, r, pal, env.u);
        ctx.save();
        roundRectPath(ctx, box.x, box.y, box.w, box.h, r);
        ctx.clip();
        ctx.fillStyle = pal.dark ? mix(pal.surface.startsWith('#') ? pal.surface : '#15151a', '#ffffff', 0.08) : '#eceef1';
        ctx.fillRect(box.x, box.y, box.w, bar);
        ['#ff5f57', '#febc2e', '#28c840'].forEach((c, i) => {
          ctx.beginPath();
          ctx.arc(box.x + 22 * k + i * 20 * k, box.y + bar / 2, 6.5 * k, 0, Math.PI * 2);
          ctx.fillStyle = c;
          ctx.fill();
        });
        const urlX = box.x + 92 * k;
        const urlW = box.w - 92 * k - 18 * k;
        roundRectPath(ctx, urlX, box.y + 9 * k, urlW, bar - 18 * k, (bar - 18 * k) / 2);
        ctx.fillStyle = pal.dark ? 'rgba(255,255,255,0.08)' : '#ffffff';
        ctx.fill();
        favicon(ctx, assets.icon, urlX + 10 * k, box.y + bar / 2 - 8 * k, 16 * k, env.theme.accent, layer.domain);
        applyFont(ctx, mono(500), 12.5 * k);
        ctx.fillStyle = pal.muted;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        const [url] = lines(ctx, (layer.url || layer.domain || '').replace(/^https?:\/\/(www\.)?/, ''), urlW - 44 * k, 1);
        ctx.fillText(url ?? '', urlX + 34 * k, box.y + bar / 2 + k);
        if (img) coverImage(ctx, img, box.x, box.y + bar, box.w, imgH);
        ctx.restore();
        const y = box.y + bar + imgH + pad;
        applyFont(ctx, ui(700), 30 * k, -0.02);
        fillLines(ctx, title, box.x + pad, y, 30 * k, 1.14, pal.text);
        if (desc.length) {
          applyFont(ctx, ui(400), 17 * k);
          fillLines(ctx, desc, box.x + pad, y + title.length * 30 * k * 1.14 + 12 * k, 17 * k, 1.45, pal.muted);
        }
      },
    };
  },

  /** Editorial headline card: serif title, accent rule, source line. Great without an image. */
  headline(ctx, layer, w, assets, env, k = w / EXTRA_NOMINAL) {
    const pal = cardPalette(layer.cardTheme, env.theme);
    const pad = 36 * k;
    const accent = env.theme.accent;
    const img = assets.image;
    const imgH = img ? 190 * k : 0;
    applyFont(ctx, serif(), 48 * k, -0.01);
    const title = lines(ctx, layer.title || layer.domain, w - pad * 2, 5);
    applyFont(ctx, ui(400), 17 * k);
    const desc = layer.showDescription !== false && layer.description ? lines(ctx, layer.description, w - pad * 2, 3) : [];
    const titleH = title.length * 48 * k * 1.04;
    const descH = desc.length ? 14 * k + desc.length * 17 * k * 1.45 : 0;
    const h = imgH + pad + 26 * k + 22 * k + titleH + descH + 28 * k + 22 * k + pad;
    return {
      h,
      paint(box) {
        const r = 24 * k;
        shell(ctx, box, r, pal, env.u);
        if (img) {
          ctx.save();
          roundRectPath(ctx, box.x, box.y, box.w, box.h, r);
          ctx.clip();
          coverImage(ctx, img, box.x, box.y, box.w, imgH);
          ctx.restore();
        }
        let y = box.y + imgH + pad;
        applyFont(ctx, mono(500), 12.5 * k, 0.14);
        const tag = (layer.siteName || layer.domain || 'Article').toUpperCase();
        const tagW = ctx.measureText(tag).width + 24 * k;
        roundRectPath(ctx, box.x + pad, y, tagW, 26 * k, 13 * k);
        ctx.fillStyle = accent;
        ctx.fill();
        ctx.fillStyle = isDark(accent) ? '#fff' : '#111';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(tag, box.x + pad + 12 * k, y + 13 * k + k);
        y += 26 * k + 22 * k;
        applyFont(ctx, serif(), 48 * k, -0.01);
        fillLines(ctx, title, box.x + pad, y, 48 * k, 1.04, pal.text);
        y += titleH;
        if (desc.length) {
          applyFont(ctx, ui(400), 17 * k);
          fillLines(ctx, desc, box.x + pad, y + 14 * k, 17 * k, 1.45, pal.muted);
          y += descH;
        }
        y += 28 * k;
        ctx.fillStyle = accent;
        ctx.fillRect(box.x + pad, y, 44 * k, 3 * k);
        favicon(ctx, assets.icon, box.x + box.w - pad - 22 * k, y - 9 * k, 22 * k, accent, layer.domain);
        applyFont(ctx, mono(500), 12.5 * k, 0.08);
        ctx.fillStyle = pal.muted;
        ctx.textAlign = 'left';
        ctx.fillText(`READ ON ${(layer.domain || '').toUpperCase()} ↗`, box.x + pad + 56 * k, y + 2 * k);
      },
    };
  },

  /** Big-type post quote: huge text, author footer, X mark. */
  quote(ctx, layer, w, assets, env, k = w / EXTRA_NOMINAL) {
    const t = layer.tweet ?? { text: layer.description || layer.title, author: { name: layer.author || layer.siteName || layer.domain, handle: '' } };
    const pal = cardPalette(layer.cardTheme ?? 'light', env.theme);
    const pad = 40 * k;
    const text = String(t.text || '').trim();
    const size = (text.length > 260 ? 24 : text.length > 140 ? 30 : 38) * k;
    applyFont(ctx, ui(600), size, -0.02);
    const body = lines(ctx, text, w - pad * 2, 14);
    const bodyH = body.length * size * 1.22;
    const avatar = 52 * k;
    const h = pad + 60 * k + bodyH + 30 * k + avatar + pad;
    const isTweet = layer.kind === 'tweet';
    return {
      h,
      paint(box) {
        shell(ctx, box, 30 * k, pal, env.u);
        applyFont(ctx, serif(), 110 * k);
        ctx.fillStyle = env.theme.accent;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText('“', box.x + pad - 6 * k, box.y + pad + 70 * k);
        if (isTweet) drawLogo(ctx, 'x', box.x + box.w - pad - 26 * k, box.y + pad, 26 * k, pal.text);
        applyFont(ctx, ui(600), size, -0.02);
        fillLines(ctx, body, box.x + pad, box.y + pad + 60 * k, size, 1.22, pal.text);
        const y = box.y + pad + 60 * k + bodyH + 30 * k;
        ctx.fillStyle = pal.line;
        ctx.fillRect(box.x + pad, y - 14 * k, box.w - pad * 2, Math.max(1, k));
        circleImage(ctx, assets.avatar ?? assets.icon, box.x + pad, y, avatar, t.author?.name, LINK_BLUE);
        const nx = box.x + pad + avatar + 14 * k;
        applyFont(ctx, ui(700), 19 * k);
        ctx.fillStyle = pal.text;
        ctx.textBaseline = 'middle';
        const [name] = lines(ctx, t.author?.name ?? '', box.w - pad * 2 - avatar - 60 * k, 1);
        ctx.fillText(name ?? '', nx, y + avatar * 0.32);
        if (t.author?.verified) verifiedBadge(ctx, nx + ctx.measureText(name ?? '').width + 6 * k, y + avatar * 0.32 - 9 * k, 18 * k);
        applyFont(ctx, ui(400), 16 * k);
        ctx.fillStyle = pal.muted;
        ctx.fillText(t.author?.handle ? `@${t.author.handle}` : (layer.domain || ''), nx, y + avatar * 0.74);
      },
    };
  },
};
