const CRAWLER_AGENTS = [
  'Twitterbot',
  'facebookexternalhit',
  'LinkedInBot',
  'Slackbot',
  'Discordbot',
  'WhatsApp',
  'TelegramBot',
  'Applebot',
];

const SITE_URL = 'https://fields.lunchfirm.com';
const DEFAULT_OG_IMAGE = `${SITE_URL}/packaging/og/og-image.png`;

function isCrawler(ua: string): boolean {
  return CRAWLER_AGENTS.some((bot) => ua.includes(bot));
}

function buildOgHtml(imageUrl: string, presetParam: string): string {
  const pageUrl = `${SITE_URL}/?p=${presetParam}`;
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Emergent Field Explorer — Lunch</title>
  <meta name="description" content="Emergent Field Explorer by Lunch." />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${pageUrl}" />
  <meta property="og:title" content="Emergent Field Explorer" />
  <meta property="og:description" content="Emergent Field Explorer by Lunch." />
  <meta property="og:image" content="${imageUrl}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="Emergent Field Explorer — Lunch" />
  <meta name="twitter:description" content="Emergent Field Explorer by Lunch." />
  <meta name="twitter:image" content="${imageUrl}" />
</head>
<body></body>
</html>`;
}

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const preset = url.searchParams.get('p');
  const ua = req.headers.get('user-agent') ?? '';

  // Not a crawler or no preset — redirect to the SPA
  if (!preset || !isCrawler(ua)) {
    return new Response(null, {
      status: 302,
      headers: { Location: preset ? `/?p=${preset}` : '/' },
    });
  }

  const blobStoreUrl = process.env.BLOB_STORE_URL;

  if (blobStoreUrl) {
    const imageUrl = `${blobStoreUrl}/og/${encodeURIComponent(preset)}.png`;

    try {
      const headResp = await fetch(imageUrl, { method: 'HEAD' });
      if (headResp.ok) {
        return new Response(buildOgHtml(imageUrl, preset), {
          headers: { 'content-type': 'text/html; charset=utf-8' },
        });
      }
    } catch {
      // Blob doesn't exist or fetch failed — fall through to default
    }
  }

  return new Response(buildOgHtml(DEFAULT_OG_IMAGE, preset), {
    headers: { 'content-type': 'text/html; charset=utf-8' },
  });
}

export const config = { runtime: 'edge' };
