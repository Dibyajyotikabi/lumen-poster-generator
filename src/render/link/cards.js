// Article / video link designs: card, hero, video, compact, minimal.
import { isDark, shiftHue } from '../../core/color.js';
import { ui, mono, applyFont, roundRectPath, shell, cardPalette, coverImage, framedImage, lines, fillLines, clamp, aspectOf, drawLogo } from './kit.js';

export const CARD_NOMINAL = 560;
const NOMINAL = CARD_NOMINAL;
const label = (layer) => (layer.siteName || layer.domain || '').toUpperCase();

function siteIcon(ctx, icon, x, y, size, accent, domain) {
  roundRectPath(ctx, x, y, size, size, size * 0.26);
  if (icon) {
    ctx.save();
    ctx.clip();
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    coverImage(ctx, icon, x, y, size, size);
    ctx.restore();
    return;
  }
  ctx.fillStyle = accent;
  ctx.fill();
  applyFont(ctx, ui(700), size * 0.56);
  ctx.fillStyle = isDark(accent) ? '#ffffff' : '#111111';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText((domain?.[0] ?? '·').toUpperCase(), x + size / 2, y + size * 0.54);
}

/** Site row (icon + name). Returns its height. */
function metaRow(ctx, layer, assets, x, y, k, color, accent) {
  const size = 24 * k;
  if (layer.kind === 'video') drawLogo(ctx, 'yt', x, y + 2 * k, size, '#ff0033');
  else siteIcon(ctx, assets.icon, x, y, size, accent, layer.domain);
  applyFont(ctx, mono(500), 13.5 * k, 0.08);
  ctx.fillStyle = color;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(label(layer), x + size + 10 * k, y + size / 2 + k);
  return size;
}

function textStack(ctx, layer, width, k, { titleSize, descSize, titleMax, descMax }) {
  applyFont(ctx, ui(650), titleSize * k, -0.018);
  const title = lines(ctx, layer.title || layer.domain, width, titleMax);
  applyFont(ctx, ui(400), descSize * k);
  const desc = layer.showDescription !== false && layer.description ? lines(ctx, layer.description, width, descMax) : [];
  const titleH = title.length * titleSize * k * 1.16;
  const descH = desc.length * descSize * k * 1.45;
  return { title, desc, titleH, descH, h: titleH + (desc.length ? 10 * k + descH : 0) };
}

function paintStack(ctx, stack, x, y, k, sizes, pal) {
  applyFont(ctx, ui(650), sizes.titleSize * k, -0.018);
  fillLines(ctx, stack.title, x, y, sizes.titleSize * k, 1.16, pal.text);
  if (!stack.desc.length) return;
  applyFont(ctx, ui(400), sizes.descSize * k);
  fillLines(ctx, stack.desc, x, y + stack.titleH + 10 * k, sizes.descSize * k, 1.45, pal.muted);
}

function playButton(ctx, cx, cy, k) {
  const w = 86 * k;
  const h = 60 * k;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.35)';
  ctx.shadowBlur = 24 * k;
  roundRectPath(ctx, cx - w / 2, cy - h / 2, w, h, 18 * k);
  ctx.fillStyle = '#ff0033';
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(cx - 11 * k, cy - 15 * k);
  ctx.lineTo(cx + 17 * k, cy);
  ctx.lineTo(cx - 11 * k, cy + 15 * k);
  ctx.closePath();
  ctx.fill();
}

