import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as MessageTray from 'resource:///org/gnome/shell/ui/messageTray.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

import {blocklistFile} from './blocklist.js';
import {Blocker, helperInstalled} from './blocker.js';

const State = {
    IDLE: 'idle',
    RUNNING: 'running',
    PAUSED: 'paused',
    OVERTIME: 'overtime',
};

// Sessions offered as one-click presets, in minutes.
const PRESETS = [
    {label: '45 min', minutes: 45},
    {label: '1:30 h', minutes: 90},
];

// Top-ups offered while a session is running, in minutes.
const TOP_UPS = [5, 15];

const MINUTE = 60 * 1000;

const ICON_BASE_CLASS = 'system-status-icon study-timer-icon';
const LABEL_BASE_CLASS = 'study-timer-remaining';

function pad(n) {
    return n < 10 ? `0${n}` : `${n}`;
}

/** Renders a duration as m:ss, or h:mm:ss once it passes an hour. */
function formatDuration(ms) {
    const total = Math.max(0, Math.round(ms / 1000));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor(total / 60) % 60;
    const seconds = total % 60;

    return hours > 0
        ? `${hours}:${pad(minutes)}:${pad(seconds)}`
        : `${minutes}:${pad(seconds)}`;
}

/** Renders a duration in words, for menu labels and notifications. */
function describeDuration(ms) {
    const total = Math.max(0, Math.round(ms / 60000));
    const hours = Math.floor(total / 60);
    const minutes = total % 60;

    if (hours > 0)
        return minutes > 0 ? `${hours} h ${minutes} min` : `${hours} h`;
    return `${minutes} min`;
}

