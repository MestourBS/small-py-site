import { Tile } from './tile.js';
import { Item } from './item.js';
import { Skill } from './skills.js';
import { MinHeap } from './minheap.js';
import { average, number_between } from './primitives.js';
import { inventory_items_per_row } from './display.js';
import { Direction, surrounding_square, coords_distance, can_walk } from './coords.js';
import Random from './random.js';
import globals from './globals.js';
import Color from './color.js';
/**
 * @typedef {import('./room.js').Room} Room
 */

/**
 * TODO LIST
 * =========
 *
 * ?pathfinding: smarter that takes speed & size in account
 *
 * entity:
 *  * factions & intents
 *  * skills
 *  * attacking/interacting
 *
 * autonomous entity:
 *  * auto equip
 *  * auto use
 *
 * projectiles
 */

/**
 * List of functions for targeting
 */
export const targetings = {
    'null': () => null,
    'roaming': function() {
        return Random.array_element(Tile.grid.filter(t => !t.solid && t != this && (!(t instanceof Item) || t.owner != this)));
    },
    'player': function() {
        return globals.player;
    },
    'item': function() {
        /** @type {Item[]} */
        let items = Tile.grid.filter(t => t instanceof Item && !t.owner);
        // All the items have been grabbed, so we get them back
        if (!items.length) {
            items = Entity.entities.filter(t => t != this).map(t => t.inventory[0]).flat();
        }
        // There's no item :(
        if (!items.length) {
            return null;
        }
        return Random.array_element(items);
    },
    'entity': function() {
        let entities = Entity.entities.filter(e => e.health > 0);
        if (!entities.length) return null;
        return Random.array_element(entities);
    },
};
/**
 * List of functions for pathfinding
 */
export const pathfindings = {
    /** @type {(this: AutonomousEntity) => null} */
    'null': () => null,
    /** @type {(this: AutonomousEntity) => readonly [number, number]} */
    'direct': function() {
        if (!this.target) return null;

        let {x, y} = this.target;

        let dist_x = x - this.x;
        let dist_y = y - this.y;

        if (!dist_x && !dist_y) return null;

        // Get the space to move around before moving
        let left = dist_x < 0;
        let right = dist_x > 0;
        let up = dist_y < 0;
        let down = dist_y > 0;

        let space = this.get_cardinal_space({left, right, up, down});

        let can_horizontal = false;
        let can_vertical = false;
        let dir_horizontal = null;
        let dir_vertical = null;

        if (Math.sign(dist_x) == 1) {
            can_horizontal = space['1'][0] > 0;
            dir_horizontal = Direction.right;
        } else if (Math.sign(dist_x) == -1) {
            can_horizontal = space['-1'][0] > 0;
            dir_horizontal = Direction.left;
        }
        if (Math.sign(dist_y) == 1) {
            can_vertical = space['1'][1] > 0;
            dir_vertical = Direction.down;
        } else if (Math.sign(dist_y) == -1) {
            can_vertical = space['-1'][1] > 0;
            dir_vertical = Direction.up;
        }

        // Move on the side, or up/down, or on the side/never
        if (Math.abs(dist_x) >= Math.abs(dist_y) && can_horizontal) {
            return dir_horizontal;
        } else if (Math.abs(dist_y) > 0 && can_vertical) {
            return dir_vertical;
        } else {
            return dir_horizontal;
        }
    },
    /** @type {(this: AutonomousEntity) => readonly [number, number]} */
    'smart': function() {
        if (!this.target) return null;

        /** Direct reference to `this.path` */
        let path = this.path;
        let round = Math.round;

        /** @type {[number, number]} */
        let position = [round(this.x), round(this.y)];
        /** @type {[number, number]} */
        let target = [round(this.target.x), round(this.target.y)];
        /** @param {[number, number]} coords */
        let is_target = coords => coords_distance(coords, target) < .1;

        // We're already there
        if (is_target([this.x, this.y])) return null;

        // Check if the path leads to the target
        if (path && path.length) {
            let end = path[path.length - 1];

            if (coords_distance(end, target) > 10) {
                this.path = path = null;
            }
        }

        // Try to compute towards the target
        if (!path || !path.length) {
            this.path = path = (new Path).find(position, target, [this, this.target]);
        }

        // Follow the path
        if (path && path.length) {
            let current = path[0];
            if (coords_distance(current, [this.x, this.y]) < .05) {
                // We passed the first step
                path.shift();
                if (path.length) current = path[0];
                else return null;
            }

            let dist_x = current[0] - this.x;
            let dist_y = current[1] - this.y;

            // Get the space to move around before moving
            let left = dist_x < 0;
            let right = dist_x > 0;
            let up = dist_y < 0;
            let down = dist_y > 0;

            let space = this.get_cardinal_space({left, right, up, down});

            let can_horizontal = false;
            let can_vertical = false;
            let dir_horizontal = null;
            let dir_vertical = null;

            if (Math.sign(dist_x) == 1) {
                can_horizontal = space['1'][0] > 0;
                dir_horizontal = Direction.right;
            } else if (Math.sign(dist_x) == -1) {
                can_horizontal = space['-1'][0] > 0;
                dir_horizontal = Direction.left;
            }
            if (Math.sign(dist_y) == 1) {
                can_vertical = space['1'][1] > 0;
                dir_vertical = Direction.down;
            } else if (Math.sign(dist_y) == -1) {
                can_vertical = space['-1'][1] > 0;
                dir_vertical = Direction.up;
            }

            // Move on the side, or up/down
            let dir = dir_horizontal;
            if (dist_y && Math.abs(dist_x) < Math.abs(dist_y) && can_vertical) {
                dir = dir_vertical;
            }

            if (!can_horizontal && !can_vertical) {
                this.path = null;
            }

            // If we're past the current step, we remove it
            /*if (dir && number_between(current[0], this.x, this.x + dir[0]) || number_between(current[1], this.y, this.y + dir[1])) {
                path.shift();
            }*/

            return dir;
        }

        return null;
    },
};

/**
 * @template {Color|string|CanvasImageSource|(x: number, y: number, context?: CanvasRenderingContext2D, this: Entity<T>) => void} T
 */
export class Entity extends Tile {
    /** @type {Entity[]} */
    static entities = [];

