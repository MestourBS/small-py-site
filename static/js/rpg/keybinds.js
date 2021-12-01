import { Direction } from './coords.js';
import { inventory_items_per_row } from './display.js';
import globals from './globals.js';

/**
 * Game keybinds
 *
 * Effects are obtained with `KEYBINDS[<game_state>|others][mapped_key]`.
 * `mapped_key` is the lowercased key, with alt, ctrl and/or shift prepended if they are pressed.
 * Checks are done in an alphabetical order, so alt+key takes priority over ctrl+key.
 * Longer composites take precedence over shorter ones, so alt+ctrl+key > alt+key.
 * Composite building is also done in an alphabetical way, so alt+ctrl+key is correct, unlike ctrl+alt+key.
 *
 * - Actions are in-game actions (movement, attack, etc.)
 * - Others are other actions (pause, resume, inventory, etc.)
 *
 * @type {{
 *  playing?: {[k: string]: (keyof actions)[]},
 *  pause?: {[k: string]: (keyof actions)[]},
 *  inventory?: {[k: string]: (keyof actions)[]},
 *  status?: {[k: string]: (keyof actions)[]},
 *  others: {[k: string]: (keyof actions)[]},
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
    },
    status: {
        'o': ['hide_status'],
    },
    others: {
        'p': ['game_pause_toggle'],
    },
};
/**
 * Existing actions
 */
const actions = new Proxy(Object.freeze({
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
            let items_per_row = inventory_items_per_row();
            if (globals.cursors.inventory[1] <= 0) return;

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

            let dir = Direction.down;
            globals.cursors.status[0] += dir[0];
            globals.cursors.status[1] += dir[1];
        },
    },
    'move_cursor_status_up': {
        name: gettext('games_rpg_action_move_cursor_status_up'),
        func: () => {
            if (globals.cursors.status[1] <= 0) return;

            let dir = Direction.up;
            globals.cursors.status[0] += dir[0];
            globals.cursors.status[1] += dir[1];
        },
    },
    'use_inventory_selected': {
        name: gettext('games_rpg_action_use_inventory_selected'),
        func: () => {
            let items_per_row = inventory_items_per_row();
            if (globals.cursors.inventory[0] < items_per_row) {
                let index = globals.cursors.inventory[1] * items_per_row + globals.cursors.inventory[0];
                globals.player.use_item(index);
            } // You can't use an equipped item!
        },
    },
    'drop_inventory_selected': {
        name: gettext('games_rpg_action_drop_inventory_selected'),
        func: () => {
            let items_per_row = inventory_items_per_row();
            let index;
            let equip = globals.cursors.inventory[0] >= items_per_row;
            if (!equip) {
                index = globals.cursors.inventory[1] * items_per_row + globals.cursors.inventory[0];
            } else {
                index = globals.cursors.inventory[1];
            }

            globals.player.drop_item(index, equip);
        },
    },
    'toggle_equip_inventory_selected': {
        name: gettext('games_rpg_action_toggle_equip_inventory_selected'),
        func: () => {
            let items_per_row = inventory_items_per_row();
            if (globals.cursors.inventory[0] == items_per_row) {
                globals.player.unequip_item(globals.cursors.inventory[1]);
            } else {
                let index = globals.cursors.inventory[1] * items_per_row + globals.cursors.inventory[0];
                globals.player.equip_item(index);
            }
        },
    },
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
            globals.cursors.status[1] = 0;
        },
    },
    'hide_status': {
        name: gettext('games_rpg_action_hide_status'),
        func: () => {
            globals.game_state = 'playing';
        },
    },
}),{
    get: (obj, prop) => obj[prop] ?? {name: '', func: () => {}},
    set: (obj, prop, val) => {},
});


/**
 * Calls the action that corresponds to the key pressed
 *
 * @this {Document}
 * @param {KeyboardEvent} e
 */
export function keydown(e) {
    let to_check = [keybinds.others];
    if (globals.game_state in keybinds) to_check.push(keybinds[globals.game_state]);
    to_check.reverse();

    // Get the key
    let key = e.key.toLowerCase();
    if (globals.cursors) {
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
        keys.sort((a, b) => {
            if (a.length == b.length) return a < b;
            return b.length - a.length;
        });
        key = keys.find(k => to_check.some(kb => k in kb)) ?? key;
    }

    /** @type {string[]} */
    let key_actions = [];
    to_check.forEach(kb => {
        if (key in kb) key_actions.push(...kb[key]);
    });
    key_actions.forEach(a => {
        actions[a].func();
    });
}
