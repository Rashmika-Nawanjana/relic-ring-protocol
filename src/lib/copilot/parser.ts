const PLANET_IDS = [
  "Aegis",
  "Boreas",
  "Dawn",
  "Elysium",
  "Fenix",
  "Caelum",
] as const;

export type ParsedRequest = {
  origin_id: string;
  destination_id: string;
  message: string;
};

export type ParseResult =
  | { ok: true; request: ParsedRequest }
  | { ok: false; error: string };

function findPlanet(text: string): string | null {
  const lower = text.toLowerCase();
  for (const id of PLANET_IDS) {
    if (lower.includes(id.toLowerCase())) return id;
  }
  return null;
}

function extractMessage(text: string, origin: string, destination: string): string {
  const colon = text.match(/:\s*(.+)$/);
  if (colon?.[1]?.trim()) return colon[1].trim();

  const quoted = text.match(/["']([^"']+)["']/);
  if (quoted?.[1]) return quoted[1];

  const msgMatch = text.match(/\bmessage\s+(.+)$/i);
  if (msgMatch?.[1]) return msgMatch[1].trim();

  const stripped = text
    .replace(new RegExp(origin, "gi"), "")
    .replace(new RegExp(destination, "gi"), "")
    .replace(/\b(send|from|to|packet|transmit|route)\b/gi, "")
    .trim();
  return stripped || "Hello world";
}

/**
 * Parse unstructured NL into origin, destination, and payload.
 * Examples:
 *   "Send Caelum to Aegis: Hello world"
 *   "from Aegis to Caelum message ping"
 */
export function parseNaturalLanguageRequest(text: string): ParseResult {
  const trimmed = text.trim();
  if (!trimmed) {
    return { ok: false, error: "Request text is empty" };
  }

  const fromTo =
    trimmed.match(/\bfrom\s+(\w+)\s+to\s+(\w+)\b/i) ??
    trimmed.match(/\b(\w+)\s+to\s+(\w+)\b/i) ??
    trimmed.match(/\bsend\s+(\w+)\s+(\w+)\b/i);

  if (fromTo) {
    const origin = findPlanet(fromTo[1]!);
    const destination = findPlanet(fromTo[2]!);
    if (!origin || !destination) {
      return {
        ok: false,
        error: `Unknown planet in "${fromTo[1]} → ${fromTo[2]}". Valid: ${PLANET_IDS.join(", ")}`,
      };
    }
    if (origin === destination) {
      return { ok: false, error: "Origin and destination must differ" };
    }
    return {
      ok: true,
      request: {
        origin_id: origin,
        destination_id: destination,
        message: extractMessage(trimmed, origin, destination),
      },
    };
  }

  const found = PLANET_IDS.filter((id) =>
    trimmed.toLowerCase().includes(id.toLowerCase()),
  );
  if (found.length >= 2) {
    return {
      ok: true,
      request: {
        origin_id: found[0]!,
        destination_id: found[1]!,
        message: extractMessage(trimmed, found[0]!, found[1]!),
      },
    };
  }

  return {
    ok: false,
    error: `Could not parse origin/destination. Mention two planets from: ${PLANET_IDS.join(", ")}`,
  };
}

/** Accept structured fields or NL text in one entry point. */
export function parseCopilotInput(body: {
  text?: string;
  origin?: string;
  destination?: string;
  message?: string;
}): ParseResult {
  if (body.origin && body.destination) {
    const origin = findPlanet(body.origin);
    const destination = findPlanet(body.destination);
    if (!origin || !destination) {
      return { ok: false, error: "Invalid origin or destination planet id" };
    }
    if (origin === destination) {
      return { ok: false, error: "Origin and destination must differ" };
    }
    return {
      ok: true,
      request: {
        origin_id: origin,
        destination_id: destination,
        message: body.message?.trim() || "Hello world",
      },
    };
  }

  if (body.text) return parseNaturalLanguageRequest(body.text);
  return { ok: false, error: "Provide text or origin+destination" };
}

export { PLANET_IDS };
