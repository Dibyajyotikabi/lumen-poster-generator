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
