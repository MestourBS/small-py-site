import { get_theme_value as theme } from './display.js';
import globals from './globals.js';
import Machine, { pause_text } from './machine.js';
import { Pane } from './pane.js';
import { beautify, number_between } from './primitives.js';
import Resource from './resource.js';
/**
 * @typedef {import('./pane.js').PaneCell} PaneCell
 *
 * @typedef {'fixed'|'scaling'} RecipeType
 */

//todo refresh panes on color changes

const type_text = {
    'fixed': gettext('games_cidle_maker_type_fixed'),
    'scaling': gettext('games_cidle_maker_type_scaling'),
};

export class Recipe {
    /**
     * @param {Object} params
     * @param {string|string[]|(level: number, this: Recipe) => string} params.name
     * @param {number} params.max_level
     * @param {number} [params.level]
     * @param {boolean} [params.paused]
     * @param {boolean} [params.can_pause]
     * @param {RecipeType|RecipeType[]|(level: number, this: Recipe) => RecipeType} [params.type]
     * @param {[string, number, number?][][]|(level: number, this: Recipe) => [string, number, number?][]} [params.consumes] [resource, amount, requires=amount]
     * @param {[string, number, number, boolean?][][]|(level: number, this: Recipe) => [string, number, number, boolean?][]} [params.produces] [resource, amount, limit, optional=false]
     * @param {[string, number][][]|(level: number, this: Recipe) => [string, number][]} [params.upgrade_costs]
     */
    constructor({
        name, max_level,
        level=0,
        paused=false, can_pause=true,
        type=['fixed'], consumes=[], produces=[], upgrade_costs=[],
    }) {
        if (isNaN(level) || !isFinite(level)) throw new TypeError(`Recipe level must be a number (${level})`);
        if (isNaN(max_level) || !isFinite(max_level)) throw new TypeError(`Recipe max level must be a number (${max_level})`);
        if (typeof type != 'function' &&
            !is_recipe_type(type) &&
            (!Array.isArray(type) || type.some(t => !is_recipe_type(t))))
            throw new TypeError(`Recipe types must be valid recipe types (${type})`);
        if (typeof consumes != 'function' &&
            (!Array.isArray(consumes) || consumes.some(row => !Array.isArray(row) || row.some(cell => !Array.isArray(cell)))))
            throw new TypeError(`Recipe consumption must be a 2d array of [string, number, number?] (${consumes})`);
        if (typeof produces != 'function' &&
            (!Array.isArray(produces) || produces.some(row => !Array.isArray(row) || row.some(cell => !Array.isArray(cell)))))
            throw new TypeError(`Recipe production must be a 2d array of [string, number, number?] (${produces})`);
        if (typeof upgrade_costs != 'function' &&
            (!Array.isArray(upgrade_costs) || upgrade_costs.some(row => !Array.isArray(row) || row.some(cell => !Array.isArray(cell)))))
            throw new TypeError(`Recipe costs must be a 2d array of [string, number] (${upgrade_costs})`);

        this.#name = (typeof name == 'function' || Array.isArray(name)) ? name : name.toString();
        this.#max_level = max_level;
        this.#paused = !!paused;
        this.#can_pause = !!can_pause;
        this.#level = +level;
        this.#type = type;
        this.#consumes = consumes;
        this.#produces = produces;
        this.#upgrade_costs = upgrade_costs;
        this.#owner = Machine.machines.find(m => m.recipes.includes(this));

        this.cache_refresh();
    }

    #name;
    #max_level;
    #level;
    #paused;
    #can_pause;
    #type;
    /** [resource, amount, requires] */
    #consumes;
    /** [resource, amount, limit, optional] */
    #produces;
    /** [resource, cost] */
    #upgrade_costs;
    /** @type {Machine} */
    #owner;

