/**
 * Keybinds, clicks and more!
 *
 * This module deals with all player induced actions.
 * This includes keybinds, clicks, right-clicks, and more (in the future).
 *
 * Current features:
 * * Keybinds, for when the player types something
 * * Clicks, for when the player clicks something
 * * Context menus, for when the player right-clicks something
 *
 * Planned features:
 * * Keybinds rework, required for inputs
 * * Drag-click, to reorder the inventory
 * * Scroll-wheel support, for both the inventory and the status
 */
import { Tile } from './tile.js';
import { Item } from './item.js';
import { Entity } from './entity.js';
import { canvas, mini_status_rows_sizes } from './canvas.js';
import { coords_between, coords_distance, Direction } from './coords.js';
import { number_between } from './primitives.js';
import { display_size, entity_skills_per_row, get_theme_value, inventory_items_per_row, tile_size } from './display.js';
import { BaseCanvasOption } from './options.js';
import globals from './globals.js';
/**
 * @typedef {import('./skills.js').Skill} Skill
 */

/**
 * Game keybinds
 *
 * Effects are obtained with `KEYBINDS[<game_state>|others][mapped_key]`.
 * `mapped_key` is the lowercased key, with alt, ctrl and/or shift prepended if they are pressed.
 * Checks are done in an alphabetical order, so alt+key takes priority over ctrl+key.
 * Longer composites take precedence over shorter ones, so alt+ctrl+key > alt+key.
 * Composite building is also done in an alphabetical way, so alt+ctrl+key is correct, unlike ctrl+alt+key.
 *
 * Using `*` for a key will call on any key, but will also pass the event to the action
 *
 * - Actions are in-game actions (movement, attack, etc.)
 *
 * @type {{
 *  playing: {[key: string]: (keyof actions)[]},
 *  pause: {[key: string]: (keyof actions)[]},
 *  inventory: {[key: string]: (keyof actions)[]},
 *  status: {[key: string]: (keyof actions)[]},
 *  skills: {[key: string]: (keyof actions)[]},
 *  skill_targeting: {[key: string]: (keyof actions)[]},
 *  options_test: {[key: string]: (keyof actions)[]},
 * }}
 */
const keybinds = {
    playing: {
        'a': ['move_player_left'],
        'd': ['move_player_right'],
        's': ['move_player_down'],
        'w': ['move_player_up'],
        'arrowleft': ['move_player_left'],
        'arrowright': ['move_player_right'],
        'arrowdown': ['move_player_down'],
        'arrowup': ['move_player_up'],
        'i': ['show_inventory'],
        'o': ['show_status'],
        'k': ['show_skills'],
        'm': ['show_minimap'],
        'p': ['game_pause'],
        '0': ['show_options_test'],
    },
    pause: {
        'i': ['show_inventory'],
        'o': ['show_status'],
        'k': ['show_skills'],
        'm': ['show_minimap'],
        'p': ['game_resume'],
    },
    inventory: {
        'a': ['move_cursor_inventory_left'],
        'd': ['move_cursor_inventory_right'],
        's': ['move_cursor_inventory_down'],
        'w': ['move_cursor_inventory_up'],
        'arrowleft': ['move_cursor_inventory_left'],
        'arrowright': ['move_cursor_inventory_right'],
        'arrowdown': ['move_cursor_inventory_down'],
        'arrowup': ['move_cursor_inventory_up'],
        ' ': ['use_inventory_selected'],
        'q': ['drop_inventory_selected'],
        'i': ['hide_inventory'],
        'e': ['toggle_equip_inventory_selected'],
        'k': ['show_skills'],
        'o': ['show_status'],
        'm': ['show_minimap'],
        'p': ['game_pause'],
    },
    status: {
        's': ['move_cursor_status_down'],
        'w': ['move_cursor_status_up'],
        'arrowdown': ['move_cursor_status_down'],
        'arrowup': ['move_cursor_status_up'],
        'o': ['hide_status'],
        'i': ['show_inventory'],
        'k': ['show_skills'],
        'm': ['show_minimap'],
        'p': ['game_pause'],
    },
    skills: {
        'a': ['move_cursor_skill_select_left'],
        'd': ['move_cursor_skill_select_right'],
        's': ['move_cursor_skill_select_down'],
        'w': ['move_cursor_skill_select_up'],
        'arrowleft': ['move_cursor_skill_select_left'],
        'arrowright': ['move_cursor_skill_select_right'],
        'arrowdown': ['move_cursor_skill_select_down'],
        'arrowup': ['move_cursor_skill_select_up'],
        ' ': ['select_skill_selected'],
        'k': ['hide_skills'],
        'u': ['level_skill'],
        'i': ['show_inventory'],
        'o': ['show_status'],
        'm': ['show_minimap'],
        'p': ['game_pause'],
    },
    skill_targeting: {
        'a': ['move_cursor_skill_target_left'],
        'd': ['move_cursor_skill_target_right'],
        's': ['move_cursor_skill_target_down'],
        'w': ['move_cursor_skill_target_up'],
        'arrowleft': ['move_cursor_skill_target_left'],
        'arrowright': ['move_cursor_skill_target_right'],
        'arrowdown': ['move_cursor_skill_target_down'],
        'arrowup': ['move_cursor_skill_target_up'],
        'k': ['change_skill'],
        'q': ['cancel_skill'],
        ' ': ['use_skill'],
        'p': ['game_pause'],
    },
    minimap: {
        'm': ['hide_minimap'],
        'i': ['show_inventory'],
        'o': ['show_status'],
        'k': ['show_skills'],
        'p': ['game_pause'],
    },
    options_test: {
        'arrowdown': ['move_cursor_options_down'],
        'arrowup': ['move_cursor_options_up'],
        'escape': ['exit_options'],
        '*': ['call_option'],
    },
};
/**
 * Existing actions
 */
