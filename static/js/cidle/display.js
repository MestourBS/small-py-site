import globals from './globals.js';
/**
 * @typedef Style
 * @prop {string} [name]
 *
 * @prop {number} font_size
 * @prop {string} font_family
 *
 * @prop {number} tab_padding
 *
 * @prop {string} tab_color_fill
 * @prop {string} text_color_fill
 * @prop {string} pane_color_fill
 * @prop {string} machine_color_fill
 * @prop {string} tab_text_color_fill
 * @prop {string} tab_selected_color_fill
 * @prop {string} tab_selected_text_color_fill
 * @prop {string} machine_upgrade_lower_con_fill
 * @prop {string} machine_upgrade_lower_pro_fill
 * @prop {string} machine_upgrade_higher_con_fill
 * @prop {string} machine_upgrade_higher_pro_fill
 *
 * @prop {string} tab_color_border
 * @prop {string} pane_color_border
 * @prop {string} grid_color_border
 * @prop {string} machine_color_border
 * @prop {string} machine_can_upgrade_color_border
 * @prop {string} machine_full_upgrades_color_border
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

        tab_color_fill: '#fff',
        text_color_fill: '#000',
        pane_color_fill: '#fff',
        machine_color_fill: '#ccc',
        tab_text_color_fill: '#000',
        tab_selected_color_fill: '#00f',
        tab_selected_text_color_fill: '#fff',
        machine_upgrade_lower_con_fill: '#070',
        machine_upgrade_lower_pro_fill: '#b00',
        machine_upgrade_higher_con_fill: '#b00',
        machine_upgrade_higher_pro_fill: '#070',

        tab_color_border: '#000',
        pane_color_border: '#000',
        grid_color_border: '#eee',
        machine_color_border: '#000',
        machine_can_upgrade_color_border: 'orchid',
        machine_full_upgrades_color_border: 'gold',
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
/**
 * Returns whether the theme exists
 *
 * @param {string} theme
 * @returns {boolean}
 */
export function is_valid_theme(theme) {
    return theme in styles;
}
