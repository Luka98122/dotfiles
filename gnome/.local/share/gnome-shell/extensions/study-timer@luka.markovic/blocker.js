import Gio from 'gi://Gio';

import {parseHosts, readBlocklistText} from './blocklist.js';

/** Installed by scripts/setup-study-timer-block.sh; runs as root via polkit. */
export const HELPER_PATH = '/usr/local/libexec/study-timer-hosts';

const HOSTS_PATH = '/etc/hosts';
const BEGIN_MARKER = '# >>> study-timer >>>';

export function helperInstalled() {
    return Gio.File.new_for_path(HELPER_PATH).query_exists(null);
}

/** Whether our block is currently sitting in /etc/hosts. */
export function blockApplied() {
    try {
        const [ok, bytes] = Gio.File.new_for_path(HOSTS_PATH).load_contents(null);
        return ok && new TextDecoder().decode(bytes).includes(BEGIN_MARKER);
    } catch (e) {
        logError(e, 'study-timer: could not read /etc/hosts');
        return false;
    }
}

/**
 * Drives the root helper that owns the managed block in /etc/hosts.
 *
 * Calls are serialised through a promise chain: pkexec runs are slow enough
 * that a start-then-stop in quick succession could otherwise land out of
 * order and strand the block in the wrong state.
 */
export class Blocker {
    constructor({onError, dropConnections} = {}) {
        this._onError = onError ?? (() => {});
        this._dropConnections = dropConnections ?? (() => true);
        this._queue = Promise.resolve();
        this._destroyed = false;

        // What /etc/hosts says right now, so a block left behind by a crash or
        // a logout gets cleared on the first sync rather than lingering.
        this._target = blockApplied();
    }

    get blocked() {
        return this._target;
    }

    /** Applies or clears the block; a no-op when already in that state. */
    setBlocked(blocked) {
        if (blocked === this._target)
            return;

        this._target = blocked;
        this._enqueue(blocked);
    }

    /** Re-pushes the list after blocklist.txt changed under a live block. */
    refresh() {
        if (this._target)
            this._enqueue(true);
    }

    _enqueue(blocked) {
        this._queue = this._queue
            .then(() => this._run(blocked))
            .catch(e => {
                if (this._destroyed) {
                    logError(e, 'study-timer: blocking failed');
                    return;
                }

                // Don't claim a state we failed to reach; the next sync retries.
                this._target = blockApplied();
                this._onError(e);
            });
    }

    async _run(blocked) {
        if (this._destroyed)
            return;

        if (!helperInstalled())
            throw new Error(`blocking helper is not installed at ${HELPER_PATH}`);

        const hosts = blocked ? parseHosts(readBlocklistText()) : [];
        if (blocked && hosts.length === 0)
            throw new Error('the blocklist is empty — nothing to block');

        const argv = ['pkexec', HELPER_PATH, blocked ? 'apply' : 'clear'];
        if (blocked && !this._dropConnections())
            argv.push('--keep-connections');

        const proc = Gio.Subprocess.new(
            argv, Gio.SubprocessFlags.STDIN_PIPE | Gio.SubprocessFlags.STDERR_PIPE);

        const stderr = await this._communicate(
            proc, blocked ? `${hosts.join('\n')}\n` : null);

        if (!proc.get_successful())
            throw new Error(stderr.trim() || 'the helper exited with an error');
    }

    /**
     * Hand-rolled rather than awaited directly: the shell doesn't promisify
     * communicate_utf8_async, so awaiting it drops the callback argument.
     */
    _communicate(proc, stdin) {
        return new Promise((resolve, reject) => {
            proc.communicate_utf8_async(stdin, null, (source, res) => {
                try {
                    const [, , stderr] = source.communicate_utf8_finish(res);
                    resolve(stderr ?? '');
                } catch (e) {
                    reject(e);
                }
            });
        });
    }

    /**
     * Best-effort unblock on shutdown. Deliberately fire-and-forget: waiting on
     * pkexec here would freeze the shell if polkit decided to prompt. Anything
     * left behind is cleared by the next startup, which reconciles against
     * what /etc/hosts actually contains.
     */
    destroy() {
        if (this._target && helperInstalled()) {
            try {
                Gio.Subprocess.new(['pkexec', HELPER_PATH, 'clear'], Gio.SubprocessFlags.NONE);
            } catch (e) {
                logError(e, 'study-timer: could not clear the block on shutdown');
            }
        }

        this._destroyed = true;
        this._target = false;
    }
}
