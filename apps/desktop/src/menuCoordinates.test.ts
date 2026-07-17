import { describe, expect, it } from "vitest";

import { resolveMenuPopupPosition } from "./menuCoordinates";

describe("resolveMenuPopupPosition", () => {
  it.each([
    { zoomFactor: 0.8, expected: { x: 8, y: 16 } },
    { zoomFactor: 1, expected: { x: 10, y: 20 } },
    { zoomFactor: 1.25, expected: { x: 12, y: 25 } },
    { zoomFactor: 1.5, expected: { x: 15, y: 30 } },
    { zoomFactor: 2, expected: { x: 20, y: 40 } },
  ])("scales CSS pixels at $zoomFactor zoom", ({ zoomFactor, expected }) => {
    // Given renderer coordinates expressed in CSS pixels
    const position = { x: 10, y: 20 };

    // When the native popup position is resolved for the window zoom
    const result = resolveMenuPopupPosition(position, zoomFactor);

    // Then the coordinates are scaled once in native-window points
    expect(result).toEqual(expected);
  });

  it("floors only after multiplying fractional coordinates", () => {
    // Given fractional CSS-pixel coordinates
    const position = { x: 10.8, y: 20.2 };

    // When they are resolved at 200% zoom
    const result = resolveMenuPopupPosition(position, 2);

    // Then flooring happens after scaling
    expect(result).toEqual({ x: 21, y: 40 });
  });

  it("keeps zero coordinates as an explicit native position", () => {
    // Given the renderer origin
    const position = { x: 0, y: 0 };

    // When it is resolved at a valid zoom
    const result = resolveMenuPopupPosition(position, 1.25);

    // Then the native popup remains explicitly positioned at the origin
    expect(result).toEqual({ x: 0, y: 0 });
  });

  it.each([
    { label: "negative x", position: { x: -1, y: 20 } },
    { label: "negative y", position: { x: 10, y: -1 } },
    { label: "NaN x", position: { x: Number.NaN, y: 20 } },
    { label: "positive-infinite x", position: { x: Number.POSITIVE_INFINITY, y: 20 } },
    { label: "negative-infinite x", position: { x: Number.NEGATIVE_INFINITY, y: 20 } },
    { label: "NaN y", position: { x: 10, y: Number.NaN } },
    { label: "positive-infinite y", position: { x: 10, y: Number.POSITIVE_INFINITY } },
    { label: "negative-infinite y", position: { x: 10, y: Number.NEGATIVE_INFINITY } },
  ])("omits explicit coordinates for $label", ({ position }) => {
    // Given a renderer position outside the accepted coordinate domain
    // When the popup position is resolved
    const result = resolveMenuPopupPosition(position, 1);

    // Then Electron can use native cursor placement
    expect(result).toBeUndefined();
  });

  it.each([
    { label: "zero", zoomFactor: 0 },
    { label: "negative", zoomFactor: -1 },
    { label: "NaN", zoomFactor: Number.NaN },
    { label: "positive infinity", zoomFactor: Number.POSITIVE_INFINITY },
    { label: "negative infinity", zoomFactor: Number.NEGATIVE_INFINITY },
  ])("omits explicit coordinates for $label zoom", ({ zoomFactor }) => {
    // Given a valid renderer position and an invalid owner zoom
    // When the popup position is resolved
    const result = resolveMenuPopupPosition({ x: 10, y: 20 }, zoomFactor);

    // Then Electron can use native cursor placement
    expect(result).toBeUndefined();
  });
});
