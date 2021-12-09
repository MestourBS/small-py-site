import globals from './globals.js';

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
 * @type {{[k: string]: {
 *  name: string,
 *  [k: string]: string,
 * },}}
 */
const themes = {
    'dark': {
        name: gettext('games_rpg_themes_dark'),
        // Text
        text_font: 'monospace',
        text_color: '#000',
        text_low_health_color: 'orange',
        text_item_amount_color: '#fff',
        text_item_equipped_color: '#0a3',
        text_item_has_slot_color: '#070',
        text_very_low_health_color: '#f00',
        text_item_has_not_slot_color: '#f00',
        // Borders
        border_tooltip_color: '#000',
        border_context_menu_color: '#000',
        border_inventory_cell_color: '#000',
        border_equipment_cell_color: '#a77',
        border_inventory_cursor_color: '#0ff',
        // Backgrounds
        background_tooltip_color: '#ccc',
        background_inventory_color: '#ccc',
        background_context_menu_color: '#ccc',
        background_entity_health_color: '#0f0',
        background_equipment_cell_locked_color: '#ff6',
        background_entity_missing_health_color: '#f00',
    },
    /*
    'light': {
        name: gettext('games_rpg_themes_light'),
    },
    */
};
/**
 * Theme names
 *
 * @type {{[k: string]: string}}
 */
const theme_entries = {
    // Text
    text_font: gettext('games_rpg_theme_text_font'),
    text_color: gettext('games_rpg_theme_text_color'),
    text_item_amount_color: gettext('games_rpg_theme_text_item_amount_color'),
    text_very_low_health_color: gettext('games_rpg_theme_text_very_low_health_color'),
    text_low_health_color: gettext('games_rpg_theme_text_low_health_color'),
    text_item_equipped_color: gettext('games_rpg_theme_text_item_equipped_color'),
    text_item_has_slot_color: gettext('games_rpg_theme_text_item_has_slot_color'),
    text_item_has_not_slot_color: gettext('games_rpg_theme_text_item_has_not_slot_color'),
    // Borders
    border_tooltip_color: gettext('games_rpg_theme_border_tooltip_color'),
    border_inventory_cell_color: gettext('games_rpg_theme_border_inventory_cell_color'),
    border_equipment_cell_color: gettext('games_rpg_theme_border_equipment_cell_color'),
    border_inventory_cursor_color: gettext('games_rpg_theme_border_inventory_cursor_color'),
    // Backgrounds
    background_tooltip_color: gettext('games_rpg_theme_background_tooltip_color'),
    background_inventory_color: gettext('games_rpg_theme_background_inventory_color'),
    background_equipment_cell_locked_color: gettext('games_rpg_theme_background_equipment_cell_locked_color'),
    background_entity_health_color: gettext('games_rpg_theme_background_entity_health_color'),
    background_entity_missing_health_color: gettext('games_rpg_theme_background_entity_missing_health_color'),
};

globals.current_theme = Object.keys(themes)[0];

/**
 * Returns the amount of inventory items per row
 *
 * @returns {number}
 */
export function inventory_items_per_row() {
    return Math.max(Math.floor(display_size[0] / 3) - 2, 1);
}
/**
 * Returns the value of the key in the current theme
 *
 * @param {string} key
 */
export function get_theme_value(key) {
    let _theme = Object.assign({}, themes[globals.current_theme], themes['dark']);

    if (!(key in _theme)) throw new RangeError(`${key} not found in current theme`);

    return _theme[key];
}
