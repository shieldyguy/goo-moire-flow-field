const OG_WIDTH = 1200;
const OG_HEIGHT = 630;

export async function uploadOgImage(
  sourceCanvas: HTMLCanvasElement,
  preset: string,
): Promise<string> {
  const offscreen = document.createElement('canvas');
  offscreen.width = OG_WIDTH;
  offscreen.height = OG_HEIGHT;
  const ctx = offscreen.getContext('2d');
  if (!ctx) throw new Error('Could not get 2d context');

  // Fill with black background
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, OG_WIDTH, OG_HEIGHT);

  // Fit source canvas into OG dimensions preserving aspect ratio (cover)
  const srcW = sourceCanvas.width;
  const srcH = sourceCanvas.height;
  const srcAspect = srcW / srcH;
  const ogAspect = OG_WIDTH / OG_HEIGHT;

  let drawW: number, drawH: number, drawX: number, drawY: number;
  if (srcAspect > ogAspect) {
    // Source is wider — fit height, crop sides
    drawH = OG_HEIGHT;
    drawW = OG_HEIGHT * srcAspect;
    drawX = (OG_WIDTH - drawW) / 2;
    drawY = 0;
  } else {
    // Source is taller — fit width, crop top/bottom
    drawW = OG_WIDTH;
    drawH = OG_WIDTH / srcAspect;
    drawX = 0;
    drawY = (OG_HEIGHT - drawH) / 2;
  }

  ctx.drawImage(sourceCanvas, drawX, drawY, drawW, drawH);

  // Export as JPEG for much smaller file size (patterns don't need transparency)
  const blob = await new Promise<Blob | null>((resolve) =>
    offscreen.toBlob(resolve, 'image/jpeg', 0.85),
  );
  if (!blob) throw new Error('Canvas toBlob failed');

  const res = await fetch(
    `/api/upload-og?preset=${encodeURIComponent(preset)}`,
    {
      method: 'POST',
      headers: {
        'content-type': 'image/jpeg',
        'x-og-token': import.meta.env.VITE_OG_UPLOAD_SECRET ?? '',
      },
      body: blob,
    },
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Upload failed' }));
    throw new Error(err.error ?? 'Upload failed');
  }

  const data = await res.json();
  return data.url;
}
