'use client';

import { useState, useEffect } from 'react';
import type { SystemMetadata } from './types';

interface UseSystemMetadataResult {
  metadata: SystemMetadata | null;
  loading: boolean;
  error: string | null;
}

export function useSystemMetadata(systemKey: string): UseSystemMetadataResult {
  const [metadata, setMetadata] = useState<SystemMetadata | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!systemKey) return;

    setLoading(true);
    setError(null);

    fetch(`/system-data/${systemKey}.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
        return r.json() as Promise<SystemMetadata>;
      })
      .then((data) => {
        setMetadata(data);
        setLoading(false);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : String(err));
        setLoading(false);
      });
  }, [systemKey]);

  return { metadata, loading, error };
}
