"use client";

import { useSyncExternalStore } from "react";

const noop = () => () => {};

export function UnlockError() {
  const wrong = useSyncExternalStore(noop, () => new URLSearchParams(window.location.search).has("e"), () => false);
  return wrong ? <p className="text-xs text-danger">Wrong passcode.</p> : null;
}
