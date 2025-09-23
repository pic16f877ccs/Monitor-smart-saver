import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';
import GObject from 'gi://GObject';
import GLib from 'gi://GLib';

import { ExtensionPreferences,
    gettext as _ } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class MonitorSmartSaverPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        window._settings = this.getSettings();

        const extensionSoundsPath = this.metadata.path + '/sounds';
        const dirPaths = [
            '/usr/share/sounds/gnome/default/alerts',
            '/usr/share/sounds/freedesktop/stereo',
            extensionSoundsPath,
        ];
        const filesExt = ['.ogg', '.oga', '.wav'];

        const currentSoundName = window._settings.get_value('sound-file-map').deepUnpack().soundName;

        this._soundFileLister = new SoundFileLister(dirPaths, filesExt);

        const page = new Adw.PreferencesPage({
            title: _('General Settings'),
            icon_name: 'dialog-information-symbolic',
        });
        window.add(page);

        const behaviorGroup = new Adw.PreferencesGroup({ title: _('Behavior')});
        behaviorGroup.set_separate_rows?.(true);
        page.add(behaviorGroup);

        const soundChoiceRow = new Adw.ComboRow({
            title: _('Notification Sound'),
            subtitle: _('Choose which sound to play'),
            model: Gtk.StringList.new([_('Loading...')]),
            selected: 0,
        });
        behaviorGroup.add(soundChoiceRow);

        soundChoiceRow.set_factory(Gtk.SignalListItemFactory.new());

        soundChoiceRow.get_factory().connect('setup', (factory, listItem) => {
            const label = new Gtk.Label({ xalign: 0 });
            listItem.set_child(label);
        });

        soundChoiceRow.get_factory().connect('bind', (factory, listItem) => {
            const label = listItem.get_child();
            const item = listItem.get_item();

            if (label && item instanceof Gtk.StringObject) {
                let full = item.get_string();
                let dotIndex = full.lastIndexOf('.');
                let base = dotIndex > 0 ? full.slice(0, dotIndex) : full;
                label.label = base;
            }
        });

        this._soundFileLister.listSoundFiles().then(files => {
            soundChoiceRow.set_model(Gtk.StringList.new(files));

            const currentSoundIndex = files.indexOf(currentSoundName);
            soundChoiceRow.set_selected(currentSoundIndex >= 0 ? currentSoundIndex : 0);
        })
        .catch(errorfile => {
            soundChoiceRow.set_model(Gtk.StringList.new(errorfile));
            soundChoiceRow.set_sensitive(false);
            soundChoiceRow.set_selected(0);
        });

        soundChoiceRow.connect('notify::selected', (row) => {
            if (!row.selected_item) return;

            const selectedKey = row.selected_item.string;
            const soundFilePath = this._soundFileLister.qualifiedName(selectedKey);
            const soundFileName = GLib.Variant.new('a{ss}',
                {
                    'soundName': selectedKey,
                    'soundPath': soundFilePath,
                }
            );

            window._settings.set_value('sound-file-map', soundFileName);
        });

        const playSoundSwitchRow = new Adw.SwitchRow({
            title: _('Enable sound'),
            subtitle: _('Enable or disable sound notifications'),
        });

        playSoundSwitchRow.set_icon_name('audio-volume-high-symbolic');
        behaviorGroup.add(playSoundSwitchRow);

        playSoundSwitchRow.bind_property(
            'active',
            soundChoiceRow,
            'sensitive',
            GObject.BindingFlags.SYNC_CREATE
        );

        const delayGroup = new Adw.PreferencesGroup({ title: _('Delay settings') });
        delayGroup.set_separate_rows?.(true);
        page.add(delayGroup);
        
        const screenOffDelayRow = Adw.SpinRow.new_with_range(1, 5, 1);
        screenOffDelayRow.set_value(window._settings.get_uint('delay-off'));
        screenOffDelayRow.set_wrap(true);
        screenOffDelayRow.set_title(_('Screen Off Delay'));
        screenOffDelayRow.set_subtitle(_('Time in seconds before the screen turns off'));
        delayGroup.add(screenOffDelayRow);

        const doubleClickDelayRow = Adw.SpinRow.new_with_range(100, 1000, 10);
        doubleClickDelayRow.set_value(window._settings.get_uint('delay-double-click'));
        doubleClickDelayRow.set_wrap(true);
        doubleClickDelayRow.set_title(_('Double-Click Delay'));
        doubleClickDelayRow.set_subtitle(_('Double-click detection time in milliseconds'));
        delayGroup.add(doubleClickDelayRow);

        window._settings.bind('delay-off', screenOffDelayRow, 'value',
            Gio.SettingsBindFlags.DEFAULT
        );
        window._settings.bind('delay-double-click', doubleClickDelayRow, 'value',
            Gio.SettingsBindFlags.DEFAULT
        );
        window._settings.bind('play-sound', playSoundSwitchRow, 'active',
            Gio.SettingsBindFlags.DEFAULT);
    }
}

class SoundFileLister {
    constructor(directoryPaths, fileExtensions) {
        this.directoryPaths = Array.isArray(directoryPaths) ? directoryPaths : [directoryPaths];
        this.fileExtensions = fileExtensions.map(ext => ext.toLowerCase());
    }

    listSoundFiles() {
        const allFiles = new Set();

        const readDirPromises = this.directoryPaths.map(path => {
            return new Promise((resolve, reject) => {
                const dir = Gio.File.new_for_path(path);

                dir.enumerate_children_async(
                    'standard::name,standard::type',
                    Gio.FileQueryInfoFlags.NONE,
                    GLib.PRIORITY_DEFAULT,
                    null,
                    (sourceObject, result) => {
                        try {
                            const infos = dir.enumerate_children_finish(result);

                            for (const info of infos) {
                                const name = info.get_name().toLowerCase();
                                if (
                                    info.get_file_type() === Gio.FileType.REGULAR &&
                                    this.fileExtensions.some(ext => name.endsWith(ext))
                                ) {
                                    allFiles.add(name);
                                }
                            }

                            resolve();
                        } catch (e) {
                            logError(e, `Failed to read directory: ${path}`);
                            reject([_('Failed to read directory')]);
                        }
                    }
                );
            });
        });

        return Promise.allSettled(readDirPromises)
            .then(() => {
                if (allFiles.size > 0) {
                    return Array.from(allFiles).sort();
                }
                return Promise.reject([_('No matching sound files found')]);
            });
    }

    qualifiedName(fileName) {
        for (const path of this.directoryPaths) {
            const fullPath = GLib.build_filenamev([path, fileName]);

            if (Gio.File.new_for_path(fullPath).query_exists(null)) {
                return fullPath;
            }
        }

        return '';
    }
}
