/* eslint-disable @typescript-eslint/consistent-type-imports */
import type { NumezisAPI } from "../electron/preload";

export {};

declare global {
  interface Window {
    numezis: NumezisAPI;
  }
}
