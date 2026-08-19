import { normalizeText, AMBIGUOUS_SURNAMES } from './matcher';

export interface CandidateCluster {
  id: string;
  canonicalQuery: string;
  normalizedQuery: string;
  allRawSpans: string[];
  allNormalizedSpans: string[];
  totalMentions: number;
  articleIds: string[];
}

export interface CandidateMention {
  rawText: string;
  norm: string;
  articleId: string;
}

/**
 * Cluster and canonicalize candidate text spans before upstream API resolution.
 * Groups variations (e.g. "Marcus Rashford", "Rashford", "M. Rashford" -> "Marcus Rashford").
 * Prefers the strongest/fullest name as the canonical resolution query.
 */
export function clusterCandidateMentions(mentions: CandidateMention[]): CandidateCluster[] {
  if (!mentions || mentions.length === 0) return [];

  // 1. Group mentions by normalized string
  const groupedByNorm = new Map<string, { rawSpans: Set<string>; count: number; articleIds: Set<string> }>();

  for (const m of mentions) {
    const norm = m.norm || normalizeText(m.rawText);
    if (!norm) continue;

    const existing = groupedByNorm.get(norm);
    if (existing) {
      existing.rawSpans.add(m.rawText);
      existing.count++;
      if (m.articleId) existing.articleIds.add(m.articleId);
    } else {
      groupedByNorm.set(norm, {
        rawSpans: new Set([m.rawText]),
        count: 1,
        articleIds: new Set(m.articleId ? [m.articleId] : []),
      });
    }
  }

  // 2. Sort groups by token count descending (e.g. 2-3 word full names before single surnames)
  const sortedNormGroups = Array.from(groupedByNorm.entries()).sort((a, b) => {
    const tokensA = a[0].split(/\s+/).length;
    const tokensB = b[0].split(/\s+/).length;
    if (tokensB !== tokensA) return tokensB - tokensA; // longer names first
    return b[1].count - a[1].count; // higher frequency first
  });

  const clusters: CandidateCluster[] = [];
  const assignedNorms = new Set<string>();

  for (const [norm, groupData] of sortedNormGroups) {
    if (assignedNorms.has(norm)) continue;

    const tokens = norm.split(/\s+/).filter(Boolean);
    const clusterRawSpans = new Set<string>(groupData.rawSpans);
    const clusterNormSpans = new Set<string>([norm]);
    const clusterArticleIds = new Set<string>(groupData.articleIds);
    let totalMentions = groupData.count;

    assignedNorms.add(norm);

    // If this is a multi-word name (e.g. "Marcus Rashford"), find related single tokens (e.g. "Rashford") or initial tokens
    if (tokens.length >= 2) {
      const surname = tokens[tokens.length - 1];
      const firstname = tokens[0];

      if (!AMBIGUOUS_SURNAMES.has(surname) && surname.length >= 4) {
        for (const [otherNorm, otherGroup] of sortedNormGroups) {
          if (assignedNorms.has(otherNorm)) continue;

          const otherTokens = otherNorm.split(/\s+/).filter(Boolean);

          // Subsume exact surname mononym (e.g. "Rashford" into "Marcus Rashford", "Batrakov" into "Aleksey Batrakov")
          const isSingleSurnameMatch = otherTokens.length === 1 && otherTokens[0] === surname;

          // Subsume initial + surname (e.g. "M. Rashford")
          const isInitialSurnameMatch =
            otherTokens.length === 2 &&
            otherTokens[1] === surname &&
            otherTokens[0].length === 1 &&
            firstname.startsWith(otherTokens[0]);

          // Subsume transliteration variants (e.g. "Aleksei Batrakov" into "Aleksey Batrakov")
          const isTransliterationMatch =
            otherTokens.length === 2 &&
            otherTokens[1] === surname &&
            (firstname.slice(0, 4) === otherTokens[0].slice(0, 4) ||
              firstname.startsWith(otherTokens[0]) ||
              otherTokens[0].startsWith(firstname));

          if (isSingleSurnameMatch || isInitialSurnameMatch || isTransliterationMatch) {
            assignedNorms.add(otherNorm);
            otherGroup.rawSpans.forEach((s) => clusterRawSpans.add(s));
            clusterNormSpans.add(otherNorm);
            otherGroup.articleIds.forEach((id) => clusterArticleIds.add(id));
            totalMentions += otherGroup.count;
          }
        }
      }
    }

    // Pick the most complete raw string as canonicalQuery
    const allRawList = Array.from(clusterRawSpans);
    const canonicalQuery = allRawList.reduce(
      (best, cur) => (cur.split(/\s+/).length > best.split(/\s+/).length ? cur : best),
      allRawList[0] || norm,
    );

    clusters.push({
      id: `cluster-${norm.replace(/\s+/g, '-')}`,
      canonicalQuery,
      normalizedQuery: norm,
      allRawSpans: allRawList,
      allNormalizedSpans: Array.from(clusterNormSpans),
      totalMentions,
      articleIds: Array.from(clusterArticleIds),
    });
  }

  // Sort clusters by mention frequency
  return clusters.sort((a, b) => b.totalMentions - a.totalMentions);
}
