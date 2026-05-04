import { useCallback, useEffect, useLayoutEffect, useRef, type RefObject } from 'react';

export type ThreadDomPaintLogOptions = {
    enabled: boolean;
    sessionId: string | null;
    /**
     * Compact fingerprint of what React last committed as thread inputs
     * (message ids/lengths, streaming buffer sizes, busy flags). Built by the caller.
     * Compare with {@link ThreadDomPaintSnapshot.dom} to spot stale UI.
     */
    reactFingerprint: string;
};

export type ThreadDomPaintSnapshot = {
    v: 1;
    kind: 'kletron.thread_dom_paint';
    seq: number;
    perfTime: number;
    iso: string;
    sessionId: string | null;
    reactFingerprint: string;
    /** Text sampled from the live DOM (scroll root), not from React props */
    dom: {
        streamingLive: null | { innerTextLen: number; innerTextPreview: string };
        streamingMarkdown: null | { innerTextLen: number; innerTextPreview: string };
        /** One entry per `[data-kletron-thread-row]` in document order (virtualized threads only expose visible rows) */
        rows: Array<{
            index: number;
            kind: string | null;
            id: string | null;
            innerTextLen: number;
            innerTextPreview: string;
        }>;
    };
};

function normalizePreview(s: string, maxLen: number): string {
    const t = s.replace(/\s+/g, ' ').trim();
    return t.length <= maxLen ? t : `${t.slice(0, maxLen)}…`;
}

function collectSnapshot(
    root: HTMLDivElement,
    sessionId: string | null,
    reactFingerprint: string,
    seq: number,
): ThreadDomPaintSnapshot {
    const live = root.querySelector('[data-kletron-streaming-live]') as HTMLElement | null;
    const md = root.querySelector('[data-kletron-streaming-markdown]') as HTMLElement | null;
    const rowNodes = Array.from(root.querySelectorAll('[data-kletron-thread-row]')) as HTMLElement[];

    const rows = rowNodes.map((el, index) => ({
        index,
        kind: el.getAttribute('data-kletron-kind'),
        id: el.getAttribute('data-kletron-id'),
        innerTextLen: el.innerText.length,
        innerTextPreview: normalizePreview(el.innerText, 220),
    }));

    return {
        v: 1,
        kind: 'kletron.thread_dom_paint',
        seq,
        perfTime: typeof performance !== 'undefined' ? performance.now() : 0,
        iso: new Date().toISOString(),
        sessionId,
        reactFingerprint,
        dom: {
            streamingLive: live
                ? {
                    innerTextLen: live.innerText.length,
                    innerTextPreview: normalizePreview(live.innerText, 420),
                }
                : null,
            streamingMarkdown: md
                ? {
                    innerTextLen: md.innerText.length,
                    innerTextPreview: normalizePreview(md.innerText, 420),
                }
                : null,
            rows,
        },
    };
}

/**
 * Logs what is actually painted inside the thread scroll root: row previews and the
 * streaming slot, after layout and on DOM mutations (e.g. markdown streaming).
 * Use {@link ThreadDomPaintLogOptions.reactFingerprint} from the parent to correlate
 * with the React model in the same console timeline.
 */
export function useThreadDomPaintLog(
    rootRef: RefObject<HTMLDivElement | null>,
    options: ThreadDomPaintLogOptions | undefined,
): void {
    const seqRef = useRef(0);
    const lastSerializedRef = useRef<string>('');

    const capture = useCallback(() => {
        if (!options?.enabled) return;
        const root = rootRef.current;
        if (!root) return;
        const snap = collectSnapshot(root, options.sessionId, options.reactFingerprint, ++seqRef.current);
        const serialized = JSON.stringify(snap);
        if (serialized === lastSerializedRef.current) return;
        lastSerializedRef.current = serialized;
        console.info('[kletron:thread-dom]', snap);
    }, [options, rootRef]);

    useLayoutEffect(() => {
        if (!options?.enabled) return;
        capture();
    }, [options?.enabled, options?.reactFingerprint, options?.sessionId, capture]);

    useEffect(() => {
        if (!options?.enabled) return;
        const root = rootRef.current;
        if (!root) return;

        let raf: number | null = null;
        const schedule = () => {
            if (raf != null) return;
            raf = requestAnimationFrame(() => {
                raf = null;
                capture();
            });
        };

        const mo = new MutationObserver(schedule);
        mo.observe(root, { subtree: true, childList: true, characterData: true, attributes: true });

        schedule();

        return () => {
            mo.disconnect();
            if (raf != null) cancelAnimationFrame(raf);
        };
    }, [options?.enabled, capture, rootRef]);
}
