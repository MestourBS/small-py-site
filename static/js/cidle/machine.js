import { context as canvas_context, display_size, grid_spacing, tabs_heights } from './canvas.js';
import { get_theme_value as theme } from './display.js';
import globals from './globals.js';
import { Pane } from './pane.js';
import { angle_to_rhombus_point, coords_distance as distance, line_crosses_rectangle, parallel_perpendicular, rect_contains_point } from './position.js';
import { beautify, number_between } from './primitives.js';
import Recipe from './recipe.js';
import Resource from './resource.js';
/**
 * @typedef {import('./canvas.js').GameTab} GameTab
 * @typedef {import('./position.js').PointLike} PointLike
 * @typedef {import('./pane.js').PaneCell} PaneCell
 */

//todo refresh pane on color changes
//todo move group of machines
//todo change draw to draw different parts of the machine as required
//todo change draw_connections to draw different connections as required
//todo don't redraw same line multiple times
//todo make arrows start/end at edges
//todo move production to a single all consuming / producing function
//todo faster arrows based on time speed
//todo level-based resources value
//todo add fill level support for images
//todo change linear fill to start at lowest point and end at highest
//todo? switchable recipes
//todo? luck-based recipes
//todo? faster/bigger arrows based on production

export const pause_text = {
    'true': gettext('games_cidle_maker_paused'),
    'false': gettext('games_cidle_maker_unpaused'),
};
const time_constant = 1.76;

