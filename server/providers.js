// Rich previews for sites that don't expose useful Open Graph data to servers.
//   tweets  → FxTwitter public API (full text, author, photos, stats); oEmbed fallback
//   YouTube → oEmbed (title, channel) + i.ytimg thumbnails
const TWEET_RE = /^https?:\/\/(?:www\.|mobile\.)?(?:twitter|x|fxtwitter|vxtwitter|fixupx)\.com\/([A-Za-z0-9_]{1,15})\/status(?:es)?\/(\d{1,25})/i;
const YOUTUBE_RE = /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([\w-]{11})/i;
const MAX_MEDIA = 4;

export const matchTweet = (url) => {
  const m = TWEET_RE.exec(url);
  return m ? { user: m[1], id: m[2] } : null;
};
export const matchYouTube = (url) => YOUTUBE_RE.exec(url)?.[1] ?? null;

const hiResAvatar = (url) => (url ? url.replace(/_(normal|bigger|mini|200x200)\.(jpe?g|png|webp)$/i, '_400x400.$2') : null);
const num = (v) => (Number.isFinite(v) ? v : null);

/** Maps a FxTwitter API response to our preview shape. Pure. */
export function mapFxTweet(json, url) {
  const t = json?.tweet;
  if (!t?.author) return null;
  const photos = (t.media?.photos ?? []).map((p) => ({ url: p.url, width: p.width, height: p.height, type: 'photo' }));
  const videos = (t.media?.videos ?? []).map((v) => ({ url: v.thumbnail_url, width: v.width, height: v.height, type: v.type === 'gif' ? 'gif' : 'video' }));
  const media = [...photos, ...videos].filter((m) => m.url).slice(0, MAX_MEDIA);
  const text = String(t.text ?? '').trim();
  return {
    kind: 'tweet',
    url: t.url ?? url,
    domain: 'x.com',
    siteName: 'X',
    title: `${t.author.name} on X`,
    description: text,
    image: media[0]?.url ?? null,
    fallbackImage: null,
    icon: null,
    themeColor: '#1d9bf0',
    tweet: {
      text,
      author: {
        name: t.author.name,
        handle: t.author.screen_name,
        avatar: hiResAvatar(t.author.avatar_url),
        verified: Boolean(t.author.verification?.verified ?? t.author.verified),
      },
      media,
      createdAt: t.created_timestamp ? t.created_timestamp * 1000 : Date.parse(t.created_at) || null,
      stats: { replies: num(t.replies), reposts: num(t.retweets), likes: num(t.likes), views: num(t.views), bookmarks: num(t.bookmarks) },
      quote: t.quote ? { name: t.quote.author?.name, handle: t.quote.author?.screen_name, text: String(t.quote.text ?? '').trim() } : null,
    },
  };
}

const stripTags = (html) =>
  String(html)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&mdash;/g, '—');

/** Maps Twitter's public oEmbed (text-only fallback). Pure. */
export function mapTweetOEmbed(json, url, handle) {
  if (!json?.html) return null;
  const paragraph = /<p[^>]*>([\s\S]*?)<\/p>/i.exec(json.html)?.[1] ?? '';
  const text = stripTags(paragraph).replace(/\s*pic\.twitter\.com\/\w+/g, '').trim();
  return {
    kind: 'tweet',
    url,
    domain: 'x.com',
    siteName: 'X',
    title: `${json.author_name} on X`,
    description: text,
    image: null,
    fallbackImage: null,
    icon: null,
    themeColor: '#1d9bf0',
    tweet: {
      text,
      author: { name: json.author_name ?? handle, handle: (json.author_url ?? '').split('/').pop() || handle, avatar: null, verified: false },
      media: [],
      createdAt: null,
      stats: null,
      quote: null,
    },
  };
}

/** Maps YouTube oEmbed. Pure. */
export function mapYouTube(json, url, id) {
  return {
    kind: 'video',
    url,
    domain: 'youtube.com',
    siteName: 'YouTube',
    title: json?.title ?? 'YouTube video',
    description: json?.author_name ? `by ${json.author_name}` : '',
    author: json?.author_name ?? null,
    image: `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`,
    fallbackImage: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
    icon: null,
    themeColor: '#ff0033',
  };
}

async function getJson(fetcher, url) {
  const { body } = await fetcher(url, { accept: 'application/json', maxBytes: 2 * 1024 * 1024 });
  return JSON.parse(body.toString('utf8'));
}

/** Returns a rich preview for known providers, or null to fall back to generic unfurling. */
export async function providerPreview(url, fetcher) {
  const tweet = matchTweet(url);
  if (tweet) {
    const canonical = `https://x.com/${tweet.user}/status/${tweet.id}`;
    try {
      const mapped = mapFxTweet(await getJson(fetcher, `https://api.fxtwitter.com/${tweet.user}/status/${tweet.id}`), canonical);
      if (mapped) return mapped;
    } catch (err) {
      console.warn('[lumen] FxTwitter failed:', err.message);
    }
    try {
      const oembed = await getJson(fetcher, `https://publish.twitter.com/oembed?omit_script=1&dnt=1&url=${encodeURIComponent(canonical)}`);
      const mapped = mapTweetOEmbed(oembed, canonical, tweet.user);
      if (mapped) return mapped;
    } catch (err) {
      console.warn('[lumen] tweet oEmbed failed:', err.message);
    }
    throw Object.assign(new Error('Couldn’t load that post — it may be private or deleted'), { status: 404 });
  }
  const video = matchYouTube(url);
  if (video) {
    const json = await getJson(fetcher, `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${video}`)}`).catch(() => null);
    return mapYouTube(json, url, video);
  }
  return null;
}
