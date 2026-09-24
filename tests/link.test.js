import { test } from 'node:test';
import assert from 'node:assert/strict';

/* ---------- link previews ---------- */

test('parseMeta extracts Open Graph data and resolves relative URLs', async () => {
  const { parseMeta } = await import('../server/unfurl.js');
  const html = `<html><head><title>Fallback &amp; Title</title>
    <meta property="og:title" content="Samsung One UI 9 &#8211; What&#39;s new">
    <meta name="description" content="Short desc">
    <meta property="og:image" content="/img/hero.jpg">
    <meta property="og:site_name" content="Tech Blog">
    <meta name="theme-color" content="#1A2B3C">
    <link rel="icon" href="/favicon-32.png" sizes="32x32"><link rel="apple-touch-icon" href="/apple.png">
  </head><body></body></html>`;
  const meta = parseMeta(html, 'https://www.example.com/posts/one-ui-9');
  assert.equal(meta.title, "Samsung One UI 9 – What's new");
  assert.equal(meta.description, 'Short desc');
  assert.equal(meta.image, 'https://www.example.com/img/hero.jpg');
  assert.equal(meta.icon, 'https://www.example.com/apple.png');
  assert.equal(meta.siteName, 'Tech Blog');
  assert.equal(meta.domain, 'example.com');
  assert.equal(meta.themeColor, '#1a2b3c');
});

