import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";

import { useDesktopFullscreen } from "./desktopFullscreen";
import { isElectron } from "./env";
import { isMacPlatform } from "./lib/utils";

export type MacTrafficLightInsetKind = "titlebar" | "collapsed-sidebar-trigger";

export type MacTrafficLightInsetProperty = "padding-left" | "margin-left";

export type MacTrafficLightInsetInput = {
  readonly kind: MacTrafficLightInsetKind;
  readonly isElectron: boolean;
  readonly isMac: boolean;
  readonly isFullscreen: boolean;
};

export function resolveMacTrafficLightInset(input: MacTrafficLightInsetInput): number {
  if (!input.isElectron || !input.isMac || input.isFullscreen) {
    return 0;
  }

  return input.kind === "titlebar" ? 90 : 76;
}

export function MacTrafficLightInsetLayout({
  enabled = true,
  inset,
  insetProperty,
  render,
  style,
  ...props
}: useRender.ComponentProps<"div"> & {
  readonly enabled?: boolean;
  readonly inset: number;
  readonly insetProperty: MacTrafficLightInsetProperty;
}) {
  const resolvedStyle =
    enabled && inset > 0
      ? insetProperty === "padding-left"
        ? { ...style, paddingLeft: inset }
        : { ...style, marginLeft: inset }
      : style;
  const defaultProps = {
    "data-mac-traffic-light-inset": enabled ? inset : 0,
    "data-mac-traffic-light-inset-property": insetProperty,
    style: resolvedStyle,
  };

  return useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(defaultProps, props),
    render,
  });
}

export function useMacTrafficLightInset(kind: MacTrafficLightInsetKind): number {
  const isFullscreen = useDesktopFullscreen();

  return resolveMacTrafficLightInset({
    kind,
    isElectron,
    isMac: typeof navigator !== "undefined" && isMacPlatform(navigator.platform),
    isFullscreen,
  });
}
