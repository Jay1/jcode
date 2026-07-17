import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  MacTrafficLightInsetLayout,
  resolveMacTrafficLightInset,
  type MacTrafficLightInsetKind,
  type MacTrafficLightInsetProperty,
} from "./macTrafficLightInset";

const consumers = [
  { id: "sidebar-titlebar", kind: "titlebar", insetProperty: "padding-left" },
  { id: "empty-chat-titlebar", kind: "titlebar", insetProperty: "padding-left" },
  { id: "active-chat-titlebar", kind: "titlebar", insetProperty: "padding-left" },
  {
    id: "collapsed-sidebar-trigger",
    kind: "collapsed-sidebar-trigger",
    insetProperty: "margin-left",
  },
] as const satisfies ReadonlyArray<{
  readonly id: string;
  readonly insetProperty: MacTrafficLightInsetProperty;
  readonly kind: MacTrafficLightInsetKind;
}>;

function MacElectronTrafficLightFixture({ isFullscreen }: { readonly isFullscreen: boolean }) {
  return (
    <div data-fullscreen={String(isFullscreen)}>
      {consumers.map((consumer) => {
        const inset = resolveMacTrafficLightInset({
          kind: consumer.kind,
          isElectron: true,
          isMac: true,
          isFullscreen,
        });
        return (
          <MacTrafficLightInsetLayout
            data-consumer={consumer.id}
            inset={inset}
            insetProperty={consumer.insetProperty}
            key={consumer.id}
          />
        );
      })}
    </div>
  );
}

describe("simulated macOS Electron traffic-light layouts", () => {
  it("applies all four windowed consumer styles through the production primitive", () => {
    // Given a rendered simulated macOS Electron window
    // When it is windowed
    const html = renderToStaticMarkup(<MacElectronTrafficLightFixture isFullscreen={false} />);

    // Then titlebars and the collapsed trigger reserve their distinct native clearances
    expect(html.match(/padding-left:90px/g)).toHaveLength(3);
    expect(html.match(/margin-left:76px/g)).toHaveLength(1);
  });

  it("removes all four production primitive styles while fullscreen", () => {
    // Given the same rendered simulated macOS Electron layouts
    // When the native window is already fullscreen
    const html = renderToStaticMarkup(<MacElectronTrafficLightFixture isFullscreen />);

    // Then no consumer retains either windowed reservation
    expect(html).not.toContain("padding-left:90px");
    expect(html).not.toContain("margin-left:76px");
    expect(html.match(/data-mac-traffic-light-inset="0"/g)).toHaveLength(4);
  });
});