const actions = new Proxy(Object.freeze({
    // Player actions
    'move_player_left': {
        name: gettext('games_rpg_action_move_player_left'),
        func: () => {
            globals.player.move(Direction.left, 1/10);
        },
    },
    'move_player_right': {
        name: gettext('games_rpg_action_move_player_right'),
        func: () => {
            globals.player.move(Direction.right, 1/10);
        },
    },
    'move_player_down': {
        name: gettext('games_rpg_action_move_player_down'),
        func: () => {
            globals.player.move(Direction.down, 1/10);
        },
    },
    'move_player_up': {
        name: gettext('games_rpg_action_move_player_up'),
        func: () => {
            globals.player.move(Direction.up, 1/10);
        },
    },
    // Cursors actions
    'move_cursor_inventory_left': {
        name: gettext('games_rpg_action_move_cursor_inventory_left'),
        func: () => {
            let items_per_row = inventory_items_per_row();
            let index = globals.cursors.inventory[1] * items_per_row + globals.cursors.inventory[0];
            if (globals.cursors.inventory[0] == items_per_row) {
                // We're in the equipment section, so we reach for the nearest item
                // Cursor is outside the inventory rows, reduce it by 1
                index--;
                let position = Math.max(0, globals.player.inventory.length - 1);
                let prevs = Object.keys(globals.player.equipment).sort((a,b) => b-a)
                    .filter(n => n < globals.cursors.inventory[1] && n >= Math.floor(position / items_per_row));

                if (globals.player.inventory.length - 1 <= index) {
                    if (prevs.length) {
                        globals.cursors.inventory[1] = +prevs[0];
                    } else {
                        globals.cursors.inventory[0] = position % items_per_row;
                        globals.cursors.inventory[1] = Math.floor(position / items_per_row);
                    }
                } else {
                    globals.cursors.inventory[0] = index % items_per_row;
                    globals.cursors.inventory[1] = Math.floor(index / items_per_row);
                }
            } else {
                if (index - 1 < 0) return;

                globals.cursors.inventory[0] += Direction.left[0];
                globals.cursors.inventory[1] += Direction.left[1];

                if (globals.cursors.inventory[0] < 0) {
                    if (globals.cursors.inventory[1] > 0) {
                        globals.cursors.inventory[1]--;
                        if (globals.cursors.inventory[1] in globals.player.equipment) globals.cursors.inventory[0] = items_per_row;
                        else globals.cursors.inventory[0] = (index - 1) % items_per_row;
                    } else {
                        globals.cursors.inventory[1] = 0;
                    }
                }
            }
        },
    },
    'move_cursor_inventory_right': {
        name: gettext('games_rpg_action_move_cursor_inventory_right'),
        func: () => {
            let items_per_row = inventory_items_per_row();
            let index = globals.cursors.inventory[1] * items_per_row + globals.cursors.inventory[0];
            if (globals.cursors.inventory[0] == items_per_row) {
                // We're in the equipment section, so we reach for the nearest item
                index--;
                let nexts = Object.keys(globals.player.equipment).sort((a,b) => a-b).filter(n => n > globals.cursors.inventory[1]);

                if (globals.player.inventory.length - 1 <= index) {
                    if (nexts.length) {
                        globals.cursors.inventory[1] = +nexts[0];
                    }
                } else {
                    globals.cursors.inventory[0] = 0;
                    globals.cursors.inventory[1]++;
                }
            } else {
                globals.cursors.inventory[0] += Direction.right[0];
                globals.cursors.inventory[1] += Direction.right[1];

                let out_index = index + 1 >= globals.player.inventory.length;
                let out_row = globals.cursors.inventory[0] == items_per_row && !(globals.cursors.inventory[1] in globals.player.equipment);
                out_row ||= globals.cursors.inventory[0] > items_per_row;

                if (out_row && out_index) {
                    // We're beyond the inventory and not in the equipment
                    globals.cursors.inventory[0] -= Direction.right[0];
                    globals.cursors.inventory[1] -= Direction.right[1];
                } else if (out_row) {
                    // We're not in the equipment, we can still get in the inventory
                    globals.cursors.inventory[0] = 0;
                    globals.cursors.inventory[1]++;
                } else if (out_index) {
                    // We're beyond the inventory, let's get to the next equipment slot
                    let nexts = Object.keys(globals.player.equipment).sort((a,b) => a-b).filter(n => n >= globals.cursors.inventory[1]);
                    if (!nexts.length) {
                        // We're beyond the equipment too, undo
                        globals.cursors.inventory[0] -= Direction.right[0];
                        globals.cursors.inventory[1] -= Direction.right[1];
                    } else {
                        // Get to the next equipment slot, somewhere below
                        globals.cursors.inventory[0] = items_per_row;
                        globals.cursors.inventory[1] = +nexts[0];
                    }
                }
            }
        },
    },
    'move_cursor_inventory_down': {
        name: gettext('games_rpg_action_move_cursor_inventory_down'),
        func: () => {
            let items_per_row = inventory_items_per_row();
            if (globals.cursors.inventory[0] == items_per_row) {
                // We're in the equipment section, should be easy, right?
                let nexts = Object.keys(globals.player.equipment).sort((a,b) => a-b).filter(n => n > globals.cursors.inventory[1]);
                if (nexts.length) {
                    globals.cursors.inventory[1] = +nexts[0];
                }
            } else {
                let index = globals.cursors.inventory[1] * items_per_row + globals.cursors.inventory[0];
                if (index + items_per_row >= globals.player.inventory.length) return;

                globals.cursors.inventory[1]++;
            }
        },
    },
    'move_cursor_inventory_up': {
        name: gettext('games_rpg_action_move_cursor_inventory_up'),
        func: () => {
            if (globals.cursors.inventory[1] <= 0) return;
            let items_per_row = inventory_items_per_row();

            if (globals.cursors.inventory[0] == items_per_row) {
                let prevs = Object.keys(globals.player.equipment).sort((a,b) => b-a).filter(n => n < globals.cursors.inventory[1]);

                if (prevs.length) {
                    globals.cursors.inventory[1] = +prevs[0];
                }
            } else {
                let dir = Direction.up;
                globals.cursors.inventory[0] += dir[0];
                globals.cursors.inventory[1] += dir[1];
            }
        },
    },
    'move_cursor_status_down': {
        name: gettext('games_rpg_action_move_cursor_status_down'),
        func: () => {
            let rows = 4; // health, speed, range, inventory
            if (debug_status) rows += 4; //x, y, z, solid
            if (globals.player.name) rows++;
            rows += Object.keys(globals.player.defense).length;
            rows += Object.keys(globals.player.damage).length;
            if (rows + 4 <= DISPLAY_SIZE[1]) return;

            globals.cursors.status[0]++;
        },
    },
    'move_cursor_status_up': {
        name: gettext('games_rpg_action_move_cursor_status_up'),
        func: () => {
            if (globals.cursors.status[0] <= 0) return;

            globals.cursors.status[0]--;
        },
    },
    'move_cursor_skill_select_up': {
        name: gettext('games_rpg_action_move_cursor_skill_select_up'),
        func: () => {
            if (globals.cursors.skill_select[1] <= 0) return;
            let skills_per_row = entity_skills_per_row();

            let current_index = skills_per_row * globals.cursors.skill_select[1] + globals.cursors.skill_select[0];
            let target_index = current_index - skills_per_row;

            if (target_index in globals.player.skills) {
                globals.cursors.skill_select[1]--;
            }
        },
    },
    'move_cursor_skill_select_down': {
        name: gettext('games_rpg_action_move_cursor_skill_select_down'),
        func: () => {
            let skills_per_row = entity_skills_per_row();

            let current_index = skills_per_row * globals.cursors.skill_select[1] + globals.cursors.skill_select[0];
            let target_index = current_index + skills_per_row;

            if (target_index in globals.player.skills) {
                globals.cursors.skill_select[1]++;
            }
        },
    },
    'move_cursor_skill_select_left': {
        name: gettext('games_rpg_action_move_cursor_skill_select_left'),
        func: () => {
            if (globals.cursors.skill_select.every(n => n <= 0)) return;
            let skills_per_row = entity_skills_per_row();

            let current_index = skills_per_row * globals.cursors.skill_select[1] + globals.cursors.skill_select[0];
            let target_index = current_index - 1;

            if (target_index in globals.player.skills) {
                if (globals.cursors.skill_select[0] <= 0) {
                    globals.cursors.skill_select[0] = skills_per_row - 1;
                    globals.cursors.skill_select[1]--;
                } else {
                    globals.cursors.skill_select[0]--;
                }
            }
        },
    },
    'move_cursor_skill_select_right': {
        name: gettext('games_rpg_action_move_cursor_skill_select_right'),
        func: () => {
            let skills_per_row = entity_skills_per_row();

            let current_index = skills_per_row * globals.cursors.skill_select[1] + globals.cursors.skill_select[0];
            let target_index = current_index + 1;

            if (target_index in globals.player.skills) {
                if (globals.cursors.skill_select[0] >= skills_per_row - 1) {
                    globals.cursors.skill_select[0] = 0;
                    globals.cursors.skill_select[1]++;
                } else {
                    globals.cursors.skill_select[0]++;
                }
            }
        },
    },
    'move_cursor_skill_target_up': {
        name: gettext('games_rpg_action_move_cursor_skill_target_up'),
        func: () => {
            let skills_per_row = entity_skills_per_row();
            const skill_target = globals.cursors.skill_target;

            let index = skills_per_row * globals.cursors.skill_select[1] + globals.cursors.skill_select[0];
            let skill = globals.player.skills[index];
            let range = skill.range;
            let dist = coords_distance(skill_target, globals.player);
            let dist_next = coords_distance(skill_target.map((n,i) => n + Direction.up[i] * .1), globals.player);

            if (dist_next <= range || dist_next < dist) {
                skill_target[0] += Direction.up[0] * .1;
                skill_target[1] += Direction.up[1] * .1;
            }
        },
    },
    'move_cursor_skill_target_down': {
        name: gettext('games_rpg_action_move_cursor_skill_target_down'),
        func: () => {
            let skills_per_row = entity_skills_per_row();
            const skill_target = globals.cursors.skill_target;

            let index = skills_per_row * globals.cursors.skill_select[1] + globals.cursors.skill_select[0];
            let skill = globals.player.skills[index];
            let range = skill.range;
            let dist = coords_distance(skill_target, globals.player);
            let dist_next = coords_distance(skill_target.map((n,i) => n + Direction.down[i] * .1), globals.player);

            if (dist_next <= range || dist_next < dist) {
                skill_target[0] += Direction.down[0] * .1;
                skill_target[1] += Direction.down[1] * .1;
            }
        },
    },
    'move_cursor_skill_target_left': {
        name: gettext('games_rpg_action_move_cursor_skill_target_left'),
        func: () => {
            let skills_per_row = entity_skills_per_row();
            const skill_target = globals.cursors.skill_target;

            let index = skills_per_row * globals.cursors.skill_select[1] + globals.cursors.skill_select[0];
            let skill = globals.player.skills[index];
            let range = skill.range;
            let dist = coords_distance(skill_target, globals.player);
            let dist_next = coords_distance(skill_target.map((n,i) => n + Direction.left[i] * .1), globals.player);

            if (dist_next <= range || dist_next < dist) {
                skill_target[0] += Direction.left[0] * .1;
                skill_target[1] += Direction.left[1] * .1;
            }
        },
    },
    'move_cursor_skill_target_right': {
        name: gettext('games_rpg_action_move_cursor_skill_target_right'),
        func: () => {
            let skills_per_row = entity_skills_per_row();
            const skill_target = globals.cursors.skill_target;

            let index = skills_per_row * globals.cursors.skill_select[1] + globals.cursors.skill_select[0];
            let skill = globals.player.skills[index];
            let range = skill.range;
            let dist = coords_distance(skill_target, globals.player);
            let dist_next = coords_distance(skill_target.map((n,i) => n + Direction.right[i] * .1), globals.player);

            if (dist_next <= range || dist_next < dist) {
                skill_target[0] += Direction.right[0] * .1;
                skill_target[1] += Direction.right[1] * .1;
            }
        },
    },
    'move_cursor_options_up': {
        name: gettext('games_rpg_action_move_cursor_options_up'),
        func: () => {
            if (globals.cursors.options[1] <= 0) return;

            globals.cursors.options[1]--;
            globals.cursors.options[0] = 0;
        },
    },
    'move_cursor_options_down': {
        name: gettext('games_rpg_action_move_cursor_options_down'),
        func: () => {
            if (globals.cursors.options[1] >= BaseCanvasOption.options.length - 1) return;

            globals.cursors.options[1]++;
            globals.cursors.options[0] = 0;
        },
    },
    // Cursor-position based actions
    'use_inventory_selected': {
        name: gettext('games_rpg_action_use_inventory_selected'),
        /** @param {number?} [index] */
        func: (index = null) => {
            let items_per_row = inventory_items_per_row();
            if (globals.cursors.inventory[0] < items_per_row) {
                index ??= globals.cursors.inventory[1] * items_per_row + globals.cursors.inventory[0];
                globals.player.use_item(index);
            } // You can't use an equipped item!
        },
    },
    'drop_inventory_selected': {
        name: gettext('games_rpg_action_drop_inventory_selected'),
        /** @param {number?} [index] */
        func: (index = null) => {
            let items_per_row = inventory_items_per_row();
            let equip = globals.cursors.inventory[0] >= items_per_row;
            if (index == null) {
                if (!equip) {
                    index = globals.cursors.inventory[1] * items_per_row + globals.cursors.inventory[0];
                } else {
                    index = globals.cursors.inventory[1];
                }
            }

            globals.player.drop_item(index, equip);
        },
    },
    'toggle_equip_inventory_selected': {
        name: gettext('games_rpg_action_toggle_equip_inventory_selected'),
        /** @param {number?} [index] */
        func: (index = null) => {
            let items_per_row = inventory_items_per_row();
            if (globals.cursors.inventory[0] == items_per_row) {
                index ??= globals.cursors.inventory[1];
                globals.player.unequip_item(index);
            } else {
                index ??= globals.cursors.inventory[1] * items_per_row + globals.cursors.inventory[0];
                globals.player.equip_item(index);
            }
        },
    },
    'select_skill_selected': {
        name: gettext('games_rpg_action_select_skill_selected'),
        /** @param {number?} [index] */
        func: (index = null) => {
            let skills_per_row = entity_skills_per_row();
            let sindex = skills_per_row * globals.cursors.skill_select[1] + globals.cursors.skill_select[0];
            let skill = globals.player.skills[index ?? sindex];

            if (skill.cost > globals.player.magic) return;

            if (Object.keys(skill.on_use_target).length || skill.range > 0) {
                globals.game_state = 'skill_targeting';
            } else if (Object.keys(skill.on_use_self).length) {
                globals.player.use_skill(index ?? sindex);
            }
        },
    },
    'use_skill': {
        name: gettext('games_rpg_action_use_skill'),
        /**
         * @param {number?} [index]
         * @param {{x: number, y: number}?} [target]
         */
        func: (index = null, target = null) => {
            let skills_per_row = entity_skills_per_row();
            index ??= globals.cursors.skill_select[1] * skills_per_row + globals.cursors.skill_select[0];
            // If we're further than half a tile from the player, we select a nearby target
            if (coords_distance(globals.player, globals.cursors.skill_target) > .5) {
                target ??= {
                    x: globals.cursors.skill_target[0],
                    y: globals.cursors.skill_target[1],
                };
            }
            globals.player.use_skill(index, target);
            globals.game_state = 'playing';
        },
    },
    'level_skill': {
        name: gettext('games_rpg_action_level_skill'),
        /** @param {number?} [index] */
        func: (index = null) => {
            let skills_per_row = entity_skills_per_row();
            index ??= globals.cursors.skill_select[1] * skills_per_row + globals.cursors.skill_select[0];
            globals.player.level_skill(index);
        },
    },
    'call_option': {
        name: gettext('games_rpg_action_call_option'),
        /** @param {KeyboardEvent} e */
        func: e => {
            let i = globals.cursors.options[1];

            if (!(i in BaseCanvasOption.options)) return;

            let o = BaseCanvasOption.options[i];
            o.keydown(e);
        },
    },
    // Game state actions
    'game_pause': {
        name: gettext('games_rpg_action_game_pause'),
        func: () => {
            globals.game_state = 'pause';
        },
    },
    'game_resume': {
        name: gettext('games_rpg_action_game_resume'),
        func: () => {
            globals.game_state = 'playing';
        },
    },
    'game_pause_toggle': {
        name: gettext('games_rpg_action_game_pause_toggle'),
        func: () => {
            globals.game_state = globals.game_state == 'playing' ? 'pause' : 'playing';
        },
    },
    'show_inventory': {
        name: gettext('games_rpg_action_show_inventory'),
        func: () => {
            globals.game_state = 'inventory';
            globals.cursors.inventory[0] = 0;
            globals.cursors.inventory[1] = 0;
        },
    },
    'hide_inventory': {
        name: gettext('games_rpg_action_hide_inventory'),
        func: () => {
            globals.game_state = 'playing';
        },
    },
    'show_status': {
        name: gettext('games_rpg_action_show_status'),
        func: () => {
            globals.game_state = 'status';
            globals.cursors.status[0] = 0;
        },
    },
    'hide_status': {
        name: gettext('games_rpg_action_hide_status'),
        func: () => {
            globals.game_state = 'playing';
        },
    },
    'show_skills': {
        name: gettext('games_rpg_action_show_skills'),
        func: () => {
            globals.game_state = 'skills';
            globals.cursors.skill_select[0] = 0;
            globals.cursors.skill_select[1] = 0;
            globals.cursors.skill_target[0] = globals.player.x;
            globals.cursors.skill_target[1] = globals.player.y;
        },
    },
    'hide_skills': {
        name: gettext('games_rpg_action_hide_skills'),
        func: () => {
            globals.game_state = 'playing';
        },
    },
    'change_skill': {
        name: gettext('games_rpg_action_change_skill'),
        func: () => {
            globals.game_state = 'skills';
        },
    },
    'cancel_skill': {
        name: gettext('games_rpg_action_cancel_skill'),
        func: () => {
            globals.game_state = 'playing';
        },
    },
    'show_minimap': {
        name: gettext('games_rpg_action_show_minimap'),
        func: () => {
            globals.game_state = 'minimap';
            Tile.visible_grid_mini = false;
        },
    },
    'hide_minimap': {
        name: gettext('games_rpg_action_hide_minimap'),
        func: () => {
            globals.game_state = 'playing';
        },
    },
    'exit_options': {
        name: gettext('games_rpg_action_show_options_test'),
        func: () => {
            BaseCanvasOption.options.length = 0;
            globals.game_state = 'playing';
        },
    },
    'show_options_test': {
        name: gettext('games_rpg_action_show_options_test'),
        func: () => {
            let target = {
                num: 3,
                str: 'test',
                bool: false,
                list: '1',
                color: '#000',
                key: 'a',
            };

            BaseCanvasOption.options.push(
                BaseCanvasOption.make_option_type({target, target_property: 'num', label: 'num', type: 'number'}),
                BaseCanvasOption.make_option_type({target, target_property: 'str', label: 'str', type: 'string'}),
                BaseCanvasOption.make_option_type({target, target_property: 'bool', label: 'bool', type: 'boolean'}),
                BaseCanvasOption.make_option_type({target, target_property: 'list', label: 'list', type: 'list', list: ['1', 'a', 'α', 'A',]}),
                BaseCanvasOption.make_option_type({target, target_property: 'color', label: 'color', type: 'color'}),
                BaseCanvasOption.make_option_type({target, target_property: 'key', label: 'key', type: 'key'}),
            );

            globals.game_state = 'options_test';
            globals.cursors.options[0] = 0;
            globals.cursors.options[1] = 0;
        },
    },
    // Click actions
    'open_context_menu': {
        name: gettext('games_rpg_action_open_context_menu'),
        func: () => {
            let x_in = number_between(mouse_position[0], 0, canvas.offsetWidth);
            let y_in = number_between(mouse_position[1], 0, canvas.offsetHeight);
            if (!x_in || !y_in) return;

            let x = mouse_position[0];
            let y = mouse_position[1];

            contextmenu(x, y);
        },
    },
}),{
    get: (obj, prop) => obj[prop] ?? {name: '', func: () => {}},
    set: (obj, prop, val) => {},
});

