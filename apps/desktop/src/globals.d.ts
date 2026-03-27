/// <reference path="../electron/preload.ts" />

interface Window {
  kletron: import("../electron/preload").KletronAPI;
}