    #cache = {
        /** @type {string} */
        name: '',
        /** @type {RecipeType} */
        type: 'fixed',
        /** @type {[string, number, number][]} [resource, consumed, requires] */
        consumes: [],
        /** @type {[string, number, number, boolean][]} [resource, consumed, max, optional] */
        produces: [],
        /** @type {[string, number][]} [resource, cost] */
        upgrade_costs: [],
        can_upgrade: false,
        /** @type {{[res: string]: Machine}} */
        targets: {},
    };

    get name() { return this.#cache.name; }
    get max_level() { return this.#max_level; }
    get level() { return this.#level; }
    set level(level) {
        if (!isNaN(level) && isFinite(level) && number_between(level, 0, this.#max_level)) {
            this.#level = level;

            this.cache_refresh();
        }
    }
    get paused() { return this.#paused; }
    set paused(paused) { this.#paused = paused && this.#can_pause; }
    get can_pause() { return this.#can_pause; }
    get type() { return this.#cache.type; }
    /** @type {[string, number, number][]} [resource, amount, requires] */
    get consumes() { return this.#cache.consumes.map(arr => [...arr]); }
    /** @type {[string, number, number, boolean][]} [resource, amount, limit, optiona] */
    get produces() { return this.#cache.produces.map(arr => [...arr]); }
    /** @type {[string, number][]} [resource, cost] */
    get upgrade_costs() { return this.#cache.upgrade_costs.map(arr => [...arr]); }
    get can_upgrade() { return this.#cache.can_upgrade; }
    /** @type {{[res: string]: Machine}} */
    get targets() { return Object.fromEntries(Object.entries(this.#cache.targets)); }
    get owner() {
        if (!this.#owner) this.#owner = Machine.machines.find(m => m.recipes.includes(this));
        return this.#owner;
    }

    toJSON() {
        return {
            level: this.#level,
            paused: this.#paused,
        };
    }
    /**
     * Loads data in the recipe
     *
     * @param {Object} [data]
     * @param {number} [data.level]
     * @param {boolean} [data.paused]
     */
    load(data={}) {
        if (!(data instanceof Object)) return;

        if ('level' in data) this.level = data.level;
        if ('paused' in data) this.paused = data.paused;

        this.cache_refresh();
    }
    /**
     * Refreshes the recipe's cache
     *
     * @param {Object} [params]
     * @param {boolean} [params.name]
     * @param {boolean} [params.type]
     * @param {boolean} [params.consumes]
     * @param {boolean} [params.produces]
     * @param {boolean} [params.upgrade_costs]
     * @param {boolean} [params.targets]
     * @param {boolean} [params.can_upgrade]
     */
    cache_refresh(
        {name, type, consumes, produces, upgrade_costs, targets, can_upgrade}=
        {name:true, type:true, consumes:true, produces:true, upgrade_costs:true, targets:true, can_upgrade:true}
    ) {
        const cache = this.#cache;
        const level = this.#level;

        if (name) {
            const name = this.#name;
            let cname = '';

            if (typeof name == 'function') cname = name.call(this, level);
            else if (Array.isArray(name)) cname = name[level] ?? gettext('games_cidle_recipe_unnamed');
            else cname = name;

            cache.name = cname;
        }

        if (type) {
            const type = this.#type;
            /** @type {RecipeType} */
            let ctype;

            if (typeof type == 'function') ctype = type.call(this, level);
            else if (Array.isArray(type) && level in type) ctype = type[level];
            else ctype = type;

            cache.type = ctype;
        }

        if (consumes) {
            const consumes = this.#consumes;
            /** @type {[string, number, number][]} */
            let ccon;

            if (typeof consumes == 'function') ccon = consumes.call(this, level) ?? [];
            else ccon = consumes[level] ?? [];
            ccon = ccon.map(([res, con, req=con]) => [res, con, req]);

            cache.consumes = ccon;
        }

        if (produces) {
            const produces = this.#produces;
            /** @type {[string, number, number, 0][]} */
            let cpro;

            if (typeof produces == 'function') cpro = produces.call(this, level) ?? [];
            else cpro = produces[level] ?? [];
            cpro = cpro.map(([res, pro, max, opt=false]) => [res, pro, max, opt]);
            cache.produces = cpro;
        }

        if (upgrade_costs) {
            const upgrade_costs = this.#upgrade_costs;
            /** @type {[string, number][]} */
            let cupg;

            if (typeof upgrade_costs == 'function') cupg = upgrade_costs.call(this, level) ?? [];
            else cupg = upgrade_costs[level] ?? [];

            cache.upgrade_costs = cupg;
        }

        if (can_upgrade) {
            const upgrade_costs = cache.upgrade_costs;
            cache.can_upgrade = this.#level < this.#max_level && upgrade_costs.every(([res, cost]) => {
                return Machine.storage_for(res)?.resources?.[res]?.amount >= cost;
            });
        }

        if (targets) {
            cache.targets = {};

            const resources = new Set([...cache.consumes.map(([res]) => res), ...cache.produces.map(([res]) => res)]);

            resources.forEach(res => {
                cache.targets[res] = Machine.storage_for(res);
            });
        }
    }
    /**
     * Computes the preview for the machine's pane
     *
     * @param {Object} params
     * @param {number} params.x X position for the recipe's pane (if opened)
     * @param {number} params.y Y position for the recipe's pane (if opened)
     * @returns {PaneCell[]}
     */
    pane_preview(params) {
        const {can_upgrade} = this.#cache;
        const max_level = this.#level >= this.#max_level;

        let border_color;
        if (can_upgrade) border_color = theme('machine_can_upgrade_color_border');
        else if (max_level) border_color = theme('machine_full_upgrades_color_border');
        else border_color = theme('machine_color_border');

        const pause_content = this.can_pause ? () => (this.paused ? '⏸' : '▶') : '';
        /** @type {PaneCell} */
        const pause_cell = {
            content: [pause_content],
            click: [() => this.toggle_pause()],
            border_color,
        };

        /** @type {PaneCell[]} */
        const row = [
            pause_cell,
            {
                content: [() => this.name],
                click: [() => {
                    const pane = this.pane_contents(params);
                    const {id} = pane;
                    let p = Pane.pane(id);
                    if (p) {
                        p.remove();
                    } else {
                        p = new Pane(this.pane_contents(params));
                    }
                }],
                width: 1 + max_level,
                border_color,
            },
        ];

        if (!max_level) {
            row.push({
                content: ['⇑'],
                click: [() => {
                    const up_pane = this.upgrade_pane_contents(params);
                    const {id} = up_pane;
                    let p = Pane.pane(id);
                    if (p) {
                        p.remove();
                    } else {
                        p = new Pane(up_pane);
                    }
                }],
                border_color,
            });
        }

        return row;
    }
    /**
     * Computes the recipe's pane's arguments
     *
     * @param {Object} params
     * @param {number} params.x X position for the recipe's pane (if opened)
     * @param {number} params.y Y position for the recipe's pane (if opened)
     * @returns {{
     *  id: string,
     *  x: number,
     *  y: number,
     *  content: PaneCell[][],
     *  title: string,
     *  tab: GameTab,
     *  border_color: string,
     * }}
     */
    pane_contents({x, y}) {
        const {can_upgrade} = this.#cache;
        const max_level = this.#level >= this.#max_level;
        const id = this.name.replace(/[^\w]+/g, '_');
        const title = this.name;
        const tab = globals.game_tab;

        /** @type {() => number} */
        const prod_mult = this.max_production_multiplier.bind(this);
        let border_color;
        if (can_upgrade) border_color = theme('machine_can_upgrade_color_border');
        else if (max_level) border_color = theme('machine_full_upgrades_color_border');
        else border_color = theme('machine_color_border');
        let type_content;
        if (this.type == 'fixed') type_content = type_text['fixed'];
        else if (this.type == 'scaling') type_content = () => {
            let text = `${type_text['scaling']}`;
            if (Math.abs(prod_mult() - 1) >= 1e-3) text += ` (x${beautify(prod_mult() ?? 1).padEnd(8)})`;
            return text;
        };
        const pause_content = this.can_pause ? () => pause_text[this.paused] : gettext('games_cidle_maker_unpausable');
        /** @type {PaneCell} */
        const pause_cell = {
            content: [pause_content],
            click: [() => {
                if (!this.can_pause) return;
                this.toggle_pause();
            }],
        };
        if (!this.can_pause) delete pause_cell.click;

        /** @type {PaneCell[][]} */
        const content = [
            [{
                content: [type_content],
            }],
            [pause_cell],
        ];

        if (this.consumes.length) content.push(...this.consumes.map(/** @returns {PaneCell[]} */([res, con, req]) => {
            const {name, color, background_color} = Resource.resource(res);
            const data = Machine.storage_for(res).resources[res];
            let consume;
            if (this.type == 'fixed') consume = `${beautify(-con)}/s`;
            else if (this.type == 'scaling') consume = () => {
                const mult = prod_mult() ?? 1;
                let scon = beautify(-con * mult);
                if (Math.abs(mult - 1) >= 1e-3) scon = `${scon.padEnd(8)} x(${beautify(mult).padEnd(8)})`;
                return `${scon}/s`;
            };
            let require;
            if (this.type == 'fixed') require = beautify(req);
            else if (this.type == 'scaling') require = () => {
                const mult = prod_mult() ?? 1;
                let sreq = beautify(req * mult);
                if (Math.abs(mult - 1) >= 1e-3) sreq = `${sreq.padEnd(8)} x(${beautify(mult).padEnd(8)})`;

                return ` / ${sreq}`;
            };

            return [
                {
                    content: [() => beautify(data.amount).padEnd(8), name],
                    background_color, text_color: color,
                },
                {
                    content: [consume, require],
                    background_color, text_color: color,
                },
            ];
        }));
        if (this.produces.length) content.push(...this.produces.map(/** @returns {PaneCell[]} */([res, pro, max, opt]) => {
            const {name, color, background_color} = Resource.resource(res);
            const data = Machine.storage_for(res).resources[res];
            const amount = () => {
                const mult = prod_mult() ?? 1;
                let spro = beautify(pro * mult);
                if (this.type == 'scaling' && Math.abs(mult - 1) >= 1e-3) spro = `${spro.padEnd(8)} x(${beautify(mult).padEnd(8)})`;
                if (opt) spro = `0-${spro}`;

                return `${spro}/s`;
            };

            return [
                {
                    content: [name, () => `${beautify(data.amount).padEnd(8)}/${beautify(max)}`],
                    background_color, text_color: color,
                },
                {
                    content: ['', amount],
                    background_color, text_color: color,
                },
            ];
        }));

        return {x, y, id, title, tab, content, border_color};
    }
    /**
     * Computes the recipe's upgrade pane's arguments
     *
     * @param {Object} params
     * @param {number} params.x X position for the recipe's pane (if opened)
     * @param {number} params.y Y position for the recipe's pane (if opened)
     * @returns {{
     *  id: string,
     *  x: number,
     *  y: number,
     *  content: PaneCell[][],
     *  title: string,
     *  tab: GameTab,
     *  border_color: string,
     * }}
     */
    upgrade_pane_contents({x, y}) {
        const {can_upgrade} = this.#cache;
        let border_color;
        if (can_upgrade) border_color = theme('machine_can_upgrade_color_border');
        else border_color = theme('machine_color_border');
        const id = `${this.name.replace(/[^\w]+/g, '_')}_upgrade`;
        const title = gettext('games_cidle_machine_upgrading', {obj: this.name});
        const tab = globals.game_tab;

        /** @type {PaneCell[][]} */
        const content = [
            [{
                content: [gettext('games_cidle_machine_upgrade')],
                click: [() => {
                    if (this.upgrade()) {
                        let p = Pane.pane(id);
                        if (p) p.remove();
                    }
                }],
            }],
        ];
        if (this.upgrade_costs.length) content.push(
            [{
                content: [gettext('games_cidle_machine_upgrade_costs')],
            }],
            ...this.upgrade_costs.map(/** @returns {PaneCell[]} */([res, cost]) => {
                const {name, color, background_color} = Resource.resource(res);
                const data = Machine.storage_for(res).resources[res];
                const amount = () => {
                    return `${beautify(data.amount).padEnd(8)}/${beautify(cost)}`;
                };
                return [
                    {
                        content: [name, () => beautify(data.amount).padEnd(8)],
                        background_color, text_color: color,
                    },
                    {
                        content: [amount],
                        background_color, text_color: color,
                    },
                ];
            }),
        );

        return {id, x, y, content, title, tab, border_color};
    }
    /**
     * Upgrades the pane
     *
     * @returns {boolean}
     */
    upgrade() {
        if (this.#level >= this.#max_level) return;

        this.cache_refresh({upgrade_costs: true, can_upgrade: true});
        const {can_upgrade, upgrade_costs} = this.#cache;

        if (!can_upgrade) return;

        upgrade_costs.forEach(([res, cost]) => {
            Machine.storage_for(res).resources[res].amount -= cost;
        });
        this.level++;
        this.cache_refresh();
        this.owner.cache_refresh({can_upgrade: true, connections: true, max_level: true, is_time_machine: true});

        // Refresh owner pane
        const o_pane = this.owner.pane_contents();
        const o_id = o_pane.id;
        const o_p = Pane.pane(o_id);
        if (o_p) {
            o_pane.x = o_p.x;
            o_pane.y = o_p.y;
            o_p.remove();
            new Pane(o_pane);
        }
        // Refresh own pane
        const pane = this.pane_contents({});
        const id = pane.id;
        const p = Pane.pane(id);
        if (p) {
            pane.x = p.x;
            pane.y = p.y;
            p.remove();
            new Pane(pane);
        }
        // Remove upgrade pane
        const up_pane = this.upgrade_pane_contents({});
        const up_id = up_pane.id;
        const up_p = Pane.pane(up_id);
        if (up_p) {
            up_pane.x = up_p.x;
            up_pane.y = up_p.y;
            up_p.remove();
        }
    }
    /**
     * Checks whether the recipe can produce things
     */
    can_produce() {
        /**
         * @type {{[res: string]: {
         *  best: number,
         *  amount: number,
         * }}}
         */
        const res_datas = {};
        /** @param {string} res */
        const get_res_data = res => res_datas[res] ??= Machine.storage_for(res).resources[res];
        return this.consumes.every(([res,,min]) => {
            return get_res_data(res).amount >= min;
        }) && this.produces.every(([res,,max,opt]) => {
            return opt || get_res_data(res).amount < max;
        });
    }
    /**
     * Consumes and produces things
     *
     * @param {Object} params
     * @param {number} params.multiplier Speed multiplier
     */
    produce({multiplier}) {
        multiplier *= this.max_production_multiplier();
        /**
         * @type {{[res: string]: {
         *  best: number,
         *  amount: number,
         * }}}
         */
        const res_datas = {};
        /** @param {string} res */
        const get_res_data = res => res_datas[res] ??= Machine.storage_for(res).resources[res];
        this.consumes.forEach(([res, con]) => {
            get_res_data(res).amount -= con * multiplier;
        });
        this.produces.forEach(([res, pro, max]) => {
            const data = get_res_data(res);
            if (data.amount < max) data.amount += pro * multiplier;
        });
    }
    /**
     * Computes the maximum multiplier for a scaling maker
     */
    max_production_multiplier() {
        if (this.type == 'fixed') return 1;

        const multipliers = [
            ...this.consumes.map(([res,,req]) => {
                const {amount} = Machine.storage_for(res).resources[res];
                if (req > amount) return 0;

                return amount / req;
            }),
            ...this.produces.filter(([,,,opt]) => !opt).map(([res, pro, max]) => {
                const {amount} = Machine.storage_for(res).resources[res];
                if (amount > max) return 0;

                return (max - amount) / pro;
            }),
        ];
        return multipliers.length ? Math.min(...multipliers) : 0;
    }
    /**
     * Pauses/unpauses the recipe's production and consumption
     *
     * @param {Object} params
     * @param {boolean|'auto'} [params.set]
     */
    toggle_pause({set='auto'}={}) {
        if (!this.#can_pause) return;

        if (set == 'auto') set = !this.#paused;

        this.paused = set;
    }
}
export default Recipe;

/**
 * Checks if type is a valid recipe type
 *
 * @param {string} type
 * @returns {type is RecipeType}
 */
function is_recipe_type(type) {
    return ['fixed', 'scaling'].includes(type.toString().toLowerCase());
}
