import GObject from 'gi://GObject';
import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import St from 'gi://St';

import {Extension, gettext as _, ngettext, pgettext} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as MessageTray from 'resource:///org/gnome/shell/ui/messageTray.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

const DOUBLE_CLICKS = 2;
const INIT_CLICKS = 0;
const CLICKS_CANCEL = 3;

export default class MonitorSmartSaverExtension extends Extension {
    constructor(metadata) {
        super(metadata);
    }

    enable() {
        this._buttonIndicator = new ButtonIndicator(this.metadata, this.getSettings(), this);
        Main.panel.addToStatusArea(this.uuid, this._buttonIndicator);
    }

    disable() {
        this._buttonIndicator?.destroy();
        this._buttonIndicator = null;
    }
}

const ButtonIndicator = GObject.registerClass(
    { GTypeName: 'ButtonIndicator' },
    class ButtonIndicator extends PanelMenu.Button {
        constructor(metadata, settings, extension) {
            super(0.5, metadata.name, false);

            this._settings = settings;
            this._extension = extension;
            this._doubleClickTime = this._settings.get_uint('delay-double-click');
            this._screensaverActevateTime = this._settings.get_uint('delay-off');

            const icon = new St.Icon({
                icon_name: 'video-display-symbolic',
                style_class: 'system-status-icon',
            });

            this.add_child(icon);
            this._clickCount = INIT_CLICKS;

            this._settings.connectObject(
                'changed::delay-double-click', () => { 
                    this._doubleClickTime = this._settings.get_uint('delay-double-click');
                },
                'changed::delay-off', () => {
                    this._screensaverActevateTime = this._settings.get_uint('delay-off');
                },
                this,
            );

            this.connect('button-press-event', this._onButtonPressed.bind(this));
        }

        _onButtonPressed(actor, event) {
            const button = event.get_button();
                if (this.menu) {
                    this.menu.close();
                    this.menu.removeAll();
                }

            if (button == Clutter.BUTTON_PRIMARY) {
                if (this._clickCount == INIT_CLICKS) {
                    if (!this._doubleClickDetectionTimeout) {
                        this._doubleClickDetectionTimeout =
                            GLib.timeout_add(GLib.PRIORITY_DEFAULT, this._doubleClickTime, this._click_processing.bind(this));
                    }
                }

                this._clickCount = this._clickCount + 1;

                if (this._clickCount >= CLICKS_CANCEL) {
                    if (this._screenSaverActivateTimeout) {
                        GLib.Source.remove(this._screenSaverActivateTimeout);
                        delete this._screenSaverActivateTimeout;
                        this._clickCount = INIT_CLICKS;
                if (this._extensionNotificationSource) {
                    this._extensionNotificationSource.destroy(MessageTray.NotificationDestroyedReason.REPLACED);
                }
                        this._showNotification(_('Screensaver activation canceled!'));
                    }
                }

                return Clutter.EVENT_STOP;
            } else if (button === Clutter.BUTTON_SECONDARY) {
                const settingsMenuItem = new PopupMenu.PopupMenuItem(_('Settings'), {
                });

                settingsMenuItem.setOrnament(PopupMenu.Ornament.HIDDEN);

                this.menu.addMenuItem(settingsMenuItem);
                this.menu.open();

                settingsMenuItem.connect('activate', (item, event) => { 
                    this._extension.openPreferences();
                });

                const settingsSystemMenuItem = new PopupMenu.PopupMenuItem(_('System settings'), {
                });

                settingsSystemMenuItem.setOrnament(PopupMenu.Ornament.HIDDEN);

                this.menu.addMenuItem(settingsSystemMenuItem);
                this.menu.open();

                settingsSystemMenuItem.connect('activate', (item, event) => { 
                    GLib.spawn_command_line_async('gnome-control-center privacy');
                });

                this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
                this._screensaverSettings = new Gio.Settings({ schema: "org.gnome.desktop.screensaver" });
                const getState = this._screensaverSettings.get_boolean('lock-enabled');
                const menuItem = new PopupMenu.PopupSwitchMenuItem(_('Lock disable'), getState, { });

                menuItem.setToggleState(!menuItem.state);
                menuItem.toggle();
                this.menu.addMenuItem(menuItem);

                menuItem.connect('toggled', (item, state) => {
                    item.state = state;
                    this._screensaverSettings.set_boolean('lock-enabled', state);
                });

                return Clutter.EVENT_STOP;
            }

            return Clutter.EVENT_PROPAGATE ;
        }

        _showNotification(message) {
            if (this._extensionNotificationSource) {
                this._extensionNotificationSource.destroy(MessageTray.NotificationDestroyedReason.REPLACED);
            }

            if (!this._extensionNotificationSource) {

                this._extensionNotificationSource = new MessageTray.Source({
                    title: _('Monitor Smart Saver'),
                    iconName: 'dialog-information',
                });

                this._extensionNotificationSource.connect('destroy', _source => {
                    this._extensionNotificationSource = null;
                });
                Main.messageTray.add(this._extensionNotificationSource);
            }

            this._extensionNotification = new MessageTray.Notification({
                source: this._extensionNotificationSource,
                body: message,
            });

            this._extensionNotificationSource.addNotification(this._extensionNotification);
        }

        _screenSaverActivate(message, lock_unlock) {
            if (!this._screenSaverActivateTimeout) {
                this._showNotification(message); 

                this._screenSaverActivateTimeout = 
                    GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, this._screensaverActevateTime, () => {

                        if (this._settings.get_boolean('play-sound')) {
                            const soundFilePath = Gio.File.new_for_path(this._settings.get_value('sound-file-map').deepUnpack().soundPath);
                            const player = global.display.get_sound_player();
                            player.play_from_file(soundFilePath, 'Notification sound', null);
                        }

                        if (lock_unlock) {
                            this._screenSaverLock();
                        } else {
                            this._screenSaverSetActive();
                        }

                        this._clickCount = INIT_CLICKS;

                        delete this._screenSaverActivateTimeout;
                        return GLib.SOURCE_REMOVE;
                    });
            }
        }

        _click_processing() {
            if (this._clickCount >= DOUBLE_CLICKS) {
                this._screenSaverActivate(
                    ngettext('Screensaver will lock the screen in %d second!', 'Screensaver will lock the screen in %d seconds!',
                        this._screensaverActevateTime).format(this._screensaverActevateTime), true);
            } else {
                this._screenSaverActivate(
                    ngettext('The screensaver will start in %d second!', 'The screensaver will start in %d seconds!',
                        this._screensaverActevateTime).format(this._screensaverActevateTime), false);
            }

            delete this._doubleClickDetectionTimeout;
            return GLib.SOURCE_REMOVE;
        }

        _screenSaverSetActive() {
            Gio.DBus.session.call(
                'org.gnome.ScreenSaver',
                '/org/gnome/ScreenSaver',
                'org.gnome.ScreenSaver',
                'SetActive',
                new GLib.Variant('(b)', [true]),
                null,
                Gio.DBusCallFlags.NONE,
                -1,
                null,
                (conn, res) => {
                    try {
                        conn.call_finish(res);
                    } catch (e) {
                        logError(e);
                    }
                }
            );
        }

        _screenSaverLock() {
            Gio.DBus.session.call(
                'org.gnome.ScreenSaver',
                '/org/gnome/ScreenSaver',
                'org.gnome.ScreenSaver',
                'Lock',
                null,
                null,
                Gio.DBusCallFlags.NONE,
                -1,
                null,
                (conn, res) => {
                    try {
                        conn.call_finish(res);
                    } catch (e) {
                        logError(e);
                    }
                }
            );
        }

        destroy() {
            if (this._extensionNotificationSource) {
                this._extensionNotificationSource.destroy();
                this._extensionNotificationSource = null;
            }

            if (this._screenSaverActivateTimeout) {
                GLib.Source.remove(this._screenSaverActivateTimeout);
            }
            delete this._screenSaverActivateTimeout;

            if (this._doubleClickDetectionTimeout) {
                GLib.Source.remove(this._doubleClickDetectionTimeout);
            }
            delete this._doubleClickDetectionTimeout;

            this._settings.disconnectObject(this);
            this._settings = null;

            super.destroy();
        }
    }
);

