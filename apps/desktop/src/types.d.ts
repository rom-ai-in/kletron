import type { NumezisAPI } from "../electron/preload";

declare global {
  interface Window {
    numezis: NumezisAPI;
  }
}

export {};
