# Monitor Smart Saver

**Easily switch your monitor to power-saving mode with a simple button press.**

Monitor Smart Saver is a GNOME Shell extension that enables you to quickly turn off your screen or activate power-saving mode with a single or double click, directly from your panel. It supports customizable behavior, notification sounds, and screen lock options, making it convenient for users who want quick access to monitor power management without the hassle.

## Features

- **One-click screen off:** Instantly turn off your monitor with a single click, without requiring a password upon wake-up.
- **Double-click to lock:** Double-click to turn off and lock the screen for added security.
- **Customizable notification sounds:** Choose from various sound files for notifications.
- **User-friendly panel button:** A panel button for easy access and quick actions.
- **Configurable delays:** Adjust the delay before screen off and double-click detection timing.
- **Settings integration:** Enable/disable sound, set delays, and choose notification sounds from the preferences window.

## Installation

1. **Download the Extension:**
   - Clone the repository or download the latest release from [GitHub](https://github.com/pic16f877ccs/Monitor-smart-saver).

2. **Install to Your Extensions Directory:**
   ```
   cd ~/Downloads/
   git clone https://github.com/pic16f877ccs/Monitor-smart-saver.git
   ./run_dev.sh build
   ./run_dev.sh install
   ```

3. **Enable the Extension:**
   - Press <kbd>Alt</kbd>+<kbd>F2</kbd>, type `r` and press <kbd>Enter</kbd> (on X11), or log out and log back in (on Wayland).
   - Use GNOME Extensions or run:
     ```
     gnome-extensions enable monitorSmartSaver@pic16f877ccs.github.com
     ```

## Usage

- **Single Click:** Turns off the screen (monitor enters power-saving mode). No password is required when waking up.
- **Double Click:** Turns off and locks the screen. Password is required to unlock.
- **Right Click:** Opens the context menu to access settings.
- **Settings:** Go to the extension preferences to choose notification sounds, enable/disable sound, and change delay settings.

## Preferences

Customize your experience with the following options:
- **Notification Sound:** Select which sound to play when an action occurs.
- **Enable Sound:** Toggle sound notifications on or off.
- **Screen Off Delay:** Set how many seconds to wait before the screen actually turns off.
- **Double-Click Delay:** Adjust the time window for double-click detection.

## Compatibility

- **GNOME Shell Versions:** 47, 48, 49
- **Session Modes:** User

## Troubleshooting

If the extension does not appear after installation:
- Make sure the UUID is correct: `monitorSmartSaver@pic16f877ccs.github.com`
- Restart GNOME Shell or your session.
- Check for compatibility with your GNOME version.
- View logs with `journalctl /usr/bin/gnome-shell -f` for errors.

## License

This project is licensed under the MIT License.
