import { NextResponse } from 'next/server';

import { buildTemplateGraphicPackage } from '@/lib/projecthub-system-templates/templateGraphicPackage';

export const runtime = 'nodejs';

export async function GET(
  _request: Request,
  {
    params,
  }: {
    params: Promise<{ templateId: string }> | { templateId: string };
  }
) {
  const resolvedParams = await params;
  const packageData = buildTemplateGraphicPackage(resolvedParams.templateId);

  if (!packageData) {
    return NextResponse.json({ error: 'Template graphic package not found.' }, { status: 404 });
  }

  return NextResponse.json(packageData, {
    headers: {
      'cache-control': 'no-store',
    },
  });
}
