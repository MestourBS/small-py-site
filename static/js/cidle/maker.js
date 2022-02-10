import { context as canvas_context, display_size, canvas_write } from './canvas.js';
import globals from './globals.js';
import Machine from './machine.js';
import { angle_to_rhombus_point, coords_distance as distance, line_crosses_rectangle, parallel_perpendicular, rect_contains_point, to_point } from './position.js';
import { StorageMachine } from './storage.js';
import Resource from './resource.js';
import { get_theme_value as theme } from './display.js';
import { Pane } from './pane.js';
import { array_group_by, beautify, number_between, stable_pad_number } from './primitives.js';
/**
 * @typedef {import('./position.js').PointLike} PointLike
 *
 * @typedef {'fixed'|'scaling'} MakerType
 */

//todo move production to a single all consuming / producing function
//todo draw production/consumption amounts for scaling
//todo prevent flickering connections
//todo add move button to pane
//todo faster arrows based on time speed
//todo include global tabs heights in is_visible
//todo? multiple recipes
//todo? switchable recipes
//todo? luck-based recipes

const pause_text = {
    'true': gettext('games_cidle_maker_paused'),
    'false': gettext('games_cidle_maker_unpaused'),
};
const type_text = {
    'fixed': gettext('games_cidle_maker_type_fixed'),
    'scaling': gettext('games_cidle_maker_type_scaling'),
};

