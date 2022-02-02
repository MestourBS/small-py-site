import { context as canvas_context, display_size } from './canvas.js';
import globals from './globals.js';
import Machine from './machine.js';
import { coords_distance as distance, parallel_perpendicular, rect_contains_point, to_point } from './position.js';
import { StorageMachine } from './storage.js';
import Resource from './resource.js';
import { get_theme_value as theme } from './display.js';
import { Pane } from './pane.js';
import { beautify } from './primitives.js';
/**
 * @typedef {import('./position.js').PointLike} PointLike
 */

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
     * @param {Object} params
     * @param {string?} [params.id]
     * @param {number?} [params.x]
     * @param {number?} [params.y]
     * @param {string?} [params.name]
     * @param {number?} [params.level]
     * @param {string|HTMLImageElement?} [params.image]
     * @param {boolean} [params.insert]
     * @param {boolean} [params.hidden]
     * @param {('fixed'|'scaling')[]} [params.type]
     * @param {boolean} [params.paused]
     * @param {[string, number][][]?} [params.consumes]
     * @param {[string, number][][]?} [params.produces]
     * @param {[string, number][][]?} [params.requires]
     * @param {[string, number][][]|((level: number) => [string, number][]|false)?} [params.upgrade_costs]
     */
    constructor({
        id = null, x = null, y = null, name = null, level = 0, image = null, insert = true,
        hidden=false, type=['fixed'], paused=false,
        consumes=[], produces=[], requires=[], upgrade_costs=[],
    }) {
        if (!Array.isArray(consumes) || consumes.some(row => row.some(([r, a]) => typeof r != 'string' || typeof a != 'number'))) throw new TypeError(`Maker machine consumes must be an array of arrays of [resources,numbers] (${consumes})`);
        if (!Array.isArray(produces) || produces.some(row => row.some(([r, a]) => typeof r != 'string' || typeof a != 'number'))) throw new TypeError(`Maker machine produces must be an array of arrays of [resources,numbers] (${produces})`);
        if (!Array.isArray(requires) || requires.some(row => row.some(([r, a]) => typeof r != 'string' || typeof a != 'number'))) throw new TypeError(`Maker machine requires must be an array of arrays of [resources,numbers] (${requires})`);
        if (typeof upgrade_costs == 'function');
        else if (!Array.isArray(upgrade_costs) || upgrade_costs.some(row => row.some(([r, a]) => typeof r != 'string' || typeof a != 'number'))) throw new TypeError(`Maker machine upgrade_costs must be an array of arrays of [resources,numbers] (${upgrade_costs})`);
        if (type.some(t => !['fixed', 'scaling'].includes(t))) throw new TypeError(`Maker machine type must be an array of fixed or scaling (${type})`);

        super({id, x, y, name, level, image, insert});

        this.#consumes = consumes;
        this.#produces = produces;
        this.#requires = requires;
        this.#upgrade_costs = upgrade_costs;
        this.#hidden = !!hidden;
        this.#type = type;
        this.#paused = paused;

        if (x != null && y != null && insert && this.is_visible) {
            MakerMachine.#maker_machines.push(this);
            Machine.visible_machines.push(this);
        }
    }

    #consumes;
    #produces;
    #requires;
    #last_multiplier = 1;
    #hidden;
    #type;
    #paused = false;
    #upgrade_costs;
    /** @type {null|false|[string, number][]} */
    #upgrade_costs_leveled = null;

    /** @type {[string, number][]} */
    get consumes() {
        if (!(this.level in this.#consumes)) return [];
        return this.#consumes[this.level].map(v => [...v]);
    }
    /** @type {[string, number][]} */
    get produces() {
        if (!(this.level in this.#produces)) return [];
        return this.#produces[this.level].map(v => [...v]);
    }
    /** @type {[string, number][]} */
    get requires() {
        if (!(this.level in this.#requires)) return [];
        return this.#requires[this.level].map(v => [...v]);
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
    get is_visible() {
        if (this.#hidden) return false;

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
    get hidden() { return this.#hidden; }
    get type() {
        if (this.level in this.#type) return this.#type[this.level];
        return 'fixed';
    }
    get paused() { return this.#paused; }
    get #max_level() { return Math.max(this.#type.length, this.#consumes.length, this.#produces.length, this.#requires.length) - 1; }
    get level() { return super.level; }
    set level(level) {
        if (!isNaN(level)) {
            super.level = Math.min(this.#max_level, level);
            this.#upgrade_costs_leveled = null;
        }
    }

    toJSON() {
        return Object.assign(super.toJSON(), {
            hidden: this.#hidden,
            paused: this.#paused,
        });
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
        multiplier *= this.#max_produce_multiplier();

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
                if (group_resources) result.machines = [];
                if (group_relations) result.with = [];
                StorageMachine.storages_for(res)
                    .sort((a, b) => distance(this, a) - distance(this, b))
                    .forEach(m => {
                        if (req <= 0 || m.resources[res].amount <= 0) return;

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
                if (group_resources) result.machines = [];
                if (group_relations) result.from = [];

                StorageMachine.storages_for(res)
                    .sort((a, b) => distance(this, a) - distance(this, b))
                    .forEach(m => {
                        if (con <= 0 || m.resources[res].amount <= 0) return;

                        if (group_resources && !result.machines.includes(m)) result.machines.push(m);
                        con -= m.resources[res].amount;
                        if (group_relations) {
                            results.from.push(m);
                            result.from.push(m);
                        }
                    });
                result.can_consume = con <= 0;
            });
        }
        if (produce) {
            if (group_relations) results.to = [];

            this.produces.forEach(([res, pro]) => {
                pro *= multiplier;
                /**
                 * @type {{
                 *  machines?: StorageMachine[],
                 *  to?: StorageMachine[],
                 *  can_produce?: boolean,
                 * }}
                 */
                const result = (results[res] ??= {});
                if (group_resources) result.machines = [];
                if (group_relations) result.to = [];

                StorageMachine.storages_for(res)
                    .sort((a, b) => distance(this, a) - distance(this, b))
                    .forEach(m => {
                        const space = m.resources[res].max - m.resources[res].amount;
                        if (pro <= 0 || space <= 0) return;

                        if (group_resources && !result.machines.includes(m)) result.machines.push(m);
                        pro -= space;
                        if (group_relations) {
                            results.to.push(m);
                            result.to.push(m);
                        }
                    });
                result.can_produce = pro <= 0;
            });
        }

        return results;
    }

    /**
     * Computes the maximum multiplier for a scaling maker
     */
    #max_produce_multiplier() {
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
        if (produces.length) {
            multipliers.push(...produces.map(([res, pro]) => {
                let total = 0;
                StorageMachine.storages_for(res)
                    .forEach(m => {
                        const data = m.resources[res];
                        const space = data.max - data.amount;

                        total += space;
                    });
                return total / pro;
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
        const id = this.index == -1 ? this.id : this.index;
        const pane_id = `${globals.game_tab}_maker_${id}_pane`;
        /** @type {{content: string[], click?: (() => void)[], width?: number}[][]} */
        const content = [];
        if (this.requires.length) {
            content.push([{content: [gettext('games_cidle_maker_requires')], width: 2}]);
            content.push(...this.requires.map(([res, req]) => {
                const resource = Resource.resource(res);
                return [{
                    content: [`{color:${resource.color}}${resource.name}`],
                }, {
                    content: [`{color:${resource.color}}${beautify(req)}`],
                }];
            }));
        }
        if (this.produces.length) {
            content.push([{content: [gettext('games_cidle_maker_produces')], width: 2}]);
            content.push(...this.produces.map(([res, pro]) => {
                const resource = Resource.resource(res);
                return [{
                    content: [`{color:${resource.color}}${resource.name}`],
                }, {
                    content: [`{color:${resource.color}}${beautify(pro)}/s`],
                }];
            }));
        }
        if (this.consumes.length) {
            content.push([{content: [gettext('games_cidle_maker_consumes')], width: 2}]);
            content.push(...this.consumes.map(([res, con]) => {
                const resource = Resource.resource(res);
                return [{
                    content: [`{color:${resource.color}}${resource.name}`],
                }, {
                    content: [`{color:${resource.color}}${beautify(con)}/s`],
                }];
            }));
        }
        if (this.upgrade_costs !== false) {
            content.push([{content: [gettext('games_cidle_maker_upgrade')], width: 2, click: [() => this.upgrade()]}]);
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
        const x = this.x + this.radius;
        const y = this.y - this.radius;

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
     * @param {Object} [params]
     * @param {CanvasRenderingContext2D} [params.context]
     * @param {number?} [params.x] Override for the x position
     * @param {number?} [params.y] Override for the y position
     */
    draw({context=canvas_context, x=null, y=null}={}) {
        if (this.#hidden) return;

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
            context.fillStyle = theme('maker_color_fill');
            context.strokeStyle = theme('maker_color_border');
            context.setLineDash([]);
            context.beginPath();
            context.moveTo(x - this.radius, y);
            context.lineTo(x, y - this.radius);
            context.lineTo(x + this.radius, y);
            context.lineTo(x, y + this.radius);
            context.lineTo(x - this.radius, y);
            context.fill();
            context.stroke();
            context.closePath();
        }

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
    }

    /**
     * Draws the machine's connections, if they are visible
     */
    draw_connections({context=canvas_context, multiplier=this.#last_multiplier}) {
        if (this.#hidden) return;
        if (this.#paused) {
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
                // Check if X is visible
                let [minx, maxx] = [this.x, machine.x];
                if (minx > maxx) [minx, maxx] = [maxx, minx];
                if (maxx > display_size.width) maxx = display_size.width;
                if (minx < 0) minx = 0;
                if (minx > maxx) return;

                // Check if Y is visible
                let miny = this.y;
                let maxy = machine.y;
                const dx = machine.x - this.x;
                if (Math.abs(dx) > 1e-7) {
                    let a = (machine.y - this.y) / dx;
                    let b = this.y - a * this.x;
                    miny = a * minx + b;
                    maxy = a * maxx + b;
                }
                if (miny > maxy) [miny, maxy] = [maxy, miny];
                if (maxy > display_size.height) maxy = display_size.height;
                if (miny < 0) miny = 0;
                if (miny > maxy) return;
            }

            /** @type {[string, 'from'|'to'|'with'][]} */
            const resources = Object.entries(storages)
                .filter(([res, val]) => !Array.isArray(val) && val.machines.includes(machine) && Resource.resource(res))
                .map(([res, val]) => [Resource.resource(res).color, relations.find(r => val[r]?.includes(machine))]);

            // Space out resources
            let dbr = 0;
            let d = 0;
            if (resources.length <= 0) return;
            if (resources.length > 1) {
                dbr = this.radius * 2 / (resources.length - 1);
                d = -this.radius * 3;
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
                /** @type {[number, number]} */
                const tip = [
                    (pa.x + pb.x) / 2 + 5 * Math.sign(dist_x),
                    (pa.y + pb.y) / 2 + 5 * Math.sign(dist_y),
                ];
                /** @type {[number, number]} */
                const left = parallels(d + 5).reduce((a, p) => [a[0] + p.x / 2, a[1] + p.y / 2], [0, 0]);
                /** @type {[number, number]} */
                const right = parallels(d - 5).reduce((a, p) => [a[0] + p.x / 2, a[1] + p.y / 2], [0, 0]);

                tip[0] += offset_x;
                left[0] += offset_x;
                right[0] += offset_x;
                tip[1] += offset_y;
                left[1] += offset_y;
                right[1] += offset_y;

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
        if (this.#paused) {
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
     * @param {boolean?} [params.hidden]
     * @param {('fixed'|'scaling')[]?} [params.type]
     * @param {boolean} [params.hidden]
     * @param {[string, number][][]?} [params.consumes]
     * @param {[string, number][][]?} [params.produces]
     * @param {[string, number][][]?} [params.requires]
     */
    clone({x, y, name, level, image, insert=true, hidden, type, paused, consumes, produces, requires}={}) {
        x ??= this.x;
        y ??= this.y;
        name ??= this.name;
        level ??= this.level;
        hidden ??= this.hidden;
        type ??= this.#type;
        consumes ??= this.#consumes;
        produces ??= this.#produces;
        requires ??= this.#requires;
        image ??= this.image;
        paused ??= this.paused;
        const id = this.id;
        return new MakerMachine({id, x, y, name, level, hidden, type, paused, consumes, produces, requires, image, insert});
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
        if (this.#paused) {
            this.#last_multiplier = multiplier;
            return;
        }
        const {from, to} = this.#target_storages({multiplier, group_resources:false, require:false});

        // We can't do anything without a target
        if ((!from.length) != (!this.consumes.length) || (!to.length) != (!this.produces.length)) return;
        multiplier *= this.#max_produce_multiplier();

        // Consume resources
        this.consumes.forEach(([res, con]) => {
            con *= multiplier;

            from.forEach(machine => {
                if (con <= 0) return;

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
        });

        // Produce resources
        this.produces.forEach(([res, pro]) => {
            pro *= multiplier;

            to.forEach(machine => {
                if (pro <= 0) return;

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
        this.level++;
        const pane_id = `maker_${this.id}_pane`;
        let p = Pane.pane(pane_id);
        if (p) {
            this.click();
            this.click();
        }
    }
}
export default MakerMachine;

export function make_makers() {
    /**
     * @type {{
     *  id?: string,
     *  name?: string,
     *  image?: string|HTMLImageElement,
     *  hidden?: boolean,
     *  type?: ('fixed'|'scaling')[],
     *  consumes?: [string, number][][],
     *  produces?: [string, number][][],
     *  requires?: [string, number][][],
     *  upgrade_costs?: [string, number][][]|(level: number) => [string, number][]|false,
     * }[]}
     */
    const makers = [
        {
            id: 'tree_chopper',
            name: gettext('games_cidle_maker_tree_chopper'),
            produces: [[['wood', 1]]],
        },
        {
            id: 'stone_miner',
            name: gettext('games_cidle_maker_stone_miner'),
            produces: [[['stone', 1]]],
        },
        {
            id: 'sundial',
            name: gettext('games_cidle_maker_sundial'),
            consumes: [[['time', 1]]],
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
     *  imnage?: string|HTMLImageElement,
     *  insert?: boolean,
     *  hidden?: boolean,
     *  type?: ('fixed'|'scaling')[],
     *  consumes?: [string, number][][],
     *  produces?: [string, number][][],
     *  requires?: [string, number][][],
     * }][]}
     */
    const makers = [
        ['tree_chopper', {x: -100, y: 0}],
    ];

    makers.forEach(([id, parts]) => {
        Machine.get_machine_copy(id, parts);
    });
}
