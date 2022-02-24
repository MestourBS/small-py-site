import { canvas_write, context as canvas_context, display_size, tabs_heights } from './canvas.js';
import { get_theme_value as theme } from './display.js';
import globals from './globals.js';
import Machine from './machine.js';
import { Pane } from './pane.js';
import { coords_distance as distance, angle_to_rhombus_point, rect_contains_point } from './position.js';
import Resource from './resource.js';
import { beautify, number_between } from './primitives.js';
/**
 * @typedef {import('./position.js').PointLike} PointLike
 * @typedef {keyof filltypes} FillType
 * @typedef {'clockwise'|'counterclockwise'|'transparency'|'circle'|'rhombus'|'linear'} FillMode
 */

//todo change draw to draw different parts of the storage as required
//todo level-based resources value
//todo add fill level support for images
//todo change linear fill to start at lowest point and end at highest

const filltypes = {
    'fraction': {
        /** @param {number} amount @param {number} max */
        fill(amount, max) {
            if (!isFinite(amount)) {
                return 1;
            }
            if (!isFinite(max)) {
                return 10 ** (Math.log10(amount) % 1 - 1);
            }
            return amount / max;
        },
    },
    'logarithm': {
        /** @param {number} amount @param {number} max */
        fill(amount, max) {
            if (!isFinite(amount)) {
                return 1;
            }
            if (!isFinite(max)) {
                return Math.log(amount) / Math.log(Number.MAX_VALUE);
            }
            return Math.log(amount) / Math.log(max);
        },
    },
    get 'default'() { return this['fraction']; },
};

export class StorageMachine extends Machine {
    /** @type {StorageMachine[]} */
    static #storages = [];
    /** @type {{[resource: string]: StorageMachine[]}} */
    static #filtered_storages = {};

