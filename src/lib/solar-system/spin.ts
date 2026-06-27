/** Match ZetaPlanet equatorial spin so packet visuals stay on towers. */
export function planetSpinY(
  elapsedTime: number,
  rotationSpeed: number,
  isFocused: boolean,
): number {
  const speed = isFocused ? 0.015 : 0.05;
  return elapsedTime * speed * rotationSpeed;
}
