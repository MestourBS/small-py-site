import { Tile } from './tile.js';
import { number_between } from './primitives.js';
import { AutonomousEntity } from './entity.js';
import { tile_size, display_size, get_theme_value, inventory_items_per_row } from './display.js';
import globals from './globals.js';
/** @typedef {import('./entity.js').Entity} Entity */

/**
 * Canvas of the game
 *
 * @type {HTMLCanvasElement}
 */
export const canvas = document.getElementById('rpg_game');
/**
 * For drawing on the canvas
 *
 * @type {CanvasRenderingContext2D}
 */
export const context = canvas.getContext('2d');

/**
 * Regex for color matching in text writing
 *
 * @type {RegExp}
 */
const regex_color = /(?<!\\)\{color:(.+?)\}/ig;
/**
 * Regex for escaped color matching
 *
 * @type {RegExp}
 */
const regex_not_color = /\\(\{color:.+?\})/g;
/**
 * Existing damage/defense types
 *
 * @type {{[k: string]: string}}
 */
const types_names = {
    'none': gettext('games_rpg_type_none'),
};
/**
 * Existing entity attributes
 *
 * @type {{[k: string]: string}}
 */
const attributes_names = {
    'health': gettext('games_rpg_status_health'),
    'health_max': gettext('games_rpg_status_health_max'),
    'speed': gettext('games_rpg_status_speed'),
    'range': gettext('games_rpg_status_range'),
    'inventory': gettext('games_rpg_status_inventory'),
    'defense': gettext('games_rpg_status_defense', {type: '%(type)s'}),
    'damage': gettext('games_rpg_status_damage', {type: '%(type)s'}),
};
/**
 * Existing entity equipment slots
 *
 * @type {{[k: number]: {
 *  name: string,
 *  image?: CanvasImageSource,
 * }}}
 */
const equip_slots = {
    0: {
        name: gettext('games_rpg_slot_head'),
        image: null,
    },
    1: {
        name: gettext('games_rpg_slot_face'),
        image: null,
    },
    2: {
        name: gettext('games_rpg_slot_neck'),
        image: null,
    },
    3: {
        name: gettext('games_rpg_slot_chest'),
        image: null,
    },
    4: {
        name: gettext('games_rpg_slot_arm'),
        image: null,
    },
    5: {
        name: gettext('games_rpg_slot_hand'),
        image: null,
    },
    6: {
        name: gettext('games_rpg_slot_leg'),
        image: null,
    },
    7: {
        name: gettext('games_rpg_slot_foot'),
        image: null,
    },
};
/**
 * Cache of splits
 *
 * As {`font` => `line` => `lines`}
 *
 * @type {{[k: string]: {
 *  [k: string]: string[],
 * }}}
 */
const pre_split = {};

/**
 * Empties the canvas display
 */
export function canvas_reset() {
    let width = tile_size[0] * display_size[0];
    let height = tile_size[1] * display_size[1];

    if (canvas.width != width || canvas.height != height) {
        canvas.style.width = `${width}px`;
        canvas.width = width;
        canvas.style.height = `${height}px`;
        canvas.height = height;
    } else {
        let c = context.fillStyle;
        let color = {
            'pause': '#000',
            'playing': '#fff',
            'status': '#fff',
            get 'inventory'() { return get_theme_value('background_inventory_color'); },
        }[globals.game_state];
        context.fillStyle = color;
        context.fillRect(0, 0, width, height);
        context.fillStyle = c;
    }
}
/**
 * Refreshes the canvas contents
 */
export function canvas_refresh() {
    canvas_reset();

    switch (globals.game_state) {
        case 'playing': case 'pause':
            show_game();
            break;
        case 'inventory':
            show_inventory(globals.player);
            break;
        case 'status':
            show_status(globals.player);
            break;
        default:
            console.error(`Unknown game state ${globals.game_state}`);
            break;
    }

    show_mini_status(globals.player);
}
/**
 * Shows the mini status at the bottom right
 *
 * @param {Entity} entity
 */
