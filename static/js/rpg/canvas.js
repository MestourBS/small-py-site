import { Tile } from './tile.js';
import { AutonomousEntity } from './entity.js';
import { tile_size, display_size, get_theme_value, inventory_items_per_row } from './display.js';
import globals from './globals.js';

/**
 * Canvas of the game
 *
 * @type {HTMLCanvasElement}
 */
const canvas = document.getElementById('rpg_game');
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
 * Empties the canvas display
 */
export function canvas_reset() {
    let width = tile_size[0] * display_size[0];
    let height = tile_size[1] * display_size[1];

    if (canvas.width != width || canvas.height != height) {
        canvas.style.width = `${tile_size[0] * display_size[0]}px`;
        canvas.width = tile_size[0] * display_size[0];
        canvas.style.height = `${tile_size[1] * display_size[1]}px`;
        canvas.height = tile_size[1] * display_size[1];
    } else {
        let c = context.fillStyle;
        context.fillStyle = globals.game_state == 'pause' ? '#000' : '#fff';
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
    context.font = `${tile_size[1]}px ${get_theme_value('text_font')}`;
    context.fillStyle = get_theme_value('text_color');
    context.textAlign = 'center';
    context.fillText(`${entity.health}/${entity.health_max}`, text_position, top + height * .8, width);
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
    context.fillStyle = get_theme_value('background_inventory_color');
    context.fillRect(0, 0, tile_size[0] * display_size[0], tile_size[1] * display_size[1]);
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

            context.strokeStyle = color;
            context.fillStyle = color;
            let func = x != items_per_row || y in entity.equipment ? 'strokeRect' : 'fillRect';
            context[func](x_start, y_start, tile_size[0] * 2, tile_size[1] * 2);
            if (x == items_per_row && y in equip_slots && equip_slots[y].image) {
                context.drawImage(equip_slots[y].image, x_start, y_start, tile_size[0] * 2, tile_size[1] * 2);
            }
        }
    }
    // Draw items
    entity.inventory.forEach(([i,a]) => i.draw_inventory(a));
    Object.values(entity.equipment).forEach(i => {if (i) i.draw_inventory(1);});
    // Draw cursor
    let offset_x = tile_size[0];
    let offset_y = tile_size[1];
    let x_start = globals.cursors.inventory[0] * 3 * tile_size[0] + offset_x;
    let y_start = globals.cursors.inventory[1] * 3 * tile_size[1] + offset_y;
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
        }
    }

    let health_line = attributes_names['health'] + `: ${entity.health}/${entity.health_max}`;
    if (entity.bonus_health_max)
        health_line += ` (${entity.base_health_max} +${entity.bonus_health_max})`;
    if (entity.health / entity.health_max <= .1)
        health_line = `{color:${get_theme_value('text_very_low_health_color')}}${health_line}{color:${get_theme_value('text_color')}}`;
    else if (entity.health / entity.health_max <= .5)
        health_line = `{color:${get_theme_value('text_low_health_color')}}${health_line}{color:${get_theme_value('text_color')}}`;
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
 */
function canvas_write(lines, left, top) {
    if (!Array.isArray(lines)) lines = [lines];
    if (!lines.length) return;

    // Set text vars
    context.textAlign = 'left';
    context.font = `${tile_size[1]}px ${get_theme_value('text_font')}`;
    context.fillStyle = get_theme_value('text_color');
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
