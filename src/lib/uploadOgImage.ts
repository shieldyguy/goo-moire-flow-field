const OG_WIDTH = 600;
const OG_HEIGHT = 315;

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

  // Crop a center region from the source canvas at 4x zoom (25% of the canvas)
  // at the OG aspect ratio. This gives a tight, detailed preview.
  const srcW = sourceCanvas.width;
  const srcH = sourceCanvas.height;
  const ogAspect = OG_WIDTH / OG_HEIGHT;
  const zoom = 4;

  // Start with 1/zoom of the source dimensions, then adjust for aspect ratio
  let cropW = srcW / zoom;
  let cropH = srcH / zoom;
  const cropAspect = cropW / cropH;

  if (cropAspect > ogAspect) {
    cropW = cropH * ogAspect;
  } else {
    cropH = cropW / ogAspect;
  }

  const cropX = (srcW - cropW) / 2;
  const cropY = (srcH - cropH) / 2;

  // Draw the cropped center region into the OG-sized canvas
  ctx.drawImage(sourceCanvas, cropX, cropY, cropW, cropH, 0, 0, OG_WIDTH, OG_HEIGHT);

  // Export as JPEG — much smaller than PNG, patterns don't need transparency
  const blob = await new Promise<Blob | null>((resolve) =>
    offscreen.toBlob(resolve, 'image/jpeg', 0.70),
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