/**
 * Whether the game is in pseudo-pause
 *
 * The game is considered pseudo-paused if the window's focus is lost for any reason
 *
 * @type {boolean}
 */
let blur_pause = !document.hasFocus();
/**
 * Current mouse position on the document
 *
 * @type {[number, number]}
 */
let mouse_position = [0, 0];

/**
 * Calls the action that corresponds to the key pressed
 *
 * @this {Document}
 * @param {KeyboardEvent} e
 */
export function keydown(e) {
    if (e.metaKey) return;

    /** @type {{[k: string]: keyof actions}} */
    let to_check = {};
    Object.entries(keybinds[globals.game_state] ?? {}).forEach(([key, act]) => {
        if (!(key in to_check)) to_check[key] = [];
        to_check[key].push(...act);
    });

    // Get the key
    let key = e.key.toLowerCase();
    if (globals.strict_keys) {
        // There's only one key we want
        if (e.shiftKey) key = `shift+${key}`;
        if (e.ctrlKey) key = `ctrl+${key}`;
        if (e.altKey) key = `alt+${key}`;
    } else {
        // Compose keys, get most complex valid one
        let keys = [key];
        if (e.shiftKey) keys.push(...keys.map(k => `shift+${k}`));
        if (e.ctrlKey) keys.push(...keys.map(k => `ctrl+${k}`));
        if (e.altKey) keys.push(...keys.map(k => `alt+${k}`));
        keys.sort((a, b) => b.length - a.length || a < b);
        key = keys.find(k => k in to_check) ?? key;
    }

    /** @type {string[]} */
    let key_actions = to_check[key];
    if ('*' in to_check) {
        actions[to_check['*']].func(e);
    }
    if (key_actions?.length && !e.defaultPrevented) {
        e.preventDefault();
        key_actions.forEach(a => actions[a].func());
    }
}
/**
 * Performs a click on a target tile
 *
 * @param {number} x x position where the click was on the canvas
 * @param {number} y y position where the click was on the canvas
 */
