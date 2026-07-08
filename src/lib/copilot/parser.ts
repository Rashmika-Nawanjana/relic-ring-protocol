export type ParsedRequest = {
  origin_id: string;
  destination_id: string;
  message: string;
};

export type ParseResult =
  | { ok: true; request: ParsedRequest }
  | { ok: false; error: string };

function findPlanet(text: string, planetIds: readonly string[]): string | null {
  const lower = text.toLowerCase();
  for (const id of planetIds) {
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
 * Planet vocabulary comes from the universe config (dynamic parsing) —
 * pass `config.nodes.map((n) => n.id)`.
 *
 * Examples:
 *   "Send Caelum to Aegis: Hello world"
 *   "from Aegis to Caelum message ping"
 */
export function parseNaturalLanguageRequest(
  text: string,
  planetIds: readonly string[],
): ParseResult {
  const trimmed = text.trim();
  if (!trimmed) {
    return { ok: false, error: "Request text is empty" };
  }

  const fromTo =
    trimmed.match(/\bfrom\s+(\w+)\s+to\s+(\w+)\b/i) ??
    trimmed.match(/\b(\w+)\s+to\s+(\w+)\b/i) ??
    trimmed.match(/\bsend\s+(\w+)\s+(\w+)\b/i);

  if (fromTo) {
    const origin = findPlanet(fromTo[1]!, planetIds);
    const destination = findPlanet(fromTo[2]!, planetIds);
    if (!origin || !destination) {
      return {
        ok: false,
        error: `Unknown planet in "${fromTo[1]} → ${fromTo[2]}". Valid: ${planetIds.join(", ")}`,
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

  const found = planetIds.filter((id) =>
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
    error: `Could not parse origin/destination. Mention two planets from: ${planetIds.join(", ")}`,
  };
}

/** Accept structured fields or NL text in one entry point. */
export function parseCopilotInput(
  body: {
    text?: string;
    origin?: string;
    destination?: string;
    message?: string;
  },
  planetIds: readonly string[],
): ParseResult {
  if (body.origin && body.destination) {
    const origin = findPlanet(body.origin, planetIds);
    const destination = findPlanet(body.destination, planetIds);
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

  if (body.text) return parseNaturalLanguageRequest(body.text, planetIds);
  return { ok: false, error: "Provide text or origin+destination" };
}
