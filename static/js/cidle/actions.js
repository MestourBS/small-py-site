import { canvas, display_size, tabs_heights, click as tabs_click } from './canvas.js';
import globals from './globals.js';
import Machine from './machine.js';
import { Pane } from './pane.js';
import { click as click_inventory, is_clickable as is_clickable_inventory } from './inventory.js';

/**
 * Game keybinds
 *
 * Effects are obtained with `KEYBINDS[<globals.game_tab>][mapped_key]`.
 * `mapped_key` is the lowercased key, with alt, ctrl and/or shift prepended if they are pressed.
 * Checks are done in an alphabetical order, so alt+key takes priority over ctrl+key.
 * Longer composites take precedence over shorter ones, so alt+ctrl+key > alt+key.
 * Composite building is also done in an alphabetical way, so alt+ctrl+key is correct, unlike ctrl+alt+key.
 *
 * Using `*` for a key will call on any key, but will also pass the event to the action
 *
 * Actions are in-game actions (movement, attack, etc.)
 *
 * @type {{
 *  '*': {[key: string]: (keyof actions)[]},
 *  world: {[key: string]: (keyof actions)[]},
 *  inventory: {[key: string]: (keyof actions)[]},
 * }}
 */
const keybinds = {};
/**
 * Existing actions
 */
const actions = new Proxy(Object.freeze({
}), {get: (obj, prop) => obj[prop] ?? ({func:()=>{},name:''})});
/**
 * Currently active actions
 *
 * @type {Set<keyof actions>}
 */
const active_actions = new Set;
const game_tabs = {
    world: {
        click: click_world,
        can_click: is_clickable_world,
        drag: drag_world,
        contextmenu: contextmenu_world,
    },
    inventory: {
        click: click_inventory,
        can_click: is_clickable_inventory,
        drag: drag_inventory,
        contextmenu: () => {},
    },
};

let last_action = Date.now();
let clicking = false;
let dragging = false;
/**
 * Object being currently dragged
 *
 * @type {null|{drag: (x: number, y: number, x_diff: number, y_diff: number, event: MouseEvent) => void}}
 */
let currently_dragging = null;

/**
 * Starts the actions that corresponds to the key pressed
 *
 * @param {KeyboardEvent} event
 */
function keydown(event) {
    if (event.metaKey) return;
    const to_check = Object.assign({}, keybinds['*'] ?? {}, keybinds[globals.game_tab] ?? {});

    // Something accepts every key, let's try it first
    if ('*' in to_check) {
        to_check['*'].forEach(a => active_actions.add(a));

        //? unsure
        event.preventDefault();
    }

    // Get the key
    let key = event.key.toLowerCase();
    if (globals.strict_keys) {
        // There's only one key we want
        if (event.shiftKey) key = `shift+${key}`;
        if (event.ctrlKey) key = `ctrl+${key}`;
        if (event.altKey) key = `alt+${key}`;
    } else {
        // Compose keys, get most complex valid one
        let keys = [key];
        if (event.shiftKey) keys.push(...keys.map(k => `shift+${k}`));
        if (event.ctrlKey) keys.push(...keys.map(k => `ctrl+${k}`));
        if (event.altKey) keys.push(...keys.map(k => `alt+${k}`));
        keys.sort((a, b) => b.replace(/[^\+]/g, '').length - a.replace(/[^\+]/g, '').length || a < b);
        key = keys.find(k => k in to_check) ?? key;
    }

    // Call the key's actions if they exist
    if (key in to_check) {
        event.preventDefault();

        to_check[key].forEach(a => active_actions.add(a));
    }
}
/**
 * Ends the actions that corresponds to the key pressed
 *
 * @param {KeyboardEvent} event
 */
