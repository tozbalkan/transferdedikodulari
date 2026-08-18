import { NextResponse } from 'next/server';
import {
  getGalatasaraySquad,
  resolveGalatasarayTeam,
  ApiFootballKeyMissingError,
} from '@/lib/api-football';
import type { PlayersApiResponse } from '@/types/transfer';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse<PlayersApiResponse | { error: string }>> {
  try {
    const team = await resolveGalatasarayTeam();
    const players = await getGalatasaraySquad(team.id);

    const response: PlayersApiResponse = {
      data: players,
      meta: {
        total: players.length,
        teamName: team.name,
        teamId: team.id,
        generatedAt: new Date().toISOString(),
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof ApiFootballKeyMissingError) {
      return NextResponse.json(
        { error: 'API_FOOTBALL_KEY is missing. Please set it in .env.local' },
        { status: 500 },
      );
    }
    const message = error instanceof Error ? error.message : 'Failed to fetch players';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
