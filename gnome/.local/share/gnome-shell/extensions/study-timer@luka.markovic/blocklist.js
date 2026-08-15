import GLib from 'gi://GLib';
import Gio from 'gi://Gio';

/** Sites blocked out of the box, and what a fresh blocklist.txt is seeded with. */
export const DEFAULT_SITES = ['x.com', 'youtube.com', 'instagram.com', 'reddit.com'];

const HEADER = [
    '# Study Timer blocklist — one domain per line, # starts a comment.',
    '# Each entry blocks the bare domain and its www. form by pointing them',
    '# at 127.0.0.1 in /etc/hosts while blocking is on.',
    '',
].join('\n');

export const DEFAULT_TEXT = `${HEADER}${DEFAULT_SITES.join('\n')}\n`;

// Same shape the root helper enforces: labels of a-z 0-9 -, at least two of them.
const HOST_RE = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/;

export function blocklistPath() {
    return GLib.build_filenamev([GLib.get_user_config_dir(), 'study-timer', 'blocklist.txt']);
}

export function blocklistFile() {
    return Gio.File.new_for_path(blocklistPath());
}

/** Reads blocklist.txt, seeding it with the defaults the first time round. */
export function readBlocklistText() {
    const file = blocklistFile();

    try {
        const [ok, bytes] = file.load_contents(null);
        if (ok)
            return new TextDecoder().decode(bytes);
    } catch (e) {
        if (!e.matches?.(Gio.IOErrorEnum, Gio.IOErrorEnum.NOT_FOUND))
            logError(e, 'study-timer: could not read blocklist');
    }

    writeBlocklistText(DEFAULT_TEXT);
    return DEFAULT_TEXT;
}

export function writeBlocklistText(text) {
    const file = blocklistFile();

    try {
        file.get_parent().make_directory_with_parents(null);
    } catch (e) {
        if (!e.matches?.(Gio.IOErrorEnum, Gio.IOErrorEnum.EXISTS))
            throw e;
    }

    file.replace_contents(
        new TextEncoder().encode(text), null, false,
        Gio.FileCreateFlags.REPLACE_DESTINATION, null);
}

/** Turns the file's text into the clean, deduped host list the helper wants. */
export function parseHosts(text) {
    const hosts = [];

    for (const raw of text.split('\n')) {
        const host = raw.split('#')[0].trim().toLowerCase();
        if (!host || host.length > 253 || !HOST_RE.test(host))
            continue;
        if (!hosts.includes(host))
            hosts.push(host);
    }

    return hosts;
}
