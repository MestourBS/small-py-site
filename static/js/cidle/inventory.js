import StorageMachine from './storage.js';
import { canvas_reset, canvas_write, context as canvas_context, cut_lines, display_size, grid_spacing, tabs_heights as global_tabs_heights } from './canvas.js';
import { get_theme_value as theme } from './display.js';
import Machine from './machine.js';
import { Pane } from './pane.js';
import globals from './globals.js';
import Resource from './resource.js';
import { beautify, stable_pad_number } from './primitives.js';
import { coords_distance as distance } from './position.js';

//todo further improve performances by drawing only after panes movements (use context.clip)
//todo find out why there is an added space at the top when reloading in
//todo move panes when unlocked
//todo resource crafting

/**
 * Current inventory
 *
 * @type {{
 *  machines: {
 *      name: string,
 *      type: readonly keyof inventory,
 *      draw: ({context, top} ?: {context?: CanvasRenderingContext2D, top?: number}) => void,
 *      click: (x: number, y: number, event: MouseEvent) => void,
 *      is_clickable: (x: number, y: number, event: MouseEvent) => boolean,
 *      contents: {[machine_id: string]: number},
 *      cache: {
 *          contents: {[machine_id: string]: {
 *              amount: number,
 *              can_craft: boolean,
 *              index: number,
 *              machine?: Machine,
 *          }},
 *      },
 *  },
 * }}
 */
