'use client';

import { useState, useEffect, useCallback } from 'react';
import type { TransferRumor, RumorsApiMeta, RumorsApiResponse } from '@/types/transfer';

export function useTransferData() {
  const [rumors, setRumors] = useState<TransferRumor[]>([]);
  const [meta, setMeta] = useState<RumorsApiMeta | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRumors = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch('/api/rumors');
      if (!res.ok) {
        throw new Error(`Sunucu hatası: ${res.status}`);
      }
      const data: RumorsApiResponse = await res.json();
      setRumors(data.data || []);
      setMeta(data.meta);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Veriler alınamadı');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadInitial() {
      try {
        const res = await fetch('/api/rumors');
        if (!res.ok) throw new Error(`Sunucu hatası: ${res.status}`);
        const data: RumorsApiResponse = await res.json();
        if (isMounted) {
          setRumors(data.data || []);
          setMeta(data.meta);
          setIsLoading(false);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Veriler alınamadı');
          setIsLoading(false);
        }
      }
    }

    loadInitial();
    const timer = setInterval(fetchRumors, 5 * 60 * 1000);

    return () => {
      isMounted = false;
      clearInterval(timer);
    };
  }, [fetchRumors]);

  return {
    rumors,
    meta,
    isLoading,
    error,
    refetch: fetchRumors,
  };
}
