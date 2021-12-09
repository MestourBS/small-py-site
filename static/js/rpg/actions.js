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
import { canvas } from './canvas.js';
import { Direction } from './coords.js';
import { number_between } from './primitives.js';
import { display_size, get_theme_value, inventory_items_per_row, tile_size } from './display.js';
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
 *  playing: {[k: string]: (keyof actions)[]},
 *  pause: {[k: string]: (keyof actions)[]},
 *  inventory: {[k: string]: (keyof actions)[]},
 *  status: {[k: string]: (keyof actions)[]},
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
    pause: {},
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
        //'contextmenu': ['open_context_menu'], //!still shows the context menu
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

    //let to_check = [keybinds[globals.game_state], keybinds.others];
    /** @type {{[k: string]: keyof actions}} */
    let to_check = {};
    Object.entries(keybinds[globals.game_state]).forEach(([key, act]) => {
        if (!(key in to_check)) to_check[key] = [];
        to_check[key].push(...act);
    });
    Object.entries(keybinds.others).forEach(([key, act]) => {
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
    if (key_actions?.length) {
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
    if (globals.game_state == 'inventory') {
        let target_x = Math.floor(x / tile_size[0]);
        let target_y = Math.floor(y / tile_size[1]);
        let max_rows = Math.max(Math.floor(display_size[1] / 3) - 1, 1);
        // Empty slot, ignore it
        if (!(target_x % 3 && target_y % 3) || target_y / 3 > max_rows) return;
        // Inventory slots are 3 times as big as normal tiles, so further divide by 3
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
}
/**
 * Performs a right-click and shows a context menu on a target tile
 *
 * @param {number} x x position where the click was on the canvas
 * @param {number} y y position where the click was on the canvas
 */
function contextmenu(x, y) {
    const player = globals.player;
    let content;

    if (globals.game_state == 'playing') {
        //todo disable when clicking on the mini status
        let target_x = Math.floor(x / tile_size[0] + player.x - display_size[0] / 2);
        let target_y = Math.floor(y / tile_size[1] + player.y - display_size[1] / 2);

        // Get content at the target
        let targets = Tile.visible_grid.filter(t => Math.round(t.x) == target_x && Math.round(t.y) == target_y);
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
            t.draw(0, 0, mini_context);
            cell_name.textContent = t.name ?? (t.solid ? 'wall' : 'floor');
            let has_options = false;
            if (t instanceof Item) {
                has_options ||= Object.keys(t.passive).length || Object.keys(t.on_use).length || t.equip_slot != null;
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
                    let options = [];
                    if (t instanceof Item) {
                        if (Object.keys(t.passive).length) options.push(gettext('games_rpg_item_has_passive'));
                        if (Object.keys(t.on_use).length) options.push(gettext('games_rpg_item_can_use'));
                        if (t.equip_slot != null) options.push(gettext('games_rpg_item_can_equip'));
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
                        cells[1].innerText = o;
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
    } else if (globals.game_state == 'inventory') {
        let target_x = Math.floor(x / tile_size[0]);
        let target_y = Math.floor(y / tile_size[1]);
        let max_rows = Math.max(Math.floor(display_size[1] / 3) - 1, 1);
        // Empty slot, ignore it
        if (!(target_x % 3 && target_y % 3) || target_y / 3 > max_rows) return;
        // Inventory slots are 3 times as big as normal tiles, so further divide by 3
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
        options = options.map(o => {
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
