// 3D emoji stickers — Microsoft Fluent Emoji (MIT), bundled locally in assets/stickers.
const CODES = '1f525 2728 1f680 1f4a1 1f389 1f3af 1f4af 26a1 1f31f 2764-fe0f 1f451 1f48e 1f4b0 1f4c8 1f4ca 1f4e2 1f514 1f440 1f914 1f60d 1f602 1f60e 1f929 1f631 1f92f 1f973 1f64c 1f44d 1f44f 1f4aa 1f91d 270c-fe0f 1f449 1f447 2705 274c 26a0-fe0f 2753 1f4f1 1f4bb 1f916 1f3ae 1f3a7 1f4f8 1f3ac 1f4da 270f-fe0f 1f4cc 1f30d 1f308 2600-fe0f 1f319 1f340 1f33a 1f355 2615 1f381 1f3c6 1f947 23f0'.split(' ');

const toEmoji = (code) => String.fromCodePoint(...code.split('-').map((c) => parseInt(c, 16)));

export const STICKERS = CODES.map((code) => ({ id: code, emoji: toEmoji(code), src: `assets/stickers/${code}.webp` }));
