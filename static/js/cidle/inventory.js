import StorageMachine from './storage.js';
import { canvas_write, context as canvas_context, cut_lines, display_size, tabs_heights as global_tabs_heights } from './canvas.js';
import { get_theme_value as theme } from './display.js';
import Machine from './machine.js';
import { Pane } from './pane.js';
import globals from './globals.js';
import Resource from './resource.js';
import { beautify } from './primitives.js';

/**
 * Current inventory
 *
 * @type {{
 *  machines: {
 *      name: string,
 *      type: readonly keyof inventory,
 *      contents: [string, number, Machine|false][],
 *      draw: ({context, top} ?: {context?: CanvasRenderingContext2D, top?: number}) => void,
 *      click: (x: number, y: number, event: MouseEvent) => void,
 *  },
 * }}
 */
const inventory = {
    machines: {
        name: gettext('games_cidle_inventory_machines'),
        contents: [],
        get type() { return Object.entries(inventory).find(([_,obj]) => obj == this)[0]; },
        draw: function({context=canvas_context, top=0}={}) {
            const contents = this.contents;
            if (contents.length == 0) return;

            const max_diameter = Math.max(0, ...contents.map(entry => {
                const [id] = entry;
                let [,,machine] = entry;
                if (!machine) {
                    entry[2] = machine = copy_machine(id);
                }

                return machine.radius;
            })) * 2;
            if (max_diameter == 0) return;

            top++;
            const padding = theme('inventory_padding');
            const max_x = Math.floor(display_size.width / (max_diameter + padding * 2));
            let x = 0;
            let y = 0;

            contents.forEach(entry => {
                const [id, amount] = entry;
                let [,,machine] = entry;
                const cell_x = [x * max_diameter, (x + 1) * max_diameter + padding * 2];
                const cell_y = [y * max_diameter + top, (y + 1) * max_diameter + padding * 2 + top];

                // Draw the box
                context.strokeStyle = theme('inventory_color_border');
                context.fillStyle = theme('inventory_color_fill');
                context.beginPath();
                context.moveTo(cell_x[0], cell_y[0]);
                context.lineTo(cell_x[1], cell_y[0]);
                context.lineTo(cell_x[1], cell_y[1]);
                context.lineTo(cell_x[0], cell_y[1]);
                context.lineTo(cell_x[0], cell_y[0]);
                context.stroke();
                context.fill();
                context.closePath();

                // Draw the machine
                if (!machine) {
                    entry[2] = machine = copy_machine(id);
                }
                const machine_draw = {
                    context,
                    x: x * max_diameter + machine.radius + padding,
                    y: y * max_diameter + machine.radius + padding + top,
                };
                machine.draw(machine_draw);

                canvas_write(amount.toString(), cell_x[1], cell_y[1] - theme('font_size'), {text_align: 'right'});

                x = (x + 1) % max_x;
                y += x == 0;
            });
        },
        click: function(x, y, event) {
            const arg_y = y;
            const contents = this.contents;
            if (contents.length == 0) return;

            const max_diameter = Math.max(0, ...contents.map(entry => {
                const [id] = entry;
                let [,,machine] = entry;
                if (!machine) {
                    entry[2] = machine = copy_machine(id);
                }

                return machine.radius;
            })) * 2;
            if (max_diameter == 0) return;
            const padding = theme('inventory_padding');

            y -= tabs_heights();

            const max_x = Math.floor(display_size.width / (max_diameter + padding * 2));
            const cell_x = Math.floor(x / (max_diameter + padding * 2));
            const cell_y = Math.floor(y / (max_diameter + padding * 2));
            const cell_index = cell_x + cell_y * max_x;

            if (cell_index in contents) {
                const entry = contents[cell_index];
                const [id, amount] = entry;
                let machine = entry[2];

                if (!machine) {
                    entry[2] = machine = copy_machine(id);
                }

                const pane = machine.panecontents(event);
                const pane_id = pane.id;
                let p = Pane.pane(pane_id);

                // Remove pane every other click
                if (p) {
                    p.remove();
                    return;
                }

                let name = (pane.title !== false ? pane.title : machine.name);
                if (amount > 0) {
                    pane.content.unshift([{
                        content: [gettext('games_cidle_place', {obj: name})],
                        click: [() => {
                            this.click(x,arg_y,event);
                            globals.game_tab = 'world';
                            globals.adding['world'] = (x, y, event) => {
                                if (event.shiftKey) {
                                    x = Math.round(x / 100) * 100;
                                    y = Math.round(y / 100) * 100;
                                }
                                delete globals.adding['world'];
                                machine.clone({x, y});
                                return true;
                            };
                        }],
                        width: 2,
                    }]);
                }
                // Add button to craft the machine
                if (id in recipes.machines) {
                    const recipe = recipes.machines[id];
                    let cost = recipe.resources;
                    if (typeof cost == 'function') cost = cost(recipe.crafted);
                    if (cost !== false) {
                        pane.content.unshift(
                            [{
                                content: [gettext('games_cidle_make', {obj: name})],
                                click: [() => {
                                    if (craft(id, 'machines')) {
                                        this.click(x,arg_y,event);
                                        this.click(x,arg_y,event);
                                    }
                                }],
                                width: 2,
                            }],
                            [{
                                content: [gettext('games_cidle_craft_costs')]
                            }],
                            ...cost.map(/**@param {[string, number]}*/([res, cost]) => {
                                const resource = Resource.resource(res);
                                const cost_func = () => {
                                    let sum = 0;
                                    StorageMachine.storages_for(res).forEach(m => {
                                        if (sum >= cost) return;

                                        sum += m.resources[res].amount;
                                    });
                                    let can_afford = sum >= cost;
                                    let cost_color;
                                    if (can_afford) cost_color = theme('machine_upgrade_can_afford_fill');
                                    else cost_color = theme('machine_upgrade_cant_afford_fill');

                                    return `{color:${cost_color}}${beautify(cost)}`;
                                };
                                return [{
                                    content: [`{color:${resource.color}}${resource.name}`],
                                }, {
                                    content: [cost_func],
                                }];
                            }),
                        );
                    }
                }
                pane.x = (cell_x + 1) * (max_diameter + padding * 2) - display_size.width / 2 - globals.position[0];
                pane.y = cell_y * (max_diameter + padding * 2) - display_size.height / 2 - globals.position[1] + tabs_heights() + global_tabs_heights();
                //pane.pinned = true;
                p = new Pane(pane);
                return;
            }
        },
    },
};
/**
 * Crafting recipes to make new things
 *
 * @type {{
 *  machines: {[machine_id: string]: {
 *      crafted: number,
 *      resources: [string, number][]|(crafted: number) => [string, number][]|false,
 *      unlocked: boolean|() => boolean,
 *  }},
 * }}
 */
