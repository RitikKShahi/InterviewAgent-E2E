"use client";

import * as React from "react";
import { exitFs, stopAllMediaTracks } from "./proctor";

/**
 * <ProctorCleanup />
 * Mounted on post-interview pages (like /report/[id]) to guarantee that:
 * 1. Fullscreen is automatically exited.
 * 2. Any active camera/mic MediaStream tracks are terminated immediately.
 */
export function ProctorCleanup() {
  React.useEffect(() => {
    exitFs();
    stopAllMediaTracks();
  }, []);

  return null;
}