function show_mini_status(entity) {
    let width = Math.min(Math.max(Math.ceil(entity.health_max / 10), 10), display_size[0]) * tile_size[0];
    let height = tile_size[1];
    let left = (display_size[0] * tile_size[0]) - width;
    let top = (display_size[1] * tile_size[1]) - height;

    let text_position = left + width / 2;
    let width_fill = Math.ceil(entity.health / entity.health_max * width) || 0;
    let width_empty = width - width_fill;

    context.fillStyle = get_theme_value('background_entity_health_color');
    context.fillRect(left, top, width_fill, height);
    context.fillStyle = get_theme_value('background_entity_missing_health_color');
    context.fillRect(left + width_fill, top, width_empty, height);
    // For some reason, the target position has to be moved
    canvas_write(`${entity.health}/${entity.health_max}`, text_position - tile_size[0], top - tile_size[1] * .2, {text_align: 'center'});
}
/**
 * Shows the grid, the player and the entities
 */
function show_game() {
    Tile.visible_grid.sort((a, b) => {
        if (a == globals.player) return 1;
        if (b == globals.player) return -1;
        if (a.z != b.z) return a.z - b.z;
        if (b.y != a.y) return b.y - a.y;
        return b.x - a.x;
    }).forEach(t => t.draw());
}
/**
 * Shows the inventory of an entity
 *
 * @param {Entity} entity
 */
function show_inventory(entity) {
    // Draw inventory background
    let items_per_row = inventory_items_per_row();
    let item_rows = Math.max(Math.floor(display_size[1] / 3) - 1, 1);
    for (let y = 0; y < item_rows; y++) {
        for (let x = 0; x < items_per_row + 1; x++) {
            let offset_x = tile_size[0];
            let offset_y = tile_size[1];
            let x_start = x * 3 * tile_size[0] + offset_x;
            let y_start = y * 3 * tile_size[1] + offset_y;

            let color = get_theme_value('border_inventory_cell_color');
            if (x == items_per_row) {
                color = get_theme_value('border_equipment_cell_color');

                if (y in entity.equipment) {
                    color = get_theme_value('background_equipment_cell_locked_color');
                }
            }

            context.strokeStyle = context.fillStyle = color;
            let func = x != items_per_row || y in entity.equipment ? context.strokeRect : context.fillRect;
            func(x_start, y_start, tile_size[0] * 2, tile_size[1] * 2);
            if (x == items_per_row && y in equip_slots && equip_slots[y].image) {
                context.drawImage(equip_slots[y].image, x_start, y_start, tile_size[0] * 2, tile_size[1] * 2);
            }
        }
    }

    // Draw items
    entity.inventory.forEach(([i,a]) => i.draw_inventory(a));
    Object.values(entity.equipment).filter(i => i != null).forEach(i => i.draw_inventory(1));

    // Draw cursor
    let x_start = (globals.cursors.inventory[0] * 3 + 1) * tile_size[0];
    let y_start = (globals.cursors.inventory[1] * 3 + 1) * tile_size[1];
    context.strokeStyle = get_theme_value('border_inventory_cursor_color');
    context.strokeRect(x_start, y_start, tile_size[0] * 2, tile_size[1] * 2);

    // Prepare tooltip
    let item = null;
    let amount = 1;
    if (globals.cursors.inventory[0] == items_per_row && globals.cursors.inventory[1] in entity.equipment) {
        item = entity.equipment[globals.cursors.inventory[1]];
    } else if (globals.cursors.inventory[0] < items_per_row) {
        let item_index = globals.cursors.inventory[1] * items_per_row + globals.cursors.inventory[0];
        if (item_index in entity.inventory) [item, amount] = entity.inventory[item_index];
    }
    if (item) {
        let lines = [
            gettext('games_rpg_status_name') + ': ' + (item.name || gettext('games_rpg_status_name_unnamed') + ` (${amount})`),
        ];
        if (item.description) lines.push(gettext('games_rpg_status_description') + ': ' + item.description);
        if (Object.keys(item.on_use).length) {
            lines.push('---', gettext('games_rpg_status_on_use'));
            Object.entries(item.on_use).forEach(([attr, change]) => {
                if (typeof change == 'number') {
                    attr = attributes_names[attr];
                    let sign = {'1': '+', '-1': '-', '0': ''}[Math.sign(change)];
                    lines.push(`${attr}: ${sign}${change}`);
                } else {
                    Object.entries(change).forEach(([type, change]) => {
                        attr = gettext(attributes_names[attr], {type});
                        let sign = {'1': '+', '-1': '-', '0': ''}[Math.sign(change)];
                        lines.push(`${attr}: ${sign}${change}`);
                    });
                }
            });
        }
        if (Object.keys(item.passive).length) {
            lines.push('---', gettext('games_rpg_status_passive'));
            Object.entries(item.passive).forEach(([attr, change]) => {
                if (typeof change == 'number') {
                    attr = attributes_names[attr];
                    let sign = {'1': '+', '-1': '-', '0': ''}[Math.sign(change)];
                    lines.push(`${attr}: ${sign}${change}`);
                } else {
                    Object.entries(change).forEach(([type, change]) => {
                        attr = gettext(attributes_names[attr], {type});
                        let sign = {'1': '+', '-1': '-', '0': ''}[Math.sign(change)];
                        lines.push(`${attr}: ${sign}${change}`);
                    });
                }
            });
        }
        if (item.equip_slot != null) {
            lines.push('---');

            let title = gettext('games_rpg_status_equipped');
            if (globals.cursors.inventory[0] == items_per_row)
                title = `{color:${get_theme_value('text_item_equipped_color')}}${title}{color:${get_theme_value('text_color')}}`;
            lines.push(title);

            let has_slot = item.equip_slot in entity.equipment ? 'text_item_has_slot_color' : 'text_item_has_not_slot_color';
            lines.push(gettext('games_rpg_status_equip_slot', {
                slot: `{color:${get_theme_value(has_slot)}}${equip_slots[item.equip_slot].name}{color:${get_theme_value('text_color')}}`
            }));

            Object.entries(item.equipped).forEach(([attr, change]) => {
                if (typeof change == 'number') {
                    attr = attributes_names[attr];
                    let sign = {'1': '+', '-1': '-', '0': ''}[Math.sign(change)];
                    lines.push(`${attr}: ${sign}${change}`);
                } else {
                    Object.entries(change).forEach(([type, change]) => {
                        attr = gettext(attributes_names[attr], {type});
                        let sign = {'1': '+', '-1': '-', '0': ''}[Math.sign(change)];
                        lines.push(`${attr}: ${sign}${change}`);
                    });
                }
            });
        }

        canvas_tooltip(lines, x_start, y_start + tile_size[1] * 2.25);
    }
}
/**
 * Shows the status of an entity
 *
 * @param {Entity} entity
 */