const recipes = {
    machines: {
        'wood_storage': {
            crafted: 0,
            resources: (crafted) => {
                if (crafted <= 1) return [['wood', (crafted + 1) * 500]];
                return false;
            },
            unlocked: true,
        },
    },
};
const max_tabs_per_line = 5;

/** @type {keyof inventory} */
let subtab = 'machines';

function init() {
    const machines = inventory.machines.contents;
    Object.entries(recipes.machines).forEach(([machine, data]) => {
        let unlocked = data.unlocked;
        if (unlocked !== true) return;

        if (!machines.some(([id]) => id == machine)) {
            machines.push([machine, 0, false]);
        }
    });

    // Tries to unlock recipes every minute
    setInterval(() => unlock_recipes(), 60 * 1e3);
}
/**
 * Makes a thing, or returns false
 *
 * @param {string} id
 * @param {keyof inventory} [type]
 * @returns {boolean}
 */
function craft(id, type = subtab) {
    if (!(type in recipes)) return false;

    const subrecipes = recipes[type];

    if (!(id in subrecipes)) return false;

    const recipe = subrecipes[id];
    recipe.crafted ??= 0;
    let cost = recipe.resources;
    if (typeof cost == 'function') {
        let c = cost(recipe.crafted);
        if (c === false) return false;
        cost = c;
    }

    const can_afford = cost.every(([res, cost]) => {
        StorageMachine.storages_for(res).forEach(m => {
            if (cost <= 0) return;

            cost -= m.resources[res].amount;
        });

        return cost <= 0;
    });

    if (!can_afford) return false;

    cost.forEach(([res, cost]) => {
        StorageMachine.storages_for(res).forEach(m => {
            if (cost <= 0) return;

            let loss = Math.min(m.resources[res].amount, cost);
            m.resources[res].amount -= loss;
            cost -= loss;
        });
    });

    const inv = inventory[type];
    let cell = inv.contents.find(([mid]) => mid == id);
    if (!cell) {
        inv.contents.push(cell = [id, 0]);
    }
    cell[1]++;
    recipe.crafted++;
    return true;
}
/**
 * Finds a target and performs a click on it
 *
 * @param {number} x Absolute x position where the click was on the canvas
 * @param {number} y Absolute y position where the click was on the canvas
 * @param {MouseEvent} event
 */