    /** @type {number} */
    #health;
    /** @type {number} */
    #health_max;
    /** @type {number} */
    #magic;
    /** @type {number} */
    #magic_max;
    /** @type {{[k: string]: number}} */
    #defense;
    /** @type {{[k: string]: number}} */
    #damage;
    /** @type {number} */
    #speed;
    /** @type {number} */
    #range;

    /** @type {[Item, number][]} */
    #inventory = [];
    /** @type {{[k: number]: Item|null}} */
    #equipment = {};
    /** @type {Skill[]} */
    #skills = [];

    /**
     * @param {Object} params
     * @param {number} params.x
     * @param {number} params.y
     * @param {number} params.z
     * @param {T} params.content
     * @param {string} [params.name]
     * @param {number} [params.health]
     * @param {number} [params.health_max]
     * @param {number} [params.magic]
     * @param {number} [params.magic_max]
     * @param {number|{[k: string]: number}} [params.defense]
     * @param {number|{[k: string]: number}} [params.damage]
     * @param {number} [params.speed]
     * @param {number} [params.range] Interaction range
     * @param {number[]} [params.equip_slots]
     */
    constructor({
        x, y, z, content, name=null,
        health=10, health_max=null, magic=10, magic_max=null,
        defense=1, damage=1,
        speed=1, range=.75, equip_slots=[]
    }) {
        health_max ??= health;
        magic_max ??= magic;
        if (typeof health != 'number') throw new TypeError(`Invalid entity parameter health: ${health}`);
        if (typeof health_max != 'number') throw new TypeError(`Invalid entity parameter health_max: ${health_max}`);
        if (typeof magic != 'number') throw new TypeError(`Invalid entity parameter magic: ${magic}`);
        if (typeof magic_max != 'number') throw new TypeError(`Invalid entity parameter magic_max: ${magic_max}`);
        if (typeof defense == 'number') {
            defense = {'none': defense};
        } else if (typeof defense != 'object') throw new TypeError(`Invalid entity parameter defense: ${defense}`);
        if (typeof damage == 'number') {
            damage = {'none': damage};
        } else if (typeof damage != 'object') throw new TypeError(`Invalid entity parameter damage: ${damage}`);
        if (typeof speed != 'number') throw new TypeError(`Invalid entity parameter speed: ${speed}`);
        if (typeof range != 'number') throw new TypeError(`Invalid entity parameter range: ${range}`);
        if (!Array.isArray(equip_slots)) throw new TypeError(`Invalid entity parameter equip_slots: ${equip_slots}`);

        super({x, y, z, content, solid: health > 0, override: false, interacted: /**@this {Entity}*/function(entity) {
            let enemy = true;

            if (enemy) {
                let damage = 0;
                Object.entries(entity.damage).forEach(([type, dmg]) => {
                    let def = this.defense?.[type] ?? 0;
                    damage += Math.max(0, dmg - def);
                });

                this.health -= damage;
                if (this.health <= 0) {
                    entity.kills++;
                }
            } else {
                // do something else
            }
        }});

        this.name = name == null ? '' : name.toString();
        this.#health = health;
        this.#health_max = health_max;
        this.#magic = magic;
        this.#magic_max = magic_max;
        this.#defense = defense;
        this.#damage = damage;
        this.#speed = speed;
        this.#range = range;
        this.kills = 0;
        equip_slots.sort((a,b) => a-b).forEach(n => this.#equipment[n] = null);

        Entity.entities.push(this);
    }

    get can_interact() { return this.health > 0; }

    get health() {
        return Math.min(this.#health, this.health_max);
    }
    set health(health) {
        if (!isNaN(health)) {
            this.#health = Math.max(Math.min(this.health_max, health), 0);
            this.solid = this.#health > 0;
            if (this.#health <= 0) {
                while (this.#inventory.length > 0) {
                    this.drop_item(0, false, 'max');
                }
                Object.keys(this.#equipment).forEach(n => this.drop_item(+n, true));
                Tile.solid_tiles = false;

                if (typeof this.content == 'string') {
                    this.content = '💀';
                } else if (this.content instanceof Color) {
                    this.content = this.content.darken(.25);
                }
            }
        }
    }
    get health_max() { return Math.max(this.base_health_max + this.bonus_health_max, 0); }
    get bonus_health_max() {
        let bonus = this.#inventory.map(([item, amount]) => {
            if (!amount) return 0;
            return (item.passive?.health_max ?? 0) * amount;
        }).reduce((s, n) => s + n, 0);
        bonus += Object.values(this.#equipment)
            .filter(i => i != null)
            .map(i => +(i?.equipped?.health_max ?? 0))
            .reduce((s, n) => s + n, 0);
        bonus += this.#skills.map(s => +(s?.passive?.health_max ?? 0))
            .reduce((s, n) => s + n, 0);

        return bonus;
    }
    get base_health_max() { return this.#health_max; }
    set base_health_max(health_max) { if (!isNaN(health_max)) this.#health_max = Math.max(+health_max, 0); }
    get magic() {
        return Math.min(this.#magic, this.magic_max);
    }
    set magic(magic) {
        if (!isNaN(magic)) {
            this.#magic = Math.max(Math.min(this.magic_max, magic), 0);
        }
    }
    get magic_max() { return Math.max(this.base_magic_max + this.bonus_magic_max, 0); }
    get bonus_magic_max() {
        let bonus = this.#inventory.map(([item, amount]) => {
            if (!amount) return 0;
            return (item.passive?.magic_max ?? 0) * amount;
        }).reduce((s, n) => s + n, 0);
        bonus += Object.values(this.#equipment)
            .filter(i => i != null)
            .map(i => +(i?.equipped?.magic_max ?? 0))
            .reduce((s, n) => s + n, 0);
        bonus += this.#skills.map(s => +(s?.passive?.magic_max ?? 0))
            .reduce((s, n) => s + n, 0);

        return bonus;
    }
    get base_magic_max() { return this.#magic_max; }
    set base_magic_max(magic_max) { if (!isNaN(magic_max)) this.#magic_max = Math.max(+magic_max, 0); }
    get defense() {
        /** @type {{[k: string]: number}} */
        let defense = {};

        Object.entries(this.base_defense).forEach(([type, def]) => {
            if (!defense.hasOwnProperty(type)) defense[type] = def;
            else defense[type] += def;
        });
        Object.entries(this.bonus_defense).forEach(([type, def]) => {
            if (!defense.hasOwnProperty(type)) defense[type] = def;
            else defense[type] += def;
        });

        return defense;
    }
    get bonus_defense() {
        /** @type {{[k: string]: number}} */
        let defense = {};

        this.#inventory.forEach(([item, amount]) => {
            if (!amount) return;
            if (!item.passive.hasOwnProperty('defense') || typeof item.passive.defense != 'object') return;
            let item_defense = item.passive.defense;
            Object.entries(item_defense).forEach(([type, def]) => {
                if (!defense.hasOwnProperty(type)) defense[type] = def * amount;
                else defense[type] += def * amount;
            });
        });
        Object.values(this.#equipment)
            .filter(i => i != null)
            .forEach(item => {
                if (!item.equipped.hasOwnProperty('defense') || typeof item.equipped.defense != 'object') return;
                let item_defense = item.equipped.defense;
                Object.entries(item_defense).forEach(([type, def]) => {
                    if (!defense.hasOwnProperty(type)) defense[type] = def;
                    else defense[type] += def;
                });
            });
        this.#skills.forEach(skill => {
            if (!skill.passive.hasOwnProperty('defense') || typeof skill.passive.defense != 'object') return;
            let skill_defense = skill.passive.defense;
            Object.entries(skill_defense).forEach(([type, def]) => {
                if (!defense.hasOwnProperty(type)) defense[type] = def;
                else defense[type] += def;
            });
        });

        return defense;
    }
    get base_defense() { return this.#defense; }
    set base_defense(defense) {
        if (typeof defense == 'number') defense = {'none': defense};
        else if (typeof defense != 'object') return;
        this.#defense = defense;
    }
    get damage() {
        /** @type {{[k: string]: number}} */
        let damage = {};

        Object.entries(this.base_damage).forEach(([type, dmg]) => {
            if (!damage.hasOwnProperty(type)) damage[type] = dmg;
            else damage[type] += dmg;
        });
        Object.entries(this.bonus_damage).forEach(([type, dmg]) => {
            if (!damage.hasOwnProperty(type)) damage[type] = dmg;
            else damage[type] += dmg;
        });

        return damage;
    }
    get bonus_damage() {
        /** @type {{[k: string]: number}} */
        let damage = {};

        this.#inventory.forEach(([item, amount]) => {
            if (!amount) return;
            if (!item.passive.hasOwnProperty('damage') || typeof item.passive.damage != 'object') return;
            let item_damage = item.passive.damage;
            Object.entries(item_damage).forEach(([type, dmg]) => {
                if (!damage.hasOwnProperty(type)) damage[type] = dmg * amount;
                else damage[type] += dmg * amount;
            });
        });
        Object.values(this.#equipment)
            .filter(i => i != null)
            .forEach(item => {
                if (!item.equipped.hasOwnProperty('damage') || typeof item.equipped.damage != 'object') return;
                let item_damage = item.equipped.damage;
                Object.entries(item_damage).forEach(([type, dmg]) => {
                    if (!damage.hasOwnProperty(type)) damage[type] = dmg;
                    else damage[type] += dmg;
                });
            });
        this.#skills.forEach(skill => {
            if (!skill.passive.hasOwnProperty('damage') || typeof skill.passive.damage != 'object') return;
            let skill_damage = skill.passive.damage;
            Object.entries(skill_damage).forEach(([type, def]) => {
                if (!damage.hasOwnProperty(type)) damage[type] = def;
                else damage[type] += def;
            });
        });

        return damage;
    }
    get base_damage() { return this.#damage; }
    set base_damage(damage) {
        if (typeof damage == 'number') damage = {'none': damage};
        else if (typeof damage != 'object') return;
        this.#damage = damage;
    }
    get speed() { return Math.max(this.base_speed + this.bonus_speed, 0); }
    get bonus_speed() {
        let bonus = this.#inventory.map(([item, amount]) => {
            if (!amount) return 0;
            return (item.passive?.speed ?? 0) * amount;
        }).reduce((s, n) => s + n, 0);
        bonus += Object.values(this.#equipment)
            .filter(i => i != null)
            .map(i => +(i?.equipped?.speed ?? 0))
            .reduce((s, n) => s + n, 0);
        bonus += this.#skills.map(s => +(s?.passive?.speed ?? 0))
            .reduce((s, n) => s + n, 0);

        return bonus;
    }
    get base_speed() { return this.#speed; }
    set base_speed(speed) { if (!isNaN(speed)) this.#speed = Math.max(+speed, 0); }
    get range() { return Math.max(this.base_range + this.bonus_range, 0); }
    get bonus_range() {
        let bonus = this.#inventory.map(([item, amount]) => {
            if (!amount) return 0;
            return (item.passive?.range ?? 0) * amount;
        }).reduce((s, n) => s + n, 0);
        bonus += Object.values(this.#equipment)
            .filter(i => i != null)
            .map(i => +(i?.equipped?.range ?? 0))
            .reduce((s, n) => s + n, 0);
        bonus += this.#skills.map(s => +(s?.passive?.range ?? 0))
            .reduce((s, n) => s + n, 0);

        return bonus;
    }
    get base_range() { return this.#range; }
    set base_range(range) { if (!isNaN(range)) this.#range = Math.max(+range, 0); }

    get inventory() { return this.#inventory; }
    get equipment() { return this.#equipment; }
    get skills() { return this.#skills; }

    /**
     * Moves an entity somewhere
     *
     * @param {Direction} direction
     * @param {number} [multiplier] speed multiplier
     */
    move(direction, multiplier=1) {
        if (this.health <= 0) return;

        let amounts = direction.map(n => n * multiplier * this.speed);
        direction = direction.map(Math.sign);
        let left = direction[0] == -1;
        let right = direction[0] == 1;
        let up = direction[1] == -1;
        let down = direction[1] == 1;
        let space = this.get_cardinal_space({left, right, up, down});

        // Get the lowest movement available in the directions
        amounts = amounts.map((n, i) => {
            if (direction[i] in space) {
                // Needs abs, otherwise the game won't know you can't go through walls on the left or up
                return Math.min(Math.abs(n), space[direction[i]][i]) * Math.sign(n);
            }
            return 0;
        });

        if (amounts.some(n => n != 0)) {
            // Move around
            this.x += amounts[0];
            this.y += amounts[1];

            if (this.is_visible != Tile.visible_grid.includes(this)) {
                if (this.is_visible) {
                    // Not in the visible grid, but should be
                    Tile.visible_grid.push(this);
                } else {
                    // In the visible grid, but should not be
                    let i = Tile.visible_grid.indexOf(this);
                    Tile.visible_grid.splice(i, 1);
                }
            }
        }

        // Interact with next tile(s)
        let x_range = [Math.floor(this.x + .5 - amounts[0]), Math.ceil(this.x - .5 + amounts[0])];
        let y_range = [Math.floor(this.y + .5 - amounts[1]), Math.ceil(this.y - .5 + amounts[1])];

        switch (direction[0]) {
            case 1:
                x_range[1]++;
                break;
            case -1:
                x_range[0]--;
        }
        switch (direction[1]) {
            case 1:
                y_range[1]++;
                break;
            case -1:
                y_range[0]--;
        }

        // Interact with tiles
        Tile.grid
            .filter(t => {
                if (t == this || !t.can_interact) return false;
                let tx_range = [Math.floor(t.x + .25), Math.ceil(t.x - .25)];
                let ty_range = [Math.floor(t.y + .25), Math.ceil(t.y - .25)];

                if (!tx_range.some(n => number_between(n, ...x_range))) return false;
                return ty_range.some(n => number_between(n, ...y_range));
            })
            .forEach(t => t.interacted(this));
    }
    /**
     * Calculates the movement space available in all 4 cardinal directions
     *
     * @param {Object} params
     * @param {boolean} [params.left]
     * @param {boolean} [params.right]
     * @param {boolean} [params.up]
     * @param {boolean} [params.down]
     * @returns {{
     *  '-1': [number, number],
     *  '1': [number, number],
     * }} -1: [left, up], 1: [right, down]
     */
    get_cardinal_space({left=false, right=false, up=false, down=false}={}) {
        let result = {
            /** Left. up */
            '-1': [Infinity, Infinity],
            /** Right, down */
            '1': [Infinity, Infinity],
        };

        let x_range = [Math.floor(this.x + .05), Math.ceil(this.x - .05)];
        let y_range = [Math.floor(this.y + .05), Math.ceil(this.y - .05)];

        if (left) {
            let tiles_left = Tile.solid_tiles.filter(t => {
                if (t.x >= this.x) return false;

                let range = [Math.floor(t.y + .05), Math.ceil(t.y - .05)];
                return range.some(c => number_between(c, ...y_range));
            });
            if (tiles_left.length) {
                let least_left = tiles_left.map(t => t.x + 1).reduce((max, x) => Math.max(max, x), -Infinity);
                result['-1'][0] = Math.max(0, this.x - least_left);
            }
        }
        if (right) {
            let tiles_right = Tile.solid_tiles.filter(t => {
                if (t.x <= this.x) return false;

                let range = [Math.floor(t.y + .05), Math.ceil(t.y - .05)];
                return range.some(c => number_between(c, ...y_range));
            });
            if (tiles_right.length) {
                let least_right = tiles_right.map(t => t.x - 1).reduce((min, x) => Math.min(min, x), Infinity);
                result['1'][0] = Math.max(0, least_right - this.x);
            }
        }
        if (up) {
            let tiles_up = Tile.solid_tiles.filter(t => {
                if (t.y >= this.y) return false;

                let range = [Math.floor(t.x + .05), Math.ceil(t.x - .05)];
                return range.some(c => number_between(c, ...x_range));
            });
            if (tiles_up.length) {
                let least_up = tiles_up.map(t => t.y + 1).reduce((max, y) => Math.max(max, y), -Infinity);
                result['-1'][1] = Math.max(0, this.y - least_up);
            }
        }
        if (down) {
            let tiles_down = Tile.solid_tiles.filter(t => {
                if (t.y <= this.y) return false;

                let range = [Math.floor(t.x + .05), Math.ceil(t.x - .05)];
                return range.some(c => number_between(c, ...x_range));
            });
            if (tiles_down.length) {
                let least_down = tiles_down.map(t => t.y - 1).reduce((min, y) => Math.min(min, y), Infinity);
                result['1'][1] = Math.max(0, least_down - this.y);
            }
        }

        return result;
    }
    /**
     * Uses an item in the inventory
     *
     * @param {Item|number|string} item item|index|id
     * @param {number|'max'} [amount=1]
     */
    use_item(item, amount=1) {
        let index;
        if (item instanceof Item) {
            index = this.#inventory.findIndex(([i]) => i.id == item.id);
        } else if (typeof item == 'string') {
            index = this.#inventory.findIndex(([i]) => i.id == item);
        } else if (typeof item == 'number') {
            index = item;
        }

        if (!(index in this.#inventory)) return;

        let [real_item, real_amount] = this.#inventory[index];
        if (amount == 'max') amount = real_amount;
        else amount = Math.min(amount, real_amount);

        if (!amount || isNaN(amount) || !Object.keys(real_item.on_use).length) return;
        Object.entries(real_item.on_use).forEach(([attr, change]) => {
            if (`base_${attr}` in this) {
                attr = `base_${attr}`;
            }
            if (!(attr in this)) return;

            this[attr] += change * amount;
        });

        if (amount >= real_amount) {
            this.#inventory.splice(index, 1)[0][0].owner = null;
            this.#inventory.filter((_, i) => i >= index).forEach(([i]) => i.re_position());

            // Check if cursor is at the end of the inventory and move it backwards if it is
            let items_per_row = inventory_items_per_row();
            let cursor_index = globals.cursors.inventory[1] * items_per_row + globals.cursors.inventory[0];
            if (cursor_index == this.#inventory.length) {
                if (globals.cursors.inventory[0] > 0) {
                    globals.cursors.inventory[0]--;
                } else if (globals.cursors.inventory[1] > 0) {
                    globals.cursors.inventory[0] = items_per_row - 1;
                    globals.cursors.inventory[1]--;
                } //Else that was the only item, so we don't move it
            }
        } else {
            this.#inventory[index][1] -= amount;
        }
    }
    /**
     * Drops an item from the inventory
     *
     * @param {Item|number|string} item item|index|id
     * @param {boolean} [equip] Whether the item is equipped or not
     * @param {number|'max'} [amount=1]
     */
    drop_item(item, equip=false, amount=1) {
        let index;
        if (item instanceof Item) {
            if (equip) {
                let entry = Object.entries(this.#equipment).find(([_, i]) => i == item);
                if (!entry) return;
                index = +entry[0];
            } else index = this.#inventory.findIndex(([i]) => i.id == item.id);
        } else if (typeof item == 'string') {
            if (equip) {
                let entry = Object.entries(this.#equipment).find(([_, i]) => i.id == item);
                if (!entry) return;
                index = +entry[0];
            } else index = this.#inventory.findIndex(([i]) => i.id == item);
        } else if (typeof item == 'number') {
            index = item;
        }

        let real_item;
        let real_amount = 1;
        if (equip) {
            if (!(index in this.#equipment) || !this.#equipment[index]) return;

            real_item = this.#equipment[index];
        } else {
            if (!(index in this.#inventory)) return;

            [real_item, real_amount] = this.#inventory[index];
        }

        if (amount == 'max') amount = real_amount;
        else amount = Math.min(amount, real_amount);

        if (!amount || isNaN(amount)) return;

        // You can't wear 2 shirts in the game
        if (equip) this.#equipment[index] = null;
        else if (amount >= real_amount) {
            real_item.owner = null;
            let items_per_row = inventory_items_per_row();

            this.#inventory.splice(index, 1);
            this.#inventory.filter((_, i) => i >= index).forEach(([i]) => i.re_position());

            // Check if cursor is at the end of the inventory and move it backwards if it is
            let cursor_index = globals.cursors.inventory[1] * items_per_row + globals.cursors.inventory[0];
            if (cursor_index == this.#inventory.length) {
                if (globals.cursors.inventory[0] > 0) {
                    globals.cursors.inventory[0]--;
                } else if (globals.cursors.inventory[1] > 0) {
                    globals.cursors.inventory[0] = items_per_row - 1;
                    globals.cursors.inventory[1]--;
                } //Else that was the last item, so we don't move it
            }
        } else {
            this.#inventory[index][1] -= amount;
        }

        // Spawn the items on the floor
        /** @type {[number, number][]} */
        let grid = [];
        let id = real_item.id;

        let check_grid = () => {
            if (grid.length) return;

            /** @type {(([x,y]: [number, number]) => boolean)[]} */
            let filters = [
                // Only allow as a grid around the entity
                ([x,y]) => {
                    if (x == Math.round(this.x) && y == Math.round(this.y)) return false;
                    let _x = Math.round(this.x) - x;
                    if (_x % 2) return false;
                    let _y = Math.round(this.y) - y;
                    if (_y % 2) return false;

                    // Only allow non-solid tiles that are without items
                    let tiles = Tile.grid.filter(t => t.x == x && t.y == y);
                    return !tiles.some(t => t.solid || t instanceof Item) && tiles.length;
                },
                // Grid doesn't have enough space, so we fill the gaps
                ([x,y]) => {
                    if (x == Math.round(this.x) && y == Math.round(this.y)) return false;

                    // Only allow non-solid tiles that are without items
                    let tiles = Tile.grid.filter(t => t.x == x && t.y == y);
                    return !tiles.some(t => t.solid || t instanceof Item) && tiles.length;
                },
                // Just don't put it on a solid tile
                ([x,y]) => {
                    if (x == Math.round(this.x) && y == Math.round(this.y)) return false;

                    // Only allow non-solid tiles
                    let tiles = Tile.grid.filter(t => t.x == x && t.y == y);
                    return tiles.every(t => !t.solid) && tiles.length;
                },
                // Just put it on a tile
                ([x,y]) => {
                    if (x == Math.round(this.x) && y == Math.round(this.y)) return false;

                    // Only allow tiles
                    return Tile.grid.some(t => t.x == x && t.y == y);
                },
                // Ignore the entity
                ([x,y]) => {
                    return x != Math.round(this.x) || y != Math.round(this.y);
                },
            ];
            for (let filter of filters) {
                let radius = 0;

                while (!grid.length) {
                    radius++;

                    let surroudings = surrounding_square(Math.round(this.x), Math.round(this.y), radius * 2);
                    let _grid = surroudings.filter(filter);
                    if (_grid.length) {
                        grid = _grid;
                        break;
                    }
                }
            }

            grid = Random.array_shuffle(grid);
        }

        for (let i = 0; i < amount; i++) {
            check_grid();
            let coords = grid.pop();

            let [x, y] = coords;
            let item = Item.get_item(id, {x, y});
            item.insert();
        }

        Tile.visible_grid = false;
    }
    /**
     * Equips an item in the inventory
     *
     * @param {Item|number|string} item item|index|id
     */
    equip_item(item) {
        let index;
        if (item instanceof Item) {
            index = this.#inventory.findIndex(([i]) => i.id == item.id);
        } else if (typeof item == 'string') {
            index = this.#inventory.findIndex(([i]) => i.id == item);
        } else if (typeof item == 'number') {
            index = item;
        }

        if (!(index in this.#inventory)) return;

        let [real_item, amount] = this.#inventory[index];

        if (!amount || isNaN(amount) || !(real_item.equip_slot in this.#equipment)) return;
        if (this.#equipment[real_item.equip_slot]) {
            // If the item is already equipped, what is the point?
            if (this.#equipment[real_item.equip_slot].id == real_item.id) return;
            this.unequip_item(real_item.equip_slot);
        }

        if (amount > 1) {
            this.#inventory[index][1]--;
        } else {
            this.#inventory.splice(index, 1);
            this.#inventory.filter((_,i) => i >= index).forEach(([i]) => i.re_position());

            // Check if cursor is at the end of the inventory and move it backwards if it is
            let items_per_row = inventory_items_per_row();
            let cursor_index = globals.cursors.inventory[1] * items_per_row + globals.cursors.inventory[0];
            if (cursor_index == this.#inventory.length) {
                if (globals.cursors.inventory[0] > 0) {
                    globals.cursors.inventory[0]--;
                } else if (globals.cursors.inventory[1] > 0) {
                    globals.cursors.inventory[0] = items_per_row - 1;
                    globals.cursors.inventory[1]--;
                } //Else that was the last item, so we don't move it
            }
        }

        let new_item = real_item.copy();
        new_item.owner = this;
        this.#equipment[new_item.equip_slot] = new_item;
        new_item.re_position();
    }
    /**
     * Unequips an item and puts it back in the inventory
     *
     * @param {Item|number|string} item item|equip_slot|id
     */
    unequip_item(item) {
        let index;
        if (item instanceof Item) {
            let entry = Object.entries(this.#equipment).find(([_, i]) => i.id == item.id);
            index = +(entry[0] ?? -1);
        } else if (typeof item == 'string') {
            let entry = Object.entries(this.#equipment).find(([_, i]) => i.id == item);
            index = +(entry[0] ?? -1);
        } else if (typeof item == 'number') {
            index = item;
        }

        if (!(index in this.#equipment) || !this.#equipment[index]) return;

        let real_item = this.#equipment[index];
        this.#equipment[index] = null;

        let inventory_index = this.#inventory.findIndex(([i]) => i.id == real_item.id);
        if (inventory_index == -1) {
            this.#inventory.push([real_item, 1]);
            real_item.re_position();
        } else {
            this.#inventory[inventory_index][1]++;
        }
    }
    /**
     * Uses a skill
     *
     * A target can be set for the skill's on_use_target, otherwise the skill's on_use_self will be used
     *
     * @param {Skill|number|string} skill skill|index|id
     * @param {{x: number, y: number}?} [target] Target position, can be a tile for simplicity, or null for self
     */
    use_skill(skill, target=null) {
        let index;
        if (skill instanceof Skill) {
            index = this.#skills.findIndex(s => s.id == skill.id);
        } else if (typeof skill == 'string') {
            index = this.#skills.findIndex(s => s.id == skill);
        } else if (typeof skill == 'number') {
            index = skill;
        }

        if (!(index in this.#skills)) return;

        let real_skill = this.#skills[index];

        if (this.magic < real_skill.cost) return;

        this.magic -= real_skill.cost;

        if (!target) {
            Object.entries(real_skill.on_use_self).forEach(([attr, change]) => {
                if (`base_${attr}` in this) {
                    attr = `base_${attr}`;
                }
                if (!(attr in this)) return;

                if (typeof change != 'object') {
                    this[attr] += change;
                } else {
                    Object.entries(change).forEach(([type, change]) => {
                        this[attr][type] += change;
                    });
                }
            });
        } else {
            let range = real_skill.range;
            let dist = coords_distance(this, target);
            if (dist > range + .5) {
                // Get potatial targets, sorted from closest to target to farthest
                let targets = Tile.grid.filter(t => t != this && coords_distance(t, this) <= dist)
                    .sort((ta, tb) => coords_distance(ta, target) - coords_distance(tb, target));

                if (!targets.length) {
                    // We couldn't find a valid target, so we make a fake one
                    let dist_x = target.x - this.x;
                    let dist_y = target.y - this.y;
                    let angle = Math.atan(Math.abs(dist_y) / Math.abs(dist_x));

                    if (Math.sign(dist_y) == -1) {
                        // Below this
                        angle += Math.PI;
                    }
                    if (dist_x && dist_y && Math.sign(dist_y) != Math.sign(dist_x)) {
                        // 2nd quadrant of the half
                        angle += Math.PI / 2;
                    }

                    // The new target tile for the skill
                    target = {
                        x: Math.round(Math.cos(angle) * range),
                        y: Math.round(Math.sin(angle) * range),
                    };
                } else {
                    // Get the nearest target
                    target = targets[0];
                }
            }
            let radius = real_skill.radius;
            let x_range = [Math.round(target.x - radius - .1), Math.round(target.x + radius + .1)];
            let y_range = [Math.round(target.y - radius - .1), Math.round(target.y + radius + .1)];
            let affected = Entity.entities.filter(e => e.solid && number_between(e.x, ...x_range) && number_between(e.y, ...y_range));
            Object.entries(real_skill.on_use_target).forEach(([attr, change]) => {
                if (`base_${attr}` in this) {
                    attr = `base_${attr}`;
                }
                if (!(attr in this)) return;

                if (typeof change != 'object') {
                    affected.forEach(e => e[attr] += change);
                } else {
                    Object.entries(change).forEach(([type, change]) => {
                        affected.forEach(e => e[attr][type] += change);
                    });
                }
            });
        }
    }
}
/**
 * @template {Color|string|CanvasImageSource|(x: number, y: number, context?: CanvasRenderingContext2D, this: AutonomousEntity<T>) => void} T
 */
export class AutonomousEntity extends Entity {
    /** @type {Tile|null} */
    #target = null;
    /** Whether the targeting never returns a target */
    #target_never = false;
    /** @type {(this: AutonomousEntity<T>) => Tile|null} */
    #targeting;
    /** @type {(this: AutonomousEntity<T>) => Direction|null} */
    #pathfinding;
    /** @type {[number, number][]|null} */
    path = null;

    /**
     * @param {Object} params
     * @param {number} params.x
     * @param {number} params.y
     * @param {number} params.z
     * @param {T} params.content
     * @param {string} [params.name]
     * @param {number} [params.health]
     * @param {number} [params.health_max]
     * @param {number|{[k: string]: number}} [params.defense]
     * @param {number|{[k: string]: number}} [params.damage]
     * @param {number} [params.speed]
     * @param {number} [params.range] Interaction range
     * @param {(this: AutonomousEntity) => Tile|null} [params.targeting]
     * @param {(this: AutonomousEntity) => Direction|null} [params.pathfinding]
     */
    constructor({
        x, y, z, content,
        name=null, health=10, health_max=null, defense=1, damage=1, speed=1, range=.5,
        targeting=()=>null, pathfinding=()=>null
    }) {
        if (typeof targeting != 'function') throw new TypeError(`Invalid autonomous entity parameter targeting: ${targeting}`);
        if (typeof pathfinding != 'function') throw new TypeError(`Invalid autonomous entity parameter pathfinding: ${pathfinding}`);

        super({x, y, z, content, name, health, health_max, defense, damage, speed, range});

        this.#targeting = targeting;
        this.#pathfinding = pathfinding;
    }

    get target() {
        let target = this.#target;
        // The function always returns null so...
        if (this.#target_never) return null;

        if (this.#target == null && !(target = this.#reset_target())) {
            this.#target_never = true;
            return null;
        }

        // Check if we've reached the target, and get a new one if so
        if (target) {
            let reset = false;

            if (target instanceof Entity) {
                reset = target.health <= 0;
            } else if (target instanceof Item) {
                reset = target.owner == this;
            } else {
                reset = coords_distance(this, target) <= 1 + target.solid;
            }

            if (reset) {
                target = this.#reset_target();
            }
        }

        if (target instanceof Item && target.owner) {
            target = this.#target = target.owner;
        }
        return target;
    }
    set target(target) {
        if (target instanceof Tile || target == null) {
            this.#target = target;
            this.path = null;
        }
    }
    get targeting() { return this.#targeting; }
    set targeting(targeting) {
        if (typeof targeting == 'function') {
            this.#targeting = targeting;
            this.#target_never = false;
        }
    }
    get pathfinding() { return this.#pathfinding; }
    set pathfinding(pathfinding) {
        if (typeof pathfinding == 'function') {
            this.#pathfinding = pathfinding;
            this.path = null;
        }
    }

    #reset_target() {
        /** @type {Tile|null} */
        let target = this.#targeting.call(this);
        if (target) {
            this.#target = target;
            this.path = null;
        }
        return target;
    }
    /**
     * @param {Direction} [dir]
     * @param {number} [multiplier]
     */
    move(dir=null, multiplier=1) {
        // Dead things can't move
        if (this.health <= 0) return;

        dir ??= this.#pathfinding.call(this);
        if (dir && !dir.every(n => n == 0)) super.move(dir, multiplier);
    }
    /**
     * Automatic item using
     *
     * @param {Item|number|string|null} [item] item|index|id|auto
     * @param {number|'max'} amount
     */
    use_item(item = null, amount=1) {
        if (item == null) {
            // Get only items that can be used
            let usables = this.inventory.filter(([i]) => Object.keys(i.on_use).length);
            if (!usables.length) return;

            // Get only items that have an impact, sorted by impact strength
            /** @type {[Item, number, number][]} */
            let useful = usables.map(([i, a]) => {
                let usefulness = 0;

                if (a > 0) {
                    Object.entries(i.on_use).forEach(([attr, change]) => {
                        if (`base_${attr}` in this) {
                            attr = `base_${attr}`;
                        }
                        if (!(attr in this)) return;

                        let clc_chng;
                        if (typeof change != 'object') {
                            clc_chng = change;
                        } else {
                            clc_chng = average(...Object.values(change));
                        }

                        let has_max = `${attr}_max` in this;
                        let overshoot = false;
                        let is_max = attr.endsWith('_max');
                        if (has_max) {
                            let max = this[`${attr}_max`];
                            overshoot = this[attr] + change > max || this[attr] <= Math.ceil(max / 2);
                        }

                        // A change is worth more if it's for a limited value
                        // A change is worth less if it goes above limited but is less than half
                        usefulness += clc_chng * (1 + 1 * has_max - .5 * overshoot) * (1 + .5 * is_max);
                    });
                    Object.entries(i.passive).forEach(([attr, change]) => {
                        if (`base_${attr}` in this) {
                            attr = `base_${attr}`;
                        }
                        if (!(attr in this)) return;

                        let clc_chng;
                        if (typeof change != 'object') {
                            clc_chng = change;
                        } else {
                            clc_chng = average(...Object.values(change));
                        }

                        let has_max = `${attr}_max` in this;
                        let overshoot = false;
                        let is_max = attr.endsWith('_max');
                        if (has_max) {
                            let max = this[`${attr}_max`];
                            overshoot = this[attr] + change > max || this[attr] <= Math.ceil(max / 2);
                        }

                        usefulness -= clc_chng * (1 + 1 * has_max - .5 * overshoot) * (1 + .5 * is_max);
                    });
                }

                return [i, a, usefulness];
            }).filter(r => r[2] > 0).sort((a,b) => b[2] - a[2]);
            if (!useful.length) return;

            // Get what is clearly the most useful item
            item = useful[0];
        }
        super.use_item(item, amount);
    }
    /**
     * Automatic item equipping
     *
     * @param {Item|number|string|null} item item|index|id|auto
     */
    equip_item(item = null) {
        // No equipment slot
        if (!Object.keys(this.equipment).length) return;

        if (item == null) {
            // Get only items that can be equipped
            let equippable = this.inventory.filter(([i]) => i.equip_slot in this.equipment && Object.keys(i.equipped).length);
            if (!equippable.length) return;

            // Get only items that have a better impact, sorted by impact strength
            /** @type {[Item, number][]} */
            let useful = equippable.map(([i, a]) => {
                let usefulness = 0;
                let compared = this.equipment[i.equip_slot];

                if (a > 0) {
                    Object.entries(i.equipped).forEach(([attr, change]) => {
                        if (`base_${attr}` in this) {
                            attr = `base_${attr}`;
                        }
                        if (!(attr in this)) return;

                        let is_max = attr.endsWith('_max');
                        let diff;
                        if (typeof change != 'object') {
                            diff = change - (compared?.[attr] ?? 0);
                        } else {
                            diff = average(...Object.values(change));
                            if (Object.keys(compared?.[attr] ?? {}).length) {
                                diff -= average(...Object.values(compared[attr]));
                            }
                        }
                        usefulness += diff * (1 + .5 * is_max);
                    });
                    Object.entries(i.passive).forEach(([attr, change]) => {
                        if (`base_${attr}` in this) {
                            attr = `base_${attr}`;
                        }
                        if (!(attr in this)) return;

                        let clc_chng;
                        if (typeof change != 'object') {
                            clc_chng = change;
                        } else {
                            clc_chng = average(...Object.values(change));
                        }

                        let has_max = `${attr}_max` in this;
                        let overshoot = false;
                        let is_max = attr.endsWith('_max');
                        if (has_max) {
                            let max = this[`${attr}_max`];
                            overshoot = this[attr] + change > max || this[attr] <= Math.ceil(max / 2);
                        }

                        usefulness -= clc_chng * (1 + 1 * has_max - .5 * overshoot) * (1 + .5 * is_max);
                    });
                }

                return [i, usefulness];
            }).filter(r => r[1] > 0).sort((a,b) => b[1] - a[1]);
            if (!useful.length) return;

            // Get what is clearly the most useful equipment
            item = useful[0];
        }
        super.equip_item(item);
    }
    /**
     * Automatic skill usage
     *
     * @param {Skill|number|string|null} [skill] skill|index|id|auto
     * @param {{x: number, y: number}?} [target]
     */
    use_skill(skill = null, target = null) {
        if (!this.skills.length) return;

        if (skill == null) {
            // Get only skills that can be cast
            let castables = this.skills.filter(s => s.cost <= this.magic && Object.keys(s.on_use_self).length + Object.keys(s.on_use_target).length);
            if (!castables.length) return;

            let dist = Infinity;
            if (this.#target) {
                dist = coords_distance(this, this.#target);
                target = this.#target;
            }

            // Filter between useful for this, and useful against target
            /** @type {[Skill, number][]} */
            let useful_self = castables.map(s => {
                let usefulness = 0;

                Object.entries(s.on_use_self).forEach(([attr, change]) => {
                    if (`base_${attr}` in this) {
                        attr = `base_${attr}`;
                    }
                    if (!(attr in this)) return;

                    let clc_chng;
                    if (typeof change != 'object') {
                        clc_chng = change;
                    } else {
                        clc_chng = average(...Object.values(change));
                    }

                    let has_max = `${attr}_max` in this;
                    let is_max = attr.endsWith('_max');
                    let overshoot = false;
                    if (has_max) {
                        let max = this[`${attr}_max`];
                        overshoot = this[attr] + change > max || this[attr] <= Math.ceil(max / 2);
                    }

                    usefulness += clc_chng * (1 + 1 * has_max - .5 * overshoot) * (1 + .5 * is_max);
                });

                return [s, usefulness / s.cost];
            }).filter(r => r[1] > 0);
            /** @type {[Skill, number][]} */
            let useful_target = castables.map(s => {
                let usefulness = 0;

                let within_range = dist <= s.range;

                within_range && Object.entries(s.on_use_target).forEach(([attr, change]) => {
                    if (`base_${attr}` in this) {
                        attr = `base_${attr}`;
                    }
                    if (!(attr in this)) return;

                    let clc_chng;
                    if (typeof change != 'object') {
                        clc_chng = change;
                    } else {
                        clc_chng = average(...Object.values(change));
                    }

                    let has_max = `${attr}_max` in this;
                    let is_max = attr.endsWith('_max');
                    let overshoot = false;
                    if (has_max) {
                        let max = this[`${attr}_max`];
                        overshoot = this[attr] + change > max || this[attr] <= Math.ceil(max / 2);
                    }

                    // Multiply by -1 to make sure only damaging things are chosen
                    usefulness += clc_chng * (1 + 1 * has_max - .5 * overshoot) * (1 + .5 * is_max) * -1;
                });

                return [s, usefulness / s.cost];
            }).filter(r => r[1] > 0);

            if (!(useful_self.length + useful_target.length)) return;

            // Choose the most useful skill
            let bests = [
                useful_self[0] ?? [null, -1],
                useful_target[0] ?? [null, -1],
            ].sort((a,b) => b[1] - a[1]);

            // Forget the target, it's for ourselves
            if (target && bests[0] == useful_self[0]) target = null;

            skill = bests[0][0];
        }
        super.use_skill(skill, target);
    }
}
/**
 * @see https://medium.com/@polyismstudio/a-pathfinding-in-javascript-1963759cf26
 */
export class Path {
    /** @type {[number, number]} */
    start;
    /** @type {[number, number]} */
    goal;

    /** @param {[number, number]} start @param {[number, number]} goal @param {Entity|Entity[]} [e] */
    find(start, goal, e=null) {
        this.start = start;
        this.goal = goal;

        /** @type {{[k: string]: boolean}} */
        const visited_set = {}; // Processed coords
        /** @type {{[k: string]: [number, number]}} */
        const paths = {}; // Path back to the start
        /** @type {{[k: string]: number}} */
        const score_g = {}; // Distance from start to position
        /** @type {{[k: string]: number}} */
        const score_f = {}; // Approximate distance from position to goal
        /** @type {MinHeap<[number, number]>} */
        const open_set = new MinHeap(i => i in score_f ? score_f[i] : Infinity); // Nodes to be processed

        score_g[start] = 0;
        score_f[start] = this.cost_estimate(start, goal);
        open_set.push(start);

        // Loop until we find the path or we run out of tiles
        while (open_set.items.length) {
            let current = open_set.pop();

            if (this.is_goal(current)) {
                // We found the path!
                return this.path_back(paths, current);
            }

            visited_set[current] = true;
            const neighbours = this.neighbours(current);
            neighbours.forEach(neighbour => {
                if (!can_walk(neighbour, e) || neighbour in visited_set) return;

                const tentativeScore = score_g[current] + 1;

                if (!score_f[neighbour]) {
                    paths[neighbour] = current;
                    score_g[neighbour] = tentativeScore;
                    score_f[neighbour] = tentativeScore + this.cost_estimate(neighbour, goal);
                    open_set.push(neighbour);
                } else if (tentativeScore < score_g[neighbour]) {
                    let previous = open_set.items.find(c => c.every((n,i) => neighbour[i] == n));
                    paths[neighbour] = current;
                    score_g[neighbour] = tentativeScore;
                    score_f[neighbour] = tentativeScore + this.cost_estimate(neighbour, goal);
                    open_set.delete(previous);
                    open_set.push(neighbour);
                }
            });
        }
    }

    /** @param {[number, number]} node1 @param {[number, number]} node2 */
    cost_estimate(node1, node2) {
        return (node1[0] - node2[0]) ** 2 + (node1[1] - node2[1]) ** 2;
    }

    /** @param {[number, number]} node */
    is_goal(node) {
        return node.every((n,i) => this.goal[i] == n);
    }

    /** @param {[number, number]} node @returns {[number, number][]} */
    neighbours(node) {
        return [
            [node[0] - 1, node[1]],
            [node[0] + 1, node[1]],
            [node[0], node[1] - 1],
            [node[0], node[1] + 1],
        ];
    }

    /** @param {{[k: string]: [number, number]}} cameFrom @param {[number, number]} current */
    path_back(cameFrom, current) {
        let counter = 0;
        /** @type {[number, number][]} */
        const path = [];
        while (current != this.start) {
            path.push(current);
            current = cameFrom[current];
            // Path is longer than a million tiles
            if (counter++ >= 1e6) {
                return null;
            }
        }
        path.push(this.start);
        return path.reverse();
    }
}
