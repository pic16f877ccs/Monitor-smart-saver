import GObject from 'gi://GObject';
import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import St from 'gi://St';

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as MessageTray from 'resource:///org/gnome/shell/ui/messageTray.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';

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
            super(0.0, metadata.name, false);

            this._settings = settings;
            this._doubleClickTime = this._settings.get_uint('delay-double-click');
            this._screensaverActevateTime = this._settings.get_uint('delay-off');
            this._extension = extension;
            this._playSound = this._settings.get_boolean('play-sound');

            const icon = new St.Icon({
                icon_name: 'video-display-symbolic',
                style_class: 'system-status-icon',
            });

            this.add_child(icon);
            this._clickCount = INIT_CLICKS;

            this.connect('button-press-event', this._onButtonPrimaryPressed.bind(this));

            this._settings.connectObject(
                'changed::delay-double-click', () => { 
                    this._doubleClickTime = this._settings.get_uint('delay-double-click');
                },
                'changed::delay-off', () => {
                    this._screensaverActevateTime = this._settings.get_uint('delay-off');
                },
                'changed::play-sound', () => {
                    this._playSound = this._settings.get_boolean('play-sound');
                    log(this._playSound);
                },
                this);
        }

        _screenSaverActivate(message, lock_unlock) {
            if (!this._screenSaverActivateTimeout) {
                Main.notify(message + this._screensaverActevateTime + ' seconds!');

                this._screenSaverActivateTimeout = 
                    GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, this._screensaverActevateTime, () => {
                        if (this._playSound) {
                            const player = global.display.get_sound_player();
                            player.play_from_theme( 'message', '', null);
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
                log("Double Click Detected!");

                this._screenSaverActivate('Screensaver will lock the screen in ', true);
            } else {
                log("Once Click Detected!");

                this._screenSaverActivate('The screensaver will start in ', false);
            }

            delete this._doubleClickDetectionTimeout;
            return GLib.SOURCE_REMOVE;

        }

        _onButtonPrimaryPressed(actor, event) {
            const button = event.get_button();
                log(this._doubleClickTime)

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
                        Main.notify('Screensaver activation canceled!');
                    }
                }

            } else {
                this._extension.openPreferences();
            }
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
