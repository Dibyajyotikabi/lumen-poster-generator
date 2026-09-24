import { isDark, mix, rgba } from '../core/color.js';
import { drawPaper } from './paper.js';

const inkFor = (color) => isDark(color) ? '#fffaf0' : '#4b3f3a';

function line(ctx, points, color, width) {
  ctx.beginPath();
  ctx.moveTo(...points[0]);
  for (const point of points.slice(1)) ctx.lineTo(...point);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke();
}

function circle(ctx, x, y, radius, color) {
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
}

function stickerShape(ctx, fill, outline) {
  ctx.strokeStyle = '#fffdf8';
  ctx.lineWidth = 9;
  ctx.lineJoin = 'round';
  ctx.stroke();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = outline;
  ctx.lineWidth = 2.5;
  ctx.stroke();
}

function drawScribble(ctx, color) {
  const stroke = mix(color, '#ffffff', 0.16);
  ctx.beginPath();
  ctx.moveTo(10, 62);
  ctx.bezierCurveTo(24, 13, 43, 18, 33, 64);
  ctx.bezierCurveTo(27, 91, 58, 91, 62, 48);
  ctx.bezierCurveTo(66, 9, 87, 20, 79, 61);
  ctx.bezierCurveTo(75, 82, 85, 80, 92, 54);
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.stroke();
  line(ctx, [[9, 80], [27, 75], [42, 81], [58, 74], [72, 80], [90, 74]], rgba(color, 0.58), 2.2);
}