export function click(x, y, event) {
    const w_x = x - display_size.width / 2 - globals.position[0];
    const w_y = y - display_size.height / 2 - globals.position[1];
    const p = Pane.get_visible_panes(globals.game_tab).find(p => p.contains_point([w_x, w_y]));

    if (p) {
        p.click(w_x, w_y, event);
        return;
    }

    y -= global_tabs_heights();

    if (y <= tabs_heights()) {
        // Check which tab we've clicked on
        const tabs = Object.keys(inventory);
        const padding = theme('tab_padding');
        const max_width = (display_size.width - padding * 2) / Math.min(max_tabs_per_line, tabs.length);
        /** @type {[keyof inventory, string[]][]} [tab, name (as lines)][] */
        const cut = tabs.map(tab => [tab, cut_lines(inventory[tab].name, {max_width: max_width})]);
        const tab_height = (Math.max(...cut.map(([_, name]) => name.length)) + .5) * theme('font_size') + padding * 2;

        const tab_x = Math.ceil(x / max_width) - 1;
        const tab_y = Math.ceil(y / tab_height) - 1;
        const tab_index = tab_x + tab_y * max_tabs_per_line;

        if (tab_index in tabs) {
            subtab = tabs[tab_index];
            return;
        }
    }

    inventory[subtab].click(x, y, event);
}
/**
 * Draw a specific part of the inventory
 *
 * @param {Object} [params]
 * @param {CanvasRenderingContext2D} [params.context]
 * @param {number} [params.top]
 */
export function draw({context=canvas_context, top=0}={}) {
    top = draw_tabs({context, top});

    inventory[subtab].draw({context, top});
}
/**
 * Draw the tabs for the inventory
 *
 * @param {Object} [params]
 * @param {CanvasRenderingContext2D} [params.context]
 * @param {number} [params.top]
 * @returns {number} Lowest Y position on the canvas
 */
function draw_tabs({context=canvas_context, top=0}={}) {
    /** @type {(keyof inventory)[]} */
    const tabs = Object.keys(inventory);
    if (tabs.length <= 1) return top;

    const padding = theme('tab_padding');
    const max_width = (display_size.width - padding * 2) / Math.min(max_tabs_per_line, tabs.length);
    /** @type {[keyof inventory, string[]][]} [tab, name (as lines)][] */
    const cut = tabs.map(tab => [tab, cut_lines(inventory[tab].name, {context, max_width})]);
    const y_diff = (Math.max(...cut.map(([_, name]) => name.length)) + .5) * theme('font_size') + padding * 2;
    // X position in the tabs grid
    let x = 0;
    // Y position in the tabs grid
    let y = 0;
    for (const [id, name] of cut) {
        const selected = id == subtab;
        const text_color = theme(selected ? 'tab_selected_text_color_fill' : 'tab_text_color_fill');
        const tab_color = theme(selected ? 'tab_selected_color_fill' : 'tab_color_fill');
        const tab_border = theme('tab_color_border');

        // Draw tab
        context.fillStyle = tab_color;
        context.strokeStyle = tab_border;
        context.beginPath();
        context.moveTo(x * max_width, y * y_diff + top);
        context.lineTo(x * max_width, (y + 1) * y_diff + top);
        context.lineTo((x + 1) * max_width, (y + 1) * y_diff + top);
        context.lineTo((x + 1) * max_width, y * y_diff + top);
        context.lineTo(x * max_width, y * y_diff + top);
        context.fill();
        context.stroke();
        context.closePath();

        // Draw tab text
        canvas_write(name, x * max_width + padding, y * y_diff + padding + top, {base_text_color: text_color, context});

        // Move tab position
        x = (x + 1) % max_tabs_per_line;
        y += (x == 0);
    }
    // Change y position in the grid
    y += (x != 0);

    return y * y_diff + top;
}
/**
 * Computes the amount of lines of tabs
 *
 * @returns {number}
 */
