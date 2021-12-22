import { Tile } from './tile.js';
import { Entity } from './entity.js';
import { context as canvas_context } from './canvas.js';
import { number_between, isinstance } from './primitives.js';
import { get_theme_value, tile_size, inventory_items_per_row } from './display.js';
import Color from './color.js';
import Random from './random.js';
/**
 * @typedef {(options: {x: number, y: number, context: CanvasRenderingContext2D, mode: DrawMode, inventory?: 0|1|2}, this: Item) => void} ItemCustomDraw
 */

/**
 * @template {Color|string|CanvasImageSource|ItemCustomDraw} T
 */
export class Item extends Tile {
    /** @type {{[k: string]: Item}} */
    static #items = {};
    /**
     * Gets an item
     *
     * @template {T} U
     * @param {string} item_id
     * @param {Item<U>} overrides
     * @returns {Item<U|T>?}
     */
    static get_item(item_id, overrides={}) {
        if (item_id in this.#items) {
            return this.#items[item_id].copy(overrides);
        }
        return null;
    }
    /**
     * Gets a few random item_ids
     *
     * @param {number} [amount]
     * @returns {string[]}
     */
    static get_random_items(amount=null) {
        let ids = [];

        if (amount == null) {
            Object.keys(this.#items).forEach(id => {
                ids.push(...new Array(Math.ceil(Random.range(0, 10))).fill(id));
            });
        } else {
            for (let i = 0; i < amount; i++) {
                ids.push(Random.array_element(Object.keys(this.#items)));
            }
        }
        return ids;
    }

    /**
     * @param {Object} params
     * @param {number} params.x
     * @param {number} params.y
     * @param {number} params.z
     * @param {T} params.content
     * @param {string} params.id
     * @param {string} [params.name]
     * @param {string} [params.description]
     * @param {{[k: string]: number|{[k: string]: number}}} [params.on_use]
     * @param {{[k: string]: number|{[k: string]: number}}} [params.passive]
     * @param {{[k: string]: number|{[k: string]: number}}} [params.equipped]
     * @param {number} [params.equip_slot]
     * @param {Entity} [params.owner]
     * @param {boolean} [params.insert]
     */
    constructor({
        x, y, z, id, name=null, description=null, content, insert=false,
        on_use={}, passive={}, equipped={}, equip_slot=null, owner=null,
    }) {
        if (typeof on_use != 'object') throw new TypeError(`Invalid item parameter on_use: ${on_use}`);
        if (typeof passive != 'object') throw new TypeError(`Invalid item parameter passive: ${passive}`);
        if (typeof equipped != 'object') throw new TypeError(`Invalid item parameter equipped: ${equipped}`);
        if (isNaN(equip_slot)) throw new TypeError(`Invalid item parameter equip_slot: ${equip_slot}`);
        if (owner && !(owner instanceof Entity)) throw new TypeError(`Invalid item parameter owner: ${owner}`);

        super({x, y, z, content, solid: false, insert, override: false, interacted: function(e) {
            // Recalculate x and y according to current position in inventory
            let inv = e.inventory;
            this.owner = e;
            let i = inv.findIndex(([i,]) => i.id == this.id);
            if (i == -1) {
                i = inv.length;
                inv.push([this, 1]);
            } else {
                inv[i][1]++;
            }
            this.re_position();

            // Remove from grid
            if (Tile.grid.includes(this)) {
                let i = Tile.grid.indexOf(this);
                Tile.grid.splice(i, 1);
            }
            if (Tile.visible_grid_world.includes(this)) {
                let i = Tile.visible_grid_world.indexOf(this);
                Tile.visible_grid_world.splice(i, 1);
            }
        }});

        this.name = name == null ? '' : name.toString();
        this.description = description == null ? '' : description.toString();
        /** @type {Entity|null} */
        this.owner = null;
        this.on_use = on_use;
        this.passive = passive;
        this.equipped = equipped;
        this.equip_slot = equip_slot == null ? null : +equip_slot;
        this.id = id;

        if (!(id in Item.#items)) Item.#items[id] = this;
    }

    get is_visible_world() {
        return !this.owner && super.is_visible_world;
    }
    get is_visible_mini() {
        return !this.owner && super.is_visible_mini;
    }
    get is_visible_inventory() {
        if (!this.owner) return false;

        let item_rows = Math.max(Math.ceil((Math.floor(DISPLAY_SIZE[0] / 3) - 1) / 2), 1);
        let min_y = 0;
        let max_y = item_rows;

        if (globals.cursors.inventory[1] > item_rows) {
            min_y += globals.cursors.inventory[1] - item_rows;
            max_y += globals.cursors.inventory[1] - item_rows;
        }

        return number_between(this.y, min_y, max_y);
    }

    /**
     * Creates a copy of this item
     *
     * @template {T} U
     * @param {Item<U>} overrides
     * @returns {Item<U|T>}
     */
    copy(overrides={}) {
        let {x, y, z, id, content, on_use, passive, stored, name, description, equipped, equip_slot, owner} = this;
        let item = {x, y, z, id, content, on_use: {}, passive: {}, equipped: {}, equip_slot, stored, insert: false, name, description, owner};
        Object.entries(on_use).forEach(([attr, change]) => {
            if (typeof change == 'number') {
                item.on_use[attr] = change;
            } else {
                item.on_use[attr] = {};
                Object.entries(change).forEach(([type, change]) => {
                    item.on_use[attr][type] = change;
                });
            }
        });
        Object.entries(passive).forEach(([attr, change]) => {
            if (typeof change == 'number') {
                item.passive[attr] = change;
            } else {
                item.passive[attr] = {};
                Object.entries(change).forEach(([type, change]) => {
                    item.passive[attr][type] = change;
                });
            }
        });
        Object.entries(equipped).forEach(([attr, change]) => {
            if (typeof change == 'number') {
                item.equipped[attr] = change;
            } else {
                item.equipped[attr] = {};
                Object.entries(change).forEach(([type, change]) => {
                    item.equipped[attr][type] = change;
                });
            }
        });
        Object.entries(overrides).forEach(([attr, value]) => {
            item[attr] = value;
        });
        return new Item(item);
    }
    /**
     * Calculates the item's position according to the owner's inventory
     *
     * @param {Entity} [entity] owner
     */
    re_position(entity = null) {
        entity ??= this.owner;
        if (!entity) return;

        // x and y are dependant on inventory index
        let inv = entity.inventory;
        let i = inv.findIndex(([i,]) => i == this);

        let items_per_row = inventory_items_per_row();
        if (i != -1) {
            this.x = i % items_per_row;
            this.y = Math.floor(i / items_per_row);
        } else {
            this.x = items_per_row;
            this.y = this.equip_slot;
        }
    }
    /**
     * @param {Object} params
     * @param {number} [params.x]
     * @param {number} [params.y]
     * @param {CanvasRenderingContext2D} [params.context]
     * @param {number} [params.amount]
     */
    draw_inventory({x = null, y = null, context = null, amount=1}) {
        context ??= canvas_context;

        let offset_x = tile_size[0];
        let offset_y = tile_size[1];
        let x_start = x ?? this.x * 3 * tile_size[0] + offset_x;
        let y_start = y ?? this.y * 3 * tile_size[1] + offset_y;
        /** @type {T} */
        let content = this.content;

        if (typeof content == 'function') {
            let inventory = +!!this.owner;
            if (this.owner && this.owner.equipment[this.equip_slot] == this) inventory++;
            content.call(this, {x: this.x, y: this.y, context, inventory});
        } else if (typeof content == 'string') {
            context.textAlign = 'center';
            context.fillStyle = get_theme_value('text_default_tile_color');
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

        if (amount != 1) {
            context.textAlign = 'right';
            context.fillStyle = get_theme_value('text_item_amount_color');
            context.font = `${tile_size[1]}px ${get_theme_value('text_font')}`;
            let x = x_start + tile_size[0] * 2;
            let y = y_start + tile_size[1] * 2;

            context.fillText(amount, x, y);
        }
    }
}

/**
 * Creates the items for the game
 */
export function create_items() {
    /**
     * @type {{
     *  content: Color|string|CanvasImageSource|(x: number, y: number, inventory: boolean, this: Item) => void,
     *  id: string,
     *  name?: string,
     *  description?: string,
     *  on_use?: {[k: string]: number|{[k: string]: number}},
     *  passive?: {[k: string]: number|{[k: string]: number}},
     *  equipped?: {[k: string]: number|{[k: string]: number}},
     *  equip_slot?: number,
     *  x?: number,
     *  y?: number,
     *  z?: number,
     * }[]}
     */
    let items = [
        {
            content: '∅',
            id: 'no',
            passive: {
                speed: .25,
            },
            name: gettext('games_rpg_items_no'),
        },
        {
            content: '✔',
            id: 'yes',
            on_use: {
                health: 1,
            },
            name: gettext('games_rpg_items_yes'),
        },
        {
            content: '🎂',
            id: 'cake',
            on_use: {
                health: 5,
            },
            passive: {
                health_max: 1,
            },
            name: gettext('games_rpg_items_cake'),
        },
        {
            content: '🧱',
            id: 'bricks',
            name: gettext('games_rpg_items_bricks'),
            equip_slot: 5,
            equipped: {
                damage: {
                    none: 1,
                },
            },
        },
        {
            content: '✨',
            id: 'sparks',
            equip_slot: 1,
            equipped: {
                speed: 10,
            },
            name: gettext('games_rpg_items_sparks'),
        },
        {
            content: '🏁',
            id: 'flag',
            equip_slot: 0,
            equipped: {
                health_max: 1,
            },
            name: gettext('games_rpg_items_flag'),
        },
        {
            content: '🎁',
            id: 'gift',
            equip_slot: 0,
            equipped: {
                speed: 1,
            },
            name: gettext('games_rpg_items_gift'),
        },
        {
            content: '☘',
            id: 'clover',
            name: gettext('games_rpg_items_clover'),
            on_use: {
                magic: 5,
            },
        },
        {
            content: '🔥',
            id: 'fire',
            name: gettext('games_rpg_items_fire'),
        },
        {
            content: '💲',
            id: 'cash',
            name: gettext('games_rpg_items_cash'),
        },
        {
            // Everyone knows video games cause violence
            content: '🎮',
            id: 'video_game',
            name: gettext('games_rpg_items_video_game'),
            equip_slot: 5,
            equipped: {
                damage: {
                    none: 1,
                },
            },
        },
    ];

    items.forEach(item => {
        if (Item.get_item(item.id)) return;

        item.x = 0;
        item.y = 0;
        item.z = 1;

        new Item(item);
    });
}
