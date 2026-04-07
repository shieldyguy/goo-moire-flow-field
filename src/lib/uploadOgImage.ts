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

  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, OG_WIDTH, OG_HEIGHT);

  // The source canvas is DPR-scaled (e.g. 2x on Retina), so it's much larger
  // than what the user sees. Crop from the center to match the visible viewport
  // at the OG aspect ratio.
  const srcW = sourceCanvas.width;
  const srcH = sourceCanvas.height;
  const ogAspect = OG_WIDTH / OG_HEIGHT;
  const srcAspect = srcW / srcH;

  let cropX: number, cropY: number, cropW: number, cropH: number;
  if (srcAspect > ogAspect) {
    // Source is wider than OG — crop sides
    cropH = srcH;
    cropW = srcH * ogAspect;
    cropX = (srcW - cropW) / 2;
    cropY = 0;
  } else {
    // Source is taller than OG — crop top/bottom
    cropW = srcW;
    cropH = srcW / ogAspect;
    cropX = 0;
    cropY = (srcH - cropH) / 2;
  }

  // Draw the cropped center region into the OG-sized canvas
  ctx.drawImage(sourceCanvas, cropX, cropY, cropW, cropH, 0, 0, OG_WIDTH, OG_HEIGHT);

  // Export as JPEG — much smaller than PNG, patterns don't need transparency
  const blob = await new Promise<Blob | null>((resolve) =>
    offscreen.toBlob(resolve, 'image/jpeg', 0.80),
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