export class Machine {
    /** @type {{[id: string]: Machine}} */
    static #registry = {};
    /** @type {Machine[]} */
    static #machines = [];
    /** @type {{[res: string]: Machine}} */
    static #storages = {};
    static #static_cache = {
        /** @type {Machine[]|false} */
        visible_machines: false,
        /** @type {[number, number]} */
        sight_position: [NaN, NaN],
    };

    /** @type {Machine[]} */
    static get machines() {
        if (this != Machine) return Machine.machines;

        return [...this.#machines];
    }
    /** @type {Machine[]} */
    static get visible_machines() {
        if (this != Machine) return Machine.visible_machines;

        const cache = this.#static_cache;
        const {position} = globals;
        if (position.some((c, i) => c != cache.sight_position[i])) {
            cache.visible_machines = false;
            cache.sight_position = [...position];
        }

        if (!cache.visible_machines) {
            cache.visible_machines = this.#machines.filter(m => m.is_visible);
        }

        return cache.visible_machines;
    }

    /**
     * Returns an existing machine
     *
     * @param {string} id
     * @returns {Machine?}
     */
    static machine(id) {
        if (this != Machine) return Machine.machine(id);

        return this.#registry[id];
    }
    /**
     * Empties the cache
     */
    static cache_clear() {
        if (this != Machine) return Machine.cache_clear();

        this.#static_cache.visible_machines = false;
        this.#static_cache.sight_position = [NaN, NaN];
    }
    /**
     * Refreshes every hidden machine's visibility
     */
    static visible_refresh() {
        if (this != Machine) return Machine.visible_refresh();

        this.#machines.forEach(m => m.cache_refresh({hidden: true}));
    }
    /**
     * Returns the machine holding the resource
     *
     * @param {string} res
     * @returns {Machine?}
     */
    static storage_for(res) {
        if (this != Machine) return Machine.storage_for(res);

        return this.#storages[res] ?? null;
    }

    /**
     * @param {Object} params
     * @param {string} params.id
     * @param {string} params.name
     * @param {number} params.x
     * @param {number} params.y
     * @param {boolean} [params.paused]
     * @param {false|(this: Recipe) => boolean} [params.hidden]
     * @param {Recipe[]} [params.recipes]
     * @param {{[res: string]: {amount?: number, best?: number}}} [params.resources]
     * @param {string|HTMLImageElement} [params.image]
     */
    constructor({
        id, name, x, y,
        paused = false, hidden = false,
        recipes = [],
        resources = {},
        image = null,
    }) {
        if (id in Machine.#registry) throw new RangeError(`Machine id must be unique (${id})`);
        if (isNaN(x) || isNaN(y)) throw new TypeError(`Machine x and y positions must be numbers (x: ${x}, y: ${y})`);
        if (!Array.isArray(recipes) || recipes.some(r => !(r instanceof Recipe))) throw new TypeError(`Machine recipes must be of recipe class (${recipes})`);
        if (typeof resources != 'object') throw new TypeError(`Machine resources must be an object {${resources}}`);
        if (typeof image == 'string') {
            const i = new Image;
            i.src = image;
            image = i;
        } else if (image != null && !(image instanceof Image)) throw new TypeError(`Machine image must be a string or an image (${image})`);

        const can_pause = recipes.length && recipes.every(r => r.can_pause);

        this.#id = id;
        this.#name = name.toString();
        this.#x = +x;
        this.#y = +y;
        this.#paused = !!paused && can_pause;
        this.#can_pause = can_pause;
        this.#hidden = typeof hidden == 'function' ? hidden : !!hidden;
        this.#image = image;

        this.#recipes = recipes;

        this.#resources = Object.fromEntries(
            Object.entries(resources).map(([res, {amount=0, best=1}]) => {
                Machine.#storages[res] = this;

                /** @type {{amount: number, best: number}} */
                const obj = Object.defineProperty({best}, 'amount', {
                    get() { return amount; },
                    /** @param {number} a */
                    set(a) {
                        if (!isNaN(a)) {
                            amount = a;
                            // Auto update best
                            this.best = Math.max(this.best, a);
                        }
                    }
                });
                return [res, obj];
            })
        );

        this.cache_refresh();
        Machine.#machines.push(this);
        Machine.#registry[id] = this;
        if (Machine.#static_cache.visible_machines && this.is_visible) {
            Machine.#static_cache.visible_machines.push(this);
        }
    }

    #id;
    #name;
    #x;
    #y;
    #paused;
    #can_pause;
    #hidden;
    #image;
    #moving = false;
    #last_multiplier = 1;

    #recipes;

    #resources;

    #cache = {
        max_level: false,
        can_upgrade: false,
        is_time_machine: false,
        /**
         * @type {{[res: string]: {
         *  best: number,
         *  amount: number,
         * }}}
         */
        resources: {},
        /** @type {{[machine: string]: [string, 1|0|-1][]}} {machine: [color, dir]} */
        connections: {},
    };

    get is_visible() {
        if (this.hidden) return false;
        try {
            display_size;
        } catch { return false; }

        let {x, y, radius} = this;
        const {position} = globals;
        const {width, height} = display_size;

        x += width / 2 - position[0];
        y += height / 2 - position[1];

        const min_x = -radius;
        const min_y = -radius + tabs_heights();
        const max_x = min_x + width + radius * 2;
        const max_y = min_y + height + radius * 2;

        return rect_contains_point([x, y], min_x, max_x, min_y, max_y);
    }
    get radius() { return 25; }

    get id() { return this.#id; }
    get name() { return this.#name; }
    get x() { return this.#x; }
    get y() { return this.#y; }
    get paused() { return this.#paused; }
    set paused(paused) { this.#paused = paused && this.#can_pause; }
    get can_pause() { return this.#can_pause; }
    get hidden() { return !!this.#hidden; }
    get image() { return this.#image; }
    get can_upgrade() { return this.#cache.can_upgrade; }
    get moving() { return this.#moving; }
    set moving(moving) { this.#moving = !!moving; }
    get is_time_machine() { return this.#cache.is_time_machine; }
    get recipes() { return this.#recipes; }

    get resources() { return this.#cache.resources; }

    toJSON() {
        return {
            id: this.id,
            x: this.x,
            y: this.y,
            paused: this.paused,
            recipes: this.#recipes.map(r => r.toJSON()),
            resources: Object.fromEntries(Object.entries(this.#resources).map(([res, {amount, best}]) => [res, {amount, best}])),
            hidden: !!this.#hidden,
        };
    }
    /**
     * Loads data in the machine
     *
     * @param {Object} [data]
     * @param {number} [data.x]
     * @param {number} [data.y]
     * @param {boolean} [data.paused]
     * @param {{level?: number, paused?: boolean}[]} [data.recipes]
     * @param {{[k: string]: {amount?: number, best?: number}}} [data.resources]
     * @param {boolean} [data.hidden]
     */
    load(data={}) {
        if (!(data instanceof Object)) return;

        if ('x' in data && !isNaN(data.x)) this.#x = data.x;
        if ('y' in data && !isNaN(data.y)) this.#y = data.y;
        if ('paused' in data) this.#paused = !!data.paused;
        if ('recipes' in data && Array.isArray(data.recipes)) this.#recipes.forEach((r, i) => r.load(data.recipes[i] ?? {}));
        if ('resources' in data && typeof data.resources == 'object') Object.entries(data.resources).forEach(([res, data]) => {
            if (!(res in this.#resources)) return;
            const d = this.#resources[res];
            d.amount = data.amount;
            d.best = Math.max(d.best, data.best);
        });
        if ('hidden' in data && !data.hidden) this.#hidden = false;

        this.cache_refresh();
    }
    /**
     * Refreshes the machine's cache
     *
     * @param {Object} [params]
     * @param {boolean} [params.hidden]
     * @param {boolean} [params.max_level]
     * @param {boolean} [params.resources]
     * @param {boolean} [params.can_upgrade]
     * @param {boolean} [params.connections]
     * @param {boolean} [params.is_time_machine]
     */
    cache_refresh(
        {hidden, max_level, resources, can_upgrade, connections, is_time_machine}=
        {hidden:true, max_level:true, resources:true, can_upgrade:true, connections:true, is_time_machine:true}
    ) {
        const cache = this.#cache;

        if (hidden) {
            const hidden = this.#hidden;
            let chid;

            if (typeof hidden == 'function') chid = hidden.call(this);
            else chid = hidden;

            if (!chid) {
                this.#hidden = false;
                if (this.is_visible) Machine.#static_cache.visible_machines.push?.(this);
            }
        }

        if (max_level) {
            cache.max_level = this.#recipes.every(r => r.level >= r.max_level);
        }

        if (resources) {
            cache.resources = Object.fromEntries(Object.entries(this.#resources).map(([res, data]) => {
                return [res, {
                    get best() { return data.best; },
                    set best(best) { if (!isNaN(best)) data.best = Math.max(data.best, best); },
                    get amount() { return data.amount; },
                    set amount(amount) { if (!isNaN(amount)) data.amount = amount; },
                }];
            }));
        }

        if (can_upgrade) {
            cache.can_upgrade = this.#recipes.some(r => {
                r.cache_refresh({can_upgrade: true});
                return r.can_upgrade;
            });
        }

        if (connections) {
            /** @type {{[res_id: string]: number}} */
            const res_changes = {};
            /** @type {{[res_id: string]: Machine}} */
            const recipes = this.#recipes.reduce((targets, recipe) => {
                recipe.produces.forEach(([res, pro]) => {
                    //todo max support

                    res_changes[res] ??= 0;
                    res_changes[res] += pro;
                });
                recipe.consumes.forEach(([res, con]) => {
                    //todo min support

                    res_changes[res] ??= 0;
                    res_changes[res] -= con;
                });

                recipe.cache_refresh({targets: true});
                Object.entries(recipe.targets).forEach(([res, mac]) => targets[res] = mac);
                return targets;
            }, {});
            const machines = new Set(Object.values(recipes));
            machines.delete(this);
            /** @type {{[machine: string]: [string, 1|0|-1][]}} */
            const connections = cache.connections = {};

            machines.forEach(machine => {
                const resources = Object.keys(machine.resources);
                if (!resources.length) return;

                const {id} = machine;
                const links = connections[id] = [];
                links.push(...resources.map(res => [Resource.resource(res).color, Math.sign(res_changes[res] ?? 0)]));
            });
        }

        if (is_time_machine) {
            cache.is_time_machine = this.#recipes
                .some(r => r.consumes.some(([res]) => res == 'time') || r.produces.some(([res]) => res == 'time'));
        }
    }
    /**
     * Checks whether the machine contains the point at [X, Y] (absolute in grid)
     *
     * @param {PointLike} point
     * @returns {boolean}
     */
    contains_point(point) {
        return distance(this, point) <= this.radius ** 2;
    }
    /**
     * Draws the machine
     *
     * @param {Object} [params]
     * @param {CanvasRenderingContext2D} [params.context]
     * @param {number?} [params.x] Override for the x position
     * @param {number?} [params.y] Override for the y position
     * @param {boolean} [params.transparent]
     */
    draw({context=canvas_context, x=null, y=null, transparent=false}={}) {
        if (x == null) {
            ({x} = this);
            x += display_size.width / 2 - globals.position[0];
        }
        if (y == null) {
            ({y} = this);
            y += display_size.height / 2 - globals.position[1];
        }
        const {radius} = this;
        const {PI} = Math;

        if (transparent) context.globalAlpha = .5;

        context.save();
        context.fillStyle = theme('machine_color_fill');
        context.beginPath();
        context.arc(x, y, radius, 0, 2 * PI);
        if (this.image) {
            context.clip();
            context.drawImage(this.image, x - radius, y - radius, radius * 2, radius * 2);
        } else {
            context.fill();
        }
        context.closePath();
        context.restore();

        if (this.#moving && !transparent) context.setLineDash([5]);
        context.lineWidth = 1.5;

        // Partial fill for resources
        const keys = Object.keys(this.resources).sort();
        const {length} = keys;
        for (let i = 0; i < length; i++) {
            const res = keys[i];
            const {amount, best} = this.resources[res];
            const {fill_image=false, fillmode='circle', color, border_color} = Resource.resource(res);
            const limit = 10 ** Math.ceil(Math.log10(best));
            const start_angle = 2 * i / length * PI - PI / 2;
            const end_angle = 2 * (i + 1) / length * PI - PI / 2;
            /** @type {[keyof context, any[]][]} */
            const funcs = [];
            let fill;
            if (!isFinite(amount)) fill = 1;
            else if (!isFinite(best)) fill = Math.log10(amount) / 308.25;
            else fill = amount / limit;

            switch (fillmode) {
                case 'circle':
                default:
                    funcs.push(
                        ['moveTo', [x, y - radius * fill]],
                        ['arc', [x, y, radius * fill, start_angle, end_angle]],
                        ['lineTo', [x, y - radius * fill]],
                    );
                    break;
                case 'clockwise':
                case 'counterclockwise':
                    const clock_diff = 2 / length * Math.PI * fill;
                    let clock_start = start_angle;
                    let clock_end = clock_start + clock_diff;
                    if (mode == 'counterclockwise') {
                        clock_end = clock_start;
                        clock_start = clock_end - clock_diff;
                    }
                    funcs.push(
                        ['moveTo', [x - radius * fill, y]],
                        ['arc', [x, y, radius, clock_start, clock_end]],
                        ['lineTo', [x - radius * fill, y]],
                    );
                    break;
                case 'transparency':
                    const transparency_alpha = context.globalAlpha * fill;
                    funcs.push(
                        ['globalAlpha', [transparency_alpha]],
                        ['moveTo', [x - radius * fill, y]],
                        ['arc', [x, y, radius, start_angle, end_angle]],
                        ['lineTo', [x - radius * fill, y]],
                    );
                    break;
                case 'linear':
                    let linear_y = radius * (1 - 2 * fill);
                    const linear_angle_start = Math.asin(linear_y / radius);
                    let linear_x = Math.cos(linear_angle_start) * radius;
                    let linear_angle_end = Math.acos(-linear_x / radius) * Math.sign(linear_y);
                    if (fill == 1) linear_angle_end = linear_angle_start + Math.PI * 2;
                    linear_x += x;
                    linear_y += y;
                    funcs.push(
                        ['moveTo', [linear_x, linear_y]],
                        ['arc', [x, y, radius, linear_angle_start, linear_angle_end]],
                        ['lineTo', [linear_x, linear_y]],
                    );
                    break;
                case 'rhombus':
                    const rhombus_corners = [0, 1, 2].map(n => n / 2 * Math.PI);
                    /** @param {number} angle @returns {[number, number]} */
                    const rhombus_angle_point = angle => {
                        let [px, py] = angle_to_rhombus_point(angle);
                        px = px * radius * fill + x;
                        py = py * radius * fill + y;
                        return [px, py];
                    };
                    const rhombus_points = [
                        rhombus_angle_point(start_angle),
                        ...rhombus_corners.filter(c => number_between(c, start_angle, end_angle)).map(c => rhombus_angle_point(c)),
                        rhombus_angle_point(end_angle),
                    ];
                    funcs.push(
                        ['moveTo', [x - radius * fill, y]],
                        ...rhombus_points.map(([px, py]) => ['lineTo', [px, py]]),
                        ['lineTo', [x - radius * fill, y]],
                    );
                    break;
            }

            context.save();
            context.fillStyle = color;
            context.strokeStyle = border_color;
            context.beginPath();
            funcs.forEach(([func, args]) => {
                if (!(func in context)) return;
                if (typeof context[func] == 'function') context[func](...args)
                else context[func] = args[0];
            });
            if (fill_image) {
                context.clip();
                context.drawImage(fill_image, x - radius, y - radius, radius * 2, radius * 2);
            } else {
                context.fill();
            }
            context.stroke();
            context.closePath();
        }

        let color;
        if (this.#cache.can_upgrade) color = theme('machine_can_upgrade_color_border');
        else if (this.#cache.max_level) color = theme('machine_full_upgrades_color_border');
        else color = theme('machine_color_border');

        context.save();
        context.strokeStyle = color;
        context.beginPath();
        context.arc(x, y, radius, 0, 2 * PI);
        context.stroke();
        context.closePath();
        context.restore();

        if (this.paused) {
            context.fillStyle = theme('text_color_fill');
            context.beginPath();
            context.moveTo(x - radius / 10, y - radius * 2 / 5);
            context.lineTo(x - radius / 10, y + radius * 2 / 5);
            context.lineTo(x - radius * 3 / 10, y + radius * 2 / 5);
            context.lineTo(x - radius * 3 / 10, y - radius * 2 / 5);
            context.lineTo(x - radius / 10, y - radius * 2 / 5);
            context.fill();
            context.closePath();
            context.beginPath();
            context.moveTo(x + radius / 10, y - radius * 2 / 5);
            context.lineTo(x + radius / 10, y + radius * 2 / 5);
            context.lineTo(x + radius * 3 / 10, y + radius * 2 / 5);
            context.lineTo(x + radius * 3 / 10, y - radius * 2 / 5);
            context.lineTo(x + radius / 10, y - radius * 2 / 5);
            context.fill();
            context.closePath();
        }

        context.globalAlpha = 1;
        context.setLineDash([]);
    }
    /**
     * Draws the machine's connections, if they are visible
     *
     * @param {Object} [params]
     * @param {CanvasRenderingContext2D} [params.context]
     */
    draw_connections({context=canvas_context}={}) {
        if (!this.is_visible) return;
        if (this.paused) context.setLineDash([10]);

        const offset_x = display_size.width / 2 - globals.position[0];
        const offset_y = display_size.height / 2 - globals.position[1];

        Object.entries(this.#cache.connections).forEach(([machine_id, resources]) => {
            const machine = Machine.machine(machine_id);

            if (!machine || !resources.length) return;

            if (!machine.is_visible) {
                const {width, height} = display_size;

                const r_x = -offset_x;
                const r_y = -offset_y;
                const r_w = width;
                const r_h = height;

                if (!line_crosses_rectangle([this, machine], r_x, r_y, r_w, r_h)) return;
            }

            let dbr = 0;
            let d = 0;
            if (resources.length > 1) {
                dbr = this.radius / (resources.length - 1);
                if (resources.length < 3) d = -this.radius * 1.5;
                else d = -this.radius;
            }
            const parallels = parallel_perpendicular([this, machine]);

            resources.forEach(([color, dir]) => {
                let [pa, pb] = parallels(d += dbr);

                context.strokeStyle = color;
                context.beginPath();
                context.moveTo(pa.x + offset_x, pa.y + offset_y);
                context.lineTo(pb.x + offset_x, pb.y + offset_y);
                context.stroke();
                context.closePath();

                // Draw arrows if needed and they are within frame
                if (!dir) return;

                if (dir == -1) [pa, pb] = [pb, pa];

                const dist_x = pb.x - pa.x;
                const dist_y = pb.y - pa.y;
                /** @type {number} */
                let off_x;
                /** @type {number} */
                let off_y;

                if (!dist_x || !dist_y) {
                    off_x = 2.5 * Math.sign(dist_x);
                    off_y = 2.5 * Math.sign(dist_y);
                } else {
                    off_x = 2.5 * dist_x / (Math.abs(dist_x) + Math.abs(dist_y));
                    off_y = 2.5 * dist_y / (Math.abs(dist_x) + Math.abs(dist_y));
                }

                /** @type {[number, number]} */
                const tip = [
                    (pa.x + pb.x) / 2 + off_x + offset_x,
                    (pa.y + pb.y) / 2 + off_y + offset_y,
                ];
                /** @type {[number, number]} */
                const left = parallels(d + 5).reduce((a, p) => [a[0] + p.x / 2 - off_x, a[1] + p.y / 2 - off_y], [offset_x, offset_y]);
                /** @type {[number, number]} */
                const right = parallels(d - 5).reduce((a, p) => [a[0] + p.x / 2 - off_x, a[1] + p.y / 2 - off_y], [offset_x, offset_y]);

                if (!this.paused) {
                    // Move the arrow on the line
                    const d = distance(pa, pb) ** .75;
                    const r = (Date.now() % d) / d - .5;
                    [tip, left, right].forEach(p => {
                        p[0] += r * dist_x;
                        p[1] += r * dist_y;
                    });
                }

                if (![tip, left, right].some(p => rect_contains_point(p, 0, display_size.width, 0, display_size.height))) return;

                context.fillStyle = color;
                context.beginPath();
                context.moveTo(...tip);
                context.lineTo(...right);
                context.lineTo(...left);
                context.lineTo(...tip);
                context.fill();
                context.closePath();
            });
        });

        context.setLineDash([]);
    }
    /**
     * Computes the machine's pane's arguments
     *
     * @returns {{
     *  id: string,
     *  x: number,
     *  y: number,
     *  content: PaneCell[][],
     *  title: string,
     *  tab: GameTab,
     * }}
     */
    pane_contents() {
        const {id} = this;
        const pane_id = `${globals.game_tab}_machine_${id}_pane`;
        const x = this.x + this.radius;
        const y = this.y - this.radius;
        const font_size = theme('font_size');
        const resources = Object.entries(this.resources);
        const has_resources = !!resources.length;
        const has_recipes = !!this.#recipes.length;

        const pause_content = this.can_pause ? () => pause_text[this.paused] : gettext('games_cidle_maker_unpausable');
        /** @type {PaneCell} */
        const pause_cell = {
            content: [pause_content],
            click: [() => {
                if (!this.can_pause) return;
                this.toggle_pause();
            }],
            width: +has_recipes + +has_resources,
        };
        if (!this.can_pause) delete pause_cell.click;

        /** @type {PaneCell[][]} */
        const content = [
            // Buttons
            [pause_cell,
            {
                content: [gettext('games_cidle_machine_move')],
                click: [() => {
                    this.move();
                    const p = Pane.pane(pane_id);
                    if (p) p.remove();
                }],
                width: +has_recipes + +has_resources,
            }],
        ];

        /** @type {PaneCell[][]} */
        const storage_rows = [];
        /** @type {PaneCell[][]} */
        const recipe_rows = [];
        if (has_resources) {
            storage_rows.push([{
                content: [gettext('cidle_machine_contents')],
                width: 2,
            }], ...resources.map(/** @returns {PaneCell[]} */([res, data]) => {
                const {name, background_color, border_color, color} = Resource.resource(res);

                const amount = () => beautify(data.amount);

                return [{
                    content: [`${name}`],
                    background_color, border_color, text_color: color,
                }, {
                    content: [amount],
                    background_color, border_color, text_color: color,
                }];
            }));
        }
        if (has_recipes) {
            recipe_rows.push([{
                content: [gettext('cidle_machine_recipes')],
                width: 2,
            }], ...this.#recipes.map((recipe, i) => {
                const params = {
                    get x() {
                        return x + (Pane.pane(pane_id)?.table_widths().reduce((s, w) => s + w, 0) ?? 0);
                    },
                    y: y + (4.5 + i) * font_size,
                };

                return recipe.pane_preview(params);
            }));
        }

        if (has_recipes && has_resources) {
            // Zip them
            const max_i = Math.max(storage_rows.length, recipe_rows.length);

            // Force all rows to be the same width
            const storage_width = storage_rows.reduce((w, row) => {
                return Math.max(w, row.reduce((w, cell) => w + (cell.width ?? 1), 0));
            }, 0);
            storage_rows.forEach(row => {
                const row_width = row.reduce((w, cell) => w + (cell.width ?? 1), 0);
                const diff = storage_width - row_width;
                const last_cell = row[row.length - 1];
                last_cell.width = (last_cell.width ?? 1) + diff;
            });

            // Force all rows to be the same width
            const recipe_width = recipe_rows.reduce((w, row) => {
                return Math.max(w, row.reduce((w, cell) => w + (cell.width ?? 1), 0));
            }, 0)
            recipe_rows.forEach(row => {
                const row_width = row.reduce((w, cell) => w + (cell.width ?? 1), 0);
                const diff = recipe_width - row_width;
                const last_cell = row[row.length - 1];
                last_cell.width = (last_cell.width ?? 1) + diff;
            });

            for (let i = 0; i < max_i; i++) {
                // If the cells don't exist, use a blank cell
                const storage = storage_rows[i] ?? [{content: [''], width: storage_width}];
                const recipe = recipe_rows[i] ?? [{content: [''], width: recipe_width}];
                content.push([...storage, ...recipe]);
            }
        } else {
            content.push(...storage_rows, ...recipe_rows);
        }

        return {id: pane_id, x, y, content, title: this.name, tab: globals.game_tab};
    }
    /**
     * Action to perform on click
     *
     * @param {MouseEvent} event
     */
    click(event) {
        if (event.shiftKey) {
            this.move();
            return;
        }

        const contents = this.pane_contents();
        const {id} = contents;
        let p = Pane.pane(id);
        if (p) {
            p.remove();
        } else {
            p = new Pane(contents);
        }
    }
    /**
     * Action to perform on context menu
     */
    contextmenu(event) { this.toggle_pause(); }
    /**
     * Starts moving the machine
     */
    move() {
        this.#moving = true;
        globals.adding['world'] = {
            click: (x, y, event) => {
                if (event.shiftKey == globals.press_to_snap) {
                    x = Math.round(x / grid_spacing) * grid_spacing;
                    y = Math.round(y / grid_spacing) * grid_spacing;
                }
                this.#x = x;
                this.#y = y;
                this.#moving = false;
                delete globals.adding['world'];
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
                this.draw({x, y, transparent: true});
            },
        };
    }
    /**
     * Pauses/unpauses the machine's production and consumption
     *
     * @param {Object} params
     * @param {boolean|'auto'} [params.set]
     */
    toggle_pause({set='auto'}={}) {
        if (!this.#can_pause) return;

        if (set == 'auto') set = !this.#paused;

        this.paused = set;
    }
    /**
     * Checks whether the machine can produce things
     *
     * @returns {boolean}
     */
    can_produce() {
        return this.#recipes.some(r => r.can_produce());
    }
    /**
     * Consumes and produces things
     *
     * @param {Object} [params]
     * @param {number} [params.multiplier] Speed multiplier
     */
    produce({multiplier=this.#last_multiplier}={}) {
        if (this.paused) return;

        this.#recipes.filter(r => !r.paused && r.can_produce({multiplier}))
            .forEach(r => r.produce({multiplier}));
    }
}
export default Machine;

/**
 * Creates and places the machines
 */
function make_machines() {
    /**
     * @type {{
     *  id: string,
     *  name: string,
     *  x: number,
     *  y: number,
     *  paused?: false,
     *  hidden?: false|(this: Recipe) => boolean,
     *  recipes?: Recipe[],
     *  resources?: {[res: string]: {
     *      amount?: number,
     *      best?: number,
     *  }},
     *  image?: string|HTMLImageElement,
     * }[]}
     */
    const machines = [
        // T0
        {
            id: 'forest',
            name: gettext('games_cidle_machine_forest'),
            x: 100,
            y: 100,
            recipes: [
                new Recipe({
                    name: gettext('games_cidle_recipe_forest_0_0'),
                    max_level: 3,
                    produces(level) {
                        switch (level) {
                            default:
                                return [];
                            case 1:
                                return [['wood', .1, 10]];
                            case 2:
                                return [['wood', .2, 10]];
                            case 3:
                                return [['wood', .4, 20]];
                        }
                    },
                    upgrade_costs(level) {
                        switch (level) {
                            default:
                                return [];
                            case 1:
                                return [['stone', 1]];
                            case 2:
                                return [['water', 5]];
                        }
                    },
                    type: 'fixed',
                }),
            ],
            resources: {
                wood: {},
            },
        },
        {
            id: 'big_rock',
            name: gettext('games_cidle_machine_big_rock'),
            x: -100,
            y: 100,
            recipes: [
                new Recipe({
                    name: gettext('games_cidle_recipe_big_rock_0_0'),
                    max_level: 3,
                    consumes(level) {
                        switch (level) {
                            default:
                                return [];
                            case 1: case 2:
                                return [['wood', .1, .25]];
                            case 3:
                                return [['wood', .05, .125]];
                        }
                    },
                    produces(level) {
                        switch (level) {
                            default:
                                return [];
                            case 1:
                                return [['stone', .1, 10]];
                            case 2:
                                return [['stone', .2, 10]];
                            case 3:
                                return [['stone', .4, 20]];
                        }
                    },
                    upgrade_costs(level) {
                        switch (level) {
                            default:
                                return [];
                            case 0:
                                return [['wood', 10]];
                            case 1:
                                return [['fire', 1]];
                            case 2:
                                return [['fire', 5], ['water', 5]];
                        }
                    },
                    type: 'fixed',
                }),
            ],
            resources: {
                stone: {},
            },
            hidden: () => Machine.machine('forest').recipes[0].level < 1,
        },
        {
            id: 'fire_pit',
            name: gettext('games_cidle_machine_fire_pit'),
            x: -100,
            y: -100,
            recipes: [
                new Recipe({
                    name: gettext('games_cidle_recipe_fire_pit_0_0'),
                    max_level: 2,
                    consumes(level) {
                        switch (level) {
                            default:
                                return [];
                            case 1: case 2:
                                return [['wood', .1, .5]];
                        }
                    },
                    produces(level) {
                        switch (level) {
                            default:
                                return [];
                            case 1:
                                return [['fire', .1, 10]];
                            case 2:
                                return [['fire', .2, 15]];
                        }
                    },
                    upgrade_costs(level) {
                        switch (level) {
                            default:
                                return [];
                            case 0:
                                return [['wood', 10], ['stone', 5]];
                            case 1:
                                return [['wood', 20], ['stone', 15]];
                        }
                    },
                    type: 'fixed',
                }),
            ],
            resources: {
                fire: {},
            },
            hidden: () => Machine.machine('big_rock').recipes[0].level < 1,
        },
        {
            id: 'water_well',
            name: gettext('games_cidle_machine_water_well'),
            x: 100,
            y: -100,
            recipes: [
                new Recipe({
                    name: gettext('games_cidle_recipe_water_well_0_0'),
                    max_level: 2,
                    produces(level) {
                        switch (level) {
                            default:
                                return [];
                            case 1:
                                return [['water', .1, 10]];
                            case 2:
                                return [['water', .2, 15]];
                        }
                    },
                    upgrade_costs(level) {
                        switch (level) {
                            default:
                                return [];
                            case 0:
                                return [['stone', 10], ['fire', 5]];
                            case 1:
                                return [['stone', 20], ['wood', 15]];
                        }
                    },
                    type: 'fixed',
                }),
            ],
            resources: {
                water: {},
            },
            hidden: () => Machine.machine('fire_pit').recipes[0].level < 1,
        },
        // T1
        // time machines
        // space machines
    ];

    machines.forEach(m => new Machine(m));
}
/**
 * Current time speed
 *
 * Each active time consumer multiplies time by `<total consumption>^1.76 + 1`
 *
 * @returns {number}
 */
export function time_speed() {
    let multiplier = 1;

    Machine.machines.filter(m => m.is_time_machine && m.can_produce())
        .forEach(m => m.recipes.forEach(r => {
            multiplier = r.consumes.reduce((m, [,con]) => m * con ** time_constant, multiplier);
        }));

    return multiplier;
}
/**
 * Returns an object of the data to be saved
 */
export function save_data() {
    return Machine.machines.map(m => m.toJSON());
}
/**
 * Loads the saved data
 *
 * @param {{
 *  id: string,
 *  x?: number,
 *  y?: number,
 *  paused?: boolean,
 *  recipes?: {level?: number, paused?: boolean}[],
 *  resources?: {[res: string]: {amount?: number, best?: number}},
 *  hidden?: boolean,
 * }[]} data
 */
export function load_data(data) {
    if (!Array.isArray(data)) return;

    data.forEach(data => {
        // Invalid data
        if (!(data instanceof Object) || !('id' in data)) return;

        const {id} = data;

        Machine.machine(id)?.load?.(data);
    });
}

make_machines();

setInterval(() => {
    Machine.machines.forEach(m => m.cache_refresh());
}, 1e3);
