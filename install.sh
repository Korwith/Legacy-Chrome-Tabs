#!/usr/bin/env bash
# LegacyChromeTabs installer: finds every Gecko browser profile (Firefox, Waterfox, LibreWolf, Floorp, Zen, ...) and installs into each.

set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MARK_BEGIN="// >>> LegacyChromeTabs (managed by install.sh; edits inside are replaced)"
MARK_END="// <<< LegacyChromeTabs"
LOADER_MARK="LegacyChromeTabs loader"
CHROME_FILES=(userChrome.css userContent.css ease-tab-drop.uc.js ct-settings.uc.js)
# Gecko apps that aren't browsers, can't run this theme (UXP), or shouldn't be customized (Tor-style)
SKIP_RE='thunderbird|betterbird|icedove|seamonkey|interlink|moonchild|pale ?moon|basilisk|tor-?browser|mullvad'

profile=""
install_dir=""
browsers=()
theme="glass"
loader=1
recommended=0
uninstall=0
list_only=0
assume_yes=0

usage() {
    cat <<EOF
Usage: $(basename "$0") [options]

  --browser NAME       only this browser (repeatable; e.g. firefox, waterfox, librewolf)
  --list               list the browsers found and exit
  --profile DIR        install into this profile only (skips detection)
  --install-dir DIR    browser install folder for the script loader (with --profile)
  --theme NAME         glass (default) or classic
  --recommended-prefs  also set the prefs the theme was tuned with
  --no-loader          skip the script loader (no sudo; no eased drop, no Colors panel)
  --uninstall          remove what this script installed
  -y, --yes            don't ask before continuing
  -h, --help           show this help
EOF
}

say() { printf '%s\n' "$*"; }
warn() { printf 'warning: %s\n' "$*" >&2; }
die() { printf 'error: %s\n' "$*" >&2; exit 1; }

while [[ $# -gt 0 ]]; do
    case "$1" in
        --browser) browsers+=("${2:?--browser needs a name}"); shift 2 ;;
        --list) list_only=1; shift ;;
        --profile) profile="${2:?--profile needs a folder}"; shift 2 ;;
        --install-dir) install_dir="${2:?--install-dir needs a folder}"; shift 2 ;;
        --theme) theme="${2:?--theme needs glass or classic}"; shift 2 ;;
        --recommended-prefs) recommended=1; shift ;;
        --no-loader) loader=0; shift ;;
        --uninstall) uninstall=1; shift ;;
        -y|--yes) assume_yes=1; shift ;;
        -h|--help) usage; exit 0 ;;
        *) usage >&2; die "unknown option: $1" ;;
    esac
done

[[ "$theme" == glass || "$theme" == classic ]] || die "--theme must be glass or classic"

# ── Detection ─────────────────────────────────────────────────────────────