function keyup(event) {
    if (event.metaKey) return;
    const to_check = Object.assign({}, keybinds['*'] ?? {}, keybinds[globals.game_tab] ?? {});

    // Something accepts every key, let's try it first
    if ('*' in to_check) {
        to_check['*'].forEach(a => active_actions.delete(a));

        event.preventDefault();
    }

    // Get the key
    let key = event.key.toLowerCase();
    if (globals.strict_keys) {
        // There's only one key we want
        if (event.shiftKey) key = `shift+${key}`;
        if (event.ctrlKey) key = `ctrl+${key}`;
        if (event.altKey) key = `alt+${key}`;
    } else {
        // Compose keys, get most complex valid one
        let keys = [key];
        if (event.shiftKey) keys.push(...keys.map(k => `shift+${k}`));
        if (event.ctrlKey) keys.push(...keys.map(k => `ctrl+${k}`));
        if (event.altKey) keys.push(...keys.map(k => `alt+${k}`));
        keys.sort((a, b) => b.replace(/[^\+]/g, '').length - a.replace(/[^\+]/g, '').length || a < b);
        key = keys.find(k => k in to_check) ?? key;
    }

    // Call the key's actions if they exist
    if (key in to_check) {
        event.preventDefault();

        to_check[key].forEach(a => active_actions.delete(a));
    }
}
/**
 * Performs a click on a target
 *
 * @param {number} x Absolute x position where the click was on the canvas
 * @param {number} y Absolute y position where the click was on the canvas
 * @param {MouseEvent} event
 */
function click(x, y, event) {
    if (y <= tabs_heights()) {
        tabs_click(x, y, event);
        return;
    }

    if (globals.game_tab in game_tabs) {
        game_tabs[globals.game_tab].click(x, y, event);
    } else {
        console.error(`Unknown game tab ${globals.game_tab}`);
    }
}
/**
 * Performs a click on a target in the world
 *
 * @param {number} x Absolute x position where the click was on the canvas
 * @param {number} y Absolute y position where the click was on the canvas
 * @param {MouseEvent} event
 */
function click_world(x, y, event) {
    x -= display_size.width / 2 - globals.position[0];
    y -= display_size.height / 2 - globals.position[1];

    if ('world' in globals.adding) {
        if (globals.adding['world'](x, y, event)) return;
    }

    const p = Pane.get_visible_panes(globals.game_tab).find(p => p.contains_point([x, y]));

    if (p) {
        p.click(x, y, event);
        return;
    }

    const machine = Machine.visible_machines.find(m => m.contains_point([x, y]));

    if (!machine) return;

    machine.click(event);
}
/**
 * Checks if the mouse's position is clickable
 *
 * @param {number} x Absolute x position where the click was on the canvas
 * @param {number} y Absolute y position where the click was on the canvas
 * @param {MouseEvent} event
 * @returns {boolean}
 */
function is_clickable(x, y, event) {
    if (y <= tabs_heights()) {
        return true;
    }

    if (globals.game_tab in game_tabs) {
        return game_tabs[globals.game_tab].can_click(x, y, event);
    } else {
        console.error(`Unknown game tab ${globals.game_tab}`);
    }

    return false;
}
/**
 * Checks if the mouse's position is clickable in the world
 *
 * @param {number} x Absolute x position where the click was on the canvas
 * @param {number} y Absolute y position where the click was on the canvas
 * @param {MouseEvent} event
 * @returns {boolean}
 */
function is_clickable_world(x, y, event) {
    if ('world' in globals.adding) {
        return true;
    }

    x -= display_size.width / 2 - globals.position[0];
    y -= display_size.height / 2 - globals.position[1];

    const p = Pane.get_visible_panes(globals.game_tab).find(p => p.contains_point([x, y]));
    if (p) return p.is_clickable([x, y]);

    const machine = Machine.visible_machines.find(m => m.contains_point([x, y]));
    if (machine) return true;

    return false;
}
/**
 * Drags a target
 *
 * @param {number} x Absolute x position where the click was on the canvas
 * @param {number} y Absolute y position where the click was on the canvas
 * @param {number} x_diff Difference in x positions since last call
 * @param {number} y_diff Difference in y positions since last call
 * @param {MouseEvent} event
 */
function drag(x, y, x_diff, y_diff, event) {
    if (globals.game_tab in game_tabs) {
        game_tabs[globals.game_tab].drag(x, y, x_diff, y_diff, event);
    } else {
        console.error(`Unknown game tab ${globals.game_tab}`);
    }
}
/**
 * Drags a target in the world
 *
 * @param {number} x Absolute x position where the click was on the canvas
 * @param {number} y Absolute y position where the click was on the canvas
 * @param {number} x_diff Difference in x positions since last call
 * @param {number} y_diff Difference in y positions since last call
 * @param {MouseEvent} event
 */