const StudyTimerIndicator = GObject.registerClass(
class StudyTimerIndicator extends PanelMenu.Button {
    _init(extension) {
        super._init(0.5, 'Study Timer');

        this._extension = extension;
        this._state = State.IDLE;
        this._endsAt = 0;         // wall clock ms, while running
        this._pausedLeft = 0;     // ms left, while paused
        this._sessionMs = 0;      // total length of the current session
        this._tickId = 0;

        this._desktopSettings = new Gio.Settings({
            schema_id: 'org.gnome.desktop.interface',
        });
        this._settings = extension.getSettings();

        const box = new St.BoxLayout({style_class: 'study-timer-box'});
        this._icon = new St.Icon({
            icon_name: 'alarm-symbolic',
            style_class: ICON_BASE_CLASS,
            y_align: Clutter.ActorAlign.CENTER,
        });
        this._timerLabel = new St.Label({
            style_class: LABEL_BASE_CLASS,
            y_align: Clutter.ActorAlign.CENTER,
            visible: false,
        });
        box.add_child(this._icon);
        box.add_child(this._timerLabel);
        this.add_child(box);

        this._setupBlocking();
        this._buildMenu();
        this._sync();
        this._scheduleTick();

        // Only the menu's "ends at" line is clock-formatted now.
        this._formatChangedId = this._desktopSettings.connect(
            'changed::clock-format', () => this._sync());
    }

    /**
     * The blocker mirrors whatever _sync() computes; it only shells out to the
     * root helper when that answer actually changes.
     */
    _setupBlocking() {
        this._blocker = new Blocker({
            onError: e => this._onBlockingFailed(e),
        });
        // Start from what /etc/hosts actually says: if a previous session left
        // a block behind, the first sync is what lifts it.
        this._blockWanted = this._blocker.blocked;

        this._settingsChangedIds = ['block-during-session', 'manual-block'].map(
            key => this._settings.connect(`changed::${key}`, () => this._sync()));

        // Picks up edits made in preferences, or in the file by hand.
        this._blocklistMonitor = blocklistFile().monitor_file(
            Gio.FileMonitorFlags.NONE, null);
        this._blocklistChangedId = this._blocklistMonitor.connect(
            'changed', () => this._queueBlocklistRefresh());
        this._refreshId = 0;
    }

    /** One save fires several monitor events; re-push the list only once. */
    _queueBlocklistRefresh() {
        if (this._refreshId)
            GLib.Source.remove(this._refreshId);

        this._refreshId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 800, () => {
            this._refreshId = 0;
            this._blocker.refresh();
            return GLib.SOURCE_REMOVE;
        });
    }

    _buildMenu() {
        this._statusItem = new PopupMenu.PopupMenuItem('', {
            reactive: false,
            can_focus: false,
            style_class: 'study-timer-status',
        });
        this.menu.addMenuItem(this._statusItem);

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem('Start a session'));
        this.menu.addMenuItem(this._buttonRow(
            PRESETS.map(preset => ({
                label: preset.label,
                onClick: () => {
                    this.startTimer(preset.minutes * MINUTE);
                    this.menu.close();
                },
            }))));

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem('Add time'));
        this.menu.addMenuItem(this._buttonRow(
            TOP_UPS.map(minutes => ({
                label: `+${minutes} min`,
                onClick: () => this.addTime(minutes * MINUTE),
            }))));

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        this._pauseItem = new PopupMenu.PopupMenuItem('Pause');
        this._pauseItem.connect('activate', () => this.togglePause());
        this.menu.addMenuItem(this._pauseItem);

        this._stopItem = new PopupMenu.PopupMenuItem('Stop');
        this._stopItem.connect('activate', () => this.stopTimer());
        this.menu.addMenuItem(this._stopItem);

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        this._blockItem = new PopupMenu.PopupSwitchMenuItem(
            'Block distracting sites', this._settings.get_boolean('manual-block'));
        this._blockItem.connect('toggled', (_item, active) =>
            this._settings.set_boolean('manual-block', active));
        this.menu.addMenuItem(this._blockItem);

        const prefsItem = new PopupMenu.PopupMenuItem('Preferences');
        prefsItem.connect('activate', () => {
            this.menu.close();
            this._extension.openPreferences();
        });
        this.menu.addMenuItem(prefsItem);
    }

    /** A non-selectable menu row holding side-by-side push buttons. */
    _buttonRow(specs) {
        const item = new PopupMenu.PopupBaseMenuItem({
            reactive: false,
            can_focus: false,
            style_class: 'study-timer-row',
        });

        for (const spec of specs) {
            const button = new St.Button({
                label: spec.label,
                style_class: 'study-timer-action button',
                x_expand: true,
                can_focus: true,
            });
            button.connect('clicked', () => spec.onClick());
            item.add_child(button);
        }

        return item;
    }

    // --- timer control ---------------------------------------------------

    startTimer(ms) {
        this._sessionMs = ms;
        this._endsAt = this._now() + ms;
        this._state = State.RUNNING;
        this._sync();
        this._scheduleTick();
    }

    /** Top up the running session; with no session, start one this long. */
    addTime(ms) {
        switch (this._state) {
        case State.IDLE:
            this.startTimer(ms);
            return;
        case State.PAUSED:
            this._pausedLeft += ms;
            break;
        default:
            // From overtime, adding time puts us back on the clock.
            if (this._state === State.OVERTIME)
                this._endsAt = this._now();
            this._endsAt += ms;
            this._state = State.RUNNING;
            break;
        }

        this._sessionMs += ms;
        this._sync();
        this._scheduleTick();
    }

    togglePause() {
        if (this._state === State.PAUSED) {
            this._endsAt = this._now() + this._pausedLeft;
            this._state = State.RUNNING;
        } else if (this._state === State.RUNNING || this._state === State.OVERTIME) {
            this._pausedLeft = Math.max(0, this._endsAt - this._now());
            this._state = State.PAUSED;
        } else {
            return;
        }

        this._sync();
        this._scheduleTick();
    }

    stopTimer() {
        this._state = State.IDLE;
        this._endsAt = 0;
        this._pausedLeft = 0;
        this._sessionMs = 0;
        this._sync();
        this._scheduleTick();
    }

    _now() {
        return GLib.get_real_time() / 1000;
    }

    /** Signed ms left: negative once the session has run over. */
    _timeLeft() {
        if (this._state === State.PAUSED)
            return this._pausedLeft;
        if (this._state === State.IDLE)
            return 0;
        return this._endsAt - this._now();
    }

    // --- ticking ---------------------------------------------------------

    /**
     * Only a counting-down session changes what's on screen — idle shows a
     * static icon and paused shows a frozen number, so neither needs a tick.
     */
    _scheduleTick() {
        this._removeTick();

        const counting = this._state === State.RUNNING || this._state === State.OVERTIME;
        if (!counting)
            return;

        const delay = 1000 - (this._now() % 1000);

        this._tickId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, Math.max(50, Math.round(delay)), () => {
            this._tickId = 0;
            try {
                this._sync();
            } catch (e) {
                // Never let one bad tick strand the clock on a stale reading.
                logError(e, 'study-timer: tick failed');
            } finally {
                this._scheduleTick();
            }
            return GLib.SOURCE_REMOVE;
        });
    }

    _removeTick() {
        if (this._tickId) {
            GLib.Source.remove(this._tickId);
            this._tickId = 0;
        }
    }

    // --- rendering -------------------------------------------------------

    _is12Hour() {
        return this._desktopSettings.get_string('clock-format') === '12h';
    }

    _sync() {
        if (this._state === State.RUNNING && this._timeLeft() <= 0)
            this._onFinished();

        this._syncTimerLabel();
        this._syncMenu();
        this._syncBlocking();
    }

    /**
     * Blocked while the switch is on, or while a session is actually counting
     * down — a paused session is a break, so the sites come back.
     */
    _syncBlocking() {
        const manual = this._settings.get_boolean('manual-block');
        const counting = this._state === State.RUNNING || this._state === State.OVERTIME;
        const wanted = manual ||
            (counting && this._settings.get_boolean('block-during-session'));

        this._blockItem.setToggleState(manual);

        if (wanted === this._blockWanted)
            return;

        this._blockWanted = wanted;
        this._blocker.setBlocked(wanted);
    }

    /**
     * Blocking is a nicety, not the point of the timer: if the helper is
     * missing or refuses, say so once and let the session carry on.
     */
    _onBlockingFailed(error) {
        logError(error, 'study-timer: blocking failed');

        if (this._blockWarned)
            return;
        this._blockWarned = true;

        this._notify(
            'Website blocking is off',
            helperInstalled()
                ? error.message
                : 'Run this once: sudo ~/dotfiles/scripts/setup-study-timer-block.sh');
    }

    /** Idle is the bare icon; a session adds the countdown beside it. */
    _syncTimerLabel() {
        if (this._state === State.IDLE) {
            this._timerLabel.visible = false;
            this._icon.style_class = ICON_BASE_CLASS;
            this._timerLabel.style_class = LABEL_BASE_CLASS;
            return;
        }

        const left = this._timeLeft();
        const overtime = this._state === State.OVERTIME;
        const paused = this._state === State.PAUSED;

        let text = overtime ? `+${formatDuration(-left)}` : formatDuration(left);
        if (paused)
            text = `⏸ ${text}`;

        this._timerLabel.text = text;
        this._timerLabel.visible = true;

        let stateClass = '';
        if (overtime)
            stateClass = ' overtime';
        else if (paused)
            stateClass = ' paused';
        else if (left <= MINUTE)
            stateClass = ' warning';

        this._icon.style_class = ICON_BASE_CLASS + stateClass;
        this._timerLabel.style_class = LABEL_BASE_CLASS + stateClass;
    }

    _syncMenu() {
        const left = this._timeLeft();

        switch (this._state) {
        case State.IDLE:
            this._statusItem.label.text = 'No session running';
            break;
        case State.PAUSED:
            this._statusItem.label.text = `Paused · ${formatDuration(left)} left`;
            break;
        case State.OVERTIME:
            this._statusItem.label.text = `Over by ${formatDuration(-left)}`;
            break;
        default: {
            const endsAt = GLib.DateTime.new_from_unix_local(
                Math.round(this._endsAt / 1000));
            this._statusItem.label.text =
                `${formatDuration(left)} left · ends ${endsAt.format(this._is12Hour() ? '%-I:%M %p' : '%H:%M')}`;
            break;
        }
        }

        const idle = this._state === State.IDLE;
        this._pauseItem.label.text = this._state === State.PAUSED ? 'Resume' : 'Pause';
        this._pauseItem.visible = !idle;
        this._stopItem.visible = !idle;
    }

    // --- session end -----------------------------------------------------

    _onFinished() {
        this._state = State.OVERTIME;

        const player = global.display.get_sound_player();
        player.play_from_theme('complete', 'Study session finished', null);

        this._notify(
            'Session finished',
            `Your ${describeDuration(this._sessionMs)} study session is up.`);
    }

    /**
     * The message tray API changed shape across shell versions (property
     * objects replaced positional arguments, addNotification replaced
     * showNotification), so probe for what this shell actually offers.
     */
    _ensureSource() {
        if (this._source)
            return this._source;

        try {
            this._source = new MessageTray.Source({
                title: 'Study Timer',
                iconName: 'alarm-symbolic',
            });
        } catch {
            this._source = new MessageTray.Source('Study Timer', 'alarm-symbolic');
        }

        this._source.connect('destroy', () => (this._source = null));
        Main.messageTray.add(this._source);
        return this._source;
    }

    _notify(title, body) {
        const source = this._ensureSource();

        let notification;
        try {
            notification = new MessageTray.Notification({source, title, body});
        } catch {
            notification = new MessageTray.Notification(source, title, body);
        }

        // Stay up until dismissed — the whole point is not to miss it.
        if (notification.setUrgency)
            notification.setUrgency(MessageTray.Urgency.CRITICAL);
        else
            notification.urgency = MessageTray.Urgency.CRITICAL;

        if (source.addNotification)
            source.addNotification(notification);
        else
            source.showNotification(notification);
    }

    destroy() {
        this._removeTick();

        if (this._refreshId) {
            GLib.Source.remove(this._refreshId);
            this._refreshId = 0;
        }

        if (this._blocklistChangedId) {
            this._blocklistMonitor.disconnect(this._blocklistChangedId);
            this._blocklistChangedId = 0;
        }
        this._blocklistMonitor?.cancel();
        this._blocklistMonitor = null;

        for (const id of this._settingsChangedIds ?? [])
            this._settings.disconnect(id);
        this._settingsChangedIds = null;
        this._settings = null;

        // Leaving the shell shouldn't leave the machine blocked.
        this._blocker?.destroy();
        this._blocker = null;

        if (this._formatChangedId) {
            this._desktopSettings.disconnect(this._formatChangedId);
            this._formatChangedId = 0;
        }
        this._desktopSettings = null;

        this._source?.destroy();
        this._source = null;

        super.destroy();
    }
});

export default class StudyTimerExtension extends Extension {
    enable() {
        this._indicator = new StudyTimerIndicator(this);
        // Sit just left of GNOME's own clock in the centre of the panel.
        Main.panel.addToStatusArea(this.uuid, this._indicator, 0, 'center');
    }

    disable() {
        this._indicator?.destroy();
        this._indicator = null;
    }
}
