import { NextResponse, type NextRequest } from 'next/server';
import { aggregateLiveRumors } from '@/lib/rumor/aggregator';
import type { RumorsApiResponse } from '@/types/transfer';

// Revalidate every 10 minutes (600 seconds) on edge/serverless
export const revalidate = 600;
export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
): Promise<NextResponse<RumorsApiResponse | { error: string }>> {
  try {
    const { searchParams } = new URL(req.url);
    const includeDiag = searchParams.get('diag') === '1' || process.env.NODE_ENV === 'development';

    const result = await aggregateLiveRumors();

    const response: RumorsApiResponse & { diagnostics?: Record<string, unknown> } = {
      data: result.rumors,
      meta: result.meta,
      ...(includeDiag && result.diagnostics ? { diagnostics: result.diagnostics } : {}),
    };

    return NextResponse.json(response);
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