test('parseMeta uses the YouTube thumbnail and falls back to <title>', async () => {
  const { parseMeta } = await import('../server/unfurl.js');
  const yt = parseMeta('<title>Video</title>', 'https://youtu.be/dQw4w9WgXcQ');
  assert.equal(yt.image, 'https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg');
  assert.equal(yt.fallbackImage, 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg');
  assert.equal(yt.title, 'Video');
  const bare = parseMeta('<p>nothing</p>', 'https://example.org/');
  assert.equal(bare.title, 'example.org');
  assert.equal(bare.icon, 'https://example.org/favicon.ico');
  assert.equal(bare.image, null);
});

test('isPrivateAddress blocks internal targets (SSRF guard)', async () => {
  const { isPrivateAddress } = await import('../server/unfurl.js');
  ['127.0.0.1', '10.1.2.3', '192.168.1.1', '172.20.0.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '::1', 'fd00::1', 'fe80::1', '::ffff:127.0.0.1'].forEach((ip) =>
    assert.equal(isPrivateAddress(ip), true, ip),
  );
  ['8.8.8.8', '1.1.1.1', '172.32.0.1', '2606:4700::1111'].forEach((ip) => assert.equal(isPrivateAddress(ip), false, ip));
});

test('assertPublicUrl rejects non-http, credentials and localhost', async () => {
  const { assertPublicUrl } = await import('../server/unfurl.js');
  await assert.rejects(assertPublicUrl('file:///etc/passwd'));
  await assert.rejects(assertPublicUrl('http://user:pw@example.com'));
  await assert.rejects(assertPublicUrl('http://localhost:5173/'));
  await assert.rejects(assertPublicUrl('http://127.0.0.1/'));
  await assert.rejects(assertPublicUrl('not a url'));
});

test('asLink recognises pasted links only', async () => {
  const { asLink } = await import('../src/app/link.js');
  assert.equal(asLink('  https://example.com/a?b=1 '), 'https://example.com/a?b=1');
  assert.equal(asLink('example.com/post'), 'https://example.com/post');
  assert.equal(asLink('hello world'), null);
  assert.equal(asLink('One UI 9'), null);
});

/* ---------- rich providers ---------- */

test('matchTweet and matchYouTube recognise share links', async () => {
  const { matchTweet, matchYouTube } = await import('../server/providers.js');
  assert.deepEqual(matchTweet('https://x.com/jack/status/20'), { user: 'jack', id: '20' });
  assert.deepEqual(matchTweet('https://twitter.com/NASA/status/1813271468522463453?s=20&t=abc'), { user: 'NASA', id: '1813271468522463453' });
  assert.deepEqual(matchTweet('https://mobile.twitter.com/a_b/statuses/123456'), { user: 'a_b', id: '123456' });
  assert.equal(matchTweet('https://x.com/jack'), null);
  assert.equal(matchYouTube('https://youtu.be/aqz-KE-bpKQ?t=3'), 'aqz-KE-bpKQ');
  assert.equal(matchYouTube('https://www.youtube.com/shorts/aqz-KE-bpKQ'), 'aqz-KE-bpKQ');
  assert.equal(matchYouTube('https://example.com'), null);
});

test('mapFxTweet keeps full text, author, media and stats', async () => {
  const { mapFxTweet } = await import('../server/providers.js');
  const json = {
    tweet: {
      url: 'https://x.com/a/status/1',
      text: 'A very long post '.repeat(30).trim(),
      author: { name: 'Ada', screen_name: 'ada', avatar_url: 'https://pbs.twimg.com/p/a_normal.jpg', verification: { verified: true } },
      media: { photos: [{ url: 'https://pbs.twimg.com/m/1.jpg', width: 1200, height: 800 }], videos: [{ thumbnail_url: 'https://pbs.twimg.com/v/1.jpg', width: 1280, height: 720, type: 'video' }] },
      replies: 3, retweets: 5, likes: 1200, views: 99000, created_timestamp: 1700000000,
    },
  };
  const p = mapFxTweet(json, 'https://x.com/a/status/1');
  assert.equal(p.kind, 'tweet');
  assert.equal(p.tweet.text, json.tweet.text, 'text is never truncated');
  assert.equal(p.tweet.author.avatar, 'https://pbs.twimg.com/p/a_400x400.jpg');
  assert.equal(p.tweet.author.verified, true);
  assert.deepEqual(p.tweet.media.map((m) => m.type), ['photo', 'video']);
  assert.deepEqual(p.tweet.stats, { replies: 3, reposts: 5, likes: 1200, views: 99000, bookmarks: null });
  assert.equal(p.tweet.createdAt, 1700000000000);
  assert.equal(mapFxTweet({ code: 404 }, 'x'), null);
});

test('mapTweetOEmbed extracts text from the blockquote', async () => {
  const { mapTweetOEmbed } = await import('../server/providers.js');
  const p = mapTweetOEmbed({ author_name: 'Jack', author_url: 'https://twitter.com/jack', html: '<blockquote><p lang="en">just setting up my twttr &amp; more<br>line 2 pic.twitter.com/abc</p>&mdash; jack</blockquote>' }, 'https://x.com/jack/status/20', 'jack');
  assert.equal(p.tweet.text, 'just setting up my twttr & more\nline 2');
  assert.equal(p.tweet.author.handle, 'jack');
});

test('mapYouTube builds a video preview with thumbnails', async () => {
  const { mapYouTube } = await import('../server/providers.js');
  const p = mapYouTube({ title: 'Big Buck Bunny', author_name: 'Blender' }, 'https://youtu.be/x', 'aqz-KE-bpKQ');
  assert.equal(p.kind, 'video');
  assert.equal(p.author, 'Blender');
  assert.match(p.image, /maxresdefault/);
  assert.match(p.fallbackImage, /hqdefault/);
});

test('fitCard widens text cards before shrinking type, and scales image cards', async () => {
  const { fitCard } = await import('../src/render/link/index.js');
  // text-like: height = (chars / charsPerLine) * lineHeight, chars per line grows with width
  const textMeasure = (w, k) => Math.ceil(2000 / (w / (10 * k))) * 30 * k;
  const fits = fitCard({ width: 600, maxWidth: 1200, maxHeight: 700, nominal: 600, reflow: true, measure: textMeasure });
  assert.equal(fits.k, 1, 'type size kept');
  assert.ok(fits.w > 600 && fits.w <= 1200 && textMeasure(fits.w, fits.k) <= 700);
  const tiny = fitCard({ width: 600, maxWidth: 1200, maxHeight: 200, nominal: 600, reflow: true, measure: textMeasure });
  assert.ok(tiny.k < 1 && textMeasure(tiny.w, tiny.k) <= 200);
  const image = fitCard({ width: 600, maxWidth: 1200, maxHeight: 700, nominal: 600, reflow: false, measure: (w) => w * 2 });
  assert.ok(image.w * 2 <= 700 && image.w > 340);
  assert.deepEqual(fitCard({ width: 300, maxWidth: 1200, maxHeight: 700, nominal: 600, reflow: true, measure: () => 100 }), { w: 300, k: 0.5 });
});
