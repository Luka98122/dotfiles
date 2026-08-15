import Adw from 'gi://Adw';
import Gdk from 'gi://Gdk';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Gtk from 'gi://Gtk';

import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

import {
    DEFAULT_TEXT,
    blocklistPath,
    parseHosts,
    readBlocklistText,
    writeBlocklistText,
} from './blocklist.js';
import {HELPER_PATH, helperInstalled} from './blocker.js';

const SETUP_COMMAND = 'sudo ~/dotfiles/scripts/setup-study-timer-block.sh';

// Typing shouldn't hit the disk on every keystroke, but the shell should pick
// an edit up while you're still looking at the window.
const SAVE_DELAY_MS = 600;

export default class StudyTimerPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();

        const page = new Adw.PreferencesPage({
            title: 'Blocking',
            icon_name: 'action-unavailable-symbolic',
        });
        window.add(page);

        page.add(this._behaviourGroup(settings));
        page.add(this._sitesGroup(window));
        if (!helperInstalled())
            page.add(this._setupGroup());
    }

    // --- when to block -------------------------------------------------------

    _behaviourGroup(settings) {
        const group = new Adw.PreferencesGroup({
            title: 'When to block',
        });

        const duringSession = new Adw.SwitchRow({
            title: 'Block during study sessions',
            subtitle: 'Blocks while the timer counts down, including overtime. Pausing lifts it.',
        });
        settings.bind('block-during-session', duringSession, 'active',
            Gio.SettingsBindFlags.DEFAULT);
        group.add(duringSession);

        const manual = new Adw.SwitchRow({
            title: 'Block now',
            subtitle: 'Same switch as in the panel menu — blocks with no timer running.',
        });
        settings.bind('manual-block', manual, 'active', Gio.SettingsBindFlags.DEFAULT);
        group.add(manual);

        const drop = new Adw.SwitchRow({
            title: 'Drop live connections',
            subtitle: 'Cuts open connections to the blocked sites as the block goes up, so an already-loaded tab can\'t keep going on its existing one. Also flushes the system DNS cache.',
        });
        settings.bind('drop-connections', drop, 'active', Gio.SettingsBindFlags.DEFAULT);
        group.add(drop);

        return group;
    }

    // --- the list itself -----------------------------------------------------

    _sitesGroup(window) {
        const group = new Adw.PreferencesGroup({
            title: 'Blocked sites',
            description: `One domain per line, # starts a comment. Each entry also covers its www. form. Stored in ${blocklistPath()}.`,
        });

        const restore = new Gtk.Button({
            label: 'Restore defaults',
            valign: Gtk.Align.CENTER,
        });
        group.set_header_suffix(restore);

        const view = new Gtk.TextView({
            monospace: true,
            top_margin: 8,
            bottom_margin: 8,
            left_margin: 8,
            right_margin: 8,
            wrap_mode: Gtk.WrapMode.NONE,
        });
        view.buffer.text = readBlocklistText();

        const scroller = new Gtk.ScrolledWindow({
            height_request: 240,
            hscrollbar_policy: Gtk.PolicyType.AUTOMATIC,
            vscrollbar_policy: Gtk.PolicyType.AUTOMATIC,
            child: view,
        });
        scroller.add_css_class('card');

        const summary = new Gtk.Label({
            xalign: 0,
            margin_top: 6,
            css_classes: ['dim-label', 'caption'],
        });

        const box = new Gtk.Box({orientation: Gtk.Orientation.VERTICAL});
        box.append(scroller);
        box.append(summary);
        group.add(box);

        const updateSummary = () => {
            const count = parseHosts(view.buffer.text).length;
            summary.label = count === 1 ? '1 site blocked' : `${count} sites blocked`;
        };
        updateSummary();

        let saveId = 0;
        const save = () => {
            saveId = 0;
            try {
                writeBlocklistText(view.buffer.text);
            } catch (e) {
                logError(e, 'study-timer: could not save the blocklist');
            }
            return GLib.SOURCE_REMOVE;
        };

        view.buffer.connect('changed', () => {
            updateSummary();
            if (saveId)
                GLib.Source.remove(saveId);
            saveId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, SAVE_DELAY_MS, save);
        });

        restore.connect('clicked', () => (view.buffer.text = DEFAULT_TEXT));

        // Don't let a pending edit die with the window.
        window.connect('close-request', () => {
            if (saveId) {
                GLib.Source.remove(saveId);
                save();
            }
            return false;
        });

        return group;
    }

    // --- helper not installed yet --------------------------------------------

    _setupGroup() {
        const group = new Adw.PreferencesGroup({title: 'Setup needed'});

        const row = new Adw.ActionRow({
            title: 'Blocking helper is not installed',
            subtitle: `Nothing can be blocked until ${HELPER_PATH} exists. Run this once:\n${SETUP_COMMAND}`,
        });
        row.add_prefix(new Gtk.Image({icon_name: 'dialog-warning-symbolic'}));

        const copy = new Gtk.Button({
            icon_name: 'edit-copy-symbolic',
            tooltip_text: 'Copy the setup command',
            valign: Gtk.Align.CENTER,
            css_classes: ['flat'],
        });
        copy.connect('clicked', () => {
            Gdk.Display.get_default().get_clipboard().set(SETUP_COMMAND);
            copy.icon_name = 'object-select-symbolic';
        });
        row.add_suffix(copy);

        group.add(row);
        return group;
    }
}