function click(x, y) {
    const player = globals.player;
    // Prevent from firing if we're clicking on the mini status
    const rows = mini_status_rows_sizes(player);
    if (rows.some(r => coords_between([x, y], [r[0], r[1]], [r[0] + r[2], r[1] + r[3]]))) return;

    switch (globals.game_state) {
        case 'inventory': {
            let target_x = Math.floor(x / tile_size[0]);
            let target_y = Math.floor(y / tile_size[1]);
            let max_rows = Math.max(Math.floor(display_size[1] / 3) - 1, 1);
            // Empty slot, ignore it
            if (!(target_x % 3 && target_y % 3) || target_y / 3 > max_rows) return;
            // Inventory slots are 3 times as big as normal tiles, so divide by 3
            target_x = Math.floor(target_x / 3);
            target_y = Math.floor(target_y / 3);

            // Move cursor to clicked slot, if it exists
            let items_per_row = inventory_items_per_row();
            if (target_x == items_per_row) {
                if (!(target_y in player.equipment)) return;
            } else {
                let index = target_x + target_y * items_per_row;
                if (index && !(index in player.inventory)) return;
            }

            globals.cursors.inventory[0] = target_x;
            globals.cursors.inventory[1] = target_y;
            }
            break;
        case 'skills': {
            let target_x = Math.floor(x / tile_size[0]);
            let target_y = Math.floor(y / tile_size[1]);
            let max_rows = Math.max(Math.floor(display_size[1] / 3) - 1, 1);
            // Empty slot, ignore it
            if (!(target_x % 3 && target_y % 3) || target_y / 3 > max_rows) return;
            // Skill slots are 3 times as big as normal tiles, so divide by 3
            target_x = Math.floor(target_x / 3);
            target_y = Math.floor(target_y / 3);

            // Move cursor to clicked slot, if it exists
            let skills_per_row = entity_skills_per_row();
            let index = target_x + target_y * skills_per_row;
            if (index && !(index in player.skills)) return;

            globals.cursors.skill_select[0] = target_x;
            globals.cursors.skill_select[1] = target_y;
            }
            break;
        case 'skill_targeting': {
            const focused = globals.focused_entity;
            let target_x = Math.floor((x / tile_size[0] + focused.x - display_size[0] / 2 - .25) * 2) / 2;
            let target_y = Math.floor((y / tile_size[1] + focused.y - display_size[1] / 2 - .25) * 2) / 2;

            // Check if outside of range
            let skills_per_row = entity_skills_per_row();
            let index = globals.cursors.skill_select[0] + globals.cursors.skill_select[1] * skills_per_row;
            if (!(index in player.skills)) return;
            let skill = player.skills[index];
            let range = skill.range;

            if (range < coords_distance(player, [target_x, target_y])) {
                canvas.style.cursor = 'not-allowed';
                setTimeout(() => canvas.style.cursor = null, 250);
                return;
            }

            globals.cursors.skill_target[0] = target_x;
            globals.cursors.skill_target[1] = target_y;
            }
            break;
    }
}
/**
 * Performs a right-click and shows a context menu on a target tile
 *
 * @param {number} x x position where the click was on the canvas
 * @param {number} y y position where the click was on the canvas
 */