function tabs_heights() {
    const tabs = Object.keys(inventory);
    if (tabs.length <= 1) return 0;

    const padding = theme('tab_padding');
    const max_width = (display_size.width - padding * 2) / Math.min(max_tabs_per_line, tabs.length);
    /** @type {[keyof inventory, string[]][]} [tab, name (as lines)][] */
    const cut = tabs.map(tab => [tab, cut_lines(inventory[tab].name, {max_width: max_width})]);
    const tab_height = (Math.max(...cut.map(([_, name]) => name.length)) + .5) * theme('font_size') + padding * 2;
    return Math.ceil(tabs.length / max_tabs_per_line) * tab_height;
}
/**
 * Returns an empty, uninserted copy of a machine
 *
 * @param {string} id
 * @returns {Machine}
 */
function copy_machine(id) {
    return Machine.get_machine_copy(id, {x: 0, y: 0, insert: false, empty: true});
}
/**
 * Tries to unlock recipes
 */
function unlock_recipes() {
    const machines = inventory.machines.contents;
    Object.entries(recipes.machines).forEach(([machine, data]) => {
        let unlocked = data.unlocked;
        if (typeof unlocked == 'boolean') return;
        if (typeof unlocked == 'function') {
            unlocked = unlocked();
            if (unlocked) data.unlocked = true;
        }

        if (!machines.some(([id]) => id == machine)) {
            machines.push([machine, 0, false]);
        }
    });
}
/**
 * Returns an object containing the data to be saved
 *
 * @returns {{
 *  inv: {
 *      machines: {[id: string]: number},
 *  },
 *  rec: {
 *      machines: {[id: string]: {crafted?: number, unlocked?: boolean}}
 *  },
 * }}
 */
export function save_data() {
    const data = {
        inv: {
            machines: Object.fromEntries(inventory.machines.contents.map(([id, amount]) => [id, amount])),
        },
        rec: {
            machines: Object.fromEntries(Object.entries(recipes.machines).map(([id, data]) => {
                const {crafted, unlocked} = data;
                if (!crafted && typeof unlocked == 'function') return null;
                const d = {crafted, unlocked};
                if (typeof d.unlocked == 'function') delete d.unlocked;
                if (!d.crafted) delete d.crafted;

                return [id, d];
            }).filter(([_,data]) => data != null)),
        },
    };

    Object.entries(data.inv.machines).forEach(([id, amount]) => {
        if (!amount) delete data.inv.machines[id];
    });

    return data;
}
/**
 * Loads the saved data
 *
 * @param {Object} [data] Saved data
 * @param {Object} [data.inv]
 * @param {{[id: string]: number}} [data.inv.machines]
 * @param {Object} [data.rec]
 * @param {{[id: string]: {crafted?: number, unlocked?: boolean}}} [data.rec.machines]
 */
export function load_data(data={}) {
    if (!data) return;

    const {inv=null, rec=null} = data;

    if (inv) {
        const {machines=null} = inv;

        if (machines) {
            Object.entries(machines).forEach(([machine, amount]) => {
                let entry = inventory.machines.contents.find(([id]) => id == machine);
                if (!entry) {
                    inventory.machines.contents.push([machine, amount, false]);
                } else {
                    entry[1] = amount;
                }
            });
        }
    }
    if (rec) {
        const {machines=null} = rec;

        if (machines) {
            Object.entries(machines).forEach(([machine, data]) => {
                const {crafted=0, unlocked=null} = data;
                const recipe = recipes.machines[machine];
                recipe.crafted = crafted;
                if (unlocked === true) recipe.unlocked = unlocked;
            });
        }
    }
}

init();
