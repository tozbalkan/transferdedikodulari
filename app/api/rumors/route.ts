import { NextResponse, type NextRequest } from 'next/server';
import { aggregateLiveRumors, type SafeDiagnostics } from '@/lib/rumor/aggregator';
import type { RumorsApiResponse } from '@/types/transfer';

// Revalidate every 2 minutes (120 seconds) on edge/serverless
export const revalidate = 120;
export const dynamic = 'force-dynamic';

interface RouteCacheEntry {
  data: RumorsApiResponse & { diagnostics?: SafeDiagnostics };
  generatedAt: number;
  revalidateAt: number;
}

let cachedRouteResult: RouteCacheEntry | null = null;
const ROUTE_CACHE_TTL_MS = 120 * 1000; // 120 seconds

export async function GET(
  req: NextRequest,
): Promise<NextResponse<RumorsApiResponse & { diagnostics?: SafeDiagnostics & { routeCache?: { hit: boolean; generatedAt: string; revalidateAt: string } } } | { error: string }>> {
  try {
    const { searchParams } = new URL(req.url);
    const includeDiag = searchParams.get('diag') === '1' || process.env.NODE_ENV === 'development';
    const forceRefresh = searchParams.get('refresh') === '1';

    const now = Date.now();

    // Check server route cache
    if (!forceRefresh && cachedRouteResult && now < cachedRouteResult.revalidateAt) {
      const cached = cachedRouteResult.data;
      const diagWithCache = includeDiag && cached.diagnostics ? {
        ...cached.diagnostics,
        routeCache: {
          hit: true,
          generatedAt: new Date(cachedRouteResult.generatedAt).toISOString(),
          revalidateAt: new Date(cachedRouteResult.revalidateAt).toISOString(),
        },
      } : undefined;

      return NextResponse.json({
        ...cached,
        ...(diagWithCache ? { diagnostics: diagWithCache } : {}),
      }, {
        headers: {
          'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=60',
        },
      });
    }

    const result = await aggregateLiveRumors(forceRefresh);

    const routeCacheMeta = {
      hit: false,
      generatedAt: new Date(now).toISOString(),
      revalidateAt: new Date(now + ROUTE_CACHE_TTL_MS).toISOString(),
    };

    const response: RumorsApiResponse & { diagnostics?: SafeDiagnostics & { routeCache?: typeof routeCacheMeta } } = {
      data: result.rumors,
      meta: result.meta,
      ...(includeDiag && result.diagnostics ? {
        diagnostics: {
          ...result.diagnostics,
          routeCache: routeCacheMeta,
        },
      } : {}),
    };

    cachedRouteResult = {
      data: response,
      generatedAt: now,
      revalidateAt: now + ROUTE_CACHE_TTL_MS,
    };

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=60',
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unknown server error during rumor aggregation';
    return NextResponse.json(
      {
        error: message,
      },
      { status: 500 },
    );
  }
}