function drag_world(x, y, x_diff, y_diff, event) {
    x -= display_size.width / 2 - globals.position[0];
    y -= display_size.height / 2 - globals.position[1];

    if (currently_dragging) {
        currently_dragging.drag(x, y, x_diff, y_diff, event);
        return;
    }

    const p = Pane.get_visible_panes(globals.game_tab).find(p => p.contains_point([x, y]));

    if (p) {
        currently_dragging = p;
        return;
    }

    currently_dragging = {
        drag(x, y, x_diff, y_diff, event) {
            globals.position[0] -= x_diff;
            globals.position[1] -= y_diff;
        },
    };
}
/**
 * Drags a target in the inventory
 *
 * @param {number} x Absolute x position where the click was on the canvas
 * @param {number} y Absolute y position where the click was on the canvas
 * @param {number} x_diff Difference in x positions since last call
 * @param {number} y_diff Difference in y positions since last call
 * @param {MouseEvent} event
 */
function drag_inventory(x, y, x_diff, y_diff, event) {
    x -= display_size.width / 2 - globals.position[0];
    y -= display_size.height / 2 - globals.position[1];

    if (currently_dragging) {
        currently_dragging.drag(x, y, x_diff, y_diff, event);
        return;
    }

    const p = Pane.get_visible_panes(globals.game_tab).find(p => p.contains_point([x, y]));

    if (p) {
        currently_dragging = p;
        return;
    }
}
/**
 * Performs a right-click on a target
 *
 * @param {number} x Absolute x position where the click was on the canvas
 * @param {number} y Absolute y position where the click was on the canvas
 * @param {MouseEvent} event
 */
function contextmenu(x, y, event) {
    if (y <= tabs_heights()) {
        return;
    }

    if (globals.game_tab in game_tabs) {
        game_tabs[globals.game_tab].contextmenu(x, y, event);
    } else {
        console.error(`Unknown game tab ${globals.game_tab}`);
    }
}
/**
 * Performs a right-click on a target in the world
 *
 * @param {number} x Absolute x position where the click was on the canvas
 * @param {number} y Absolute y position where the click was on the canvas
 * @param {MouseEvent} event
 */
function contextmenu_world(x, y, event) {
    x -= display_size.width / 2 - globals.position[0];
    y -= display_size.height / 2 - globals.position[1];

    const p = Pane.get_visible_panes('world').find(p => p.contains_point([x, y]));

    // For consistency, prevent context menu clicks on panes
    // Maybe, one day, something will happen with them
    if (p) return;

    const machine = Machine.visible_machines.find(m => m.contains_point([x, y]));

    if (!machine) return;

    machine.contextmenu(event);
}
setInterval(() => {
    let now = Date.now();
    let diff = (now - last_action) / 1e3;
    last_action = now;

    active_actions.forEach(a => actions[a].func(diff));
}, 1e3 / 20);

document.addEventListener('keydown', keydown);
document.addEventListener('keyup', keyup);
document.addEventListener('blur', () => {
    globals.focused = false;
    clicking = false;
});
document.addEventListener('focus', () => {
    globals.focused = true;
});
document.addEventListener('mousemove', e => {
    let x = e.x - canvas.offsetLeft;
    let y = e.y - canvas.offsetTop;
    e.preventDefault();

    if (clicking) {
        dragging = true;

        canvas.style.cursor = 'grabbing';

        drag(x, y, e.movementX, e.movementY, e);
    } else {
        const cursor = is_clickable(x, y, e) ? 'pointer' : null;
        canvas.style.cursor = cursor;
    }
});
canvas.addEventListener('click', e => {
    if (!dragging) {
        let x = e.x - canvas.offsetLeft;
        let y = e.y - canvas.offsetTop;
        e.preventDefault();

        click(x, y, e);
    } else {
        canvas.style.cursor = null;
    }
    dragging = false;
});
canvas.addEventListener('mousedown', e => clicking = true);
canvas.addEventListener('mouseup', e => {
    clicking = false;
    currently_dragging = null;
});
canvas.addEventListener('contextmenu', e => {
    let x = e.x - canvas.offsetLeft;
    let y = e.y - canvas.offsetTop;
    e.preventDefault();

    contextmenu(x, y, e);
});