const inventory = {
    machines: {
        name: gettext('games_cidle_inventory_machines'),
        get type() { return Object.entries(inventory).find(([_,obj]) => obj == this)[0]; },
        contents: {},
        cache: {
            contents: {},
        },
        draw: function({context=canvas_context, top=0}={}) {
            const contents = Object.entries(this.contents);
            if (contents.length == 0) return;

            const {cache} = this;

            const max_diameter = Math.max(0, ...contents.map((entry, index) => {
                const [id] = entry;
                const entry_cache = (cache.contents[id] ??= {amount: 0, can_craft: false, index: -1});
                let machine = entry_cache.machine;
                if (!machine) {
                    entry_cache.machine = machine = copy_machine(id);
                }

                return machine.radius;
            })) * 2;
            if (max_diameter == 0) return;

            top++;
            const padding = theme('inventory_padding');
            const cell_size = max_diameter + padding * 2;
            const max_x = Math.floor(display_size.width / cell_size);
            let x = 0;
            let y = 0;
            const font_size = theme('font_size');

            contents.forEach((entry, index) => {
                const [id, amount] = entry;
                const can_afford = recipes.machines[id].can_afford;
                const full_redraw = !(id in cache.contents) || cache.contents[id].index != index;
                const redraw_background = full_redraw || cache.contents[id].can_craft != can_afford;
                const redraw_amount = redraw_background || cache.contents[id].amount != amount;
                const entry_cache = (cache.contents[id] ??= {amount, can_craft: can_afford, index});
                const machine = (entry_cache.machine ??= copy_machine(id));
                const cell_x = [x * cell_size, (x + 1) * cell_size];
                const cell_y = [y * cell_size + top, (y + 1) * cell_size + top];
                const background_color = theme(can_afford ? 'inventory_affordable_color_fill' : 'inventory_color_fill');

                if (full_redraw) {
                    const machine_draw = {
                        context,
                        x: x * cell_size + machine.radius + padding,
                        y: y * cell_size + machine.radius + padding + top,
                        upgrade_marker: false,
                    };
                    machine.draw(machine_draw);
                }
                if (redraw_background) {
                    const machine_x = x * cell_size + machine.radius + padding;
                    const machine_y = y * cell_size + machine.radius + padding + top;

                    context.strokeStyle = theme('inventory_color_border');
                    context.fillStyle = background_color;
                    context.beginPath();
                    // Note to future self, go counter clockwise for the cell and clockwise for the inside
                    // because otherwise it will also fill the inside for some stupid reason
                    context.moveTo(cell_x[0], cell_y[0]);
                    context.lineTo(cell_x[0], cell_y[1]);
                    context.lineTo(cell_x[1], cell_y[1]);
                    context.lineTo(cell_x[1], cell_y[0]);
                    context.lineTo(cell_x[0], cell_y[0]);
                    context.stroke();
                    machine.border_path(machine_x, machine_y).forEach(([func, params]) => {
                        if (!(func in context)) return;
                        if (typeof context[func] == 'function') context[func](...params);
                        else context[func] = params[0];
                    });
                    if (redraw_background) context.fill();
                    context.closePath();
                }
                if (redraw_amount) {
                    const width = context.measureText(amount.toString()).width;
                    const x = cell_x[1] - width;
                    const y = cell_y[1] - font_size;

                    context.fillStyle = background_color;
                    context.fillRect(x - 2, y - 2, width, font_size);
                    canvas_write(amount.toString(), cell_x[1] - 2, y - 2, {text_align: 'right'});
                }

                entry_cache.amount = amount;
                entry_cache.can_craft = can_afford;
                entry_cache.index = index;

                x = (x + 1) % max_x;
                y += x == 0;
            });
        },
        click: function(x, y, event) {
            const contents = Object.entries(this.contents);
            if (contents.length == 0) return;

            const {cache} = this;
            const max_diameter = Math.max(0, ...contents.map((entry, index) => {
                const [id] = entry;
                const entry_cache = (cache.contents[id] ??= {amount: 0, can_craft: false, index});
                let machine = entry_cache.machine;
                if (!machine) {
                    entry_cache.machine = machine = copy_machine(id);
                }

                return machine.radius;
            })) * 2;
            if (max_diameter == 0) return;
            const arg_y = y;
            const padding = theme('inventory_padding');

            y -= tabs_heights();

            const max_x = Math.floor(display_size.width / (max_diameter + padding * 2));
            const cell_x = Math.floor(x / (max_diameter + padding * 2));
            const cell_y = Math.floor(y / (max_diameter + padding * 2));
            const cell_index = cell_x + cell_y * max_x;

            if (cell_index in contents) {
                const entry = contents[cell_index];
                const [id, amount] = entry;
                const entry_cache = (cache.contents[id] ??= {amount: 0, can_craft: false, index: cell_index});
                const machine = (entry_cache.machine ??= copy_machine(id));

                const pane = machine.panecontents({event, upgrade_marker: false});
                const pane_id = pane.id;
                let p = Pane.pane(pane_id);

                // Remove pane every other click
                if (p) {
                    p.remove();
                    return;
                }

                pane.content.forEach(row => row.forEach(cell => delete cell.click));
                let name = (pane.title !== false ? pane.title : machine.name);
                if (amount > 0) {
                    pane.content.unshift([{
                        content: [gettext('games_cidle_place', {obj: name})],
                        click: [() => {
                            this.click(x,arg_y,event);
                            globals.game_tab = 'world';
                            Machine.machines.forEach(m => m.moving = false);
                            globals.adding['world'] = {
                                click: (x, y, event) => {
                                    inventory.machines.contents[id]--;
                                    if (event.shiftKey == globals.press_to_snap) {
                                        x = Math.round(x / grid_spacing) * grid_spacing;
                                        y = Math.round(y / grid_spacing) * grid_spacing;
                                    }
                                    delete globals.adding['world'];
                                    machine.clone({x, y});
                                    event.preventDefault();
                                    return true;
                                },
                                draw: (x, y, event) => {
                                    if (event?.shiftKey == globals.press_to_snap) {
                                        let x_off = (display_size.width / 2) % grid_spacing - globals.position[0] % grid_spacing;
                                        let y_off = (display_size.height / 2) % grid_spacing - globals.position[1] % grid_spacing;
                                        x = Math.round((x - x_off) / grid_spacing) * grid_spacing + x_off;
                                        y = Math.round((y - y_off) / grid_spacing) * grid_spacing + y_off;
                                    }
                                    machine.draw({x, y, transparent: true});
                                },
                            };
                        }],
                        width: 2,
                    }]);
                }
                // Add buttons to craft the machine
                if (id in recipes.machines) {
                    const recipe = recipes.machines[id];
                    let cost_list = recipe.resources;
                    if (typeof cost_list == 'function') cost_list = cost_list(recipe.crafted ?? []);
                    if (Array.isArray(cost_list)) {
                        [...cost_list].reverse().forEach((cost, i) => {
                            if (cost === false) return;
                            pane.content.unshift(
                                [{
                                    content: [gettext('games_cidle_make', {obj: name})],
                                    click: [() => {
                                        if (craft(id, cost_list.length - i - 1, 'machines')) {
                                            const old_pane = Pane.pane(pane_id);
                                            this.click(x,arg_y,event);
                                            this.click(x,arg_y,event);
                                            const new_pane = Pane.pane(pane_id);
                                            new_pane.x = old_pane.x;
                                            new_pane.y = old_pane.y;
                                        }
                                    }],
                                    width: 2,
                                }],
                                [{
                                    content: [gettext('games_cidle_craft_costs')]
                                }],
                                ...cost.map(/**@param {[string, number]}*/([res, cost]) => {
                                    const {color, name, background_color, picture: image} = Resource.resource(res);
                                    const cost_func = () => {
                                        const {amount, max} = StorageMachine.stored_resource(res);
                                        const will_afford = max >= cost;
                                        const can_afford = will_afford && amount >= cost;
                                        let cost_color;
                                        if (can_afford) cost_color = theme('machine_upgrade_can_afford_fill');
                                        else cost_color = theme('machine_upgrade_cant_afford_fill');

                                        const amount_str = (stable_pad_number(beautify(amount))+'/').repeat(!can_afford);

                                        return `{color:${cost_color}}${amount_str}${beautify(cost)}`;
                                    };
                                    return [{
                                        content: [`{color:${color}}${name}`],
                                        color: background_color,
                                        image,
                                    }, {
                                        content: [cost_func],
                                        color: background_color,
                                    }];
                                }),
                            );
                        });
                    }
                }
                pane.x = (cell_x + 1) * (max_diameter + padding * 2);
                pane.y = cell_y * (max_diameter + padding * 2) + tabs_heights() + global_tabs_heights();
                pane.pinned = true;
                pane.pinnable = false;
                p = new Pane(pane);
                const width = p.table_widths().reduce((s, w) => s + w, 0);
                if (p.x + width > display_size.width) {
                    let antx = display_size.width - p.x - width;
                    p.x += antx;
                }
            }
        },
        is_clickable: function(x, y, event) {
            const contents = Object.entries(this.contents);
            if (contents.length == 0) return false;

            const {cache} = this;

            const max_diameter = Math.max(0, ...contents.map((entry, index) => {
                const [id] = entry;
                const entry_cache = (cache.contents[id] ??= {amount: 0, can_craft: false, index});
                const machine = (entry_cache.machine ??= copy_machine(id));

                return machine.radius;
            })) * 2;
            if (max_diameter == 0) return false;

            const padding = theme('inventory_padding');
            y -= tabs_heights();

            const max_x = Math.floor(display_size.width / (max_diameter + padding * 2));
            const cell_x = Math.floor(x / (max_diameter + padding * 2));
            const cell_y = Math.floor(y / (max_diameter + padding * 2));
            const cell_index = cell_x + cell_y * max_x;

            return cell_index in contents;
        },
    },
};
/**
 * Crafting recipes to make new things
 *
 * @type {{
 *  machines: {[machine_id: string]: {
 *      crafted: number[],
 *      resources: [string, number][][]|(crafted: number[]) => ([string, number][]|false)[],
 *      unlocked: boolean|() => boolean,
 *      position?: number,
 *      can_afford: boolean,
 *  }},
 * }}
 */
