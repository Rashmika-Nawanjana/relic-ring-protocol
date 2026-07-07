/** Canonical link_id: two planet IDs joined alphabetically (e.g. Aegis-Elysium). */
export function canonicalLinkId(planetA: string, planetB: string): string {
  return [planetA, planetB].sort().join("-");
}

export function normalizeLinkId(linkId: string): string {
  const [a, b] = linkId.split("-");
  if (!a || !b) return linkId;
  return canonicalLinkId(a, b);
}