export const CARD_LAYOUTS = {
  card(ctx, layer, w, assets, env, k = w / NOMINAL) {
    const pal = cardPalette(layer.cardTheme, env.theme);
    const pad = 26 * k;
    const sizes = { titleSize: 28, descSize: 17, titleMax: 6, descMax: 5 };
    const img = assets.image;
    const imgH = img ? w / clamp(aspectOf(img), 1.25, 2.4) : 0;
    const stack = textStack(ctx, layer, w - pad * 2, k, sizes);
    const h = imgH + pad + 24 * k + 16 * k + stack.h + pad;
    return {
      h,
      paint(box) {
        const r = 28 * k;
        shell(ctx, box, r, pal, env.u);
        if (img) {
          ctx.save();
          roundRectPath(ctx, box.x, box.y, box.w, box.h, r);
          ctx.clip();
          coverImage(ctx, img, box.x, box.y, box.w, imgH);
          ctx.restore();
          if (layer.kind === 'video') playButton(ctx, box.x + box.w / 2, box.y + imgH / 2, k);
        }
        const y = box.y + imgH + pad;
        metaRow(ctx, layer, assets, box.x + pad, y, k, pal.muted, env.theme.accent);
        paintStack(ctx, stack, box.x + pad, y + 24 * k + 16 * k, k, sizes, pal);
      },
    };
  },

  video(ctx, layer, w, assets, env, k = w / NOMINAL) {
    const pal = cardPalette(layer.cardTheme, env.theme);
    const pad = 16 * k;
    const sizes = { titleSize: 27, descSize: 17, titleMax: 5, descMax: 2 };
    const thumbW = w - pad * 2;
    const thumbH = thumbW * (9 / 16);
    const stack = textStack(ctx, { ...layer, description: layer.author ? layer.author : layer.description }, thumbW - 10 * k, k, sizes);
    const h = pad + thumbH + 20 * k + 24 * k + 14 * k + stack.h + 20 * k;
    return {
      h,
      paint(box) {
        shell(ctx, box, 26 * k, pal, env.u);
        const tx = box.x + pad;
        const ty = box.y + pad;
        if (assets.image) framedImage(ctx, assets.image, tx, ty, thumbW, thumbH, 16 * k);
        else {
          roundRectPath(ctx, tx, ty, thumbW, thumbH, 16 * k);
          ctx.fillStyle = '#111111';
          ctx.fill();
        }
        playButton(ctx, tx + thumbW / 2, ty + thumbH / 2, k);
        const y = ty + thumbH + 20 * k;
        metaRow(ctx, layer, assets, tx + 5 * k, y, k, pal.muted, env.theme.accent);
        paintStack(ctx, stack, tx + 5 * k, y + 24 * k + 14 * k, k, sizes, pal);
      },
    };
  },

  hero(ctx, layer, w, assets, env, k = w / NOMINAL) {
    const pad = 30 * k;
    const img = assets.image;
    const sizes = { titleSize: 36, descSize: 18, titleMax: 5, descMax: 3 };
    const stack = textStack(ctx, layer, w - pad * 2, k, sizes);
    const minH = w / clamp(aspectOf(img, 1.4), 1.1, 1.9);
    const pill = 34 * k;
    const h = Math.max(minH, pad + pill + 90 * k + stack.h + pad);
    const white = { text: '#ffffff', muted: 'rgba(255,255,255,0.78)' };
    return {
      h,
      paint(box) {
        const r = 30 * k;
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.4)';
        ctx.shadowBlur = 60 * env.u;
        ctx.shadowOffsetY = 24 * env.u;
        roundRectPath(ctx, box.x, box.y, box.w, box.h, r);
        ctx.fillStyle = '#111';
        ctx.fill();
        ctx.restore();
        ctx.save();
        roundRectPath(ctx, box.x, box.y, box.w, box.h, r);
        ctx.clip();
        if (img) coverImage(ctx, img, box.x, box.y, box.w, box.h);
        else {
          const g = ctx.createLinearGradient(box.x, box.y, box.x + box.w, box.y + box.h);
          g.addColorStop(0, env.theme.accent);
          g.addColorStop(1, shiftHue(env.theme.accent, 60));
          ctx.fillStyle = g;
          ctx.fillRect(box.x, box.y, box.w, box.h);
        }
        // Legibility: fade to near-black well before the title starts.
        const titleTop = box.y + box.h - pad - stack.h;
        const fadeTop = Math.max(box.y, titleTop - 110 * k);
        const g = ctx.createLinearGradient(0, fadeTop, 0, box.y + box.h);
        const solidAt = Math.min(0.9, (titleTop - fadeTop) / Math.max(1, box.y + box.h - fadeTop));
        g.addColorStop(0, 'rgba(0,0,0,0)');
        g.addColorStop(solidAt, 'rgba(0,0,0,0.78)');
        g.addColorStop(1, 'rgba(0,0,0,0.9)');
        ctx.fillStyle = g;
        ctx.fillRect(box.x, fadeTop, box.w, box.y + box.h - fadeTop);
        ctx.restore();
        // site pill
        applyFont(ctx, mono(500), 13 * k, 0.08);
        const pillW = ctx.measureText(label(layer)).width + 56 * k;
        roundRectPath(ctx, box.x + pad, box.y + pad, pillW, 34 * k, 17 * k);
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.25)';
        ctx.lineWidth = Math.max(1, k);
        ctx.stroke();
        metaRow(ctx, layer, assets, box.x + pad + 8 * k, box.y + pad + 5 * k, k * 0.95, white.text, env.theme.accent);
        if (layer.kind === 'video') playButton(ctx, box.x + box.w / 2, box.y + (fadeTop - box.y) / 2 + pad, k);
        paintStack(ctx, stack, box.x + pad, box.y + box.h - pad - stack.h, k, sizes, white);
      },
    };
  },

  compact(ctx, layer, w, assets, env, k = w / NOMINAL) {
    const pal = cardPalette(layer.cardTheme, env.theme);
    const pad = 18 * k;
    const thumb = assets.image ? 150 * k : 0;
    const sizes = { titleSize: 22, descSize: 15, titleMax: 4, descMax: 3 };
    const textX = pad + (thumb ? thumb + 18 * k : 0);
    const stack = textStack(ctx, layer, w - textX - pad, k, sizes);
    const content = 24 * k + 12 * k + stack.h;
    const h = Math.max(thumb, content) + pad * 2;
    return {
      h,
      paint(box) {
        shell(ctx, box, 22 * k, pal, env.u);
        if (assets.image) framedImage(ctx, assets.image, box.x + pad, box.y + (h - thumb) / 2, thumb, thumb, 14 * k);
        const y = box.y + (h - content) / 2;
        metaRow(ctx, layer, assets, box.x + textX, y, k, pal.muted, env.theme.accent);
        paintStack(ctx, stack, box.x + textX, y + 24 * k + 12 * k, k, sizes, pal);
      },
    };
  },

  minimal(ctx, layer, w, assets, env, k = w / NOMINAL) {
    const pal = cardPalette(layer.cardTheme, env.theme);
    const pad = 16 * k;
    const icon = 42 * k;
    const textW = w - icon - pad * 3 - 34 * k;
    applyFont(ctx, ui(600), 21 * k, -0.01);
    const title = lines(ctx, layer.title || layer.domain, textW, 3);
    const titleH = title.length * 21 * k * 1.2;
    const h = Math.max(icon, titleH + 20 * k) + pad * 2;
    return {
      h,
      paint(box) {
        shell(ctx, box, Math.min(h / 2, 30 * k), pal, env.u);
        if (layer.kind === 'video') drawLogo(ctx, 'yt', box.x + pad, box.y + (h - icon) / 2, icon, '#ff0033');
        else siteIcon(ctx, assets.icon ?? assets.image, box.x + pad, box.y + (h - icon) / 2, icon, env.theme.accent, layer.domain);
        const tx = box.x + pad * 2 + icon;
        const ty = box.y + (h - titleH - 20 * k) / 2;
        applyFont(ctx, ui(600), 21 * k, -0.01);
        fillLines(ctx, title, tx, ty, 21 * k, 1.2, pal.text);
        applyFont(ctx, mono(500), 12 * k, 0.06);
        ctx.fillStyle = pal.muted;
        ctx.fillText(layer.domain.toUpperCase(), tx, ty + titleH + 10 * k);
        applyFont(ctx, ui(500), 24 * k);
        ctx.fillStyle = pal.muted;
        ctx.textAlign = 'right';
        ctx.fillText('↗', box.x + w - pad * 1.2, box.y + h / 2);
      },
    };
  },
};
