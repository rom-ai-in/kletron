/// <reference path="../electron/preload.ts" />

interface Window {
  numezis: import("../electron/preload").NumezisAPI;
}
