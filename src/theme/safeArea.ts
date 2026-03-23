import { spacing } from "./tokens";

export function standardTopInset(insetTop: number): number {
  return insetTop;
}

export function immersiveTopChromeInset(insetTop: number): number {
  return Math.max(insetTop, 14);
}

export function guidedFlowTopInset(insetTop: number): number {
  return Math.max(insetTop + spacing.xxl, 56);
}

export function guidedFlowBodyTopInset(insetTop: number): number {
  return Math.max(Math.round(insetTop * 0.5), spacing.xl);
}

export function overlayChromeSpacerHeight(insetTop: number, chromeHeight: number): number {
  return immersiveTopChromeInset(insetTop) + chromeHeight;
}
