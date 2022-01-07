import globals from './globals.js';
/**
 * @typedef Style
 * @prop {string} name
 * @prop {string} text_font
 * @prop {string} text_color
 * @prop {string} text_low_health_color
 * @prop {string} text_item_amount_color
 * @prop {string} text_skill_level_color
 * @prop {string} text_default_tile_color
 * @prop {string} text_item_equipped_color
 * @prop {string} text_item_has_slot_color
 * @prop {string} text_very_low_health_color
 * @prop {string} text_item_has_not_slot_color
 * @prop {string} border_option_color
 * @prop {string} border_tooltip_color
 * @prop {string} border_skill_cell_color
 * @prop {string} border_option_error_color
 * @prop {string} border_context_menu_color
 * @prop {string} border_inventory_cell_color
 * @prop {string} border_equipment_cell_color
 * @prop {string} border_option_selected_color
 * @prop {string} border_inventory_cursor_color
 * @prop {string} border_skill_select_cursor_color
 * @prop {string} border_skill_target_cursor_color
 * @prop {string} border_option_error_selected_color
 * @prop {string} border_skill_target_out_range_cursor_color
 * @prop {string} background_pause_color
 * @prop {string} background_option_color
 * @prop {string} background_status_color
 * @prop {string} background_skills_color
 * @prop {string} background_tooltip_color
 * @prop {string} background_playing_color
 * @prop {string} background_minimap_color
 * @prop {string} background_inventory_color
 * @prop {string} background_context_menu_color
 * @prop {string} background_entity_magic_color
 * @prop {string} background_entity_health_color
 * @prop {string} background_skill_targeting_color
 * @prop {string} background_entity_missing_magic_color
 * @prop {string} background_equipment_cell_locked_color
 * @prop {string} background_entity_missing_health_color
 * @prop {string} background_skill_cell_uncastable_color
 * @prop {string} checkmark_color
 */

/**
 * Tile size in [width, height]
 *
 * @type {[number, number]}
 */
export const tile_size = [20, 20];
/**
 * Amount of tiles displayed, as [width, height]
 *
 * @type {[number, number]}
 */
export const display_size = [30, 30];
/**
 * Available themes
 *
 * Structure: theme_id => {name => theme name, css key => css value}
 *
 * @type {{[k: string]: Style,}}
 */
const themes = {
    'dark': {
        name: gettext('games_rpg_themes_dark'),
        // Text
        text_font: 'monospace',
        text_color: '#000',
        text_low_health_color: 'orange',
        text_item_amount_color: '#fff',
        text_skill_level_color: '#fff',
        text_default_tile_color: '#000',
        text_item_equipped_color: '#0a3',
        text_item_has_slot_color: '#070',
        text_very_low_health_color: '#f00',
        text_item_has_not_slot_color: '#f00',
        // Borders
        border_option_color: '#000',
        border_tooltip_color: '#000',
        border_skill_cell_color: '#f0f',
        border_option_error_color: '#f00',
        border_context_menu_color: '#000',
        border_inventory_cell_color: '#000',
        border_equipment_cell_color: '#a77',
        border_option_selected_color: '#00f',
        border_inventory_cursor_color: '#0ff',
        border_skill_select_cursor_color: '#7f0',
        border_skill_target_cursor_color: '#0ff',
        border_option_error_selected_color: '#f07',
        border_skill_target_out_range_cursor_color: '#f00',
        // Backgrounds
        background_options_test_color: '#fff', //test
        background_pause_color: '#000',
        background_option_color: '#fff',
        background_status_color: '#fff',
        background_skills_color: '#79b',
        background_tooltip_color: '#ccc',
        background_playing_color: '#fff',
        background_minimap_color: '#fff',
        background_inventory_color: '#ccc',
        background_context_menu_color: '#ccc',
        background_entity_magic_color: '#77f',
        background_entity_health_color: '#0f0',
        background_skill_targeting_color: '#fff',
        background_entity_missing_magic_color: '#f09',
        background_equipment_cell_locked_color: '#ff6',
        background_entity_missing_health_color: '#f00',
        background_skill_cell_uncastable_color: '#737',
        // Colors
        checkmark_color: '#000',
    },
    /*
    'light': {
        name: gettext('games_rpg_themes_light'),
    },
    */
};

globals.current_theme = Object.keys(themes)[0];

/**
 * Returns the amount of inventory items per row,
 * with space left on the right for equipment
 *
 * @returns {number}
 */
export function inventory_items_per_row() {
    return Math.max(Math.floor(display_size[0] / 3) - 2, 1);
}
/**
 * Returns the amount of skills per row
 *
 * @returns {number}
 */
export function entity_skills_per_row() {
    return Math.max(Math.floor(display_size[0] / 3) - 1, 1);
}
/**
 * Returns the value of the key in the current theme
 *
 * @template {keyof Style} K
 * @param {K} key
 * @returns {Style[K]}
 */
export function get_theme_value(key) {
    let _theme = Object.assign({}, themes[globals.current_theme], themes['dark']);

    if (!(key in _theme)) throw new RangeError(`${key} not found in current theme`);

    return _theme[key];
}
