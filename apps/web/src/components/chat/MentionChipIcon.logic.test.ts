import { afterEach, describe, expect, it } from "vitest";
import { createMentionChipIconElement } from "./MentionChipIcon.logic";

function installDocumentStub() {
  const children: unknown[] = [];
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      createElement: (tagName: string) => ({
        tagName: tagName.toUpperCase(),
        ariaHidden: "false",
        className: "",
        children,
        alt: "",
        loading: "",
        src: "",
        appendChild: (child: unknown) => {
          children.push(child);
        },
        addEventListener: () => undefined,
        replaceWith: () => undefined,
      }),
      importNode: (node: unknown) => node,
    },
  });
  Object.defineProperty(globalThis, "DOMParser", {
    configurable: true,
    value: class DOMParserStub {
      parseFromString() {
        return {
          documentElement: {
            nodeName: "svg",
          },
        };
      }
    },
  });
}

afterEach(() => {
  Reflect.deleteProperty(globalThis, "document");
  Reflect.deleteProperty(globalThis, "DOMParser");
});

describe("createMentionChipIconElement", () => {
  it("renders plugin mentions as hidden static icon spans", () => {
    installDocumentStub();

    const element = createMentionChipIconElement("plugin://GitHub@codex", "dark", "plugin");

    expect(element.tagName).toBe("SPAN");
    expect(element.ariaHidden).toBe("true");
    expect(element.children).toHaveLength(1);
  });
});
