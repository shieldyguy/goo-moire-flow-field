import type { VercelRequest, VercelResponse } from '@vercel/node';
import { put } from '@vercel/blob';

const PRESET_PATTERN = /^[A-Za-z0-9_-]{10,100}$/;
const MAX_BODY_SIZE = 2 * 1024 * 1024; // 2MB

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = req.headers['x-og-token'];
  if (token !== process.env.OG_UPLOAD_SECRET) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const preset = req.query.preset as string;
  if (!preset || !PRESET_PATTERN.test(preset)) {
    return res.status(400).json({ error: 'Invalid preset parameter' });
  }

  const chunks: Buffer[] = [];
  let totalSize = 0;

  for await (const chunk of req) {
    totalSize += chunk.length;
    if (totalSize > MAX_BODY_SIZE) {
      return res.status(413).json({ error: 'Body too large' });
    }
    chunks.push(chunk);
  }

  const buffer = Buffer.concat(chunks);

  if (buffer.length === 0) {
    return res.status(400).json({ error: 'Empty body' });
  }

  const blob = await put(`og/${preset}.jpg`, buffer, {
    access: 'public',
    contentType: 'image/jpeg',
    allowOverwrite: true,
  });

  return res.status(200).json({ url: blob.url });
}
