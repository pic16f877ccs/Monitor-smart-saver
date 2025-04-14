import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';
import GObject from 'gi://GObject';

import { ExtensionPreferences,
} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class MonitorSmartSaverPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        window._settings = this.getSettings();

        const page = new Adw.PreferencesPage({
            title: 'General Settings',
            icon_name: 'dialog-information-symbolic',
        });
        window.add(page);

        const delayGroup = new Adw.PreferencesGroup({ title: 'Delay sttings' });
        delayGroup.set_separate_rows(true);
        page.add(delayGroup);
        
        const screenOffDelayRow = Adw.SpinRow.new_with_range(1, 5, 1);
        screenOffDelayRow.set_value(window._settings.get_uint('delay-off'));
        screenOffDelayRow.set_wrap(true);
        screenOffDelayRow.set_title('Screen Off Delay');
        screenOffDelayRow.set_subtitle('Time in seconds before the screen turns off');
        delayGroup.add(screenOffDelayRow);

        const doubleClickDelayRow = Adw.SpinRow.new_with_range(100, 1000, 10);
        doubleClickDelayRow.set_value(window._settings.get_uint('delay-double-click'));
        doubleClickDelayRow.set_wrap(true);
        doubleClickDelayRow.set_title('Double-Click Delay');
        doubleClickDelayRow.set_subtitle('Double-click detection time in milliseconds');
        delayGroup.add(doubleClickDelayRow);

        const behaviorGroup = new Adw.PreferencesGroup({ title: 'Behavior' });
        behaviorGroup.set_separate_rows(true);
        page.add(behaviorGroup);

        const playSoundSwitchRow = new Adw.SwitchRow({
            title: 'Enable sound',
            subtitle: 'Enable or disable sound notifications',
        });
        playSoundSwitchRow.set_icon_name('audio-volume-high-symbolic');
        behaviorGroup.add(playSoundSwitchRow);

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