const recipes = {
    machines: {
        'wood_storage': {
            resources: crafted => {
                /** @type {([string, number][]|false)[]} */
                const costs = [];
                { // 0
                    const c = crafted[0] ?? 0;
                    /** @type {[string, number][]|false} */
                    let cost = false;
                    if (c <= 1) {
                        cost = [['wood', c * 500 + 500]];
                    } else if (c <= 3) {
                        if (StorageMachine.any_storage_for('stone')) cost = [['wood', c * 500 + 1_000], ['stone', c * 1_000 - 500]];
                    } else if (c <= 6) {
                        if (StorageMachine.any_storage_for('brick')) cost = [['wood', c * 250 + 1_000], ['brick', (c - 1) * 300]];
                    }
                    costs[0] = cost;
                }
                return costs;
            },
            unlocked: true,
            position: 0,
        },
        'tree_chopper': {
            resources: crafted => {
                /** @type {([string, number][]|false)[]} */
                const costs = [];
                { // 0
                    const c = crafted[0] ?? 0;
                    /** @type {[string, number][]|false} */
                    let cost = false;
                    if (c <= 3) {
                        cost = [['wood', (c + 1) ** 2 * 500]];
                    } else if (c <= 6) {
                        if (StorageMachine.any_storage_for('stone')) cost = [['wood', c ** 2 * 500], ['stone', c ** 1.5 * 500]];
                    } else if (c <= 12) {
                        if (StorageMachine.any_storage_for('brick')) cost = [['wood', (c - 1) ** 2 * 500], ['brick', c ** 1.25 * 100]];
                    }
                    costs[0] = cost;
                }
                return costs;
            },
            unlocked: true,
            position: 1,
        },
        'stone_storage': {
            resources: crafted => {
                /** @type {([string, number][]|false)[]} */
                const costs = [];
                { // 0
                    const c = crafted[0] ?? 0;
                    /** @type {[string, number][]|false} */
                    let cost = false;
                    if (c == 0) {
                        cost = [['wood', 2_000]];
                    } else if (c <= 3) {
                        cost = [['stone', c * 500], ['wood', c * 400 + 2_100]];
                    } else if (c <= 9) {
                        if (StorageMachine.any_storage_for('brick')) cost = [['brick', (c - 3) * 250], ['wood', c * 250 + 2_750]];
                    }
                    costs[0] = cost;
                }
                return costs;
            },
            unlocked: () => recipes.machines['tree_chopper'].crafted?.reduce((s, n) => s + n, 0) > 0,
            position: 2,
        },
        'stone_miner': {
            resources: crafted => {
                /** @type {([string, number][]|false)[]} */
                const costs = [];
                { // 0
                    const c = crafted[0] ?? 0;
                    /** @type {[string, number][]|false} */
                    let cost = false;
                    if (c == 0) {
                        cost = [['wood', 2_500]];
                    } else if (c <= 3) {
                        cost = [['stone', c ** 2 * 500], ['wood', c * 500]];
                    } else if (c <= 9) {
                        if (StorageMachine.any_storage_for('brick')) cost = [['brick', (c - 3) ** 2 * 150], ['wood', c * 500]];
                    } else if (c <= 15) {
                        if (StorageMachine.any_storage_for('brick')) cost = [['brick', (c - 3) ** 2 * 150], ['copper', (c - 9) * 50]];
                    }
                    costs[0] = cost;
                }
                return costs;
            },
            unlocked: () => StorageMachine.any_storage_for('stone'),
            position: 3,
        },
        'fire_pit': {
            resources: crafted => {
                /** @type {([string, number][]|false)[]} */
                const costs = [];
                { // 0
                    const c = crafted[0] ?? 0;
                    /** @type {[string, number][]|false} */
                    let cost = false;
                    if (c <= 5) {
                        cost = [['stone', c * 500 + 1_000]];
                    } else if (c <= 10) {
                        if (StorageMachine.any_storage_for('brick')) cost = [['brick', c * 100 + 200]];
                    }
                    costs[0] = cost;
                }
                return costs;
            },
            unlocked: () => recipes.machines['stone_miner'].crafted?.reduce((s, n) => s + n, 0) > 0,
            position: 4,
        },
        'wood_burner': {
            resources: crafted => {
                /** @type {([string, number][]|false)[]} */
                const costs = [];
                { // 0
                    const c = crafted[0] ?? 0;
                    /** @type {[string, number][]|false} */
                    let cost = false;
                    if (c <= 5) {
                        cost = [['wood', c * 200 + 1_000], ['stone', c ** 2 * 500 + 1_500]];
                    } else if (c <= 10) {
                        if (StorageMachine.any_storage_for('brick')) cost = [['wood', c * 200 + 1_000], ['brick', c ** 2 * 100 + 450]];
                    } else if (c <= 13) {
                        if (StorageMachine.any_storage_for('copper')) cost = [['copper', c * 20 + 100], ['brick', c ** 2 * 100 + 450]];
                    }
                    costs[0] = cost;
                }
                return costs;
            },
            unlocked: () => StorageMachine.any_storage_for('fire'),
            position: 5,
        },
        'water_bucket': {
            resources: crafted => {
                /** @type {([string, number][]|false)[]} */
                const costs = [];
                { // 0
                    const c = crafted[0] ?? 0;
                    let cost = false;
                    if (c <= 5) {
                        cost = [['wood', c * 1_000 + 1_500], ['stone', 500 * c + 1_500]];
                    }
                    costs[0] = cost;
                }
                return costs;
            },
            unlocked: () => recipes.machines['stone_miner'].crafted?.reduce((s, n) => s + n, 0) > 0,
            position: 6,
        },
        'water_well': {
            resources: crafted => {
                /** @type {([string, number][]|false)[]} */
                const costs = [];
                { // 0
                    const c = crafted[0] ?? 0;
                    let cost = false;
                    if (c <= 3) {
                        cost = [['wood', c * 500 + 1_000], ['stone', 500 * c + 1_500]];
                    } else if (c <= 7) {
                        if (StorageMachine.any_storage_for('brick')) cost = [['wood', c * 250 + 1_000], ['brick', 150 * c + 250]];
                    } else if (c <= 10) {
                        if (StorageMachine.any_storage_for('copper')) cost = [['copper', (c - 5) * 75 + 75], ['brick', 150 * c + 250]];
                    }
                    costs[0] = cost;
                }
                return costs;
            },
            unlocked: () => StorageMachine.any_storage_for('water'),
            position: 7,
        },
        'brick_pile': {
            resources: crafted => {
                /** @type {([string, number][]|false)[]} */
                const costs = [];
                { // 0
                    const c = crafted[0] ?? 0;
                    /** @type {[string, number][]|false} */
                    let cost = false;
                    if (c <= 5) {
                        cost = [['wood', c * 800 + 2_000], ['stone', c ** 2 * 500 + 2_000]];
                    }
                    costs[0] = cost;
                }
                return costs;
            },
            unlocked: () => recipes.machines['wood_burner'].crafted?.reduce((s, n) => s + n, 0) > 0,
            position: 8,
        },
        'brick_furnace': {
            resources: crafted => {
                /** @type {([string, number][]|false)[]} */
                const costs = [];
                { // 0
                    const c = crafted[0] ?? 0;
                    /** @type {[string, number][]|false} */
                    let cost = false;
                    if (c == 0) {
                        cost = [['wood', 500], ['stone', 2_000]];
                    } else if (c <= 10) {
                        cost = [['wood', c * 500 + 500], ['brick', c ** 2 * 125 + 500]];
                    }
                    costs[0] = cost;
                }
                return costs;
            },
            unlocked: () => StorageMachine.any_storage_for('brick'),
            position: 9,
        },
        'gravel_box': {
            resources: crafted => {
                /** @type {([string, number][]|false)[]} */
                const costs = [];
                { // 0
                    const c = crafted[0] ?? 0;
                    let cost = false;
                    if (c <= 5) {
                        cost = [['wood', c * 200 + 1_000], ['brick', 256 * c + 256]];
                    }
                    costs[0] = cost;
                }
                return costs;
            },
            unlocked: () => recipes.machines['brick_furnace'].crafted?.reduce((s, n) => s + n, 0) > 0,
            position: 10,
        },
        'rock_crusher': {
            resources: crafted => {
                /** @type {([string, number][]|false)[]} */
                const costs = [];
                { // 0
                    const c = crafted[0] ?? 0;
                    let cost = false;
                    if (c <= 5) {
                        cost = [['stone', c * 400 + 2_000], ['brick', 128 * 2 ** c + 256]];
                    } else if (c <= 10) {
                        if (StorageMachine.any_storage_for('copper')) cost = [['copper', (c - 5) * 25 + 75], ['brick', 128 * 2 ** c + 256]];
                    }
                    costs[0] = cost;
                }
                return costs;
            },
            unlocked: () => StorageMachine.any_storage_for('gravel'),
            position: 11,
        },
        'ore_crate': {
            resources: crafted => {
                /** @type {([string, number][]|false)[]} */
                const costs = [];
                { // 0
                    const c = crafted[0] ?? 0;
                    let cost = false;
                    if (c <= 5) {
                        cost = [['wood', c * 125 + 1_250], ['brick', 128 * c + 256]];
                    }
                    costs[0] = cost;
                }
                return costs;
            },
            unlocked: () => recipes.machines['rock_crusher'].crafted?.reduce((s, n) => s + n, 0) > 0,
            position: 12,
        },
        'gravel_washer': {
            resources: crafted => {
                /** @type {([string, number][]|false)[]} */
                const costs = [];
                { // 0
                    const c = crafted[0] ?? 0;
                    let cost = false;
                    if (c <= 0) {
                        cost = [['stone', c * 500 + 2_000], ['brick', 128 * 2 ** c + 256]];
                    } else if (c <= 5) {
                        if (StorageMachine.any_storage_for('copper')) cost = [['copper', c * 100 + 100], ['brick', 128 * 2 ** c + 256]];
                    }
                    costs[0] = cost;
                }
                return costs;
            },
            unlocked: () => StorageMachine.any_storage_for('ore'),
            position: 13,
        },
        'sand_box': {
            resources: crafted => {
                /** @type {([string, number][]|false)[]} */
                const costs = [];
                { // 0
                    const c = crafted[0] ?? 0;
                    let cost = false;
                    if (c <= 5) {
                        cost = [['wood', c * 125 + 1_250], ['brick', 64 * c + 256]];
                    }
                    costs[0] = cost;
                }
                return costs;
            },
            unlocked: () => recipes.machines['rock_crusher'].crafted?.reduce((s, n) => s + n, 0) > 0,
            position: 14,
        },
        'gravel_crusher': {
            resources: crafted => {
                /** @type {([string, number][]|false)[]} */
                const costs = [];
                { // 0
                    const c = crafted[0] ?? 0;
                    let cost = false;
                    if (c <= 5) {
                        cost = [['brick', 128 * 1.5 ** c + 256]];
                    } else if (c <= 10) {
                        if (StorageMachine.any_storage_for('copper')) cost = [['copper', 75 * 2 ** ((c - 4) / 2) + 75], ['brick', 256 * c + 512]];
                    }
                    costs[0] = cost;
                }
                return costs;
            },
            unlocked: () => StorageMachine.any_storage_for('sand'),
            position: 15,
        },
        'copper_crate': {
            resources: crafted => {
                /** @type {([string, number][]|false)[]} */
                const costs = [];
                { // 0
                    const c = crafted[0] ?? 0;
                    let cost = false;
                    if (c <= 5) {
                        cost = [['brick', 64 * 2 ** c + 256]];
                    }
                    costs[0] = cost;
                }
                return costs;
            },
            unlocked: () => StorageMachine.any_storage_for('ore'),
            position: 16,
        },
        'copper_melter': {
            resources: crafted => {
                /** @type {([string, number][]|false)[]} */
                const costs = [];
                { // 0
                    const c = crafted[0] ?? 0;
                    let cost = false;
                    if (c <= 5) {
                        cost = [['brick', 64 * c + 256], ['fire', 2 ** (c + 1)]];
                    }
                    costs[0] = cost;
                }
                return costs;
            },
            unlocked: () => StorageMachine.any_storage_for('copper'),
            position: 17,
        },
        // Time machines
        'giant_clock': {
            resources: crafted => {
                /** @type {([string, number][]|false)[]} */
                const costs = [];
                { // 0
                    const c = crafted[0] ?? 0;
                    /** @type {[string, number][]|false} */
                    let cost = [['wood', 500 * (c + 1) ** 2]];
                    if (c >= 5) {
                        if (StorageMachine.any_storage_for('stone')) {
                            cost.push(['stone', 750 * (c - 4) ** 2]);
                        } else {
                            cost = false;
                        }
                    }
                    if (cost && c >= 10) {
                        if (StorageMachine.any_storage_for('brick')) {
                            cost.push(['brick', 250 * (c - 8) ** 2]);
                        } else {
                            cost = false;
                        }
                    }
                    costs[0] = cost;
                }
                return costs;
            },
            unlocked: () => atob(localStorage.getItem('games_cidle')).includes('date'),
            position: 101,
        },
        'sundial': {
            resources: crafted => {
                /** @type {([string, number][]|false)[]} */
                const costs = [];
                { // 0
                    const c = crafted[0] ?? 0;
                    /** @type {[string, number][]|false} */
                    let cost = [['stone', 1_000 * 10 ** c], ['time', 10 * 2 ** c]];

                    if (c >= 5) cost = false;

                    costs[0] = cost;
                }
                return costs;
            },
            unlocked: () => ['time', 'stone'].every(res => StorageMachine.any_storage_for(res)),
            position: 103,
        },
        // Space machines
    },
};
const max_tabs_per_line = 5;
/**
 * @type {{
 *  drawn: boolean,
 *  panes: {[id: string]: {
 *      x: number,
 *      y: number,
 *      width: number,
 *      height: number,
 *      index: number,
 *  }},
 * }}
 */