function show_status(entity) {
    // Get what must be written
    let lines = [];
    let name_line = gettext('games_rpg_status_name') + ': ' + (entity.name || gettext('games_rpg_status_name_unnamed'));
    lines.push(name_line);
    if (globals.debug_status) {
        lines.push(`x: ${entity.x}`, `y: ${entity.y}`, `z: ${entity.z}`, `solid: ${entity.solid}`);
        if (entity instanceof AutonomousEntity) {
            lines.push(`target: at ${entity.target.x}, ${entity.target.y}`);

            if (entity.path) {
                lines.push(`path: ${entity.path.map(c => `[${c.join(', ')}]`).join(', ')}`);
            }
        }
    }

    let health_line = attributes_names['health'] + `: ${entity.health}/${entity.health_max}`;
    if (entity.bonus_health_max)
        health_line += ` (${entity.base_health_max} +${entity.bonus_health_max})`;
    lines.push(health_line);

    Object.entries(entity.defense).forEach(([type, def]) => {
        let line = gettext(attributes_names['defense'], {type: types_names[type]}) + `: ${def}`;
        if (type in entity.bonus_defense) {
            line += ` (${entity.base_defense[type] ?? 0} +${entity.bonus_defense[type]})`;
        }
        lines.push(line);
    });
    Object.entries(entity.damage).forEach(([type, dmg]) => {
        let line = gettext(attributes_names['damage'], {type: types_names[type]}) + `: ${dmg}`;
        if (type in entity.bonus_damage) {
            line += ` (${entity.base_damage[type] ?? 0} +${entity.bonus_damage[type]})`;
        }
        lines.push(line);
    });

    let speed_line = `${attributes_names['speed']}: ${entity.speed}`;
    if (entity.bonus_speed) speed_line += ` (${entity.base_speed} +${entity.bonus_speed})`;
    let range_line = `${attributes_names['range']}: ${entity.range}`;
    if (entity.bonus_range) range_line += ` (${entity.base_range} +${entity.bonus_range})`;
    let inventory_count = entity.inventory.map(([_, a]) => a).reduce((s, a) => s + a, 0);
    let inventory_line = `${attributes_names['inventory']}: ${inventory_count} ` +
        (inventory_count > 1 ? gettext('games_rpg_status_items') : gettext('games_rpg_status_item'));
    lines.push(speed_line, range_line, inventory_line);

    // Write
    let left = 2 * tile_size[0];
    let base_top = (2 - globals.cursors.status[1]) * tile_size[1];
    context.textAlign = 'left';
    context.font = `${tile_size[1]}px ${get_theme_value('text_font')}`;
    context.fillStyle = '#000';
    for (let i = 0; i < lines.length; i++) {
        let top = base_top + (i + 1) * tile_size[1];
        if (top <= 0) continue;

        let line = lines[i];
        canvas_write(line, left, top);
    }

    // Scroll arrows
    let can_scroll_up = globals.cursors.status[1] > 0;
    let can_scroll_down = lines.length + 4 > display_size[1];
    if (can_scroll_up) {
        context.textAlign = 'right';
        context.font = `${tile_size[1] * 3}px ${get_theme_value('text_font')}`;
        let left = (display_size[0] - .5) * tile_size[0];
        let top = 3 * tile_size[1];

        context.fillText('⇑', left, top);
    }
    if (can_scroll_down) {
        context.textAlign = 'right';
        context.font = `${tile_size[1] * 3}px ${get_theme_value('text_font')}`;
        let left = (display_size[0] - .5) * tile_size[0];
        let top = tile_size[1] * (display_size[1] - 2);

        context.fillText('⇓', left, top);
    }
}
/**
 * Writes a bunch of lines in a box
 *
 * @param {string[]} lines Lines to write. Change color by writing `{color:<color>}`. Any amount of backslashes will disable colors
 * @param {number} left Distance from left edge
 * @param {number} top Distance from top edge
 */
