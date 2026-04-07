const SITE_URL = 'https://fields.lunchfirm.com';
const DEFAULT_OG_IMAGE = `${SITE_URL}/packaging/og/og-image.png`;

function buildOgHtml(imageUrl: string, presetParam: string): string {
  const pageUrl = `${SITE_URL}/?p=${presetParam}`;
  // Serve OG meta tags for all visitors. Crawlers read the tags and stop.
  // Browsers execute the script and navigate to the SPA.
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
<body>
  <script>window.location.replace("${pageUrl}&_r=1");</script>
</body>
</html>`;
}

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const preset = url.searchParams.get('p');

  if (!preset) {
    return Response.redirect(`${SITE_URL}/`, 302);
  }

  const blobStoreUrl = process.env.BLOB_STORE_URL;

  if (blobStoreUrl) {
    // Use the raw preset string (same as upload key) — no encodeURIComponent
    const imageUrl = `${blobStoreUrl}/og/${preset}.jpg`;

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
