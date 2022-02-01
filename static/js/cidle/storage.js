import { context as canvas_context, display_size } from './canvas.js';
import { get_theme_value as theme } from './display.js';
import globals from './globals.js';
import Machine from './machine.js';
import { Pane } from './pane.js';
import { coords_distance } from './position.js';
import Resource from './resource.js';
import { beautify } from './primitives.js';
/**
 * @typedef {import('./position.js').PointLike} PointLike
 */

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
     * @param {[string, number][][]|((level: number) => [string, number][]|false)?} [params.upgrade_costs]
     */
    constructor({
        id = null, x = null, y = null, name = null, level = 0, image = null, insert = true,
        resources = {}, level_formula = l => l+1, upgrade_costs=[],
    }) {
        if (typeof resources != 'object') throw new TypeError(`Storage machine resources must be an object (${resources})`);
        if (typeof level_formula != 'function') throw new TypeError(`Storage machine level_formula must be a function (${level_formula})`);
        if (typeof upgrade_costs == 'function');
        else if (!Array.isArray(upgrade_costs) || upgrade_costs.some(row => row.some(([r, a]) => typeof r != 'string' || typeof a != 'number'))) throw new TypeError(`Maker machine upgrade_costs must be an array of arrays of [resources,numbers] (${upgrade_costs})`);

        super({id, x, y, name, level, image, insert});

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

    /** @type {{[id: string]: {amount: number, max: number}}} */
    get resources() {
        if (this.#resources_leveled === false) {
            this.#resources_leveled = Object.fromEntries(Object.entries(this.#resources).map(([res, data]) => {
                const d = {
                    get amount() { return data.amount; },
                    set amount(amount) { data.amount = amount; },
                    max: data.max * this.#level_formula(this.level),
                };
                return [res, d];
            }));
        }

        return this.#resources_leveled;
    }
    get is_visible() {
        let {x, y} = this;
        if (x == null || y == null) return false;

        x += display_size.width / 2 - globals.position[0];
        y += display_size.height / 2 - globals.position[1];

        const min_x = x - this.radius;
        const max_x = x + this.radius;
        const min_y = y - this.radius;
        const max_y = y + this.radius;

        return (min_x < display_size.width || max_x > 0) && (min_y < display_size.height || max_y > 0);
    }
    get radius() { return 25; }
    get level() { return super.level; }
    set level(level) {
        if (!isNaN(level)) {
            this.#resources_leveled = false;
            this.#upgrade_costs_leveled = null;
            super.level = level;
        }
    }
    /** @type {[string, number][]|false} */
    get upgrade_costs() {
        if (this.#upgrade_costs_leveled == null) {
            if (typeof this.#upgrade_costs == 'function') this.#upgrade_costs_leveled = this.#upgrade_costs(this.level);
            else if (!(this.level in this.#upgrade_costs)) this.#upgrade_costs_leveled = false;
            else this.#upgrade_costs_leveled = this.#upgrade_costs[this.level].map(v => [...v]);
        }

        return this.#upgrade_costs_leveled;
    }

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
        let dist = coords_distance(this, point);

        return dist <= this.radius ** 2;
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
    panecontents(event) {
        const pane_id = `${globals.game_tab}_storage_${this.index}_pane`;
        /**
         * @type {{
         *  content: (string|() => string)[],
         *  click?: (() => void)[],
         *  width?: number,
         * }[][]}
         */
        const content = [
            [{
                content: [gettext('cidle_storage_contents')],
            }],
            ...Object.entries(this.resources).map(([res, data]) => {
                const resource = Resource.resource(res);
                const get_amount = () => {
                    let amount = beautify(data.amount);
                    if (isFinite(data.max)) {
                        amount += ` / ${beautify(data.max)}`;
                    }
                    return `{color:${resource.color}}${amount}`;
                };

                return [{
                    content: [`{color:${resource.color}}${resource.name}`],
                }, {
                    content: [get_amount],
                }];
            }),
        ];
        const x = this.x + this.radius;
        const y = this.y - this.radius;
        if (this.upgrade_costs !== false) {
            content.push([{content: ['upgrade'], width: 2, click: [() => this.upgrade()]}]);
            content.push(...this.upgrade_costs.map(([res, cost]) => {
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
            }));
        }

        return {x, y, id: pane_id, content, title: this.name};
    }

    /** @param {MouseEvent} event */
    click(event) {
        const contents = this.panecontents(event);
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
     * @param {'fraction'|'logarithm'} [params.fillstyle]
     * - Fraction fills at percentile of storage (`amount/max`)
     * - Logarithm fills at percentile of logarithm storage (`log(amount)/log(max)`)
     */
    draw({context=canvas_context, x=null, y=null, fillstyle='fraction'}={}) {
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

        if (this.image) {
            context.drawImage(this.image, x - this.radius, y - this.radius, this.radius * 2, this.radius * 2);
        } else {
            context.fillStyle = theme('storage_color_fill');
            context.beginPath();
            context.arc(x, y, this.radius, 0, 2 * Math.PI);
            context.fill();
            context.closePath();

            // Partial fill for resources
            const keys = Object.keys(this.resources);
            const length = keys.length;
            for (let i = 0; i < length; i++) {
                const res_id = keys[i];
                const {amount, max} = this.resources[res_id];
                const resource = Resource.resource(res_id);

                let fill = 0;
                switch (fillstyle) {
                    case 'logarithm':
                        fill = Math.log(amount) / Math.log(max);
                        break;
                    case 'fraction':
                    default:
                        fill = amount / max;
                        break;
                }

                fill = Math.max(0, Math.min(1, fill));
                const start = 2 * i / length * Math.PI;
                const end = 2 * (i + 1) / length * Math.PI;

                context.fillStyle = resource.color;
                context.strokeStyle = resource.color;
                context.beginPath();
                context.moveTo(x, y);
                context.arc(x, y, this.radius * fill, start, end);
                context.lineTo(x, y);
                context.fill();
                context.stroke();
                context.closePath();
            }

            context.strokeStyle = theme('storage_color_border');
            context.beginPath();
            context.arc(x, y, this.radius, 0, 2 * Math.PI);
            context.stroke();
            context.closePath();
        }
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
     * @param {boolean} [parts.empty]
     */
    clone({x, y, name, level, resources, image, insert=true, level_formula, empty=false} = {}) {
        x ??= this.x;
        y ??= this.y;
        image ??= this.image;
        name ??= this.name;
        level ??= this.level;
        resources ??= Object.fromEntries(Object.entries(this.resources).map(([res, data]) => {
            let {amount, max} = data;
            if (empty) amount = 0;
            return [res, {amount, max}];
        }));
        level_formula ??= this.#level_formula;
        const id = this.id;
        return new StorageMachine({id, x, y, name, level, resources, image, insert, level_formula});
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
        this.level++;
        const pane_id = `storage_${this.id}_pane`;
        let p = Pane.pane(pane_id);
        if (p) {
            this.click();
            this.click();
        }
    }
}
export default StorageMachine;

export function make_storages() {
    /**
     * @type {{
     *  id?: string,
     *  name?: string,
     *  image?: string|HTMLImageElement,
     *  level?: number,
     *  resources?: {[id: string]: {amount?: number, max?: number}},
     *  level_formula?: (level: number) => number,
     *  upgrade_costs?: [string, number][][]|((level: number) => [string, number][]|false)?,
     * }[]}
     */
    const storages = [
        {
            id: 'wood_storage',
            name: gettext('games_cidle_storage_wood_storage'),
            resources: {
                wood: {},
            },
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
     *  empty?: boolean
     * }][]}
     */
    const storages = [
        ['wood_storage', {x:0, y:0}],
    ];

    storages.forEach(([id, parts]) => {
        Machine.get_machine_copy(id, parts);
    });
}