function drawSwirl(ctx, color) {
  ctx.beginPath();
  for (let i = 0; i <= 48; i += 1) {
    const angle = i * 0.21;
    const radius = 4 + i * 0.75;
    const px = 50 + Math.cos(angle) * radius;
    const py = 50 + Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = 4.2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke();
  circle(ctx, 88, 76, 3, mix(color, '#ffffff', 0.3));
  circle(ctx, 16, 25, 2, color);
}

function drawCat(ctx, color) {
  const edge = '#463d48';
  const inner = mix(color, '#f28da2', 0.52);
  ctx.beginPath();
  ctx.ellipse(53, 72, 27, 22, 0, 0, Math.PI * 2);
  stickerShape(ctx, color, edge);
  line(ctx, [[76, 77], [88, 66], [89, 49]], edge, 8);
  line(ctx, [[76, 77], [88, 66], [89, 49]], color, 5);
  ctx.beginPath();
  ctx.moveTo(24, 37);
  ctx.lineTo(25, 10);
  ctx.lineTo(42, 25);
  ctx.quadraticCurveTo(52, 21, 62, 25);
  ctx.lineTo(79, 10);
  ctx.lineTo(80, 40);
  ctx.bezierCurveTo(84, 66, 69, 75, 52, 75);
  ctx.bezierCurveTo(32, 75, 19, 63, 24, 37);
  ctx.closePath();
  stickerShape(ctx, mix(color, '#ffffff', 0.26), edge);
  ctx.beginPath();
  ctx.moveTo(30, 20); ctx.lineTo(31, 35); ctx.lineTo(41, 27); ctx.closePath();
  ctx.moveTo(73, 20); ctx.lineTo(63, 27); ctx.lineTo(74, 35); ctx.closePath();
  ctx.fillStyle = inner;
  ctx.fill();
  circle(ctx, 40, 48, 3.3, edge);
  circle(ctx, 64, 48, 3.3, edge);
  circle(ctx, 34, 57, 5.5, rgba('#ed7f96', 0.4));
  circle(ctx, 70, 57, 5.5, rgba('#ed7f96', 0.4));
  ctx.beginPath();
  ctx.moveTo(48, 56); ctx.lineTo(56, 56); ctx.lineTo(52, 61); ctx.closePath();
  ctx.fillStyle = inner;
  ctx.fill();
  line(ctx, [[52, 61], [49, 65], [46, 63]], edge, 1.7);
  line(ctx, [[52, 61], [55, 65], [58, 63]], edge, 1.7);
  for (const side of [-1, 1]) {
    line(ctx, [[52 + side * 14, 60], [52 + side * 28, 57]], edge, 1.4);
    line(ctx, [[52 + side * 14, 64], [52 + side * 27, 67]], edge, 1.4);
  }
  circle(ctx, 41, 89, 7, mix(color, '#ffffff', 0.18));
  circle(ctx, 64, 89, 7, mix(color, '#ffffff', 0.18));
}

function drawBird(ctx, color) {
  const edge = '#344752';
  line(ctx, [[43, 78], [39, 91]], edge, 2.5);
  line(ctx, [[59, 78], [63, 91]], edge, 2.5);
  line(ctx, [[34, 91], [44, 91]], edge, 2.5);
  line(ctx, [[58, 91], [68, 91]], edge, 2.5);
  ctx.beginPath();
  ctx.moveTo(26, 62); ctx.lineTo(9, 42); ctx.lineTo(12, 71); ctx.lineTo(29, 77); ctx.closePath();
  stickerShape(ctx, mix(color, '#ffffff', 0.1), edge);
  ctx.beginPath();
  ctx.ellipse(51, 54, 31, 28, -0.2, 0, Math.PI * 2);
  stickerShape(ctx, color, edge);
  ctx.beginPath();
  ctx.ellipse(46, 64, 18, 12, -0.45, 0, Math.PI * 2);
  ctx.fillStyle = mix(color, '#ffffff', 0.44);
  ctx.fill();
  ctx.strokeStyle = rgba(edge, 0.55); ctx.lineWidth = 1.6; ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(78, 49); ctx.lineTo(94, 54); ctx.lineTo(78, 62); ctx.closePath();
  ctx.fillStyle = '#f5bc63'; ctx.fill();
  ctx.strokeStyle = edge; ctx.lineWidth = 2; ctx.stroke();
  circle(ctx, 67, 45, 3.3, edge);
  circle(ctx, 68, 44, 1, '#ffffff');
  circle(ctx, 72, 56, 4, rgba('#f38e9e', 0.4));
  line(ctx, [[42, 27], [38, 17], [50, 24]], edge, 2.2);
  line(ctx, [[52, 26], [54, 15], [62, 26]], edge, 2.2);
}

function drawFlower(ctx, color) {
  const edge = mix(color, '#583d54', 0.52);
  for (let i = 0; i < 6; i += 1) {
    const angle = (i * Math.PI) / 3;
    ctx.beginPath();
    ctx.ellipse(50 + Math.cos(angle) * 23, 50 + Math.sin(angle) * 23, 17, 23, angle + Math.PI / 2, 0, Math.PI * 2);
    stickerShape(ctx, mix(color, '#ffffff', i % 2 ? 0.2 : 0.05), edge);
  }
  circle(ctx, 50, 50, 15, '#ffda79');
  ctx.beginPath(); ctx.arc(50, 50, 15, 0, Math.PI * 2);
  ctx.strokeStyle = edge; ctx.lineWidth = 2.2; ctx.stroke();
  circle(ctx, 46, 48, 1.8, edge);
  circle(ctx, 54, 48, 1.8, edge);
  line(ctx, [[47, 55], [50, 57], [53, 55]], edge, 1.5);
}

function star(ctx, x, y, radius, color) {
  ctx.beginPath();
  ctx.moveTo(x, y - radius);
  ctx.quadraticCurveTo(x + radius * 0.14, y - radius * 0.14, x + radius, y);
  ctx.quadraticCurveTo(x + radius * 0.14, y + radius * 0.14, x, y + radius);
  ctx.quadraticCurveTo(x - radius * 0.14, y + radius * 0.14, x - radius, y);
  ctx.quadraticCurveTo(x - radius * 0.14, y - radius * 0.14, x, y - radius);
  ctx.closePath();
  stickerShape(ctx, color, mix(color, '#5e4660', 0.5));
}

function drawHeart(ctx, color) {
  ctx.beginPath();
  ctx.moveTo(50, 86);
  ctx.bezierCurveTo(33, 72, 12, 53, 15, 34);
  ctx.bezierCurveTo(18, 11, 42, 9, 50, 32);
  ctx.bezierCurveTo(59, 9, 82, 11, 85, 34);
  ctx.bezierCurveTo(88, 53, 67, 72, 50, 86);
  ctx.closePath();
  stickerShape(ctx, color, mix(color, '#633e55', 0.55));
  ctx.beginPath();
  ctx.moveTo(28, 34); ctx.quadraticCurveTo(31, 23, 40, 28);
  ctx.strokeStyle = rgba('#ffffff', 0.8); ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.stroke();
}

const STICKERS = {
  scribble: drawScribble,
  swirl: drawSwirl,
  cat: drawCat,
  bird: drawBird,
  flower: drawFlower,
  sparkles(ctx, color) {
    star(ctx, 49, 51, 30, color);
    star(ctx, 17, 23, 11, mix(color, '#ffffff', 0.2));
    star(ctx, 80, 75, 14, mix(color, '#ffffff', 0.28));
    circle(ctx, 84, 25, 3, color);
    circle(ctx, 19, 79, 2.5, color);
  },
  heart: drawHeart,
};

/** Self-contained decorations use the same layer bounds in preview and export. */
export function drawDecorativeElement(ctx, variant, { x, y, w, h, color, u }) {
  if (variant === 'paper-scrap' || variant === 'cracked-paper' || variant === 'washi-tape') {
    drawPaper(ctx, { x, y, w, h, color, ink: inkFor(color), style: variant === 'washi-tape' ? 'tape' : variant === 'cracked-paper' ? 'newsprint' : 'torn', seed: variant.length, u });
    if (variant === 'cracked-paper') {
      ctx.save();
      line(ctx, [[x + w * 0.48, y + h * 0.04], [x + w * 0.53, y + h * 0.25], [x + w * 0.45, y + h * 0.43], [x + w * 0.57, y + h * 0.61], [x + w * 0.49, y + h * 0.94]], rgba('#5b4a3d', 0.58), Math.max(1.2 * u, w * 0.008));
      line(ctx, [[x + w * 0.45, y + h * 0.43], [x + w * 0.29, y + h * 0.34], [x + w * 0.18, y + h * 0.43]], rgba('#5b4a3d', 0.42), Math.max(u, w * 0.006));
      line(ctx, [[x + w * 0.57, y + h * 0.61], [x + w * 0.7, y + h * 0.53], [x + w * 0.82, y + h * 0.59]], rgba('#5b4a3d', 0.42), Math.max(u, w * 0.006));
      ctx.restore();
    } else if (variant === 'washi-tape') {
      ctx.save();
      for (let i = 0; i < 8; i += 1) {
        const xx = x + w * (0.12 + i * 0.105);
        line(ctx, [[xx, y + h * 0.22], [xx + w * 0.025, y + h * 0.78]], rgba(inkFor(color), 0.16), Math.max(u, w * 0.012));
      }
      ctx.restore();
    }
    return true;
  }
  const draw = STICKERS[variant];
  if (!draw) return false;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(w / 100, h / 100);
  draw(ctx, color);
  ctx.restore();
  return true;
}