    /** @type {StorageMachine[]} */
    static get storage_machines() {
        // Allows children classes to access it themselves
        if (this != StorageMachine) return StorageMachine.storage_machines;

        return [...this.#storages];
    }

    /**
     * Gets the storages that store `resource`
     *
     * @param {string} resource
     * @returns {StorageMachine[]}
     */
    static storages_for(resource) {
        // Allows children classes to access it themselves
        if (this != StorageMachine) return StorageMachine.storages_for(resource);

        return [...(this.#filtered_storages[resource] ??= [])];
    }
    /**
     * Checks whether there is any storage available for a resource
     *
     * @param {string} resource
     * @param {number} [min] Minimum amount of storages to check for
     * @returns {boolean}
     */
    static any_storage_for(resource, min=1) {
        // Allows children classes to access it themselves
        if (this != StorageMachine) return StorageMachine.storages_for(resource);

        return resource in this.#filtered_storages && this.#filtered_storages[resource].length >= min;
    }
    /**
     * Computes the current amount and maximum of a resource
     *
     * @param {string} resource
     * @returns {{amount: number, max: number}}
     */
    static stored_resource(resource) {
        if (this != StorageMachine) return StorageMachine.stored_resource(resource);

        const storages = this.#filtered_storages[resource] ?? [];
        const data = Object.defineProperties({}, {
            amount: { get: () => storages.reduce((total, {resources}) => total + resources[resource].amount, 0), },
            max: { get: () => storages.reduce((total, {resources}) => total + resources[resource].max, 0), },
        });
        return data;
    }

    /**
     * @param {Object} params
     * @param {string?} [params.id]
     * @param {number?} [params.x]
     * @param {number?} [params.y]
     * @param {string?} [params.name]
     * @param {number?} [params.level]
     * @param {string|HTMLImageElement?} [params.image]
     * @param {boolean} [params.insert]
     * @param {{[id: string]: {amount?: number, max?: number}}?} [params.resources]
     * @param {(level: number) => number} [params.level_formula]
     * @param {[string, number][][]|((level: number) => [string, number][]|false|null)?} [params.upgrade_costs]
     * @param {FillType} [params.filltype]
     * @param {FillMode} [params.fillmode]
     */
    constructor({
        id = null, x = null, y = null, name = null, level = 0, image = null, insert = true,
        resources = {}, level_formula = l => l+1, upgrade_costs=[], filltype='fraction', fillmode='circle',
    }) {
        if (typeof resources != 'object') throw new TypeError(`Storage machine resources must be an object (${resources})`);
        if (typeof level_formula != 'function') throw new TypeError(`Storage machine level_formula must be a function (${level_formula})`);
        if (typeof upgrade_costs == 'function');
        else if (!Array.isArray(upgrade_costs) || upgrade_costs.some(row => row.some(([r, a]) => typeof r != 'string' || typeof a != 'number'))) throw new TypeError(`Maker machine upgrade_costs must be an array of arrays of [resources,numbers] (${upgrade_costs})`);
        if (!is_fill_type(filltype)) throw new TypeError(`Storage machine filltype must be either 'fraction' or 'logarithm' (${filltype})`);
        if (!is_fill_mode(fillmode)) throw new TypeError(`Storage machine fillmode must be either 'circle', 'counterclockwise', 'clockwise', or 'transparency' (${fillmode})`);

        super({id, x, y, name, level, image, insert});
        if (image) fillmode = 'image';

        for (let data of Object.values(resources)) {
            if (!('amount' in data)) data.amount = 0;
            if (!('max' in data)) data.max = 1e3;
        }
        if (x != null && y != null && insert) Object.keys(resources).forEach(res => {
            const filtered = StorageMachine.#filtered_storages;

            (filtered[res] ??= []).push(this);
        });

        this.#resources = resources;
        this.#level_formula = level_formula;
        this.#upgrade_costs = upgrade_costs;
        this.#filltype = filltype;
        this.#fillmode = fillmode;
        this.#level_text = this.level_to_stars();

        if (x != null && y != null && insert) {
            StorageMachine.#storages.push(this);

            if (this.is_visible) {
                Machine.visible_machines.push(this);
            }
        }
    }

    /** @type {{[id: string]: {amount: number, max: number}}} */
    #resources;
    /**
     * False when refresh is needed, object for resources amount
     *
     * @type {{[id: string]: {amount: number, max: number}}|false}
     */
    #resources_leveled = false;
    #level_formula;
    #upgrade_costs;
    /**
     * Null when refresh is needed, false when no more upgrades, [resource, amount][] to upgrade
     *
     * @type {null|false|[string, number][]}
     */
    #upgrade_costs_leveled = null;
    #filltype;
    #fillmode;
    /** @type {boolean|null} */
    #can_upgrade = null;
    #level_text;

    /** @type {{[id: string]: {amount: number, max: number}}} */
    get resources() {
        if (this.#resources_leveled === false) {
            this.#resources_leveled = Object.fromEntries(Object.entries(this.#resources).map(([res, data]) => {
                const d = {};
                Object.defineProperty(d, 'amount', {
                    get: () => data.amount,
                    set: amount => data.amount = amount,
                });
                if (res != 'space') {
                    Object.defineProperty(d, 'max', {
                        get: () => { return data.max * space_boost() * this.#level_formula(this.level); },
                        set(max) { data.max = max / (space_boost() * this.#level_formula(this.level)); },
                    });
                } else {
                    d.max = data.max * this.#level_formula(this.level);
                }
                return [res, d];
            }));
        }

        return this.#resources_leveled;
    }
    get is_visible() {
        if (this.hidden) return false;

        let {x, y, radius} = this;
        if (x == null || y == null) return false;
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
    get level() { return super.level; }
    set level(level) {
        if (!isNaN(level)) {
            super.level = level;
            this.#resources_leveled = false;
            this.#upgrade_costs_leveled = null;
            this.#level_text = this.level_to_stars();
        }
    }
    /** @type {[string, number][]|false} */
    get upgrade_costs() {
        if (this.#upgrade_costs_leveled == null) {
            if (typeof this.#upgrade_costs == 'function') this.#upgrade_costs_leveled = this.#upgrade_costs(this.level);
            else if (!(this.level in this.#upgrade_costs)) this.#upgrade_costs_leveled = false;
            else this.#upgrade_costs_leveled = this.#upgrade_costs[this.level].map(v => [...v]);
        }

        return this.#upgrade_costs_leveled ?? false;
    }
    get filltype() { return this.#filltype; }
    get fillmode() { return this.#fillmode; }
    get can_upgrade() {
        if (this.#can_upgrade == null) {
            let can;
            if (!this.upgrade_costs) can = this.#upgrade_costs_leveled;
            else can = this.upgrade_costs.every(([res, cost]) => {
                const {amount} = StorageMachine.stored_resource(res);
                return cost <= amount;
            }) || null;
            this.#can_upgrade = can;
        }
        return this.#can_upgrade ?? false;
    }
    set can_upgrade(can) {
        if (!can) this.#can_upgrade = null;
        else this.#can_upgrade = true;
    }
    get moving() { return super.moving; }
    set moving(moving) { super.moving = moving; }

    toJSON() {
        return Object.assign(super.toJSON(), {
            resources: Object.fromEntries(Object.entries(this.#resources).map(([res, data]) => {
                const {amount} = data;
                return [res, {amount}];
            }))
        });
    }

    destroy() {
        let i = StorageMachine.#storages.indexOf(this);
        while (i != -1) {
            StorageMachine.#storages.splice(i, 1);
            i = StorageMachine.#storages.indexOf(this);
        }
        Object.keys(this.#resources).forEach(res => {
            let i = StorageMachine.#filtered_storages[res].indexOf(this);
            while (i != -1) {
                StorageMachine.#filtered_storages[res].splice(i, 1);
                i = StorageMachine.#filtered_storages[res].indexOf(this);
            }
        });
        const pane_id = this.panecontents().id;
        let p = Pane.pane(pane_id);
        if (p) {
            p.remove();
            return;
        }

        super.destroy();
    }

    /**
     * @param {Object} [params]
     * @param {number?} [params.x] New X position
     * @param {number?} [params.y] New Y position
     */
    insert({x, y}={}) {
        let i = StorageMachine.#storages.indexOf(this);
        if (i == -1) StorageMachine.#storages.push(this);
        Object.keys(this.#resources).forEach(res => {
            let i = StorageMachine.#filtered_storages[res].indexOf(this);
            if (i == -1) StorageMachine.#filtered_storages[res].push(this);
        });

        super.insert({x, y});
    }

    /** @param {PointLike} point */
    contains_point(point) {
        let dist = distance(this, point);

        return dist <= this.radius ** 2;
    }

    /**
     * @param {Object} [params]
     * @param {MouseEvent} [params.event]
     * @param {boolean} [params.markers]
     * @returns {{
     *  x: number,
     *  y: number,
     *  pinned?: boolean,
     *  id: string,
     *  content?: {
     *      content: (string|() => string)[],
     *      click?: (() => void)[],
     *      width?: number,
     *  }[][],
     *  title?: string|false,
     *  tab?: GameTab
     * }?}
     */
    panecontents({event=null, markers=true}={}) {
        const id = this.index == -1 ? this.id : this.index;
        const pane_id = `${globals.game_tab}_storage_${id}_pane`;

        /**
         * @type {{
         *  content: (string|() => string)[],
         *  click?: (() => void)[],
         *  width?: number,
         * }[][]}
         */
        const content = [];

        if (markers) {
            content.push(
                [{
                    content: [gettext('games_cidle_machine_move')],
                    click: [() => {
                        this.move();
                        const p = Pane.pane(pane_id);
                        if (p) p.remove();
                    }],
                }],
            );
        }

        content.push(
            [{
                content: [gettext('cidle_storage_contents')],
            }],
            ...Object.entries(this.resources).map(([res, data]) => {
                const {color, background_color, name, picture: image} = Resource.resource(res);
                const get_amount = () => {
                    let amount = beautify(data.amount).padEnd(8);
                    if (isFinite(data.max)) {
                        amount += ` /${beautify(data.max)}`;
                    }
                    return `{color:${color}}${amount}`;
                };

                return [{
                    content: [`{color:${color}}${name}`],
                    color: background_color,
                    image,
                }, {
                    content: [get_amount],
                    color: background_color,
                }];
            }),
        );

        const x = this.x + this.radius;
        const y = this.y - this.radius;
        if (markers && this.upgrade_costs !== false) {
            const up_text = () => {
                let text = gettext('games_cidle_machine_upgrade');
                if (this.can_upgrade) text += `{color:rainbow} ▲`;

                return text;
            };
            content.push([{
                content: [() => up_text()],
                width: 2,
                click: [() => {
                    const contents = this.#upgrade_pane_contents();
                    const pane_id = contents.id;
                    let p = Pane.pane(pane_id);
                    if (p) {
                        p.remove();
                        return;
                    }

                    p = new Pane(contents);
                }],
            }]);
        }

        return {x, y, id: pane_id, content, title: this.name};
    }

    /**
     * @param {MouseEvent} event
     * @returns {{
     *  x: number,
     *  y: number,
     *  pinned?: boolean,
     *  id: string,
     *  content?: {
     *      content: (string|() => string)[],
     *      click?: (() => void)[],
     *      width?: number,
     *  }[][],
     *  title?: string|false,
     *  tab?: GameTab
     * }?}
     */
    #upgrade_pane_contents() {
        const costs = this.upgrade_costs;
        if (costs === false) return null;

        const id = this.index == -1 ? this.id : this.index;
        const pane_id = `${globals.game_tab}_maker_${id}_upgrade_pane`;
        const title = gettext('games_cidle_machine_upgrading', {obj: this.name});
        const mult = this.#level_formula(this.level + 1) / this.#level_formula(this.level);
        /** @type {{content: string[], click?: (() => void)[], width?: number}[][]} */
        const content = [
            [{
                content: [gettext('games_cidle_machine_upgrade_costs') + ' {color:rainbow}▲'.repeat(this.can_upgrade)],
                click: [() => this.upgrade()],
            }],
            ...costs.map(([res, cost]) => {
                const {color, background_color, name, picture: image} = Resource.resource(res);
                const cost_func = () => {
                    const {amount} = StorageMachine.stored_resource(res);
                    const can_afford = amount >= cost;
                    let cost_color;
                    if (can_afford) cost_color = theme('machine_upgrade_can_afford_fill');
                    else cost_color = theme('machine_upgrade_cant_afford_fill');

                    const amount_str = can_afford ? '' : (beautify(amount).padEnd(8)+' /');

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
            [{content: [gettext('games_cidle_machine_changes')]}],
            ...Object.entries(this.#resources).map(([res, {max}]) => {
                const {color, background_color, name, picture: image} = Resource.resource(res);
                const c_max = this.resources[res].max;

                return [{
                    content: [`{color:${color}}${name}`],
                    color: background_color,
                    image,
                }, {
                    content: [`{color:${color}}${beautify(c_max)} ⇒ ${beautify(c_max * mult)}`],
                    color: background_color,
                }];
            }),
        ];

        let x, y;
        const own_id = this.panecontents().id;
        const own_pane = Pane.pane(own_id);
        if (own_pane) {
            x = own_pane.x + own_pane.table_widths().reduce((s, w) => s + w, 0);
            y = own_pane.y;
        } else {
            x = this.x + this.radius;
            y = this.y - this.radius;
        }

        return {x, y, id: pane_id, content, title};
    }

    /** @param {MouseEvent} event */
    click(event) {
        if (event.shiftKey) {
            super.click(event);
            return;
        }

        const contents = this.panecontents({event});
        const pane_id = contents.id;
        let p = Pane.pane(pane_id);
        if (p) {
            p.remove();
            return;
        }

        p = new Pane(contents);
    }

    /**
     * @param {Object} params
     * @param {CanvasRenderingContext2D} [params.context]
     * @param {number?} [params.x] Override for the x position
     * @param {number?} [params.y] Override for the y position
     * @param {boolean} [params.markers]
     * @param {boolean} [params.transparent]
     * @param {FillType} [params.fillstyle]
     * - Fraction fills at percentile of storage (`amount/max`)
     * - Logarithm fills at percentile of logarithm storage (`log(amount)/log(max)`)
     * @param {FillMode} [params.fillmode]
     * - Circle fills a cirle that grows bigger
     * - Transparency fills the whole part in a more and more visible way
     * - Clockwise and counterclockwise fill a circle from 0 or to 0
     */
    draw({context=canvas_context, x=null, y=null, transparent=false, markers=true, fillstyle=this.filltype, fillmode=this.fillmode}={}) {
        if (x == null) {
            ({x} = this);
            if (x == null) return;
            x += display_size.width / 2 - globals.position[0];
        }
        if (y == null) {
            ({y} = this);
            if (y == null) return;
            y += display_size.height / 2 - globals.position[1];
        }
        const {radius} = this;

        if (transparent) context.globalAlpha = .5;

        context.save();
        context.fillStyle = theme('storage_color_fill');
        context.beginPath();
        context.arc(x, y, radius, 0, 2 * Math.PI);
        if (this.image) {
            context.clip();
            context.drawImage(this.image, x - radius, y - radius, radius * 2, radius * 2);
        } else {
            context.fill();
        }
        context.closePath();
        context.restore();

        if (this.moving && !transparent) context.setLineDash([5]);
        context.lineWidth = 1.5;

        // Partial fill for resources
        const keys = Object.keys(this.resources).sort();
        const length = keys.length;
        for (let i = 0; i < length; i++) {
            const res_id = keys[i];
            const {amount, max} = this.resources[res_id];
            const resource = Resource.resource(res_id);
            /** @type {HTMLImageElement|false} */
            const image = this.image ?? resource.fill_image ?? false;
            const mode = resource.fillmode ?? fillmode;

            /**
             * Number between 0 and 1 (both inclusive) that determines
             * the part filled
             */
            let fill = (filltypes[fillstyle] ?? filltypes.default).fill(amount, max);
            const start_angle = 2 * i / length * Math.PI - Math.PI / 2;
            const end_angle = 2 * (i + 1) / length * Math.PI - Math.PI / 2;
            /** @type {[keyof context, any[]][]} */
            const funcs = [];
            switch (mode) {
                case 'circle':
                default:
                    funcs.push(
                        ['moveTo', [x, y]],
                        ['arc', [x, y, radius * fill, start_angle, end_angle]],
                        ['lineTo', [x, y]],
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
                        ['moveTo', [x, y]],
                        ['arc', [x, y, radius, clock_start, clock_end]],
                        ['lineTo', [x, y]],
                    );
                    break;
                case 'transparency':
                    const transparency_alpha = context.globalAlpha * fill;
                    funcs.push(
                        ['globalAlpha', [transparency_alpha]],
                        ['moveTo', [x, y]],
                        ['arc', [x, y, radius, start_angle, end_angle]],
                        ['lineTo', [x, y]],
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
                        ['moveTo', [x, y]],
                        ...rhombus_points.map(([px, py]) => ['lineTo', [px, py]]),
                        ['lineTo', [x, y]],
                    );
                    break;
            }

            context.save();
            context.fillStyle = resource.color;
            context.beginPath();
            funcs.forEach(([func, args]) => {
                if (!(func in context)) return;
                if (typeof context[func] == 'function') {
                    context[func](...args);
                } else {
                    context[func] = args[0];
                }
            });
            if (image) {
                context.clip();
                context.drawImage(image, x - radius, y - radius, radius * 2, radius * 2);
            } else {
                context.fill();
            }
            context.closePath();
            context.restore();

            context.strokeStyle = resource.border_color;
            context.beginPath();
            context.arc(x, y, radius, start_angle, end_angle);
            context.stroke();
            context.closePath();
        }

        context.lineWidth = 1;
        if (this.moving) context.setLineDash([]);

        if (markers) {
            if (this.can_upgrade) {
                const color = theme('machine_upgrade_can_afford_fill');
                canvas_write(`▲`, x + radius, y - radius, {text_align: 'right', base_text_color: color});
            }
            if (this.level > 0) {
                const color = theme('machine_level_star_fill');
                canvas_write(`{color:${color}}` + this.#level_text, x - radius, y, {base_text_color: color, font_size: theme('font_size') / 1.25});
            }
        }

        if (transparent) context.globalAlpha = 1;
    }

    /**
     * @param {Object} [parts]
     * @param {number?} [parts.x]
     * @param {number?} [parts.y]
     * @param {string?} [parts.name]
     * @param {number?} [parts.level]
     * @param {string|HTMLImageElement?} [parts.image]
     * @param {boolean} [parts.insert]
     * @param {{[id: string]: {amount?: number, max?: number}}?} [parts.resources]
     * @param {((level: number) => number)?} [parts.level_formula]
     * @param {[string, number][][]|((level: number) => [string, number][]|false|null)?} [params.upgrade_costs]
     * @param {FillType} [params.filltype]
     * @param {FillMode} [params.fillmode]
     * @param {boolean} [parts.empty]
     */
    clone({x, y, name, level, resources, image, insert=true, level_formula, upgrade_costs, filltype, fillmode, empty=false} = {}) {
        x ??= this.x;
        y ??= this.y;
        image ??= this.image;
        name ??= this.name;
        level ??= this.level;
        resources = Object.fromEntries(Object.entries(this.#resources).map(([res, data]) => {
            const ndata = resources?.[res] ?? {};

            if (empty) ndata.amount = 0;
            else ndata.amount ??= data.amount;
            ndata.max ??= data.max;
            return [res, ndata];
        }));
        level_formula ??= this.#level_formula;
        filltype ??= this.#filltype;
        upgrade_costs ??= this.#upgrade_costs;
        fillmode ??= this.#fillmode;
        const id = this.id;
        return new StorageMachine({id, x, y, name, level, resources, image, insert, level_formula, filltype, fillmode, upgrade_costs});
    }

    /**
     * Upgrades the machine
     */
    upgrade() {
        const upgrade_cost = this.upgrade_costs;

        if (upgrade_cost === false) return;

        let can_upgrade = upgrade_cost.every(([res, cost]) => {
            StorageMachine.storages_for(res).forEach(m => {
                if (cost <= 0) return;

                cost -= m.resources[res].amount;
            });

            return cost <= 0;
        });

        if (!can_upgrade) return;

        upgrade_cost.every(([res, cost]) => {
            StorageMachine.storages_for(res)
                .sort((a, b) => distance(this, a) - distance(this, b))
                .forEach(m => {
                    if (cost <= 0) return;

                    let loss = Math.min(cost, m.resources[res].amount);
                    m.resources[res].amount -= loss;
                    cost -= loss;
                });
        });
        const up_pane = this.#upgrade_pane_contents();
        let up_p = Pane.pane(up_pane.id);
        if (up_p) up_p.remove();
        this.level++;
        if (this.upgrade_costs) {
            const {x, y} = up_p;
            const up_pane = this.#upgrade_pane_contents();
            up_p = new Pane(up_pane);
            up_p.x = x;
            up_p.y = y;
        }
        const pane = this.panecontents();
        let p = Pane.pane(pane.id);
        if (p) {
            const {x, y} = p;
            this.click({shiftKey: false});
            this.click({shiftKey: false});
            p = Pane.pane(pane.id);
            p.x = x;
            p.y = y;
        }
    }

    /**
     * @param {number} [x]
     * @param {number} [y]
     * @returns {[keyof CanvasRenderingContext2D, any[]][]}
     */
    border_path(x=this.x, y=this.y) {
        const {radius} = this;
        return [['arc', [x, y, radius+1, -Math.PI / 2, 1.5 * Math.PI]]];
    }
}
export default StorageMachine;

/**
 * Checks if a string is a filltype
 *
 * @param {string} type
 * @returns {type is FillType}
 */
function is_fill_type(type) {
    return type in filltypes;
}
/**
 * Checks if a string is a fillmode
 *
 * @param {string} mode
 * @returns {mode is FillMode}
 */
export function is_fill_mode(mode) {
    return ['circle', 'clockwise', 'counterclockwise', 'transparency', 'image', 'rhombus', 'linear'].includes(mode);
}

/**
 * Current space boost
 *
 * Maximum storage is multiplied by 1 + total_fill_ratio * storages
 *
 * @returns {number}
 */
export function space_boost() {
    const space_storages = StorageMachine.storages_for('space');
    let multiplier = 1;

    if (space_storages.length) {
        const space = StorageMachine.stored_resource('space');
        multiplier += space.amount / space.max * space_storages.length;
    }

    return multiplier;
}

export function make_storages() {
    /**
     * @type {{
     *  id?: string,
     *  name?: string,
     *  image?: string|HTMLImageElement,
     *  level?: number,
     *  resources?: {[id: string]: {amount?: number, max?: number}},
     *  level_formula?: (level: number) => number,
     *  upgrade_costs?: [string, number][][]|((level: number) => [string, number][]|false|null)?,
     *  filltype?: FillType,
     *  fillmode?: FillMode,
     * }[]}
     */
    const storages = [
        {
            id: 'wood_storage',
            name: gettext('games_cidle_storage_wood_storage'),
            resources: {
                wood: {},
            },
            upgrade_costs: (level) => {
                if (level == 0) {
                    if (StorageMachine.any_storage_for('brick')) return [['brick', 10]];
                    return null;
                }
                return false;
            },
        },
        {
            id: 'stone_storage',
            name: gettext('games_cidle_storage_stone_storage'),
            resources: {
                stone: {},
            },
            upgrade_costs: (level) => {
                if (level == 0) {
                    if (StorageMachine.any_storage_for('copper')) return [['copper', 10]];
                    return null;
                }
                return false;
            },
        },
        {
            id: 'fire_pit',
            name: gettext('games_cidle_storage_fire_pit'),
            resources: {
                fire: {max: 250},
            },
            upgrade_costs: (level) => {
                if (level == 0) {
                    if (StorageMachine.any_storage_for('brick')) return [['brick', 100]];
                    return null;
                } else if (level == 1) {
                    if (StorageMachine.any_storage_for('glass')) return [['glass', 100]];
                    return null;
                }
                return false;
            },
        },
        {
            id: 'brick_pile',
            name: gettext('games_cidle_storage_brick_pile'),
            resources: {
                brick: {max: 512},
            },
            upgrade_costs: (level) => {
                if (level == 0) {
                    if (StorageMachine.any_storage_for('copper')) return [['copper', 30]];
                    return null;
                }
                return false;
            },
        },
        {
            id: 'gravel_box',
            name: gettext('games_cidle_storage_gravel_box'),
            resources: {
                gravel: {},
            },
        },
        {
            id: 'water_bucket',
            name: gettext('games_cidle_storage_water_bucket'),
            resources: {
                water: {}
            },
            upgrade_costs: (level) => {
                if (level == 0) {
                    if (StorageMachine.any_storage_for('copper')) return [['copper', 15]];
                    return null;
                }
                return false;
            },
            fillmode: 'linear',
        },
        {
            id: 'ore_crate',
            name: gettext('games_cidle_storage_ore_crate'),
            resources: {
                ore: {max: 100},
            },
            upgrade_costs: (level) => {
                if (level == 0) {
                    if (StorageMachine.any_storage_for('copper')) return [['copper', 75]];
                    return null;
                }
                return false;
            },
        },
        {
            id: 'sand_box',
            name: gettext('games_cidle_storage_sand_box'),
            resources: {
                sand: {},
            },
        },
        {
            id: 'copper_crate',
            name: gettext('games_cidle_storage_copper_crate'),
            resources: {
                copper: {max: 100},
            },
        },
        {
            id: 'tin_crate',
            name: gettext('games_cidle_storage_tin_crate'),
            resources: {
                tin: {max: 50},
            },
        },
        {
            id: 'glass_container',
            name: gettext('games_cidle_storage_glass_container'),
            resources: {
                glass: {},
            },
        },
        // Time storages
        {
            id: 'giant_clock',
            name: gettext('games_cidle_storage_giant_clock'),
            resources: {
                time: {max: 60 * 60},
            },
            fillmode: 'clockwise',
        },
        // Space storages
        {
            id: 'galactic_container',
            name: gettext('games_cidle_storage_galactic_container'),
            resources: {
                space: {max: 1e3},
            },
            fillmode: 'transparency',
        },
    ];

    storages.forEach(s => new StorageMachine(s));
}
export function insert_storages() {
    // Makes sure there is no double storage
    if (StorageMachine.storage_machines.filter(m => m.x != null && m.y != null).length) return;

    /**
     * @type {[string, {
     *  x: number,
     *  y: number,
     *  name?: string,
     *  level?: number,
     *  insert?: boolean,
     *  image?: string|HTMLImageElement,
     *  resources?: {[id: string]: {amount?: number, max?: number}},
     *  level_formula?: (level: number) => number,
     *  empty?: boolean,
     *  filltype?: FillType,
     * }][]}
     */
    const storages = [
        ['wood_storage', {x:0, y:0}],
    ];

    storages.forEach(([id, parts]) => {
        Machine.get_machine_copy(id, parts);
    });
}
