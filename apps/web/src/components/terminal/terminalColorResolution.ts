// FILE: terminalColorResolution.ts
// Purpose: Resolve CSS color tokens before passing colors into xterm APIs.
// Layer: Terminal runtime infrastructure

const RGB_COLOR_RE =
  /^rgba?\(\s*([\d.]+%?)\s*[, ]\s*([\d.]+%?)\s*[, ]\s*([\d.]+%?)(?:\s*[,/]\s*[\d.]+%?)?\s*\)$/i;
const SRGB_COLOR_RE = /^color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*[\d.]+)?\s*\)$/i;

export function resolveRootColorVariable(
  variableName: string,
  fallback: string,
  options: { format?: "computed" | "hex"; property?: "backgroundColor" | "color" } = {},
): string {
  if (typeof document === "undefined" || !document.body) {
    return fallback;
  }

  const property = options.property ?? "color";
  const probe = document.createElement("span");
  probe.style.position = "fixed";
  probe.style.pointerEvents = "none";
  probe.style.opacity = "0";
  probe.style[property] = `var(${variableName})`;
  document.body.append(probe);

  const computedStyles = getComputedStyle(probe);
  const resolvedColor = computedStyles[property].trim();
  probe.remove();

  if (!resolvedColor) return fallback;
  if (options.format === "hex") return computedColorToHex(resolvedColor) ?? fallback;
  return resolvedColor;
}

function computedColorToHex(color: string): string | null {
  if (/^#[0-9a-f]{6}$/i.test(color)) return color;

  const rgbMatch = RGB_COLOR_RE.exec(color);
  if (rgbMatch) {
    return rgbToHex(
      rgbChannelToByte(rgbMatch[1]),
      rgbChannelToByte(rgbMatch[2]),
      rgbChannelToByte(rgbMatch[3]),
    );
  }

  const srgbMatch = SRGB_COLOR_RE.exec(color);
  if (srgbMatch) {
    return rgbToHex(
      srgbChannelToByte(srgbMatch[1]),
      srgbChannelToByte(srgbMatch[2]),
      srgbChannelToByte(srgbMatch[3]),
    );
  }

  return null;
}

function rgbChannelToByte(channel: string | undefined): number {
  if (!channel) return 0;
  if (channel.endsWith("%")) return clampByte((Number.parseFloat(channel) / 100) * 255);
  return clampByte(Number.parseFloat(channel));
}

function srgbChannelToByte(channel: string | undefined): number {
  if (!channel) return 0;
  return clampByte(Number.parseFloat(channel) * 255);
}

function clampByte(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(255, Math.round(value)));
}

function rgbToHex(red: number, green: number, blue: number): string {
  return `#${byteToHex(red)}${byteToHex(green)}${byteToHex(blue)}`;
}

function byteToHex(value: number): string {
  return value.toString(16).padStart(2, "0");
}