# Prints the default profile of a profiles.ini root ([Install…] Default=, else Default=1)
default_profile_in() {
    local root="$1" ini="$1/profiles.ini"
    [[ -f "$ini" ]] || return 1
    awk -v root="$root" -F= '
        /^\[/ { section = $0; path = ""; rel = 1; def = 0; next }
        section ~ /^\[Install/ && $1 == "Default" { install_default = $2 }
        section ~ /^\[Profile/ {
            if ($1 == "Path") path = $2
            if ($1 == "IsRelative") rel = $2
            if ($1 == "Default") def = $2
            if (path != "") { full[path] = (rel == 1 ? root "/" path : path); if (def == 1) marked = path }
        }
        END {
            pick = install_default != "" ? install_default : marked
            if (pick == "") exit 1
            print (pick in full ? full[pick] : root "/" pick)
        }' "$ini"
}

# Prints every profiles.ini folder under ~ (dotfolders, ~/.config, Flatpak, Snap)
find_roots() {
    {
        find "$HOME"/.[!.]* -maxdepth 3 -name profiles.ini -not -path "$HOME/.var/*" 2>/dev/null
        find "$HOME/.var/app" "$HOME/snap" -maxdepth 5 -name profiles.ini 2>/dev/null
    } | while IFS= read -r ini; do
        dirname "$ini"
    done | grep -viE "$SKIP_RE" | while IFS= read -r d; do readlink -f "$d"; done | sort -u
}

# Names a root: ~/.waterfox → waterfox, ~/.mozilla/firefox → firefox, plus (flatpak)/(snap)
browser_name() {
    local n
    n="$(basename "$1")"; n="${n#.}"; n="${n,,}"
    case "$1" in
        "$HOME/.var/app/"*) n="$n (flatpak)" ;;
        "$HOME/snap/"*) n="$n (snap)" ;;
    esac
    printf '%s' "$n"
}

# Prints a profile's install folder, from compatibility.ini, else from the browser command on PATH
find_install_dir() {
    local prof="$1" name="$2" d="" bin c
    if [[ -f "$prof/compatibility.ini" ]]; then
        d="$(sed -n 's/^LastPlatformDir=//p' "$prof/compatibility.ini" | head -n1)"
    fi
    if [[ -z "$d" || ! -d "$d/defaults/pref" ]]; then
        d=""
        for c in "$name" "$name-bin" "$name-browser" "$name-esr"; do
            if bin="$(command -v "$c" 2>/dev/null)" && [[ -n "$bin" ]]; then
                bin="$(dirname "$(readlink -f "$bin")")"
                [[ -d "$bin/defaults/pref" ]] && { d="$bin"; break; }
            fi
        done
    fi
    [[ -n "$d" ]] && printf '%s' "$d"
}

# Is this file our loader (or absent)? (The first version had no marker, only its description.)
ours_or_absent() {
    [[ ! -e "$1" ]] || grep -qE "$LOADER_MARK|(Runs every|which loads) <profile>/chrome/\*\.uc\.js" "$1"
}

# Prints why the loader can't go into an install folder, if it can't
loader_blocker() {
    local dir="$1" f
    [[ -n "$dir" ]] || { echo "install folder not found"; return; }
    case "$dir" in /app/*|/snap/*) echo "read-only (Flatpak/Snap)"; return ;; esac
    [[ -d "$dir/defaults/pref" ]] || { echo "no defaults/pref in $dir"; return; }
    for f in "$dir/config.js" "$dir/defaults/pref/config-prefs.js"; do
        ours_or_absent "$f" || { echo "$f belongs to something else"; return; }
    done
    for f in "$dir"/defaults/pref/*.js; do
        [[ -f "$f" && "$f" != */config-prefs.js ]] || continue
        grep -q 'general.config.filename' "$f" && { echo "$(basename "$f") already sets an autoconfig file"; return; }
    done
    return 0
}

# Is a browser using this profile? (its lock symlink points at host:+pid)
is_running() {
    local pid
    pid="$(readlink "$1/lock" 2>/dev/null)" || return 1
    kill -0 "${pid##*+}" 2>/dev/null
}

# Targets, as parallel arrays: name, profile folder, install folder ("" = no loader)
t_name=(); t_prof=(); t_inst=()

add_target() {
    local name="$1" prof="$2" inst="$3" why
    if [[ $loader -eq 1 ]]; then
        if why="$(loader_blocker "$inst")" && [[ -z "$why" ]]; then :; else
            warn "$name: no script loader ($why)"
            inst=""
        fi
    else
        inst=""
    fi
    t_name+=("$name"); t_prof+=("$prof"); t_inst+=("$inst")
}