function contextmenu(x, y) {
    let content;
    const player = globals.player;
    // Prevent from firing if we're clicking on the mini status
    const rows = mini_status_rows_sizes(player);
    if (rows.some(r => coords_between([x, y], [r[0], r[1]], [r[0] + r[2], r[1] + r[3]]))) return;

    switch (globals.game_state) {
        case 'playing': {
            const focused = globals.focused_entity;
            let target_x = Math.floor(x / tile_size[0] + focused.x - display_size[0] / 2);
            let target_y = Math.floor(y / tile_size[1] + focused.y - display_size[1] / 2);

            // Get content at the target
            let targets = Tile.visible_grid_world.filter(t => Math.round(t.x) == target_x && Math.round(t.y) == target_y);
            if (!targets.length) return;

            // Show options
            content = document.createElement('table');
            content.style.cursor = 'default';
            targets.forEach(t => {
                // Make the context row contents
                let mini_canvas = document.createElement('canvas');
                let mini_context = mini_canvas.getContext('2d');
                mini_canvas.style.width = `${tile_size[0]}px`;
                mini_canvas.style.height = `${tile_size[1]}px`;
                mini_canvas.style.border = `${get_theme_value('border_context_menu_color')} 1px solid`;
                mini_canvas.width = tile_size[0];
                mini_canvas.height = tile_size[1];
                let row = document.createElement('tr');
                let cell_canvas = document.createElement('td');
                let cell_name = document.createElement('td');
                let cell_options = document.createElement('td');
                cell_options.classList.add('option-selector');
                cell_canvas.appendChild(mini_canvas);
                row.appendChild(cell_canvas);
                row.appendChild(cell_name);
                row.appendChild(cell_options);
                content.appendChild(row);

                // Draw in the context menu
                t.draw({x: 0, y: 0, context: mini_context});
                cell_name.textContent = t.name ?? (t.solid ? 'wall' : 'floor');
                let has_options = false;
                if (t instanceof Item) {
                    has_options ||= Object.keys(t.passive).length || Object.keys(t.on_use).length || t.equip_slot != null;
                } else if (t instanceof Entity) {
                    let skills = player.skills.filter(s => {
                        if (!Object.keys(s.on_use_target).length) return false;
                        if (coords_distance(t, player) > s.range + .1) return false;
                        if (s.cost > player.magic) return false;
                        return true;
                    });
                    has_options ||= t.health > 0 && skills.length;
                }
                // Good enough
                cell_options.innerHTML = has_options ? '▶' : '';

                let options_shown = false;
                cell_options.addEventListener('click', e => {
                    if (t.constructor == Tile) return;
                    content.querySelectorAll('.option').forEach(e => content.removeChild(e));
                    content.querySelectorAll('.option-selector').forEach(e => e.textContent = e.textContent.replace('▼', '▶'));

                    options_shown = !options_shown;
                    if (options_shown) {
                        /** @type {(string|[string, [string, ...any]])[]} */
                        let options = [];
                        if (t instanceof Item) {
                            if (Object.keys(t.passive).length) options.push(gettext('games_rpg_item_has_passive'));
                            if (Object.keys(t.on_use).length) options.push(gettext('games_rpg_item_can_use'));
                            if (t.equip_slot != null) options.push(gettext('games_rpg_item_can_equip'));
                        } else if (t instanceof Entity) {
                            player.skills.filter(s => Object.keys(s.on_use_target).length && coords_distance(t, player) <= s.range)
                                .forEach(s => {
                                    options.push([`${actions.use_skill.name}: ${s.name} (${s.level})`, ['use_skill', s, t]]);
                                });
                        }
                        if (!options.length) return;
                        cell_options.textContent = '▼';
                        options = options.map(o => {
                            let row = document.createElement('tr');
                            row.classList.add('option');
                            let cells = [
                                document.createElement('td'),
                                document.createElement('td'),
                            ];
                            if (typeof o == 'string') {
                                cells[1].innerText = o;
                            } else if (Array.isArray(o)) {
                                let [text, action] = o;
                                cells[1].innerText = text;
                                let [a, ...args] = action;
                                row.addEventListener('click', e => {
                                    actions[a].func(...args);
                                });
                                row.style.cursor = 'pointer';
                            }
                            cells[1].colSpan = 2;
                            cells.forEach(c => row.appendChild(c));
                            return row;
                        }).reverse();

                        options.forEach(o => {
                            content.insertBefore(o, row.nextSibling);
                        });
                    }
                });
            });
            }
            break;
        case 'inventory': {
            let target_x = Math.floor(x / tile_size[0]);
            let target_y = Math.floor(y / tile_size[1]);
            let max_rows = Math.max(Math.floor(display_size[1] / 3) - 1, 1);
            // Empty slot, ignore it
            if (!(target_x % 3 && target_y % 3) || target_y / 3 > max_rows) return;
            // Inventory slots are 3 times as big as normal tiles, so divide by 3
            target_x = Math.floor(target_x / 3);
            target_y = Math.floor(target_y / 3);

            // Get contents at the target
            let items_per_row = inventory_items_per_row();
            let is_equipped = target_x == items_per_row;
            let target = null;
            let index;
            if (is_equipped) {
                if (target_y in player.equipment) {
                    target = player.equipment[target_y];
                    index = target_y;
                }
            } else {
                index = target_x + target_y * items_per_row;
                if (index in player.inventory) target = player.inventory[index][0];
            }
            // There's no item there
            if (!target) return;

            // Show options
            let options = [
                'drop_inventory_selected',
            ];
            if (Object.keys(target.on_use).length && !is_equipped) options.push('use_inventory_selected');
            if (target.equip_slot != null) options.push('toggle_equip_inventory_selected');

            content = document.createElement('table');
            content.style.cursor = 'cursor';
            options.forEach(o => {
                let row = document.createElement('tr');
                let cell = document.createElement('td');
                row.style.cursor = 'pointer';
                row.appendChild(cell);

                cell.innerText = actions[o].name;
                cell.addEventListener('click', e => {
                    actions[o].func(index);
                    hide_context_menu();
                });

                content.appendChild(row);
            });
            }
            break;
        case 'skills': {
            let target_x = Math.floor(x / tile_size[0]);
            let target_y = Math.floor(y / tile_size[1]);
            let max_rows = Math.max(Math.floor(display_size[1] / 3) - 1, 1);
            // Empty slot, ignore it
            if (!(target_x % 3 && target_y % 3) || target_y / 3 > max_rows) return;
            // Skill slots are 3 times as big as normal tiles, so divide by 3
            target_x = Math.floor(target_x / 3);
            target_y = Math.floor(target_y / 3);

            // Get contents at the target
            let skills_per_row = entity_skills_per_row();
            /** @type {Skill} */
            let target = null;
            let index = target_x + target_y * skills_per_row;
            if (index in player.skills) target = player.skills[index];
            // There's no skill there
            if (!target) return;

            // Show options
            let options = [];
            if (player.magic >= target.cost) options.push('select_skill_selected');

            content = document.createElement('table');
            content.style.cursor = 'cursor';
            options.forEach(o => {
                let row = document.createElement('tr');
                let cell = document.createElement('td');
                row.style.cursor = 'pointer';
                row.appendChild(cell);

                cell.innerText = actions[o].name;
                cell.addEventListener('click', e => {
                    actions[o].func(index);
                    hide_context_menu();
                });

                content.appendChild(row);
            });
            }
            break;
    }

    show_context_menu(x + tile_size[0] * .5, y + tile_size[1] * 2, content);
}
/**
 * Shows the context menu with some content
 *
 * @param {number} left
 * @param {number} top
 * @param {HTMLElement} content
 * @param {boolean} [empty=true] Whether to empty the previous content
 */
