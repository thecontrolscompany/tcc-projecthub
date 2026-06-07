import fs from 'node:fs';
import path from 'node:path';

import { NextResponse } from 'next/server';

import { getTemplateAssetFilePath } from '@/lib/projecthub-system-templates';

export const runtime = 'nodejs';

function getContentType(filePath: string) {
  switch (path.extname(filePath).toLowerCase()) {
    case '.png':
      return 'image/png';
    case '.gif':
      return 'image/gif';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.svg':
      return 'image/svg+xml';
    case '.webp':
      return 'image/webp';
    case '.css':
      return 'text/css; charset=utf-8';
    case '.js':
      return 'text/javascript; charset=utf-8';
    default:
      return 'application/octet-stream';
  }
}

export async function GET(
  _request: Request,
  {
    params,
  }: {
    params: Promise<{ templateId: string; assetPath: string[] }> | { templateId: string; assetPath: string[] };
  }
) {
  const resolvedParams = await params;
  const relativeAssetPath = resolvedParams.assetPath.join('/');
  const filePath = getTemplateAssetFilePath(resolvedParams.templateId, relativeAssetPath);

  if (!filePath || !fs.existsSync(filePath)) {
    return NextResponse.json({ error: 'Asset not found.' }, { status: 404 });
  }

  const contentType = getContentType(filePath);
  const bytes = fs.readFileSync(filePath);

  return new NextResponse(bytes, {
    headers: {
      'content-type': contentType,
      'cache-control': 'public, max-age=31536000, immutable',
    },
  });
}