wanted() {
    local b
    [[ ${#browsers[@]} -eq 0 ]] && return 0
    for b in "${browsers[@]}"; do [[ "${1,,}" == *"${b,,}"* ]] && return 0; done
    return 1
}

if [[ -n "$profile" ]]; then
    [[ -d "$profile" ]] || die "profile folder not found: $profile"
    profile="$(cd "$profile" && pwd)"
    [[ -n "$install_dir" ]] || install_dir="$(find_install_dir "$profile" "$(browser_name "$(dirname "$profile")")" || true)"
    add_target "$(browser_name "$(dirname "$profile")")" "$profile" "$install_dir"
else
    while IFS= read -r root; do
        [[ -n "$root" ]] || continue
        name="$(browser_name "$root")"
        wanted "$name" || continue
        prof="$(default_profile_in "$root" 2>/dev/null)" || continue
        [[ -f "$prof/prefs.js" ]] || continue
        add_target "$name" "$prof" "$(find_install_dir "$prof" "${name%% *}" || true)"
    done < <(find_roots)
fi

[[ ${#t_name[@]} -gt 0 ]] || die "no Gecko browser profile found; start the browser once, or pass --profile DIR"

# ── Plan, and confirm ─────────────────────────────────────────────────────

for i in "${!t_name[@]}"; do
    say "${t_name[$i]}"
    say "  profile: ${t_prof[$i]}"
    say "  loader:  ${t_inst[$i]:-skipped}"
    is_running "${t_prof[$i]}" && warn "${t_name[$i]} is running: quit it fully and start it again afterwards"
done
[[ $list_only -eq 1 ]] && exit 0
[[ $uninstall -eq 1 ]] && say "Action: uninstall" || say "Theme: $theme"

if [[ $assume_yes -eq 0 ]]; then
    read -r -p "Continue? [y/N] " reply
    [[ "$reply" == [yY]* ]] || { say "Nothing changed."; exit 0; }
fi

for f in "${CHROME_FILES[@]}"; do
    [[ -f "$HERE/chrome/$f" ]] || die "missing from this folder: chrome/$f"
done

stamp="$(date +%Y%m%d-%H%M%S)"

# ── Per-profile helpers ───────────────────────────────────────────────────

# Runs a command, with sudo when the install folder isn't writable
as_install_owner() {
    if [[ -w "$inst" && -w "$inst/defaults/pref" ]]; then "$@"; else sudo "$@"; fi
}

# Moves a profile file into this run's backup folder
back_up() {
    [[ -e "$1" ]] || return 0
    mkdir -p "$backup"
    mv "$1" "$backup/"
}

# Rewrites user.js without our block, then (with arguments) appends a new one
write_userjs_block() {
    local userjs="$prof/user.js" tmp
    tmp="$(mktemp "$prof/.user.js.XXXXXX")"
    if [[ -f "$userjs" ]]; then
        awk -v b="$MARK_BEGIN" -v e="$MARK_END" '$0 == b { skip = 1; next } $0 == e { skip = 0; next } !skip' "$userjs" >"$tmp"
    fi
    [[ $# -gt 0 ]] && printf '%s\n' "$MARK_BEGIN" "$@" "$MARK_END" >>"$tmp"
    if [[ -s "$tmp" ]]; then mv "$tmp" "$userjs"; else rm -f "$tmp" "$userjs"; fi
}

prefs=(
    'user_pref("toolkit.legacyUserProfileCustomizations.stylesheets", true);'
    "user_pref(\"userChrome.ct.theme\", \"$theme\");"
)
if [[ $recommended -eq 1 ]]; then
    prefs+=(
        'user_pref("browser.nova.enabled", false);'
        'user_pref("browser.tabs.inTitlebar", 1);'
        'user_pref("sidebar.verticalTabs", false);'
        'user_pref("sidebar.revamp", false);'
        'user_pref("browser.tabs.hoverPreview.enabled", false);'
        'user_pref("browser.tabs.tabMinWidth", 32);'
        'user_pref("browser.tabs.tabClipWidth", 56);'
        'user_pref("browser.urlbar.trimURLs", false);'
        'user_pref("browser.urlbar.trimHttps", false);'
        'user_pref("browser.urlbar.formatting.enabled", true);'
        'user_pref("browser.download.autohideButton", true);'
        'user_pref("browser.uidensity", 1);'
    )
fi

# ── Install / uninstall each ──────────────────────────────────────────────

for i in "${!t_name[@]}"; do
    name="${t_name[$i]}"; prof="${t_prof[$i]}"; inst="${t_inst[$i]}"
    chrome="$prof/chrome"; backup="$chrome/backup-$stamp"
    say "── $name"

    if [[ $uninstall -eq 1 ]]; then
        for f in "${CHROME_FILES[@]}"; do back_up "$chrome/$f"; done
        [[ -f "$prof/user.js" ]] && write_userjs_block
        if [[ -n "$inst" ]]; then
            for f in "$inst/config.js" "$inst/defaults/pref/config-prefs.js"; do
                [[ -e "$f" ]] && as_install_owner rm -f "$f"
            done
        fi
        [[ -d "$backup" ]] && say "  removed files are in $backup"
        say "  uninstalled"
        continue
    fi

    mkdir -p "$chrome"
    for f in "${CHROME_FILES[@]}"; do
        if [[ -e "$chrome/$f" ]] && ! cmp -s "$HERE/chrome/$f" "$chrome/$f"; then back_up "$chrome/$f"; fi
        install -m 644 "$HERE/chrome/$f" "$chrome/$f"
    done
    write_userjs_block "${prefs[@]}"
    say "  theme + prefs installed into $prof"

    if [[ -n "$inst" ]]; then
        say "  installing the script loader into $inst (may ask for your password)"
        as_install_owner install -m 644 "$HERE/autoconfig/config.js" "$inst/config.js"
        as_install_owner install -m 644 "$HERE/autoconfig/config-prefs.js" "$inst/defaults/pref/config-prefs.js"
        if command -v dpkg >/dev/null 2>&1 && dpkg -S "$inst" >/dev/null 2>&1; then
            say "  note: a package update may remove the loader; rerun this script if dropped tabs start snapping"
        fi
    fi
    [[ -d "$backup" ]] && say "  replaced files are in $backup"
done

say "Done. Quit each browser fully and start it again."
