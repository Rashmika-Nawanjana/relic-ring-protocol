export function toBase(value: number, base: number): string {
  if (value === 0) return "0";
  const digits = "0123456789ABCDEF";
  let n = value;
  let result = "";
  while (n > 0) {
    result = digits[n % base] + result;
    n = Math.floor(n / base);
  }
  return result;
}

export function encodePayloadAscii(message: string, base: number): string {
  const values = [...message].map((ch) => toBase(ch.charCodeAt(0), base));
  return `[${values.join(", ")}]`;
}
