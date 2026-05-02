/** Pure slash-command parsing for tests and command handler. */
export function parseSlashCommand(text: string): { cmd: string; rest: string; isSlash: boolean } {
    const t = text.trim();
    if (!t.startsWith("/")) {
        return { cmd: "", rest: t, isSlash: false };
    }
    const space = t.indexOf(" ");
    if (space === -1) {
        const cmd = t.slice(1).split("@")[0].toLowerCase();
        return { cmd, rest: "", isSlash: true };
    }
    const cmd = t.slice(1, space).split("@")[0].toLowerCase();
    return { cmd, rest: t.slice(space + 1).trim(), isSlash: true };
}
