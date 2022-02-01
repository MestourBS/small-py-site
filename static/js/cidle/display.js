import globals from './globals.js';
/**
 * @typedef Style
 * @prop {string} [name]
 *
 * @prop {number} font_size
 * @prop {string} font_family
 *
 * @prop {number} tab_padding
 * @prop {number} inventory_padding
 *
 * @prop {string} tab_color_fill
 * @prop {string} text_color_fill
 * @prop {string} pane_color_fill
 * @prop {string} maker_color_fill
 * @prop {string} storage_color_fill
 * @prop {string} tab_text_color_fill
 * @prop {string} inventory_color_fill
 * @prop {string} tab_selected_color_fill
 * @prop {string} tab_selected_text_color_fill
 * @prop {string} machine_upgrade_can_afford_fill
 * @prop {string} machine_upgrade_cant_afford_fill
 *
 * @prop {string} tab_color_border
 * @prop {string} pane_color_border
 * @prop {string} maker_color_border
 * @prop {string} storage_color_border
 * @prop {string} inventory_color_border
 */

/**
 * @type {{[id: string]: Style}}
 */
const styles = {
    light: {
        name: gettext('games_cidle_style_light'),

        font_size: 20,
        font_family: 'monospace',

        tab_padding: 10,
        inventory_padding: 10,

        tab_color_fill: '#0000',
        text_color_fill: '#000',
        pane_color_fill: '#fff',
        maker_color_fill: '#ccc',
        storage_color_fill: '#ccc',
        tab_text_color_fill: '#fff',
        inventory_color_fill: '#fff',
        tab_selected_color_fill: '#00f',
        tab_selected_text_color_fill: '#fff',
        machine_upgrade_can_afford_fill: '#0f0',
        machine_upgrade_cant_afford_fill: '#f00',

        tab_color_border: '#000',
        pane_color_border: '#000',
        maker_color_border: '#000',
        storage_color_border: '#000',
        inventory_color_border: '#000',
    }
};

/**
 * Returns the value of the key in the current theme, or in the default theme
 *
 * @template {keyof Style} K
 * @param {K} key
 * @returns {Style[K]}
 */
export function get_theme_value(key) {
    const theme = Object.assign({}, styles[globals.current_theme], styles['light']);

    if (!(key in theme)) throw new RangeError(`${key} not found in current theme`);

    return theme[key];
}