function canvas_tooltip(lines, left, top) {
    if (!lines.length) return;

    context.font = `${tile_size[1]}px ${get_theme_value('text_font')}`;
    let width = lines.map(line => {
        line = line.replace(regex_color, '');
        return context.measureText(line).width;
    }).sort((a, b) => b - a)[0] + tile_size[0] * 2;
    let height = tile_size[1] * (lines.length + .5);
    // Keep tooltip in the canvas (as much as possible)
    if (left + width > tile_size[0] * display_size[0]) {
        let overshot = left + width - tile_size[0] * display_size[0];
        left = Math.max(0, left - overshot);
    }
    if (top + height > tile_size[1] * display_size[1]) {
        let overshot = top + height - tile_size[1] * display_size[1];
        top = Math.max(0, top - overshot);
    }

    // Draw tooltip box
    context.fillStyle = get_theme_value('background_tooltip_color');
    context.strokeStyle = get_theme_value('border_tooltip_color');
    context.fillRect(left, top, width, height);
    context.strokeRect(left, top, width, height);

    canvas_write(lines, left, top);
}
/**
 * Writes text, with colors if you want, on the canvas
 *
 * @param {string[]|string} lines Lines to write. Change color by writing `{color:<color>}`. Any amount of backslashes will disable colors
 * @param {number} left Distance from left edge
 * @param {number} top Distance from top edge
 * @param {Object} context_options
 * @param {number} [context_options.min_left] Minimum distance from the left edge of the canvas
 * @param {number} [context_options.min_right] Minimum distance from the right edge of the canvas
 * @param {CanvasTextAlign} [context_options.text_align]
 */
