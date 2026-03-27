/* eslint-disable @typescript-eslint/consistent-type-imports */
import type { KletronAPI } from "../electron/preload";

export {};

declare global {
  interface Window {
    kletron: KletronAPI;
  }
}