const cache = {};

/** @type {keyof inventory} */
let subtab = 'machines';

function init() {
    const machines = inventory.machines.contents;
    Object.entries(recipes.machines).forEach(([machine, {unlocked}]) => {
        if (unlocked !== true) return;

        machines[machine] ??= 0;
    });
    check_can_afford();
    sort_inventory();

    // Tries to unlock recipes every 15 seconds
    setInterval(() => {
        if (globals.game_tab != 'inventory') return;
        unlock_recipes();
        check_can_afford();
    }, 15 * 1_000);
    // Prevents a space at the top, somehow
    setTimeout(() => {
        try {
            canvas_reset();
        } catch {}
        clear_caches();
    }, 10);
}
/**
 * Makes a thing, or returns false
 *
 * @param {string} id
 * @param {number} [recipe_id]
 * @param {keyof inventory} [type]
 * @returns {boolean}
 */
function craft(id, recipe_id=0, type=subtab) {
    if (!(type in recipes)) return false;

    const subrecipes = recipes[type];

    if (!(id in subrecipes)) return false;

    const recipe = subrecipes[id];
    recipe.crafted ??= [];
    let cost_list = recipe.resources;
    if (typeof cost_list == 'function') {
        let c = cost_list(recipe.crafted);
        cost_list = c;
    }

    if (!(recipe_id in cost_list) || !Array.isArray(cost_list)) return false;

    if (recipe.crafted.length < cost_list.length) {
        let added = new Array(cost_list.length - recipe.crafted.length).fill(0);
        recipe.crafted.push(...added);
    }

    const cost = cost_list[recipe_id];

    const can_afford = cost.every(([res, cost]) => {
        StorageMachine.storages_for(res).forEach(m => {
            if (cost <= 0) return;

            cost -= m.resources[res].amount;
        });

        return cost <= 0;
    });

    if (!can_afford) return false;

    cost.forEach(([res, cost]) => {
        StorageMachine.storages_for(res)
        .sort((a,b) => distance([0, 0], a) - distance([0, 0], b))
        .forEach(m => {
            if (cost <= 0) return;

            let loss = Math.min(m.resources[res].amount, cost);
            m.resources[res].amount -= loss;
            cost -= loss;
        });
    });
    const inv = inventory[type];
    inv.contents[id] = (inv.contents[id] ?? 0) + 1;
    recipe.crafted[recipe_id]++;
    Machine.machines.forEach(m => m.can_upgrade = false);
    Object.values(recipes.machines).forEach(r => r.can_afford = false);
    check_can_afford();
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
    const w_x = x - display_size.width / 2 + globals.position[0];
    const w_y = y - display_size.height / 2 + globals.position[1];
    const p = [...Pane.get_visible_panes(globals.game_tab)].reverse().find(p => p.contains_point([w_x, w_y]));

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
 * Checks if the mouse's position is clickable in the inventory
 *
 * @param {number} x Absolute x position where the click was on the canvas
 * @param {number} y Absolute y position where the click was on the canvas
 * @param {MouseEvent} event
 * @returns {boolean}
 */
export function is_clickable(x, y, event) {
    const w_x = x - display_size.width / 2 + globals.position[0];
    const w_y = y - display_size.height / 2 + globals.position[1];

    const p = [...Pane.get_visible_panes(globals.game_tab)].reverse().find(p => p.contains_point([w_x, w_y]));
    if (p) return p.is_clickable([w_x, w_y]);

    y -= global_tabs_heights();
    if (y <= tabs_heights()) return true;

    return inventory[subtab].is_clickable(x, y, event);
}
/**
 * Draw a specific part of the inventory
 *
 * @param {Object} [params]
 * @param {CanvasRenderingContext2D} [params.context]
 * @param {number} [params.top]
 */
export function draw({context=canvas_context, top=0}={}) {
    const panes = [...Pane.get_visible_panes('inventory')].reverse();
    const redraw_panes = panes.length != Object.keys(cache.panes ??= {}).length || panes.some((pane, i) => {
        const {id, x, y} = pane;
        if (!(id in cache.panes)) return true;

        const cached_pane = cache.panes[id];
        if (cached_pane.index != i || cached_pane.x != x || cached_pane.y != y) return true;

        const width = pane.table_widths().reduce((s, w) => s + w, 0);
        const height = pane.table_heights().reduce((s, h) => s + h, 0);

        return cached_pane.height != height || cached_pane.width != width;
    });

    if (!cache.drawn || redraw_panes) {
        canvas_reset();
        cache.drawn = true;
    }

    top = draw_tabs({context, top});

    if (redraw_panes) inventory[subtab].cache = {contents: {}};
    inventory[subtab].draw({context, top});

    cache.panes = {};
    panes.forEach((pane, index) => {
        const width = pane.table_widths().reduce((s, w) => s + w, 0);
        const height = pane.table_heights().reduce((s, h) => s + h, 0);
        const {x, y, id} = pane;

        if (redraw_panes) pane.clear_cache();

        pane.nw_draw({context});

        cache.panes[id] = {
            x,
            y,
            index,
            width,
            height,
        };
    });
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
 * Sorts the inventory machines
 */
function sort_inventory() {
    const inv_ma = inventory.machines.contents;
    const rec_ma = recipes.machines;
    inventory.machines.contents = Object.fromEntries(Object.entries(inv_ma).sort(([a], [b]) => {
        if ('position' in rec_ma[a] && 'position' in rec_ma[b]) {
            const posa = rec_ma[a].position;
            const posb = rec_ma[b].position;
            return posa - posb;
        } else if ('position' in rec_ma[a] != 'position' in rec_ma[b]) {
            return ('position' in rec_ma[b]) - ('position' in rec_ma[a]);
        }
        return a > b;
    }));
}
/**
 * Tries to unlock recipes
 */
export function unlock_recipes() {
    const inv_ma = inventory.machines.contents;
    const rec_ma = recipes.machines;
    let added = false;
    Object.entries(rec_ma).forEach(([id, data]) => {
        let unlocked = data.unlocked;
        if (typeof unlocked == 'boolean') return;
        if (typeof unlocked == 'function') {
            unlocked = unlocked();
            if (unlocked) data.unlocked = true;
        }
        if (!unlocked) return;

        added = true;
        inv_ma[id] ??= 0;
    });
    if (added) sort_inventory();
}
/**
 * Checks whether any version of a recipe is affordable
 */
export function check_can_afford() {
    Object.values(recipes.machines).filter(r => !r.can_afford).forEach(recipe => {
        const {crafted=[]} = recipe;
        let {resources} = recipe;
        if (typeof resources == 'function') resources = resources(crafted);
        if (!Array.isArray(resources)) return;
        recipe.can_afford = resources.some(/**@param {false|[string, number][]} list*/list => {
            if (!list) return false;
            return list.every(([res, cost]) => StorageMachine.stored_resource(res).amount >= cost);
        });
    });
}
/**
 * Clears the caches
 */
export function clear_caches() {
    inventory.machines.cache = {
        contents: {},
    };
    cache.drawn = false;
    cache.panes = {};
}
/**
 * Returns an object containing the data to be saved
 *
 * @returns {{
 *  inv: {
 *      machines: {[id: string]: number},
 *  },
 *  rec: {
 *      machines: {[id: string]: {crafted?: number[], unlocked?: boolean}}
 *  },
 * }}
 */
export function save_data() {
    const data = {
        inv: {
            machines: Object.fromEntries(Object.entries(inventory.machines.contents)),
        },
        rec: {
            machines: Object.fromEntries(Object.entries(recipes.machines).map(([id, data]) => {
                const {crafted, unlocked} = data;
                if (!crafted && typeof unlocked == 'function') return null;
                const d = {crafted, unlocked};
                if (typeof d.unlocked == 'function') delete d.unlocked;
                if (!d.crafted) delete d.crafted;

                return [id, d];
            }).filter(data => data != null)),
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
 * @param {{[id: string]: {crafted?: number[], unlocked?: boolean}}} [data.rec.machines]
 */
export function load_data(data={}) {
    if (!data) return;

    const {inv=null, rec=null} = data;

    if (inv) {
        const {machines=null} = inv;

        if (machines) {
            Object.entries(machines).forEach(([id, amount]) => {
                inventory.machines.contents[id] = amount;
            });
        }
    }
    if (rec) {
        const {machines=null} = rec;

        if (machines) {
            Object.entries(machines).forEach(([id, data]) => {
                const {crafted=[], unlocked=null} = data;
                const recipe = recipes.machines[id];
                recipe.crafted = crafted;
                if (unlocked === true) {
                    recipe.unlocked = unlocked;
                    inventory.machines.contents[id] ??= 0;
                }
            });
        }
    }
    sort_inventory();
}

init();
