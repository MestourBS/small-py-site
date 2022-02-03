/**
 * @typedef {import('./canvas.js').GameTab} GameTab
 */

import { is_valid_tab } from './canvas.js';
import { is_valid_theme } from './display.js';

export const globals = {
    /**
     * Player focus position as [x, y]
     *
     * @type {[number, number]}
     */
    position: [0, 0],
    /**
     * Current selected theme
     *
     * @type {string}
     */
    current_theme: 'light',
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
     * Currently selected tab
     *
     * @type {GameTab}
     */
    game_tab: 'world',
    /**
     * Objects being placed on the next click
     *
     * @type {{[game_tab: string]: (x: number, y: number, event: MouseEvent) => boolean}}
     */
    adding: {},
    /**
     * Whether shift must be pressed to snap machines to grid
     *
     * @type {boolean}
     */
    press_to_snap: false,
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
 * }}
 */
export function save_data() {
    const data = {
        pos: [...globals.position],
        theme: globals.current_theme,
        strict: globals.strict_keys,
        tab: globals.game_tab,
    };

    if (data.pos.every(n => n == 0)) delete data.pos;
    if (data.theme == 'light') delete data.theme;
    if (data.strict == true) delete data.strict;
    if (data.tab == 'world') delete data.tab;

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
 */
export function load_data(data={}) {
    if (!data) return;

    const {pos=null, theme=null, strict=null, tab=null} = data;
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
}
