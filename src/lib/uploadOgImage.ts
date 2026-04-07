const OG_WIDTH = 1200;
const OG_HEIGHT = 630;

export async function uploadOgImage(
  sourceCanvas: HTMLCanvasElement,
  preset: string,
): Promise<string> {
  // Draw source onto 1200x630 offscreen canvas
  const offscreen = document.createElement('canvas');
  offscreen.width = OG_WIDTH;
  offscreen.height = OG_HEIGHT;
  const ctx = offscreen.getContext('2d');
  if (!ctx) throw new Error('Could not get 2d context');
  ctx.drawImage(sourceCanvas, 0, 0, OG_WIDTH, OG_HEIGHT);

  // Export as PNG (WebP not supported in Safari canvas export)
  const blob = await new Promise<Blob | null>((resolve) =>
    offscreen.toBlob(resolve, 'image/png'),
  );
  if (!blob) throw new Error('Canvas toBlob failed');

  const res = await fetch(
    `/api/upload-og?preset=${encodeURIComponent(preset)}`,
    {
      method: 'POST',
      headers: {
        'content-type': 'image/png',
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
