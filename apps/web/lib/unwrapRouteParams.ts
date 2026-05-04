import { use } from "react";

/**
 * Next.js 15 may pass `params` as a Promise; Next.js 14 passes a plain object.
 * Use this instead of `use(params)` so both runtimes work.
 */
export function unwrapRouteParams<T>(params: T | Promise<T>): T {
    if (params instanceof Promise) {
        return use(params);
    }
    return params as T;
}