export class MakerMachine extends Machine {
    /** @type {MakerMachine[]} */
    static #maker_machines = [];
    /** @type {MakerMachine[]} */
    static get maker_machines() {
        // Allows children classes to access it themselves
        if (this != MakerMachine) return MakerMachine.maker_machines;

        return [...this.#maker_machines];
    }

    /**
     * Tries to see if hidden makers can become visible
     */
    static unhide_makers() {
        if (this != MakerMachine) {
            MakerMachine.unhide_makers();
            return;
        }

        this.#maker_machines.filter(m => typeof m.#hidden == 'function').forEach(m => m.hidden);
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
     * @param {boolean|() => boolean} [params.hidden]
     * @param {MakerType[]|(level: number) => MakerType} [params.type]
     * @param {boolean} [params.paused]
     * @param {boolean} [params.unpausable]
     * @param {[string, number][][]|((level: number) => [string, number][])?} [params.consumes]
     * @param {[string, number, boolean?][][]|((level: number) => [string, number, boolean?][])?} [params.produces]
     * @param {[string, number][][]|((level: number) => [string, number][])?} [params.requires]
     * @param {[string, number][][]|((level: number) => [string, number][]|false|null)?} [params.upgrade_costs]
     * @param {number?} [params.max_level]
     */
    constructor({
        id = null, x = null, y = null, name = null, level = 0, image = null, insert = true,
        hidden=false, type=['fixed'], paused=false, unpausable=false,
        consumes=[], produces=[], requires=[], upgrade_costs=[], max_level=null,
    }) {
        if (typeof consumes == 'function');
        else if (!Array.isArray(consumes) || consumes.some(row => row.some(([r, a]) => typeof r != 'string' || typeof a != 'number'))) throw new TypeError(`Maker machine consumes must be an array of arrays of [resources,numbers] (${consumes})`);
        if (typeof produces == 'function');
        else if (!Array.isArray(produces) || produces.some(row => row.some(([r, a]) => typeof r != 'string' || typeof a != 'number'))) throw new TypeError(`Maker machine produces must be an array of arrays of [resources,numbers] (${produces})`);
        if (typeof requires == 'function');
        else if (!Array.isArray(requires) || requires.some(row => row.some(([r, a]) => typeof r != 'string' || typeof a != 'number'))) throw new TypeError(`Maker machine requires must be an array of arrays of [resources,numbers] (${requires})`);
        if (typeof upgrade_costs == 'function');
        else if (!Array.isArray(upgrade_costs) || upgrade_costs.some(row => row.some(([r, a]) => typeof r != 'string' || typeof a != 'number'))) throw new TypeError(`Maker machine upgrade_costs must be an array of arrays of [resources,numbers] (${upgrade_costs})`);
        if (typeof type == 'function');
        else if (type.some(t => !['fixed', 'scaling'].includes(t))) throw new TypeError(`Maker machine type must be an array of fixed or scaling (${type})`);
        if (isNaN(max_level)) throw new TypeError(`Maker machine max level must be a number (${max_level})`);

        if (max_level == null) {
            /** @type {number[]} */
            const levels = [];
            if (Array.isArray(consumes)) levels.push(consumes.length);
            if (Array.isArray(produces)) levels.push(produces.length);
            if (Array.isArray(requires)) levels.push(requires.length);
            if (Array.isArray(upgrade_costs)) levels.push(upgrade_costs.length);
            if (Array.isArray(type)) levels.push(type.length);
            if (levels.length) {
                max_level = Math.min(...levels);
            } else {
                max_level = 0;
            }
        }

        super({id, x, y, name, level, image, insert});

        if (Array.isArray(requires)) requires.forEach(req => req.sort(([ares, areq], [bres, breq]) => {
            if (ares != bres) {
                return ares > bres;
            }
            return areq - breq;
        }));
        if (Array.isArray(consumes)) consumes.forEach(con => con.sort(([ares, acon], [bres, bcon]) => {
            if (ares != bres) {
                return ares > bres;
            }
            return acon - bcon;
        }));
        if (Array.isArray(produces)) produces.forEach(pro => pro.sort(([ares, apro], [bres, brpo]) => {
            if (ares != bres) {
                return ares > bres;
            }
            return apro - brpo;
        }));

        this.#consumes = consumes;
        this.#produces = produces;
        this.#requires = requires;
        this.#upgrade_costs = upgrade_costs;
        this.#hidden = typeof hidden == 'function' ? hidden : !!hidden;
        this.#type = type;
        this.#paused = !!paused;
        this.#unpausable = !!unpausable;
        this.#max_level = max_level;

        if (x != null && y != null && insert) {
            MakerMachine.#maker_machines.push(this);
            if (this.is_visible) {
                Machine.visible_machines.push(this);
            }
        }
    }

    #consumes;
    #produces;
    #requires;
    #last_multiplier = 1;
    #hidden;
    #type;
    #paused;
    #unpausable;
    #upgrade_costs;
    /** @type {null|false|[string, number][]} */
    #upgrade_costs_leveled = null;
    /** @type {null|[string, number][]} */
    #consumes_leveled = null;
    /** @type {null|[string, number, boolean?][]} */
    #produces_leveled = null;
    /** @type {null|[string, number][]} */
    #requires_leveled = null;
    /** @type {null|MakerType} */
    #type_leveled = null;
    #max_level = 0;
    /** @type {null|boolean} */
    #can_upgrade = null;

    /** @type {[string, number][]} */
    get consumes() {
        if (this.#consumes_leveled == null) {
            if (typeof this.#consumes == 'function') this.#consumes_leveled = this.#consumes(this.level);
            else if (!(this.level in this.#consumes)) this.#consumes_leveled = [];
            else this.#consumes_leveled = this.#consumes[this.level].map(v => [...v]);
        }
        return this.#consumes_leveled;
    }
    /** @type {[string, number, boolean?][]} */
    get produces() {
        if (this.#produces_leveled == null) {
            if (typeof this.#produces == 'function') this.#produces_leveled = this.#produces(this.level);
            else if (!(this.level in this.#produces)) this.#produces_leveled = [];
            else this.#produces_leveled = this.#produces[this.level].map(v => [...v]);
        }
        return this.#produces_leveled;
    }
    /** @type {[string, number][]} */
    get requires() {
        if (this.#requires_leveled == null) {
            if (typeof this.#requires == 'function') this.#requires_leveled = this.#requires(this.level);
            else if (!(this.level in this.#requires)) this.#requires_leveled = [];
            else this.#requires_leveled = this.#requires[this.level].map(v => [...v]);
        }
        return this.#requires_leveled;
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
    get is_visible() {
        if (this.hidden) return false;

        let {x, y, radius} = this;
        if (x == null || y == null) return false;
        const {position} = globals;
        const {width, height} = display_size;

        x += width / 2 - position[0];
        y += height / 2 - position[1];

        const min_x = -radius;
        const min_y = -radius;
        const max_x = min_x + width + radius * 2;
        const max_y = min_y + height + radius * 2;

        return rect_contains_point([x, y], min_x, max_x, min_y, max_y);
    }
    get radius() { return 25; }
    get hidden() {
        if (typeof this.#hidden == 'function') {
            if (!this.#hidden()) {
                this.#hidden = false;
                Machine.visible_machines.push(this);
            }
            else return true;
        }
        return this.#hidden;
    }
    get type() {
        if (this.#type_leveled == null) {
            if (typeof this.#type == 'function') this.#type_leveled = this.#type(this.level);
            else if (!(this.level in this.#type)) this.#type_leveled = 'fixed';
            else this.#type_leveled = this.#type[this.level];
        }
        return this.#type_leveled;
    }
    get paused() { return this.#paused && !this.#unpausable; }
    get max_level() { return this.#max_level; }
    get level() { return super.level; }
    set level(level) {
        if (!isNaN(level)) {
            super.level = Math.min(this.max_level, level);
            this.#upgrade_costs_leveled = null;
            this.#consumes_leveled = null;
            this.#produces_leveled = null;
            this.#requires_leveled = null;
            this.#type_leveled = null;
        }
    }
    get can_upgrade() {
        if (this.#can_upgrade == null) {
            if (!this.upgrade_costs) this.#can_upgrade = this.#upgrade_costs_leveled;
            else this.#can_upgrade = this.upgrade_costs.every(([res, cost]) => {
                const {amount} = StorageMachine.stored_resource(res);
                return cost <= amount;
            }) || null;
        }
        return this.#can_upgrade ?? false;
    }
    set can_upgrade(can) {
        if (!can) this.#can_upgrade = null;
        else this.#can_upgrade = true;
    }
    get unpausable() { return this.#unpausable; }

    toJSON() {
        /** @type {{hidden?: boolean, paused: boolean}} */
        const obj = {
            hidden: this.#hidden,
            paused: this.#paused,
        };
        if (typeof obj.hidden == 'function') delete obj.hidden;

        return Object.assign(super.toJSON(), obj);
    }

    destroy() {
        let i = MakerMachine.#maker_machines.indexOf(this);
        while (i != -1) {
            MakerMachine.#maker_machines.splice(i, 1);
            i = MakerMachine.#maker_machines.indexOf(this);
        }
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
    insert({x, y}) {
        let i = MakerMachine.#maker_machines.indexOf(this);
        if (i == -1) MakerMachine.#maker_machines.push(this);

        super.insert({x, y});
    }

    /**
     * Calculates the target storages for operations
     *
     * Storages are sorted from nearest to furthest and filtered in different keys
     *
     * - `from`: All storages from which resources are consumed, not available if `group_relations=false`
     * - `to`: All storages to which resources are given, not available if `group_relations=false`
     * - `with`: All storages which have required resources, not available if `group_relations=false`
     * - `<resource>.machines`: All storages which have something to do with the resource, not available if `group_resources=false`
     *
     * Each resource can also have a boolean which says whether its related conditions (required, consumed, produced) can be fullfilled
     *
     * @param {Object} params
     * @param {number} [params.multiplier] Speed multiplier
     *
     * @param {boolean} [params.require] Whether the required part must be computed
     * @param {boolean} [params.consume] Whether the consumed part must be computed
     * @param {boolean} [params.produce] Whether the produced part must be computed
     *
     * @param {boolean} [params.group_resources] Whether the machines must be grouped by resources
     * @param {boolean} [params.group_relations] Whether the machines must be grouped by relations
     *
     * @returns {{
     *  from?: StorageMachine[],
     *  to?: StorageMachine[],
     *  with?: StorageMachine[],
     *  [resource: string]: {
     *      machines?: StorageMachine[],
     *      from?: StorageMachine[],
     *      to?: StorageMachine[],
     *      with?: StorageMachine[],
     *      require_met?: boolean,
     *      can_consume?: boolean,
     *      can_produce?: boolean,
     *  },
     * }}
     */
    #target_storages({
        multiplier=this.#last_multiplier,
        require=true, consume=true, produce=true,
        group_resources=true, group_relations=true,
    }={}) {
        if (!require && !consume && !produce) return {};

        /**
         * @type {{
         *  from: StorageMachine[],
         *  to: StorageMachine[],
         *  with: StorageMachine[],
         *  [resource: string]: {
         *      machines: StorageMachine[],
         *      from?: StorageMachine[],
         *      to?: StorageMachine[],
         *      with?: StorageMachine[],
         *      require_met?: boolean,
         *      can_consume?: boolean,
         *      can_produce?: boolean,
         *  }
         * }}
         */
        const results = {};
        this.#last_multiplier = multiplier;
        multiplier *= this.max_produce_multiplier();

        if (require) {
            if (group_relations) results.with = [];

            this.requires.forEach(([res, req]) => {
                /**
                 * @type {{
                 *  machines?: StorageMachine[],
                 *  with?: StorageMachine[],
                 *  require_met?: boolean,
                 * }}
                 */
                const result = (results[res] ??= {});
                if (group_resources) result.machines ??= [];
                if (group_relations) result.with = [];
                StorageMachine.storages_for(res)
                    .sort((a, b) => distance(this, a) - distance(this, b))
                    .forEach(m => {
                        if (req <= 0 || m.resources[res].amount <= 1e-6) return;

                        if (group_resources && !result.machines.includes(m)) result.machines.push(m);
                        req -= m.resources[res].amount;
                        if (group_relations) {
                            results.with.push(m);
                            result.with.push(m);
                        }
                    });
                result.require_met = req <= 0;
            });
        }
        if (consume) {
            if (group_relations) results.from = [];

            this.consumes.forEach(([res, con]) => {
                con *= multiplier;
                /**
                 * @type {{
                 *  machines?: StorageMachine[],
                 *  from?: StorageMachine[],
                 *  can_consume?: boolean,
                 * }}
                 */
                const result = (results[res] ??= {});
                if (group_resources) result.machines ??= [];
                if (group_relations) result.from = [];

                StorageMachine.storages_for(res)
                    .sort((a, b) => distance(this, a) - distance(this, b))
                    .forEach(m => {
                        if (m.resources[res].amount <= 1e-6) return;
                        const insert =  con > 0 || this.type == 'scaling';
                        if (con > 0) {
                            if (group_resources && !result.machines.includes(m)) result.machines.push(m);
                            con -= m.resources[res].amount;
                        }

                        if (insert) {
                            if (group_relations) {
                                results.from.push(m);
                                result.from.push(m);
                            }
                            if (group_resources && !result.machines.includes(m)) {
                                result.machines.push(m);
                            }
                        }
                    });
                result.can_consume = con <= 0;
            });
        }
        if (produce) {
            if (group_relations) results.to = [];

            this.produces.forEach(([res, pro, optional=false]) => {
                pro *= multiplier;

                /**
                 * @type {{
                 *  machines?: StorageMachine[],
                 *  to?: StorageMachine[],
                 *  can_produce?: boolean,
                 * }}
                 */
                const result = (results[res] ??= {});
                if (group_resources) result.machines ??= [];
                if (group_relations) result.to = [];

                StorageMachine.storages_for(res)
                    .sort((a, b) => distance(this, a) - distance(this, b))
                    .forEach(m => {
                        const space = m.resources[res].max - m.resources[res].amount;
                        if (pro <= 0 || space <= 1e-6) return;

                        if (group_resources && !result.machines.includes(m)) result.machines.push(m);
                        pro -= space;
                        if (group_relations) {
                            results.to.push(m);
                            result.to.push(m);
                        }
                    });
                result.can_produce = pro <= 0 || optional;
            });
        }

        return results;
    }

    /**
     * Computes the maximum multiplier for a scaling maker
     */
    max_produce_multiplier() {
        if (this.type == 'fixed') return 1;

        /** @type {number[]} */
        const multipliers = [];
        const {consumes, produces, requires} = this;

        if (consumes.length) {
            multipliers.push(...consumes.map(([res, con]) => {
                let total = 0;
                StorageMachine.storages_for(res)
                    .forEach(m => {
                        total += m.resources[res].amount;
                    });
                return total / con;
            }));
        }
        if (requires.length) {
            multipliers.push(...requires.map(([res, req]) => {
                let total = 0;
                StorageMachine.storages_for(res)
                    .forEach(m => {
                        total += m.resources[res].amount;
                    });
                return total / req;
            }));
        }
        if (produces.length) {
            const split = array_group_by(produces, ([,,optional=false]) => optional);
            const required = split['false'];
            const optional = split['true'];
            multipliers.push(
                required.map(([res, pro]) => {
                    let total = 0;
                    StorageMachine.storages_for(res)
                        .forEach(m => {
                            const data = m.resources[res];
                            const space = data.max - data.amount;

                            total += space;
                        });
                    return total / pro;
                })
            );

            if (!multipliers.length) {
                multipliers.push(
                    optional.map(([res, pro]) => {
                        let total = 0;
                        StorageMachine.storages_for(res)
                            .forEach(m => {
                                const data = m.resources[res];
                                const space = data.max - data.amount;

                                total += space;
                            });
                        return total / pro;
                    })
                );
            }
        }

        if (!multipliers.length) {
            return 0;
        } else {
            return Math.min(...multipliers);
        }
    }

    /** @param {PointLike} point */
    contains_point(point) {
        point = to_point(point);

        const a = this.radius;
        const b = this.radius;
        const x = Math.abs(point.x - this.x);
        const y = Math.abs(point.y - this.y);

        return (x / a) + (y / b) <= 1;
    }

    /** @param {MouseEvent} event */
    contextmenu(event) { this.pause_toggle(); }

    /**
     * @param {Object} [params]
     * @param {MouseEvent} [params.event]
     * @param {boolean} [params.upgrade_marker]
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
    panecontents({event=null, upgrade_marker=true}={}) {
        const id = this.index == -1 ? this.id : this.index;
        const pane_id = `${globals.game_tab}_maker_${id}_pane`;
        /** @type {{content: string[], click?: (() => void)[], width?: number}[][]} */
        const content = [];
        if (this.#unpausable) {
            content.push([{content: [gettext('games_cidle_maker_unpausable')], width: 2}]);
        } else {
            content.push([{
                content: [() => pause_text[this.paused]],
                width: 2,
                click: [() => this.pause_toggle()],
            }])
        }
        /** @type {string|() => string} */
        let type_content;
        if (this.type == 'fixed') type_content = type_text['fixed'];
        else type_content = (() => `${type_text['scaling']} (x${beautify(this.max_produce_multiplier())})`);
        content.unshift([{content: [type_content]}]);
        if (this.requires.length) {
            content.push([{content: [gettext('games_cidle_maker_requires')], width: 2}]);
            content.push(...this.requires.map(([res, req]) => {
                const {color, name, background_color, image} = Resource.resource(res);
                return [{
                    content: [`{color:${color}}${name}`],
                    color: background_color,
                    image,
                }, {
                    content: [`{color:${color}}${beautify(req)}`],
                    color: background_color,
                }];
            }));
        }
        if (this.consumes.length) {
            content.push([{content: [gettext('games_cidle_maker_consumes')], width: 2}]);
            content.push(...this.consumes.map(([res, con]) => {
                const {color, name, background_color, image} = Resource.resource(res);
                return [{
                    content: [`{color:${color}}${name}`],
                    color: background_color,
                    image,
                }, {
                    content: [`{color:${color}}${beautify(-con)}/s`],
                    color: background_color,
                }];
            }));
        }
        if (this.produces.length) {
            content.push([{content: [gettext('games_cidle_maker_produces')], width: 2}]);
            content.push(...this.produces.map(([res, pro, optional=false]) => {
                const {color, name, background_color, image} = Resource.resource(res);
                let production = `{color:${color}}`;
                if (optional) {
                    production += '0-';
                }
                production += `${beautify(pro)}/s`;
                return [{
                    content: [`{color:${color}}${name}`],
                    color: background_color,
                    image,
                }, {
                    content: [production],
                    color: background_color,
                }];
            }));
        }
        if (upgrade_marker && this.upgrade_costs !== false) {
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
        const x = this.x + this.radius;
        const y = this.y - this.radius;

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
        /** @type {{content: string[], click?: (() => void)[], width?: number}[][]} */
        const content = [
            [{
                content: [gettext('games_cidle_machine_upgrade_costs') + ' {color:rainbow}▲'.repeat(this.can_upgrade)],
                click: [() => this.upgrade()],
            }],
            ...costs.map(([res, cost]) => {
                const {color, name, background_color, image} = Resource.resource(res);
                const cost_func = () => {
                    const {amount} = StorageMachine.stored_resource(res);
                    const can_afford = amount >= cost;
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
            [{content: [gettext('games_cidle_machine_changes')]}],
        ];
        const next_level = this.level + 1;

        // Type change
        const type_cur = this.type;
        const type_next = Array.isArray(this.#type) ? (this.#type[next_level] ?? 'fixed') : this.#type(next_level);
        if (type_cur != type_next) content.push([{
            content: [`${type_cur} ⇒ ${type_next}`],
        }]);

        // Requirement changes
        const req_cur = this.requires;
        const req_next = Array.isArray(this.#requires) ? (this.#requires[next_level] ?? []) : this.#requires(next_level);
        const req_diff = (req_cur.length || req_next.length) && (req_cur.length != req_next.length || req_cur.some(([cres, creq], i) => {
            let [nres, nreq] = req_next[i];

            return nres != cres || nreq != creq;
        }));
        if (req_diff) {
            const obj_cur = Object.fromEntries(req_cur);
            const obj_next = Object.fromEntries(req_next);
            const resources = new Set(req_cur.map(([res]) => res));
            req_next.forEach(([res]) => resources.add(res));
            resources.forEach(res => {
                const creq = obj_cur[res] ?? 0;
                const nreq = obj_next[res] ?? 0;
                if (creq == nreq) return;

                const {color, name, background_color, image} = Resource.resource(res);
                const change_color = theme(creq > nreq ? 'machine_upgrade_lower_req_fill' : 'machine_upgrade_higher_req_fill');

                const text = `{color:${color}}${beautify(creq)} ⇒ {color:${change_color}}${beautify(nreq)}`;

                content.push([{
                    content: [`{color:${color}}${name}`],
                    color: background_color,
                    image,
                }, {
                    content: [text],
                    color: background_color,
                }]);
            });
        }

        // Consumption changes
        const con_cur = this.consumes;
        const con_next = Array.isArray(this.#consumes) ? (this.#consumes[next_level] ?? []) : this.#consumes(next_level);
        const con_diff = (con_cur.length || con_next.length) && (con_cur.length != con_next.length || con_cur.some(([cres, ccon], i) => {
            let [nres, ncon] = con_next[i];

            return nres != cres || ccon != ncon;
        }));
        if (con_diff) {
            const obj_cur = Object.fromEntries(con_cur);
            const obj_next = Object.fromEntries(con_next);
            const resources = new Set(con_cur.map(([res]) => res));
            con_next.forEach(([res]) => resources.add(res));
            resources.forEach(res => {
                const ccon = obj_cur[res] ?? 0;
                const ncon = obj_next[res] ?? 0;
                if (ccon == ncon) return;

                const {color, name, background_color, image} = Resource.resource(res);
                const change_color = theme(ccon > ncon ? 'machine_upgrade_lower_con_fill' : 'machine_upgrade_higher_con_fill');

                const text = `{color:${color}}${beautify(-ccon)}/s ⇒ {color:${change_color}}${beautify(-ncon)}/s`;

                content.push([{
                    content: [`{color:${color}}${name}`],
                    color: background_color,
                    image,
                }, {
                    content: [text],
                    color: background_color,
                }]);
            });
        }

        // Production changes
        const pro_cur = this.produces;
        const pro_next = Array.isArray(this.#produces) ? (this.#produces[next_level] ?? []) : this.#produces(next_level);
        const pro_diff = (pro_cur.length || pro_next.length) && (pro_cur.length != pro_next.length || pro_cur.some(([cres, cpro], i) => {
            let [nres, npro] = pro_next[i];

            return nres != cres || npro != cpro;
        }));
        if (pro_diff) {
            /** @type {{[res: string]: [number, boolean]}} */
            const obj_cur = Object.fromEntries(pro_cur.map(([r, p, o=false]) => [r, [p, o]]));
            /** @type {{[res: string]: [number, boolean]}} */
            const obj_next = Object.fromEntries(pro_next.map(([r, p, o=false]) => [r, [p, o]]));
            const resources = new Set(pro_cur.map(([res]) => res));
            pro_next.forEach(([res]) => resources.add(res));
            resources.forEach(res => {
                let [cpro=0, copt=false] = obj_cur[res] ?? [0, false];
                let [npro=0, nopt=false] = obj_next[res] ?? [0, false];
                if (cpro == npro) return;

                const {color, name, background_color, image} = Resource.resource(res);
                const change_color = theme(cpro > npro ? 'machine_upgrade_lower_pro_fill' : 'machine_upgrade_higher_pro_fill');

                cpro = '0-'.repeat(copt) + beautify(cpro);
                npro = '0-'.repeat(nopt) + beautify(npro);

                const text = `{color:${color}}${cpro}/s ⇒ {color:${change_color}}${npro}/s`;

                content.push([{
                    content: [`{color:${color}}${name}`],
                    color: background_color,
                    image,
                }, {
                    content: [text],
                    color: background_color,
                }]);
            });
        }

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
     * @param {Object} [params]
     * @param {CanvasRenderingContext2D} [params.context]
     * @param {number?} [params.x] Override for the x position
     * @param {number?} [params.y] Override for the y position
     * @param {boolean} [params.transparent]
     * @param {boolean} [params.upgrade_marker]
     */
    draw({context=canvas_context, x=null, y=null, transparent=false, upgrade_marker=true}={}) {
        if (this.hidden) return;

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

        if (transparent) context.globalAlpha = .5;

        context.lineWidth = 1.5 * (this.#unpausable + 1);
        if (this.moving && !transparent) context.setLineDash([5]);

        context.save();
        context.fillStyle = theme('maker_color_fill');
        context.beginPath();
        context.moveTo(x - this.radius, y);
        context.lineTo(x, y - this.radius);
        context.lineTo(x + this.radius, y);
        context.lineTo(x, y + this.radius);
        context.lineTo(x - this.radius, y);
        if (this.image) {
            context.clip();
            context.drawImage(this.image, x - this.radius, y - this.radius, this.radius * 2, this.radius * 2);
        } else {
            context.fill();
        }
        context.closePath();
        context.restore();

        const res_arr = [...this.consumes, ...this.produces, ...this.requires].map(([s]) => s).sort();
        let i = 0;
        const corners = [0, 1, 2].map(n => n / 2 * Math.PI);
        new Set(res_arr).forEach(res => {
            const count = res_arr.filter(r => r == res).length;
            const {border_color} = Resource.resource(res);

            const start_angle = 2 * i / res_arr.length * Math.PI - Math.PI / 2;
            const end_angle = 2 * (i + count) / res_arr.length * Math.PI - Math.PI / 2;

            /** @type {(angle: number) => [number, number]} */
            const angle_to_point = angle => {
                let [px, py] = angle_to_rhombus_point(angle);
                px = px * this.radius + x;
                py = py * this.radius + y;
                return [px, py];
            };

            /** @type {[number, number][]} */
            const points = [
                angle_to_point(start_angle),
                ...corners.filter(c => number_between(c, start_angle, end_angle)).map(c => angle_to_point(c)),
                angle_to_point(end_angle),
            ];

            context.strokeStyle = border_color;
            context.beginPath();
            points.forEach(([x, y]) => {
                context.lineTo(x, y);
            });
            context.stroke();
            context.closePath();

            i += count;
        });

        // Resets line to prevent problems with other lines
        context.setLineDash([]);
        context.lineWidth = 1;

        if (this.paused) {
            context.fillStyle = theme('text_color_fill');
            context.beginPath();
            context.moveTo(x - this.radius / 10, y - this.radius * 2 / 5);
            context.lineTo(x - this.radius / 10, y + this.radius * 2 / 5);
            context.lineTo(x - this.radius * 3 / 10, y + this.radius * 2 / 5);
            context.lineTo(x - this.radius * 3 / 10, y - this.radius * 2 / 5);
            context.lineTo(x - this.radius / 10, y - this.radius * 2 / 5);
            context.fill();
            context.closePath();
            context.beginPath();
            context.moveTo(x + this.radius / 10, y - this.radius * 2 / 5);
            context.lineTo(x + this.radius / 10, y + this.radius * 2 / 5);
            context.lineTo(x + this.radius * 3 / 10, y + this.radius * 2 / 5);
            context.lineTo(x + this.radius * 3 / 10, y - this.radius * 2 / 5);
            context.lineTo(x + this.radius / 10, y - this.radius * 2 / 5);
            context.fill();
            context.closePath();
        }

        if (upgrade_marker && this.can_upgrade) {
            canvas_write('▲', x + this.radius, y, {text_align: 'right', base_text_color: theme('machine_upgrade_can_afford_fill')});
        }

        if (transparent) context.globalAlpha = 1;
    }

    /**
     * Draws the machine's connections, if they are visible
     */
    draw_connections({context=canvas_context, multiplier=this.#last_multiplier}) {
        if (this.hidden) return;
        if (this.paused) {
            context.setLineDash([10]);
        }

        const storages = this.#target_storages({multiplier});
        const all_visible = this.is_visible;
        /** @type {['from', 'to', 'with']} */
        const relations = ['from', 'to', 'with'];
        const machines = Array.from(new Set([...storages.from, ...storages.to, ...storages.with]));
        const offset_x = display_size.width / 2 - globals.position[0];
        const offset_y = display_size.height / 2 - globals.position[1];

        machines.forEach(machine => {
            // Check if line is visible if neither machines are visible
            if (!all_visible && !machine.is_visible) {
                const {width, height} = display_size;

                const r_x = -offset_x;
                const r_y = -offset_y;
                const r_w = width;
                const r_h = height;

                if (!line_crosses_rectangle([this, machine], r_x, r_y, r_w, r_h)) return;
            }

            /** @type {[string, 'from'|'to'|'with'][]} */
            const resources = Object.entries(storages)
                .filter(([res, val]) => !Array.isArray(val) && val.machines.includes(machine) && Resource.resource(res))
                .map(([res, val]) => [Resource.resource(res).color, relations.find(r => val[r]?.includes(machine))]);

            // Space out resources
            let dbr = 0;
            let d = 0;
            if (resources.length <= 0) return;
            else if (resources.length > 1) {
                dbr = this.radius / (resources.length - 1);
                if (resources.length < 3) d = -this.radius * 1.5;
                else d = -this.radius;
            }
            const parallels = parallel_perpendicular([this, machine]);

            // Draw lines
            resources.forEach(([color, rel]) => {
                let [pa, pb] = parallels(d += dbr);

                context.strokeStyle = color;
                context.beginPath();
                context.moveTo(pa.x + offset_x, pa.y + offset_y);
                context.lineTo(pb.x + offset_x, pb.y + offset_y);
                context.stroke();
                context.closePath();

                // Draw arrows if needed and they are within frame
                if (rel == 'with') return;

                if (rel == 'from') [pa, pb] = [pb, pa];

                const dist_x = pb.x - pa.x;
                const dist_y = pb.y - pa.y;
                let off_x = 2.5 * Math.sign(dist_x);
                let off_y = 2.5 * Math.sign(dist_y);
                if (!dist_x || !dist_y) {
                    off_x *= !!dist_x;
                    off_y *= !!dist_y;
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

                if (![tip, left, right].some(p => rect_contains_point(p, 0, display_size.width, 0, display_size.height))) return;

                if (!this.paused) {
                    const d = distance(pa, pb) ** .75;
                    const r = (Date.now() % d) / d - .5;
                    [tip, left, right].forEach(p => {
                        p[0] += r * dist_x;
                        p[1] += r * dist_y;
                    });
                }

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
        if (this.paused) {
            // Resets dashes to prevent problems with other lines
            context.setLineDash([]);
        }
    }

    /**
     * @param {Object} [params]
     * @param {number?} [params.x]
     * @param {number?} [params.y]
     * @param {string?} [params.name]
     * @param {number?} [params.level]
     * @param {string|HTMLImageElement?} [params.image]
     * @param {boolean?} [params.insert]
     * @param {boolean|(() => boolean)?} [params.hidden]
     * @param {boolean?} [params.unpausable]
     * @param {MakerType[]|((level: number) => MakerType)?} [params.type]
     * @param {boolean} [params.hidden]
     * @param {[string, number][][]|((level: number) => [string, number][]|false)?} [params.consumes]
     * @param {[string, number][][]|((level: number) => [string, number][]|false)?} [params.produces]
     * @param {[string, number][][]|((level: number) => [string, number][]|false)?} [params.requires]
     * @param {[string, number][][]|((level: number) => [string, number][]|false|null)?} [params.upgrade_costs]
     * @param {number?} [params.max_level]
     */
    clone({x, y, name, level, image, insert=true, unpausable, hidden, type, paused, consumes, produces, requires, upgrade_costs, max_level}={}) {
        x ??= this.x;
        y ??= this.y;
        name ??= this.name;
        level ??= this.level;
        hidden ??= this.#hidden;
        type ??= this.#type;
        consumes ??= this.#consumes;
        produces ??= this.#produces;
        requires ??= this.#requires;
        image ??= this.image;
        paused ??= this.paused;
        unpausable ??= this.#unpausable;
        upgrade_costs ??= this.#upgrade_costs;
        max_level ??= this.#max_level;
        const id = this.id;
        return new MakerMachine({id, x, y, name, level, hidden, type, paused, unpausable, consumes, produces, requires, image, insert, upgrade_costs, max_level});
    }

    /**
     * Checks whether the maker can produce things
     *
     * @param {Object} [params]
     * @param {number} [params.multiplier] Speed multiplier
     */
    can_produce({multiplier=this.#last_multiplier}={}) {
        if (this.x == null || this.y == null) return false;

        const storages = Object.entries(this.#target_storages({multiplier, group_resources: false, group_relations: false}));
        // Check if requirements are met
        const require_met = storages.filter(s => 'require_met' in s[1]).every(s => s[1].require_met);
        if (!require_met) return false;
        // Check if consumed resources are available
        const can_consume = storages.filter(s => 'can_consume' in s[1]).every(s => s[1].can_consume);
        if (!can_consume) return false;
        // Check if there is enough space for produced resources
        const can_produce = storages.filter(s => 'can_produce' in s[1]).every(s => s[1].can_produce);
        if (!can_produce) return false;

        return true;
    }

    /**
     * Consumes and produces things
     *
     * @param {Object} [params]
     * @param {number} [params.multiplier] Speed multiplier
     * @param {boolean} [params.overdo] Whether over producing and consuming is done
     */
    produce({multiplier=1, overdo=false}={}) {
        if (this.paused) {
            this.#last_multiplier = multiplier;
            return;
        }
        const {from, to} = this.#target_storages({multiplier, group_resources:false, require:false});

        // We can't do anything without a target
        if ((!from.length) != (!this.consumes.length) || (!to.length) != (!this.produces.length)) return;
        multiplier *= this.max_produce_multiplier();

        // Consume resources
        this.consumes.forEach(([res, con]) => {
            con *= multiplier;

            if (this.type == 'fixed') {
                from.forEach(machine => {
                    if (con <= 0 || !(res in machine.resources)) return;

                    const resobj = machine.resources[res];
                    const loss = Math.min(con, resobj.amount);

                    resobj.amount -= loss;
                    con -= loss;
                });

                if (con > 0 && overdo) {
                    // Not enough consumed, share the further loss with everything
                    const loss = con / from.length;
                    from.forEach(machine => {
                        const resobj = machine.resources[res];
                        resobj.amount -= loss;
                    });
                }
            } else if (this.type == 'scaling') {
                const cons = from.map(machine => machine.resources[res].amount);
                const sum_cons = cons.reduce((s, c) => s + c, 0);
                let ratio = 1 - con / sum_cons;
                if (ratio > 1) ratio = 1 / ratio;

                from.forEach(machine => {
                    const resobj = machine.resources[res];
                    resobj.amount *= ratio;
                });
            }
        });

        // Produce resources
        this.produces.forEach(([res, pro]) => {
            pro *= multiplier;

            to.forEach(machine => {
                if (pro <= 0 || !(res in machine.resources)) return;

                const resobj = machine.resources[res];
                const space = resobj.max - resobj.amount;
                const gain = Math.min(space, pro);

                resobj.amount += gain;
                pro -= gain;
            });

            if (pro > 0 && overdo) {
                // Not enough produced, share the further gains with everything
                const gain = pro / to.length;
                to.forEach(machine => {
                    const resobj = machine.resources[res];
                    resobj.amount += gain;
                });
            }
        });
    }

    /**
     * Pauses/unpauses the machine's production and consumption
     *
     * @param {Object} params
     * @param {boolean|'auto'} [params.set]
     */
    pause_toggle({set='auto'}={}) {
        if (set == 'auto') set = !this.#paused;

        this.#paused = set;
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
        Pane.pane(up_pane.id)?.remove?.();
        this.level++;
        const pane = this.panecontents();
        let p = Pane.pane(pane.id);
        if (p) {
            this.click({shiftKey: false});
            this.click({shiftKey: false});
        }
    }
}
export default MakerMachine;

setInterval(() => {
    MakerMachine.unhide_makers();
}, 15 * 1e3);

/**
 * Current time speed
 *
 * Each active time consumer multiplies time by `<total consumption> + 1`
 *
 * @returns {number}
 */
export function time_speed() {
    let multiplier = 1;

    MakerMachine.maker_machines
        .filter(m => !m.paused && m.consumes.some(([res]) => res == 'time') && m.can_produce())
        .forEach(m => {
            const time_lost = m.consumes
                .filter(([res]) => res == 'time')
                .map(([_, time]) => time)
                .reduce((a, b) => a + b, 0);
            multiplier *= time_lost ** 1.76 + m.max_produce_multiplier();
        });

    return multiplier;
}

export function make_makers() {
    /**
     * @type {{
     *  id?: string,
     *  name?: string,
     *  image?: string|HTMLImageElement,
     *  hidden?: boolean|() => boolean,
     *  unpausable?: boolean,
     *  max_level?: number,
     *  type?: MakerType[]|(level: number) => MakerType,
     *  consumes?: [string, number][][]|(level: number) => [string, number][],
     *  produces?: [string, number, boolean?][][]|(level: number) => [string, number, boolean?][],
     *  requires?: [string, number][][]|(level: number) => [string, number][],
     *  upgrade_costs?: [string, number][][]|(level: number) => [string, number][]|false|null,
     * }[]}
     */
    const makers = [
        {
            id: 'tree_chopper',
            name: gettext('games_cidle_maker_tree_chopper'),
            produces: (level) => [['wood', 2 ** level]],
            upgrade_costs: (level) => {
                if (level == 0) {
                    if (StorageMachine.any_storage_for('stone')) return [['stone', 100]];
                    return null;
                } else if (level == 1) {
                    if (StorageMachine.any_storage_for('copper')) return [['copper', 10]];
                    return null;
                } else if (level == 2) {
                    if (StorageMachine.any_storage_for('bronze')) return [['bronze', 20]];
                    return null;
                } else if (level == 3) {
                    if (StorageMachine.any_storage_for('magic')) return [['magic', 40]];
                    return null;
                }
                return false;
            },
            max_level: 4,
        },
        {
            id: 'stone_miner',
            name: gettext('games_cidle_maker_stone_miner'),
            produces: (level) => {
                const production = [['stone', 2.5 ** level]];

                if (level > 1) production.push(['copper', 2 ** (level - 2) / 1_000, true]);
                if (level > 2) production.push(['tin', 2 ** (level - 3) / 1_000, true]);

                return production;
            },
            upgrade_costs: (level) => {
                if (level == 0) {
                    if (StorageMachine.any_storage_for('brick')) return [['brick', 100]];
                    return null;
                } else if (level == 1) {
                    if (StorageMachine.any_storage_for('copper')) return [['copper', 25]];
                    return null;
                } else if (level == 2) {
                    if (StorageMachine.any_storage_for('bronze')) return [['bronze', 40]];
                    return null;
                } else if (level == 3) {
                    if (StorageMachine.any_storage_for('magic')) return [['magic', 60]];
                    return null;
                }
                return false;
            },
            max_level: 4,
        },
        {
            id: 'wood_burner',
            name: gettext('games_cidle_maker_wood_burner'),
            produces: (level) => [['fire', 1 + level * 2]],
            consumes: (level) => [['wood', 1 + level / 2]],
            upgrade_costs: (level) => {
                if (level == 0) {
                    if (StorageMachine.any_storage_for('brick')) return [['brick', 200]];
                    return null;
                } else if (level == 1) {
                    if (StorageMachine.any_storage_for('glass')) return [['glass', 200]];
                    return null;
                }
                return false;
            },
            max_level: 2,
        },
        {
            id: 'brick_furnace',
            name: gettext('games_cidle_maker_brick_furnace'),
            produces: [[['brick', 1]], [['brick', 2]]],
            consumes: [[['stone', 5], ['fire', 1]], [['stone', 5], ['fire', 1.5]]],
            upgrade_costs: (level) => {
                if (level == 0) {
                    if (StorageMachine.any_storage_for('glass')) return [['glass', 200]];
                    return null;
                }
                return false;
            },
            max_level: 1,
        },
        {
            id: 'rock_crusher',
            name: gettext('games_cidle_maker_rock_crusher'),
            produces: (level) => [['gravel', level + 1]],
            consumes: (level) => [['stone', level * .15 + .1]],
            upgrade_costs: (level) => {
                if (level == 0) {
                    if (StorageMachine.any_storage_for('bronze')) return [['bronze', 10]];
                    return null;
                } else if (level == 1) {
                    if (StorageMachine.any_storage_for('magic')) return [['magic', 27]];
                    return null;
                }
                return false;
            },
            max_level: 2,
        },
        {
            id: 'water_well',
            name: gettext('games_cidle_maker_water_well'),
            produces: (level) => [['water', level / 4 + .5]],
            upgrade_costs: (level) => {
                if (level == 0) {
                    if (StorageMachine.any_storage_for('copper')) return [['copper', 20]];
                    return null;
                } else if (level == 1) {
                    if (StorageMachine.any_storage_for('bronze')) return [['bronze', 35]];
                    return null;
                } else if (level == 2) {
                    if (StorageMachine.any_storage_for('aquamarine')) return [['aquamarine', 5]];
                    return null;
                } else if (level == 3) {
                    if (StorageMachine.any_storage_for('magic')) return [['magic', 15]];
                    return null;
                }
                return false;
            },
            max_level: 4,
        },
        {
            id: 'gravel_washer',
            name: gettext('games_cidle_maker_gravel_washer'),
            produces: (level) => {
                /** @type {[string, number, boolean?][]} */
                const production = [
                    ['copper', .1],
                    ['sand', .9, true],
                ];

                if (level > 0) {
                    // tin: .15, sand: .9 => 1, copper: .1 => .35
                    production.unshift(['tin', .15]);
                    production.find(([r]) => r == 'sand')[1] += .1;
                    production.find(([r]) => r == 'copper')[1] += .25;
                }
                if (level > 1) {
                    // tin: .15 => .25, sand: 1 => 1.5, copper: .25 => .5
                    production.find(([r]) => r == 'tin')[1] += .1;
                    production.find(([r]) => r == 'sand')[1] += .5;
                    production.find(([r]) => r == 'copper')[1] += .25;
                }

                return production;
            },
            consumes: (level) => [['water', 1], ['gravel', 1 + level / 2]],
            upgrade_costs: (level) => {
                if (level == 0) {
                    if (StorageMachine.any_storage_for('tin')) return [['gold', 20]];
                    return null;
                } else if (level == 1) {
                    if (StorageMachine.any_storage_for('aquamarine')) return [['aquamarine', 20]];
                    return null;
                }
                return false;
            },
            max_level: 2,
        },
        {
            id: 'gravel_crusher',
            name: gettext('games_cidle_maker_gravel_crusher'),
            produces: (level) => [['sand', .5 + level / 10]],
            consumes: (level) => [['gravel', 1]],
            upgrade_costs: (level) => {
                if (level == 0) {
                    if (StorageMachine.any_storage_for('magic')) return [['magic', 27]];
                    return null;
                }
                return false;
            },
            max_level: 1,
        },
        {
            id: 'glass_blower',
            name: gettext('games_cidle_maker_glass_blower'),
            produces: [[['glass', 1]], [['glass', 2]]],
            consumes: [[['sand', 1], ['fire', 3]], [['sand', 1], ['fire', 4]]],
            upgrade_costs: (level) => {
                if (level == 0) {
                    if (StorageMachine.any_storage_for('aquamrine')) return [['aquamrine', 10]];
                    return null;
                }
                return false;
            },
            max_level: 1,
        },
        {
            id: 'sand_washer',
            name: gettext('games_cidle_maker_sand_washer'),
            produces: (level) => {
                /** @type {[string, number, boolean?][]} */
                const production = [
                    ['gold', .1],
                ];

                if (level >= 1) {
                    // aquamarine: .1, gold: .1 => .15
                    production.push(['aquamarine', .1]);
                    production.find(([r]) => r == 'gold')[1] += .05;
                }
                if (level >= 2) {
                    // aquamarine: .1 => .15, gold: .15 => .25
                    production.find(([r]) => r == 'aquamarine')[1] += .05;
                    production.find(([r]) => r == 'gold')[1] += .1;
                }

                return production;
            },
            consumes: (level) => [['sand', 1], ['water', Math.log2(level+1)+1]],
            upgrade_costs: (level) => {
                if (level == 0) {
                    if (StorageMachine.any_storage_for('aquamarine')) return [['bronze', 50]];
                    return null;
                } else if (level == 1) {
                    if (StorageMachine.any_storage_for('magic')) return [['magic', 27]];
                    return null;
                }
                return false;
            },
            max_level: 2,
        },
        {
            id: 'bronze_foundry',
            name: gettext('games_cidle_maker_bronze_foundry'),
            produces: [[['bronze', 1]], [['bronze', 1.5]]],
            consumes: [[['copper', 2/3], ['tin', 1/3], ['fire', 5]], [['copper', 1], ['tin', .5], ['fire', 5]]],
            upgrade_costs: (level) => {
                if (level == 0) {
                    if (StorageMachine.any_storage_for('blazing_aquamarine')) return [['blazing_aquamarine', 5]];
                    return null;
                }
                return false;
            },
            max_level: 1,
        },
        {
            id: 'aquaburner',
            name: gettext('games_cidle_maker_aquaburner'),
            produces: [[['blazing_aquamarine', .025]]],
            consumes: [[['aquamarine', .025], ['fire', 5], ['water', 2.5]]],
        },
        {
            id: 'magic_collector',
            name: gettext('games_cidle_maker_magic_collector'),
            produces: (level) => [['magic', (level + 1) ** 2 / 100]],
            upgrade_costs: (level) => {
                if (level == 0) {
                    if (StorageMachine.any_storage_for('magic')) return [['magic', Math.random() * 7.5 + 2.5]];
                    return null;
                }
                return false;
            },
            max_level: 1,
        },
        {
            id: 'transmutation_circle',
            name: gettext('games_cidle_maker_transmutation_circle'),
            produces: (level) => {
                /** @type {[string, number, boolean?][]} */
                const production = [
                    ['copper', .1 + level / 10],
                ];

                if (level >= 1) {
                    production.push(['tin', level / 10]);
                }
                if (level >= 2) {
                    production.push(['bronze', level / 20 - .05], ['gold', level / 10 - .1]);
                }

                return production;
            },
            consumes: (level) => [['stone', level + 1], ['magic', level / 100 + .01]],
        },
        // Unpausable makers
        {
            id: 'fire_extinguisher',
            name: gettext('games_cidle_maker_fire_extinguisher'),
            requires: (level) => [['fire', 1e-1]],
            consumes: (level) => [['fire', Math.max(0, 10 - level) / 1e4]],
            type: (level) => 'scaling',
            upgrade_costs: (level) => {
                if (level == 0) {
                    if (StorageMachine.any_storage_for('magic')) return [['magic', 81]];
                    return null;
                }
                return false;
            },
            max_level: 1,
            unpausable: true,
            hidden: () => !StorageMachine.any_storage_for('fire'),
        },
        // Time machines
        {
            id: 'sundial',
            name: gettext('games_cidle_maker_sundial'),
            consumes: [[['time', 1]]],
        },
        {
            id: 'hourglass',
            name: gettext('games_cidle_maker_hourglass'),
            consumes: [[['time', 1.5]]],
        },
    ];

    makers.forEach(m => new MakerMachine(m));
}
export function insert_makers() {
    // Makes sure there is no double maker
    if (MakerMachine.maker_machines.filter(m => m.x != null && m.y != null).length) return;

    /**
     * @type {[string, {
     *  x: number,
     *  y: number,
     *  name?: string,
     *  level?: string,
     *  image?: string|HTMLImageElement,
     *  insert?: boolean,
     *  hidden?: boolean,
     *  type?: MakerType[]|(level: number) => MakerType,
     *  consumes?: [string, number][][]|(level: number) => [string, number][],
     *  produces?: [string, number, boolean?][][]|(level: number) => [string, number, boolean?][],
     *  requires?: [string, number][][]|(level: number) => [string, number][],
     * }][]}
     */
    const makers = [
        ['tree_chopper', {x: -100, y: 0}],
        ['fire_extinguisher', {x: 0, y: 100}],
    ];

    makers.forEach(([id, parts]) => {
        Machine.get_machine_copy(id, parts);
    });
}
