import { is_valid_tab } from './canvas.js';
import { is_valid_theme } from './display.js';
/**
 * @typedef {import('./canvas.js').GameTab} GameTab
 */

export const globals = {
    // Strings
    /**
     * Current selected theme
     *
     * @type {string}
     */
    current_theme: 'light',
    /**
     * Currently selected tab
     *
     * @type {GameTab}
     */
    game_tab: 'world',
    // Booleans
    /**
     * Whether the document is focused or not
     *
     * @type {boolean}
     */
    focused: document.hasFocus(),
    /**
     * Whether key checking is strict or not
     *
     * @type {boolean}
     */
    strict_keys: true,
    /**
     * Whether shift must be pressed to snap machines to grid
     *
     * @type {boolean}
     */
    press_to_snap: false,
    /**
     * Whether the resource order is stable (always the same)
     *
     * @type {boolean}
     */
    stable_resource_order: true,
    // Objects
    /**
     * Functions called on the next click for a tab
     *
     * If a draw function is specified, it will also be called on the current tab
     *
     * @type {{[game_tab: string]: {
     *  click: (x: number, y: number, event: MouseEvent) => boolean,
     *  draw?: (x: number, y: number, event: MouseEvent) => void,
     * }}}
     */
    adding: {},
    // Arrays
    /**
     * Player focus position as [x, y]
     *
     * @type {[number, number]}
     */
    position: [0, 0],
};
export default globals;

/**
 * Returns an object containing the data to be saved
 *
 * @returns {{
 *  pos?: [number, number],
 *  theme?: string,
 *  strict?: boolean,
 *  tab?: string,
 *  snap?: boolean,
 *  stable?: boolean,
 * }}
 */
export function save_data() {
    const data = {
        pos: [...globals.position],
        theme: globals.current_theme,
        strict: globals.strict_keys,
        tab: globals.game_tab,
        snap: globals.press_to_snap,
        stable: globals.stable_resource_order,
    };

    if (data.pos.every(n => n == 0)) delete data.pos;
    if (data.theme == 'light') delete data.theme;
    if (data.strict == true) delete data.strict;
    if (data.tab == 'world') delete data.tab;
    if (data.snap == true) delete data.snap;
    if (data.stable == true) delete data.stable;

    return data;
}
/**
 * Loads the saved data
 *
 * @param {Object} [data] Saved data
 * @param {[number, number]?} [data.pos]
 * @param {string?} [data.theme]
 * @param {boolean?} [data.strict]
 * @param {string?} [data.tab]
 * @param {boolean?} [data.snap]
 * @param {boolean?} [data.stable]
 */
export function load_data(data = {}) {
    if (!data) return;

    const { pos = null, theme = null, strict = null, tab = null, snap = null, stable = null } = data;
    if (Array.isArray(pos) && pos.length == 2 && !pos.some(n => isNaN(n))) {
        for (let i = 0; i < pos.length; i++) globals.position[i] = pos[i];
    }
    if (is_valid_theme(theme)) {
        globals.current_theme = theme;
    }
    if (strict != null) {
        globals.strict_keys = !!strict;
    }
    if (is_valid_tab(tab)) {
        globals.game_tab = tab;
    }
    if (snap != null) {
        globals.press_to_snap = !!snap;
    }
    if (stable != null) {
        globals.stable_resource_order = !!stable;
    }
}