export function canvas_write(lines, left, top, {min_left = 10, min_right = 10, text_align = 'left'}={}) {
    if (!Array.isArray(lines)) lines = [lines];
    if (!lines.length) return;

    // Set text vars
    context.textAlign = text_align;
    context.font = `${tile_size[1]}px ${get_theme_value('text_font')}`;
    context.fillStyle = get_theme_value('text_color');

    // Split lines that are too long
    let longest_line = Math.max(...lines.map(l => context.measureText(l.replace(regex_color, '')).width));
    const canvas_width = tile_size[0] * display_size[0];
    const padding = min_left + min_right;
    if (left + longest_line + padding > canvas_width) {
        // Move left to the lowest possible, or 0
        if (longest_line + padding <= canvas_width) {
            left = canvas_width - longest_line;
        } else {
            left = min_left;
            if (!(context.font in pre_split)) pre_split[context.font] = {};
            let own_splits = pre_split[context.font];

            lines = lines.map(line => {
                let colors_matches = [...line.matchAll(regex_color)];
                /** @type {[number, string][]} [index, fullcolor][] */
                let colors = [];
                colors_matches.forEach(match => {
                    let less = colors.map(c => c[1].length).reduce((s, n) => s + n, 0);
                    let index = match.index - less;
                    colors.push([index, match[0]]);
                });

                line = line.replace(regex_color, '');
                if (line in own_splits) return own_splits[line];

                let length = context.measureText(line).width;
                let slices = [];

                if (length + padding <= canvas_width) {
                    slices = [line];
                } else {
                    let baseline = line;

                    // Split into words
                    let avg_char_width = length / line.length;
                    while (context.measureText(line).width + padding > canvas_width) {
                        // Approximate target character
                        let len = (canvas_width - padding) / avg_char_width;
                        const regex_not_word = /[^\w]/g;

                        while (context.measureText(line.slice(0, len)).width + padding < canvas_width) len++;
                        while (context.measureText(line.slice(0, len)).width + padding > canvas_width) len--;

                        // Get previous non-alphanumeric
                        let slice = line.slice(0, len);
                        let separators = Array.from(new Set(slice.match(regex_not_word)));
                        if (separators.length) {
                            len = Math.max(separators.map(s => slice.lastIndexOf(s)));
                            slice = line.slice(0, len);
                            //len++; //todo depend on whether separator is whitespace
                        } // Else we just cut at the edge (so slice)

                        line = line.slice(len);

                        slices.push(slice);
                    }

                    slices.push(line);

                    own_splits[baseline] = slices;
                }
                // Put the colors back in the line(s)
                slices = slices.map((slice, index, slices) => {
                    let index_start = slices.filter((_, i) => i < index).map(s => s.length).reduce((n, a) => n + a, 0);
                    let index_end = index_start + slice.length;

                    /** @type {[number, string][]} */
                    let slice_colors = colors.filter(c => number_between(c[0], index_start, index_end)).map(c => [...c]).sort((a,b) => b[0]-a[0]);
                    slice_colors.forEach(([i, color]) => {
                        slice = slice.slice(0, i) + color + slice.slice(i);
                    });

                    return slice;
                });

                return slices;
            }).flat();
        }
    }

    const base_x = left + tile_size[0];

    // Draw text
    for (let i = 0; i < lines.length; i++) {
        const y = top + (i + 1) * tile_size[1];
        if (y <= 0) continue;
        let x = base_x;
        let line = lines[i];

        if (line.match(regex_color)) {
            // Iterate over the pieces
            let color = false;
            line.split(regex_color).forEach(chunk => {
                // Half of the pieces are color setters, the rest is actual text
                if (color) context.fillStyle = chunk;
                else {
                    context.fillText(chunk.replace(regex_not_color, n => n.slice(1)), x, y);
                    x += context.measureText(chunk).width;
                }
                color = !color;
            });
        } else {
            context.fillText(line.replace(regex_not_color, n => n.slice(1)), x, y);
        }
    }
}
