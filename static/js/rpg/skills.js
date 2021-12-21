import { Tile } from './tile.js';
import { Entity } from './entity.js';
import { context as canvas_context } from './canvas.js';
import { entity_skills_per_row, tile_size, get_theme_value } from './display.js';
import { Item } from './item.js';
/** @typedef {import('./color.js').Color} Color */

/**
 * @template {Color|string|CanvasImageSource|(x: number, y: number, context?: CanvasRenderingContext2D, level?: number, this: Skill<T>) => void} T
 */
export class Skill extends Tile {
    /** @type {{[k: string]: Skill}} */
    static #skills = {};
    /**
     * @template {T} U
     * @param {string} skill_id
     * @param {Skill<U>} [overrides]
     * @returns {Skill<U|T>?}
     */
    static get_skill(skill_id, overrides={}) {
        if (skill_id in this.#skills) {
            return this.#skills[skill_id].copy(overrides);
        }
        return null;
    }
    /**
     * Returns a list of skills the entity doesn't have and it can unlock
     *
     * @param {Entity} entity
     * @returns {string[]}
     */
    static get_unlockable_skills(entity) {
        return Object.values(this.#skills).filter(skill => {
            if (entity.skills.find(s => s.id == skill.id)) return false;

            return skill.unlock_conditions(entity);
        }).map(s => s.id);
    }

    #level;
    /** @type {number|false} */
    #multiplier = false;
    /** @type {{[k: string]: number|{[k: string]: number}}} */
    #on_use_self;
    /** @type {{[k: string]: number|{[k: string]: number}}|false} */
    #cached_on_use_self = false;
    /** @type {{[k: string]: number|{[k: string]: number}}} */
    #on_use_target;
    /** @type {{[k: string]: number|{[k: string]: number}}|false} */
    #cached_on_use_target = false;
    /** @type {{[k: string]: number|{[k: string]: number}}} */
    #passive;
    /** @type {{[k: string]: number|{[k: string]: number}}|false} */
    #cached_passive = false;
    /** @type {false|{[item_id: string]: number}} */
    #cached_cost = false;

    /**
     * @param {Object} params
     * @param {T} params.content
     * @param {string} params.id
     * @param {string} [params.name]
     * @param {string} [params.description]
     * @param {number} [params.level]
     * @param {number} [params.cost]
     * @param {(level: number) => number} [params.boost_func] Multiplier to effects depending on level
     * @param {number} [params.range]
     * @param {number} [params.radius]
     * @param {Entity?} [params.owner]
     * @param {{[k: string]: number|{[k: string]: number}}} [params.on_use_self]
     * @param {{[k: string]: number|{[k: string]: number}}} [params.on_use_target]
     * @param {{[k: string]: number|{[k: string]: number}}} [params.passive]
     * @param {(level: number) => {[item_id: string]: number}} [params.cost_func]
     * @param {null|(entity: Entity) => boolean} [params.unlock_conditions]
     */
    constructor({
        content, id, name = null, description = null,
        level = 1, cost = 0, boost_func = (n => n),
        range = 0, radius = 0, owner = null,
        on_use_self = {}, on_use_target = {}, passive = {},
        cost_func = (n => ({})), unlock_conditions = null,
    }) {
        if (isNaN(level)) throw new TypeError(`Invalid skill parameter level: ${level}`);
        if (isNaN(cost)) throw new TypeError(`Invalid skill parameter cost: ${cost}`);
        if (isNaN(range)) throw new TypeError(`Invalid skill parameter range: ${range}`);
        if (isNaN(radius)) throw new TypeError(`Invalid skill parameter radius: ${radius}`);
        if (typeof boost_func != 'function') throw new TypeError(`Invalid skill parameter boost_func: ${boost_func}`);
        if (typeof on_use_self != 'object') throw new TypeError(`Invalid skill parameter on_use_self: ${on_use_self}`);
        if (typeof on_use_target != 'object') throw new TypeError(`Invalid skill parameter on_use_target: ${on_use_target}`);
        if (typeof passive != 'object') throw new TypeError(`Invalid skill parameter passive: ${passive}`);
        if (owner && !(owner instanceof Entity)) throw new TypeError(`Invalid skill parameter owner: ${owner}`);
        if (typeof cost_func != 'function') throw new TypeError(`Invalid skill parameter cost_func: ${cost_func}`);
        if (unlock_conditions && typeof unlock_conditions != 'function') throw new TypeError(`Invalid skill parameter conditions: ${unlock_conditions}`);

        let x = 0;
        let y = 0;

        if (owner) {
            let skills_per_row = entity_skills_per_row();
            let index = owner.skills.findIndex(s => s.id == id);
            x = index % skills_per_row;
            y = Math.floor(index / skills_per_row);
        }

        super({x, y, z: 0, content, solid: false, insert: false});

        this.#on_use_self = on_use_self;
        this.#on_use_target = on_use_target;
        this.#passive = passive;
        this.#level = level;

        this.unlock_conditions = unlock_conditions;
        this.cost_func = cost_func;
        this.id = id;
        this.name = name;
        this.description = description;
        this.owner = owner;
        this.boost_func = boost_func;
        this.cost = cost;
        this.range = range;
        this.radius = radius;

        if (!(id in Skill.#skills)) Skill.#skills[id] = this;
    }

    get level() { return this.#level; }
    set level(level) {
        if (!isNaN(level)) {
            this.#level = Math.max(1, +level);
            this.#multiplier = false;
            this.#cached_passive = false;
            this.#cached_on_use_self = false;
            this.#cached_on_use_target = false;
            this.#cached_cost = false;
        }
    }
    get multiplier() {
        if (this.#multiplier === false) {
            this.#multiplier = this.boost_func(this.#level);
        }
        return this.#multiplier;
    }
    get level_cost() {
        if (this.#cached_cost === false) {
            this.#cached_cost = this.cost_func(this.#level);
        }
        return this.#cached_cost;
    }

    /**
     * @type {{
     *  [k: string]: number | {
     *      [k: string]: number;
     *  };
     * }}
     */
    get passive() {
        if (this.#cached_passive === false) {
            this.#cached_passive = Object.fromEntries(Object.entries(this.#passive).map(([attr, change]) => {
                if (typeof change != 'object') {
                    return [attr, change * this.multiplier];
                } else {
                    return [attr, Object.fromEntries(Object.entries(change).map(([a, c]) => [a, c * this.multiplier]))];
                }
            }));
        }

        return this.#cached_passive;
    }
    get base_passive() { return this.#passive; }
    set base_passive(passive) {
        if (typeof passive == 'object') {
            this.#passive = passive;
            this.#cached_passive = false;
        }
    }
    /**
     * @type {{
     *  [k: string]: number | {
     *      [k: string]: number;
     *  };
     * }}
     */
    get on_use_self() {
        if (this.#cached_on_use_self === false) {
            this.#cached_on_use_self = Object.fromEntries(Object.entries(this.#on_use_self).map(([attr, change]) => {
                if (typeof change != 'object') {
                    return [attr, change * this.multiplier];
                } else {
                    return [attr, Object.fromEntries(Object.entries(change).map(([a, c]) => [a, c * this.multiplier]))];
                }
            }));
        }

        return this.#cached_on_use_self;
    }
    get base_on_use_self() { return this.#on_use_self; }
    set base_on_use_self(on_use_self) {
        if (typeof on_use_self == 'object') {
            this.#on_use_self = on_use_self;
            this.#cached_on_use_self = false;
        }
    }
    /**
     * @type {{
     *  [k: string]: number | {
     *      [k: string]: number;
     *  };
     * }}
     */
    get on_use_target() {
        if (this.#cached_on_use_target === false) {
            this.#cached_on_use_target = Object.fromEntries(Object.entries(this.#on_use_target).map(([attr, change]) => {
                if (typeof change != 'object') {
                    return [attr, change * this.multiplier];
                } else {
                    return [attr, Object.fromEntries(Object.entries(change).map(([a, c]) => [a, c * this.multiplier]))];
                }
            }));
        }

        return this.#cached_on_use_target;
    }
    get base_on_use_target() { return this.#on_use_target; }
    set base_on_use_target(on_use_target) {
        if (typeof on_use_target == 'object') {
            this.#on_use_target = on_use_target;
            this.#cached_on_use_target = false;
        }
    }

    /**
     * @param {number} [x]
     * @param {number} [y]
     * @param {CanvasRenderingContext2D} [context]
     */
    draw(x = null, y = null, context = null) {
        context ??= canvas_context;

        let offset_x = tile_size[0];
        let offset_y = tile_size[1];
        let x_start = this.x * 3 * tile_size[0] + offset_x;
        let y_start = this.y * 3 * tile_size[1] + offset_y;
        /** @type {T} */
        let content = this.content;

        // Draw skill
        if (typeof content == 'function') {
            content.call(this, x ?? x_start, y ?? y_start, context, this.#level);
        } else if (typeof content == 'string') {
            context.textAlign = 'center';
            context.fillStyle = '#000';
            context.font = `${tile_size[1] * 2}px ${get_theme_value('text_font')}`;
            let x = x_start + tile_size[0];
            let y = y_start + tile_size[1] * 1.75;

            context.fillText(content, x, y);
        } else if (content instanceof Color) {
            context.fillStyle = content.toString();
            context.fillRect(x_start, y_start, tile_size[0] * 2, tile_size[1] * 2);
        } else if (isinstance(content, HTMLCanvasElement, HTMLImageElement, SVGImageElement, HTMLVideoElement, ImageBitmap)) {
            context.drawImage(content, x_start, y_start, tile_size[0] * 2, tile_size[1] * 2);
        } else {
            console.error(`Unknown tile content type ${content}`);
        }

        // Draw level
        context.textAlign = 'right';
        context.fillStyle = get_theme_value('text_skill_level_color');
        context.font = `${tile_size[1]}px ${get_theme_value('text_font')}`;
        let _x = x_start + tile_size[0] * 2;
        let _y = y_start + tile_size[1] * 2;

        context.fillText(this.level, _x, _y);
    }
    /**
     * Creates a copy of the skill
     *
     * @template {T} U
     * @param {Skill<U>} [overrides]
     * @returns {Skill<T|U>}
     */
    copy(overrides={}) {
        let {
            content, level, boost_func, owner, cost, name, description, id,
            base_passive, base_on_use_self, base_on_use_target, range, radius,
            cost_func, unlock_conditions: conditions,
        } = this;
        let skill = {
            content, on_use_self: {}, passive: {}, on_use_target: {}, id,
            level, boost_func, owner, cost, name, description, range, radius,
            cost_func, conditions,
        };

        Object.entries(base_passive).forEach(([attr, change]) => {
            if (typeof change != 'object') {
                skill.passive[attr] = change;
            } else {
                skill.passive[attr] = Object.fromEntries(Object.entries(change));
            }
        });
        Object.entries(base_on_use_self).forEach(([attr, change]) => {
            if (typeof change != 'object') {
                skill.on_use_self[attr] = change;
            } else {
                skill.on_use_self[attr] = Object.fromEntries(Object.entries(change));
            }
        });
        Object.entries(base_on_use_target).forEach(([attr, change]) => {
            if (typeof change != 'object') {
                skill.on_use_target[attr] = change;
            } else {
                skill.on_use_target[attr] = Object.fromEntries(Object.entries(change));
            }
        });
        Object.entries(overrides).forEach(([attr, change]) => {
            skill[attr] = change;
        });

        return new Skill(skill);
    }
    /**
     * Calculates the skill's position according to the owner's skills
     *
     * @param {Entity} [owner] owner
     */
    re_position(owner=null) {
        owner ??= this.owner;
        if (!owner) return;

        // x and y are dependant on skills index
        let skills = owner.skills;
        let i = skills.findIndex(i => i == this);

        let skills_per_row = entity_skills_per_row();
        if (i != -1) {
            this.x = i % skills_per_row;
            this.y = Math.floor(i / skills_per_row);
        } else {
            this.x = skills_per_row;
            this.y = this.equip_slot;
        }
    }
    /**
     * Returns the cost for levelling up at a specific level
     *
     * @param {number} [level]
     * @returns {{[item_id: string]: number}}
     */
    level_costs_at(level=this.#level) {
        return this.cost_func(level);
    }
}

export function create_skills() {
    /**
     * @type {{
     *  content: Color|string|CanvasImageSource|(x: number, y: number, context?: CanvasRenderingContext2D, level?: number, this: Skill<T>) => void,
     *  id: string,
     *  name?: string,
     *  description?: string,
     *  level?: number,
     *  cost?: number,
     *  range?: number,
     *  radius?: number,
     *  boost_func?: (level: number) => number,
     *  on_use_self?: {[k:string]: number|{[k: string]: number}},
     *  on_use_target?: {[k:string]: number|{[k: string]: number}},
     *  passive?: {[k:string]: number|{[k: string]: number}},
     *  cost_func?: (level: number) => {[item_id: string]: number},
     *  unlock_conditions?: (entity: Entity) => boolean,
     * }[]}
     */
    let skills = [
        {
            id: 'rest',
            content: '🛏',
            name: gettext('games_rpg_skills_rest'),
            cost: 1,
            boost_func: n => n ** .5,
            on_use_self: {
                health: 1,
                //magic: 1,
            },
            cost_func: level => ({yes: level * 2 - 2 + 1}),
            unlock_conditions: e => e.health_max >= 15,
        },
        {
            id: 'see',
            content: '👁',
            name: gettext('games_rpg_skills_see'),
            cost: 5,
            range: 15,
            boost_func: n => (n + 1) / 2,
            on_use_target: {},
            passive: {
                magic_max: 3,
            },
            cost_func: level => ({cash: level ** 2 / 2}),
            unlock_conditions: e => e.base_speed <= e.bonus_speed,
        },
        {
            id: 'stab',
            content: '🔪',
            range: 1,
            name: gettext('games_rpg_skills_stab'),
            cost: 3,
            boost_func: n => Math.log2(n + 1),
            on_use_target: {
                health: -1,
            },
            cost_func: level => ({fire: level * 2 + 2}),
            unlock_conditions: e => e.kills >= 3,
        },
    ];

    skills.forEach(skill => {
        new Skill(skill);
    });
}
