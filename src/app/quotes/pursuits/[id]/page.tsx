export const dynamic = "force-dynamic";

import { PursuitDetailClient } from "@/components/pursuit-detail-client";

export default async function PursuitDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PursuitDetailClient pursuitId={id} />;
}