function show_context_menu(left, top, content, empty = true) {
    if (!content) return;

    let context_menu = document.getElementById('fake_context_menu');
    if (!context_menu) {
        context_menu = document.createElement('table');
        context_menu.id = 'fake_context_menu';
        context_menu.style.position = 'absolute';
        context_menu.style.backgroundColor = get_theme_value('background_context_menu_color');
        context_menu.style.border = `${get_theme_value('border_context_menu_color')} 1px solid`;
        document.body.appendChild(context_menu);
    }
    context_menu.style.left = `${left}px`;
    context_menu.style.top = `${top}px`;
    context_menu.style.display = 'block';

    if (empty) context_menu.textContent = '';

    context_menu.appendChild(content);
}
/**
 * Hides the context menu
 *
 * @param {boolean} [empty=true]
 */
function hide_context_menu(empty = true) {
    let context_menu = document.getElementById('fake_context_menu');
    if (!context_menu) return;

    context_menu.style.display = 'none';

    if (empty) context_menu.textContent = '';
}

if (blur_pause) globals.game_state = 'pause';
document.addEventListener('keydown', keydown);
document.addEventListener('blur', () => {
    hide_context_menu();

    if (globals.game_state == 'playing') {
        blur_pause = true;
        globals.game_state = 'pause';
    }
});
document.addEventListener('focus', () => {
    if (blur_pause) {
        blur_pause = false;
        globals.game_state = 'playing';
    }
});
document.addEventListener('mousemove', e => {
    mouse_position[0] = e.x - canvas.offsetLeft;
    mouse_position[1] = e.y - canvas.offsetTop;
});
canvas.addEventListener('click', e => {
    hide_context_menu();

    let x = e.x - canvas.offsetLeft;
    let y = e.y - canvas.offsetTop;
    e.preventDefault();

    click(x, y);
});
canvas.addEventListener('contextmenu', e => {
    let x = e.x - canvas.offsetLeft;
    let y = e.y - canvas.offsetTop;
    e.preventDefault();

    contextmenu(x, y);
});
