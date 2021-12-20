import { Tile } from './tile.js';
import { beautify, capitalize, number_between } from './primitives.js';
import { AutonomousEntity } from './entity.js';
import { tile_size, display_size, get_theme_value, inventory_items_per_row, entity_skills_per_row } from './display.js';
import globals from './globals.js';
import { coords_distance } from './coords.js';
/**
 * @typedef {import('./entity.js').Entity} Entity
 */

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
    'magic': gettext('games_rpg_status_magic'),
    'magic_max': gettext('games_rpg_status_magic_max'),
    'speed': gettext('games_rpg_status_speed'),
    'range': gettext('games_rpg_status_range'),
    'kills': gettext('games_rpg_status_kills'),
    'inventory': gettext('games_rpg_status_inventory'),
    'skills': gettext('games_rpg_status_skills'),
    'skills_total_levels': gettext('games_rpg_status_skills_total_levels'),
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
 * @type {{[font: string]: {
 *  [line: string]: string[],
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
        let color = get_theme_value(`background_${globals.game_state}_color`);
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
        case 'skills':
            show_skills(globals.player);
            break;
        case 'skill_targeting':
            show_game();
            show_skill_target(globals.player);
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
    let height = tile_size[1];
    let top = (display_size[1] * tile_size[1]);
    let vals = ['health'];
    if (entity.magic_max > 0 && entity.skills.length) vals.push('magic');

    top -= height * vals.length;

    for (let val of vals) {
        let width;
        let fill;
        if (`${val}_max` in entity) {
            width = entity[`${val}_max`];
            fill = entity[val] / entity[`${val}_max`];
        } else {
            width = entity[val];
            fill = 1;
        }
        width = Math.min(Math.max(Math.ceil(width / 10), 10), display_size[0]) * tile_size[0];
        fill = Math.ceil(fill * width) || 0;

        let left = (display_size[0] * tile_size[0]) - width;
        let text_position = left + width / 2;
        let empty = width - fill;

        if (fill > 0) {
            context.fillStyle = get_theme_value(`background_entity_${val}_color`);
            context.fillRect(left, top, fill, height);
        }
        if (fill / width < 1) {
            context.fillStyle = get_theme_value(`background_entity_missing_${val}_color`);
            context.fillRect(left + fill, top, empty, height);
        }
        canvas_write(`${beautify(entity[val])}/${entity[`${val}_max`]}`, text_position - tile_size[0], top - tile_size[1] * .2, {text_align: 'center'});
        top += height;
    }
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
            let func = (x != items_per_row || y in entity.equipment) ? 'strokeRect' : 'fillRect';
            context[func](x_start, y_start, tile_size[0] * 2, tile_size[1] * 2);
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
        let signs = {'-1':'-','1':'+'}
        let lines = [
            gettext('games_rpg_status_name') + ': ' + capitalize(item.name || gettext('games_rpg_status_name_unnamed')) + ` (${amount})`,
        ];
        if (item.description) lines.push(gettext('games_rpg_status_description') + ': ' + item.description);
        if (Object.keys(item.on_use).length) {
            lines.push('---', gettext('games_rpg_status_on_use'));
            Object.entries(item.on_use).forEach(([attr, change]) => {
                if (typeof change == 'number') {
                    attr = capitalize(attributes_names[attr]);
                    lines.push(`${attr}: ${beautify(change, {signs})}`);
                } else {
                    Object.entries(change).forEach(([type, change]) => {
                        attr = capitalize(gettext(attributes_names[attr], {type}));
                        lines.push(`${attr}: ${beautify(change, {signs})}`);
                    });
                }
            });
        }
        if (Object.keys(item.passive).length) {
            lines.push('---', gettext('games_rpg_status_passive'));
            Object.entries(item.passive).forEach(([attr, change]) => {
                if (typeof change == 'number') {
                    attr = capitalize(attributes_names[attr]);
                    lines.push(`${attr}: ${beautify(change, {signs})}`);
                } else {
                    Object.entries(change).forEach(([type, change]) => {
                        attr = capitalize(gettext(attributes_names[attr], {type}));
                        lines.push(`${attr}: ${beautify(change, {signs})}`);
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
                    attr = capitalize(attributes_names[attr]);
                    let sign = {'1': '+', '-1': '-', '0': ''}[Math.sign(change)];
                    lines.push(`${attr}: ${sign}${change}`);
                } else {
                    Object.entries(change).forEach(([type, change]) => {
                        attr = capitalize(gettext(attributes_names[attr], {type}));
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
    let bonus_signs = {'-1':'-', '1':'+'};
    let name_line = gettext('games_rpg_status_name') + ': ' + capitalize(entity.name || gettext('games_rpg_status_name_unnamed'));
    let faction_line = gettext('games_rpg_status_faction') + ': ' + capitalize(entity.faction.name);
    lines.push(name_line, faction_line);
    if (globals.debug_status) {
        lines.push(`x: ${beautify(entity.x)}`, `y: ${beautify(entity.y)}`, `z: ${beautify(entity.z)}`, `solid: ${entity.solid}`);
        if (entity instanceof AutonomousEntity) {
            lines.push(`target: at ${beautify(entity.target.x)}, ${beautify(entity.target.y)}`);

            if (entity.path) {
                lines.push(`path: ${entity.path.map(c => `[${c.join(', ')}]`).join(', ')}`);
            }
        }
    }

    let health_line = `${capitalize(attributes_names['health'])} : ${beautify(entity.health)}/${beautify(entity.health_max)}`;
    if (entity.bonus_health_max)
        health_line += ` (${beautify(entity.base_health_max)} ${beautify(entity.bonus_health_max, {signs: bonus_signs})})`;
    let magic_line = `${attributes_names['magic']} : ${beautify(entity.magic)}/${beautify(entity.magic_max)}`;
    if (entity.bonus_magic_max)
        magic_line += ` (${beautify(entity.base_magic_max)} ${beautify(entity.bonus_magic_max, {signs: bonus_signs})})`;
    lines.push(health_line, magic_line);

    Object.entries(entity.defense).forEach(([type, def]) => {
        let line = capitalize(gettext(attributes_names['defense'], {type: types_names[type]})) + `: ${beautify(def)}`;
        if (type in entity.bonus_defense) {
            line += ` (${beautify(entity.base_defense[type])} ${beautify(entity.bonus_defense[type], {signs: bonus_signs})})`;
        }
        lines.push(line);
    });
    Object.entries(entity.damage).forEach(([type, dmg]) => {
        let line = capitalize(gettext(attributes_names['damage'], {type: types_names[type]})) + `: ${beautify(dmg)}`;
        if (type in entity.bonus_damage) {
            line += ` (${beautify(entity.base_damage[type])} ${beautify(entity.bonus_damage[type], {signs: bonus_signs})})`;
        }
        lines.push(line);
    });

    let speed_line = `${capitalize(attributes_names['speed'])}: ${beautify(entity.speed)}`;
    if (entity.bonus_speed) speed_line += ` (${beautify(entity.base_speed)} ${beautify(entity.bonus_speed, {signs: bonus_signs})})`;
    let range_line = `${capitalize(attributes_names['range'])}: ${beautify(entity.range)}`;
    if (entity.bonus_range) range_line += ` (${beautify(entity.base_range)} ${beautify(entity.bonus_range, {signs: bonus_signs})})`;
    lines.push(speed_line, range_line);

    if (entity.kills > 0) {
        let kills_line = `${capitalize(attributes_names['kills'])}: ${beautify(entity.kills)}`;
        lines.push(kills_line);
    }

    let inventory_count = entity.inventory.map(([_, a]) => a).reduce((s, a) => s + a, 0);
    let inventory_line = `${capitalize(attributes_names['inventory'])}: ${beautify(inventory_count)} ` +
        (inventory_count > 1 ? gettext('games_rpg_status_items') : gettext('games_rpg_status_item'));
    lines.push(inventory_line);

    if (entity.skills.length > 0) {
        let skills_levels = entity.skills.map(s => s.level);
        let total_levels = skills_levels.reduce((s, n) => s + n, 0);
        let skills_line = `${capitalize(attributes_names['skills'])}: ${beautify(entity.skills.length)}`;
        if (total_levels > 0) {
            skills_line += ` (${beautify(total_levels)} ${attributes_names['skills_total_levels'].toLowerCase()})`;
        }
        lines.push(skills_line);
    }

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
 * Shows the skills of an entity
 *
 * @param {Entity} entity
 */
function show_skills(entity) {
    // Draw skills background
    const skills_per_row = entity_skills_per_row();
    const skill_rows = Math.max(Math.floor(display_size[1] / 3) - 1, 1);
    const offset_x = tile_size[0];
    const offset_y = tile_size[1];
    for (let y = 0; y < skill_rows; y++) {
        for (let x = 0; x < skills_per_row; x++) {
            const x_start = x * 3 * tile_size[0] + offset_x;
            const y_start = y * 3 * tile_size[1] + offset_y;

            let index = y * skills_per_row + x;
            let can_cast = index in entity.skills && entity.magic >= entity.skills[index].cost;
            let color = get_theme_value(can_cast ? 'border_skill_cell_color' : 'background_skill_cell_uncastable_color');

            context.strokeStyle = context.fillStyle = color;
            let func = can_cast ? 'strokeRect' : 'fillRect';
            context[func](x_start, y_start, tile_size[0] * 2, tile_size[1] * 2);
        }
    }

    // Draw skills
    entity.skills.forEach(s => s.draw());

    // Draw cursor
    const skill_select = globals.cursors.skill_select;
    let x_start = (skill_select[0] * 3 + 1) * tile_size[0];
    let y_start = (skill_select[1] * 3 + 1) * tile_size[1];
    context.strokeStyle = get_theme_value('border_skill_select_cursor_color');
    context.strokeRect(x_start, y_start, tile_size[0] * 2, tile_size[1] * 2);

    // Prepare tooltip
    let skill = null;
    let index = skill_select[1] * skills_per_row + skill_select[0];
    if (index in entity.skills) skill = entity.skills[index];
    if (skill) {
        let signs = {'-1':'-','1':'+'}
        let lines = [
            gettext('games_rpg_status_name') + ': ' + capitalize(skill.name || gettext('games_rpg_status_name_unnamed')) + ` (${skill.level})`,
        ];
        if (skill.description) lines.push(gettext('games_rpg_status_description') + ': ' + skill.description);
        if (skill.cost > 0) {
            let can_cast = skill.cost <= entity.magic;
            let cost_line = `{color:${can_cast ? 'green': 'red'}}` + gettext('games_rpg_status_cost')
                +`: ${beautify(skill.cost)} {color:${get_theme_value('text_color')}}`;
            lines.push(cost_line);
        }
        if (Object.keys(skill.passive).length) {
            lines.push('---', gettext('games_rpg_status_passive'));
            Object.entries(skill.passive).forEach(([attr, change]) => {
                if (typeof change == 'number') {
                    attr = capitalize(attributes_names[attr]);
                    lines.push(`${attr}: ${beautify(change, {signs})}`);
                } else {
                    Object.entries(change).forEach(([type, change]) => {
                        attr = capitalize(gettext(attributes_names[attr], {type}));
                        lines.push(`${attr}: ${beautify(change, {signs})}`);
                    });
                }
            });
        }
        if (Object.keys(skill.on_use_self).length) {
            lines.push('---', gettext('games_rpg_status_on_use_self'));
            Object.entries(skill.on_use_self).forEach(([attr, change]) => {
                if (typeof change == 'number') {
                    attr = capitalize(attributes_names[attr]);
                    lines.push(`${attr}: ${beautify(change, {signs})}`);
                } else {
                    Object.entries(change).forEach(([type, change]) => {
                        attr = capitalize(gettext(attributes_names[attr], {type}));
                        lines.push(`${attr}: ${beautify(change, {signs})}`);
                    });
                }
            });
        }
        if (Object.keys(skill.on_use_target).length) {
            lines.push('---', gettext('games_rpg_status_on_use_target'));
            Object.entries(skill.on_use_target).forEach(([attr, change]) => {
                if (typeof change == 'number') {
                    attr = capitalize(attributes_names[attr]);
                    lines.push(`${attr}: ${beautify(change, {signs})}`);
                } else {
                    Object.entries(change).forEach(([type, change]) => {
                        attr = capitalize(gettext(attributes_names[attr], {type}));
                        lines.push(`${attr}: ${beautify(change, {signs})}`);
                    });
                }
            });
        }

        canvas_tooltip(lines, x_start, y_start + tile_size[1] * 2.25);
    }
}
/**
 * Shows the target of a skill
 *
 * @param {Entity} entity
 */
function show_skill_target(entity) {
    let skills_per_row = entity_skills_per_row();
    let index = globals.cursors.skill_select[1] * skills_per_row + globals.cursors.skill_select[0];
    let skill = entity.skills[index];
    let dist = coords_distance(entity, globals.cursors.skill_target);
    let out_range = dist > skill.range;

    let color = get_theme_value(`border_skill_target${'_out_range'.repeat(out_range)}_cursor_color`);
    let x_start = (globals.cursors.skill_target[0] - (globals.focused_entity.x - display_size[0] / 2)) * tile_size[0];
    let y_start = (globals.cursors.skill_target[1] - (globals.focused_entity.y - display_size[1] / 2)) * tile_size[1];
    context.strokeStyle = color;
    context.strokeRect(x_start, y_start, tile_size[0], tile_size[1]);
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
