#!/bin/bash
set -e

readonly _EXTENSION='monitorSmartSaver@pic16f877ccs.github.com'
readonly _EXTENSION_NAME='monitor-smart-saver'

build() {
    mkdir -p './build/temp'
    mkdir -p './build/dist'

    rm -rf "./build/temp/*"
    cp -r $(find './src' -mindepth 1 -maxdepth 1 -not -name 'assets') './build/temp/'
    cp -r './assets/sounds' './build/temp/.'

    echo 'Packing...'

    local extra_source_list=$(find "${PWD}/build/temp/" -mindepth 1 -maxdepth 1 ! -name 'metadata.json' ! -name 'extension.js' ! -name 'prefs.js' ! -name     'stylesheet.css')
 
    local extra_sources=()
    local extra_source
 
    for extra_source in "$extra_source_list"; do
      extra_sources+=("--extra-source=${extra_source}")
    done

    local path_to_schema="${PWD}/assets/org.gnome.shell.extensions.monitor-smart-saver.gschema.xml"
    local path_to_podir="${PWD}/assets/locale/"
    echo $path_to_podir
   
    if gnome-extensions pack -f -o './build/dist' --schema="$path_to_schema" "$extra_sources" --podir="$path_to_podir" './build/temp'; then
        echo '...'
        echo 'Success!'
    fi
}

nested() {
    local first_arg="${1}"

    echo '...'

    if [ "$(gnome-shell --version | awk '{print int($3)}')" -ge 49 ]; then
        dbus-run-session gnome-shell --devkit --wayland
    else
        if [ "$first_arg" = '--fullhd' ]; then
            echo 'Full Hd screen size...'

            export MUTTER_DEBUG_DUMMY_MODE_SPECS=1920x1080 
            export MUTTER_DEBUG_DUMMY_MONITOR_SCALES=1.5 
        else
            echo 'UHD screen size...'
            export MUTTER_DEBUG_DUMMY_MODE_SPECS=3840x2100 
            export MUTTER_DEBUG_DUMMY_MONITOR_SCALES=2.0 
        fi

        export MUTTER_DEBUG_NUM_DUMMY_MONITORS=1 
        dbus-run-session -- gnome-shell --unsafe-mode --nested --wayland --no-x11
    fi
}

debug() {
    local fullhd="${1}"
    echo 'Debugging...'
    echo '...'
    if gnome-extensions list | grep -Ewoq "$_EXTENSION"; then
        echo "The ${_EXTENSION} is installed"
    else
        echo "The ${_EXTENSION} is not installed"
        exit 1
    fi

    if gnome-extensions show "$_EXTENSION" | grep -Ewoq 'INACTIVE'; then
        enable
    fi

    nested "$fullhd"
}

install() {
    local second_arg="${2}"
    if [[ "$second_arg" == '-b' ]]; then
        build
        echo "..."
    fi

    echo 'Installing...'
    gnome-extensions install --force "./build/dist/${_EXTENSION}.shell-extension.zip"
    echo '...'
    echo 'Success!'
}

uninstall() {
    echo 'Uninstalling...'
    gnome-extensions uninstall "$_EXTENSION"
    echo '...'
    echo 'Success!'
}

enable() {
    echo 'Enabling...'
    gnome-extensions enable "$_EXTENSION"
    echo '...'
    echo 'Success!'
}

disable() {
    echo 'Disabling...'
    gnome-extensions disable "$_EXTENSION"
    echo '...'
    echo 'Success!'
}

watch() {
  echo 'Watching for setting changes...'
  dconf watch "/org/gnome/shell/extensions/${_EXTENSION_NAME}/"
}

reset() {
  echo 'Watching for setting changes...'
  dconf reset -f "/org/gnome/shell/extensions/${_EXTENSION_NAME}/"
}

prefs() {
  echo 'Opening prefs...'
  gnome-extensions prefs "$_EXTENSION"
}

translations() {
  echo "Updating translations..."

  touch "assets/locale/${_EXTENSION}.pot"

  find ./src -type f -a -iname "*.js" | xargs xgettext --from-code=UTF-8 \
    --add-comments \
    --join-existing \
    --keyword=_ \
    --keyword=C_:1c,2 \
    --language=Javascript \
    --output="assets/locale/${_EXTENSION}.pot"

  for pofile in assets/locale/*.po; do
    echo "Updating: $pofile"
    msgmerge -U "$pofile" "assets/locale/${_EXTENSION}.pot"
  done

  rm assets/locale/*.po~ 2>/dev/null
  echo "Done"
}

case "$1" in
debug)
  debug "$2"
  ;;
install)
  install "$1" "$2"
  ;;
uninstall)
  uninstall
  ;;
enable)
  enable
  ;;
disable)
  disable
  ;;
build)
  build
  ;;
translations)
  translations
  ;;
prefs)
  prefs
  ;;
watch)
  watch
  ;;
reset)
  reset
  ;;
*)
  echo "Usage: $0 {debug|build|install|uninstall|enable|disable|prefs|watch|reset|translations}"
  exit 1
  ;;
esac
