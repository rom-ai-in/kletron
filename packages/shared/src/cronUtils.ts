/**
 * Lightweight cron utilities — no external dependencies.
 *
 * Supports standard 5-field cron expressions:
 *   minute  hour  day-of-month  month  day-of-week
 *
 * Field syntax: *, N, N-M, N/step, *​/step, N,M,O
 */

// ─── Parsing helpers ───────────────────────────────────────────────────────────

function parseField(field: string, min: number, max: number): number[] {
    const values = new Set<number>();

    for (const part of field.split(",")) {
        const trimmed = part.trim();

        if (trimmed === "*") {
            for (let i = min; i <= max; i++) values.add(i);
            continue;
        }

        // */step
        const allStep = trimmed.match(/^\*\/(\d+)$/);
        if (allStep) {
            const step = parseInt(allStep[1], 10);
            for (let i = min; i <= max; i += step) values.add(i);
            continue;
        }

        // range with optional step: N-M or N-M/step
        const rangeMatch = trimmed.match(/^(\d+)-(\d+)(?:\/(\d+))?$/);
        if (rangeMatch) {
            const start = parseInt(rangeMatch[1], 10);
            const end = parseInt(rangeMatch[2], 10);
            const step = rangeMatch[3] ? parseInt(rangeMatch[3], 10) : 1;
            for (let i = start; i <= end; i += step) {
                if (i >= min && i <= max) values.add(i);
            }
            continue;
        }

        // plain number
        const num = parseInt(trimmed, 10);
        if (!isNaN(num) && num >= min && num <= max) {
            values.add(num);
        }
    }

    return Array.from(values).sort((a, b) => a - b);
}

interface ParsedCron {
    minutes: number[];
    hours: number[];
    daysOfMonth: number[];
    months: number[];
    daysOfWeek: number[];
}

function parseCron(cron: string): ParsedCron {
    const parts = cron.trim().split(/\s+/);
    if (parts.length !== 5) {
        throw new Error(`Invalid cron expression: expected 5 fields, got ${parts.length}`);
    }
    return {
        minutes: parseField(parts[0], 0, 59),
        hours: parseField(parts[1], 0, 23),
        daysOfMonth: parseField(parts[2], 1, 31),
        months: parseField(parts[3], 1, 12),
        daysOfWeek: parseField(parts[4], 0, 6), // 0 = Sunday
    };
}

// ─── Timezone helper ───────────────────────────────────────────────────────────

/**
 * Convert a Date to its wall-clock components in a given IANA timezone.
 * Falls back to UTC if the timezone is invalid.
 */
function dateInTimezone(date: Date, timezone: string): {
    year: number; month: number; day: number;
    hour: number; minute: number; dayOfWeek: number;
} {
    try {
        const parts = new Intl.DateTimeFormat("en-US", {
            timeZone: timezone,
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            weekday: "short",
            hour12: false,
        }).formatToParts(date);

        const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
        const weekdayMap: Record<string, number> = {
            Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
        };

        return {
            year: parseInt(get("year"), 10),
            month: parseInt(get("month"), 10),
            day: parseInt(get("day"), 10),
            hour: parseInt(get("hour"), 10),
            minute: parseInt(get("minute"), 10),
            dayOfWeek: weekdayMap[get("weekday")] ?? date.getUTCDay(),
        };
    } catch {
        // Fallback to UTC
        return {
            year: date.getUTCFullYear(),
            month: date.getUTCMonth() + 1,
            day: date.getUTCDate(),
            hour: date.getUTCHours(),
            minute: date.getUTCMinutes(),
            dayOfWeek: date.getUTCDay(),
        };
    }
}

// ─── computeNextRun ────────────────────────────────────────────────────────────

/**
 * Compute the next run time for a cron expression in a given timezone.
 * Searches up to 366 days into the future.
 *
 * @param cron - Standard 5-field cron expression
 * @param timezone - IANA timezone string (e.g. "Europe/Zurich")
 * @param after - Start searching after this date (default: now)
 * @returns The next matching Date (in UTC), or null if none found within 366 days
 */
export function computeNextRun(cron: string, timezone: string, after?: Date): Date | null {
    const parsed = parseCron(cron);

    // Start one minute after the "after" time (we don't want to re-fire the same minute)
    const start = after ? new Date(after.getTime()) : new Date();
    start.setSeconds(0, 0);
    start.setTime(start.getTime() + 60_000); // advance 1 minute

    const MAX_ITERATIONS = 366 * 24 * 60; // 1 year of minutes
    const cursor = new Date(start.getTime());

    for (let i = 0; i < MAX_ITERATIONS; i++) {
        const tz = dateInTimezone(cursor, timezone);

        if (
            parsed.months.includes(tz.month) &&
            parsed.daysOfMonth.includes(tz.day) &&
            parsed.daysOfWeek.includes(tz.dayOfWeek) &&
            parsed.hours.includes(tz.hour) &&
            parsed.minutes.includes(tz.minute)
        ) {
            return new Date(cursor.getTime());
        }

        // Advance by 1 minute
        cursor.setTime(cursor.getTime() + 60_000);
    }

    return null;
}

// ─── describeCron ──────────────────────────────────────────────────────────────

/**
 * Return a human-readable description of a cron expression.
 * Covers common patterns; falls back to the raw expression for complex ones.
 */
export function describeCron(cron: string): string {
    const parts = cron.trim().split(/\s+/);
    if (parts.length !== 5) return cron;

    const [minute, hour, dom, month, dow] = parts;

    const pad = (n: string) => n.padStart(2, "0");

    // Every minute
    if (minute === "*" && hour === "*" && dom === "*" && month === "*" && dow === "*") {
        return "Every minute";
    }

    // Every N minutes
    const everyMinMatch = minute.match(/^\*\/(\d+)$/);
    if (everyMinMatch && hour === "*" && dom === "*" && month === "*" && dow === "*") {
        const n = parseInt(everyMinMatch[1], 10);
        return n === 1 ? "Every minute" : `Every ${n} minutes`;
    }

    // Every N hours
    if (minute !== "*" && !minute.includes("/") && !minute.includes("-") && !minute.includes(",")) {
        const everyHourMatch = hour.match(/^\*\/(\d+)$/);
        if (everyHourMatch && dom === "*" && month === "*" && dow === "*") {
            const n = parseInt(everyHourMatch[1], 10);
            return n === 1 ? `Every hour at :${pad(minute)}` : `Every ${n} hours at :${pad(minute)}`;
        }
    }

    // Specific time daily
    if (
        !minute.includes("*") && !minute.includes("/") &&
        !hour.includes("*") && !hour.includes("/") &&
        dom === "*" && month === "*" && dow === "*"
    ) {
        return `Daily at ${pad(hour)}:${pad(minute)}`;
    }

    // Specific time on weekdays
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    if (
        !minute.includes("*") && !minute.includes("/") &&
        !hour.includes("*") && !hour.includes("/") &&
        dom === "*" && month === "*" && dow !== "*"
    ) {
        const days = parseField(dow, 0, 6).map((d) => dayNames[d]);
        return `${days.join(", ")} at ${pad(hour)}:${pad(minute)}`;
    }

    // Specific time on specific days of month
    if (
        !minute.includes("*") && !minute.includes("/") &&
        !hour.includes("*") && !hour.includes("/") &&
        dom !== "*" && month === "*" && dow === "*"
    ) {
        return `Day ${dom} of every month at ${pad(hour)}:${pad(minute)}`;
    }

    // Fallback
    return `Cron: ${cron}`;
}
