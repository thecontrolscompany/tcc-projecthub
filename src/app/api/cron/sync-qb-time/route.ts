import { NextRequest, NextResponse } from 'next/server';
import { importQuickBooksTimeData } from '@/lib/qb-time/sync';

const NIGHTLY_SYNC_DAYS = 30;

export async function GET(request: NextRequest) {
  // Verify the request is from Vercel
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    console.log(`[${new Date().toISOString()}] Nightly cron triggered - syncing last ${NIGHTLY_SYNC_DAYS} days of QB Time data`);
    const result = await importQuickBooksTimeData(NIGHTLY_SYNC_DAYS);
    return NextResponse.json({ success: true, days: NIGHTLY_SYNC_DAYS, data: result });
  } catch (error) {
    console.error('QB Time sync failed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Sync failed' },
      { status: 500 }
    );
  }
}

export const preferredRegion = 'iad1';
