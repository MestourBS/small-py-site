import { context as canvas_context } from './canvas.js';
import { isinstance, number_between } from './primitives.js';
import { tile_size, display_size, get_theme_value } from './display.js';
import Color from './color.js';
import globals from './globals.js';
/**
 * @typedef {import('./entity.js').Entity} Entity
 *
 * @typedef {'world'|'storage'|'mini'} DrawMode
 * @typedef {(options: {x: number, y: number, context: CanvasRenderingContext2D, mode: DrawMode}, this: Tile) => void} TileCustomDraw
 */

/**
 * Z layers for the different things
 */
export const Z_LAYERS = Object.freeze({
    'tile': 0,
    'dead_entities': 1,
    'item': 2,
    'autonomous_entity': 9,
    'player': 10,
});

/**
 * @template {Color|string|CanvasImageSource|TileCustomDraw) => void} T
 */
export class Tile {
    /**
     * Current game grid
     *
     * @type {Tile[]}
     */
    static grid = [];
    /** @type {Tile[]|false} */
    static #visible_grid_world = false;
    /** @type {Tile[]|false} */
    static #visible_grid_mini = false;
    /** @type {Tile[]|false} */
    static #solid_tiles = false;
    static #focused_x;
    static #focused_y;
    /** @type {((content: string) => T)[]} */
    static #converters = [
        Color.from_hex,
        Color.from_css_rgb,
        Color.from_html_name,
    ];

    /** @type {Tile[]} */
    static get visible_grid_world() {
        if (this.#focused_x != globals.focused_entity.x || this.#focused_y != globals.focused_entity.y) {
            this.#visible_grid_world = false;
            this.#focused_x = globals.focused_entity.x;
            this.#focused_y = globals.focused_entity.y;
        }
        if (this.#visible_grid_world === false) {
            this.#visible_grid_world = this.grid.filter(t => t.is_visible_world);
        }
        return this.#visible_grid_world;
    }
    /** @param {Tile[]|false} value */
    static set visible_grid_world(value) {
        if (value === false) {
            this.#visible_grid_world = false;
            return;
        }

        if (!Array.isArray(value)) value = [];
        else if (!value.every(t => t instanceof Tile)) value = value.filter(t => t instanceof Tile);

        this.#visible_grid_world = value;
    }
    /** @type {Tile[]} */
    static get visible_grid_mini() {
        if (this.#focused_x != globals.focused_entity.x || this.#focused_y != globals.focused_entity.y) {
            this.#visible_grid_mini = false;
            this.#focused_x = globals.focused_entity.x;
            this.#focused_y = globals.focused_entity.y;
        }
        if (this.#visible_grid_mini === false) {
            this.#visible_grid_mini = this.grid.filter(t => t.is_visible_mini);
        }
        return this.#visible_grid_mini;
    }
    /** @param {Tile[]|false} value */
    static set visible_grid_mini(value) {
        if (value === false) {
            this.#visible_grid_mini = false;
            return;
        }

        if (!Array.isArray(value)) value = [];
        else if (!value.every(t => t instanceof Tile)) value = value.filter(t => t instanceof Tile);

        this.#visible_grid_mini = value;
    }
    /** @type {Tile[]} */
    static get solid_tiles() {
        if (this.#solid_tiles === false) {
            this.#solid_tiles = this.grid.filter(t => t.solid);
        }
        return this.#solid_tiles;
    }
    /** @param {Tile[]|false} value */
    static set solid_tiles(value) {
        if (value === false) {
            this.#solid_tiles = false;
            return;
        }

        if (!Array.isArray(value)) value = [];
        else if (!value.every(t => t instanceof Tile)) value = value.filter(t => t instanceof Tile);

        this.#solid_tiles = value;
    }

    /** @type {T} */
    #content;
    /** @type {null|(entity: Entity, this: Tile<T>) => void} */
    #interacted;

    /**
     * @param {Object} params
     * @param {number} params.x
     * @param {number} params.y
     * @param {number|keyof Z_LAYERS} params.z
     * @param {T} params.content
     * @param {boolean} [params.solid=false]
     * @param {boolean} [params.insert=true]
     * @param {(entity: Entity, this: Tile<T>) => void} [params.interacted]
     * @param {boolean} [params.override=true]
     */
    constructor({x, y, z=Z_LAYERS.tile, content, solid=false, insert=true, interacted=null, override=true}) {
        override &&= insert;

        if (z in Z_LAYERS) z = Z_LAYERS[z];
        if (typeof x != 'number') throw new TypeError(`Invalid Tile parameter x: ${x}`);
        if (typeof y != 'number') throw new TypeError(`Invalid Tile parameter y: ${y}`);
        if (typeof z != 'number') throw new TypeError(`Invalid Tile parameter z: ${z}`);
        if (typeof content == 'function'); // Don't bind to this, it will break future rebinds
        else if (isinstance(content, Color, HTMLCanvasElement, HTMLImageElement, SVGImageElement, HTMLVideoElement, ImageBitmap));
        else if (typeof content == 'string') {
            for (let conv of Tile.#converters) {
                try {
                    let c = conv(content);
                    content = c;
                    break;
                } catch {}
            }
        } else throw new TypeError(`Invalid Tile parameter content: ${content}`);
        if (typeof interacted != 'function' && interacted != null) throw new TypeError(`Invalid Tile parameter interacted: ${interacted}`);

        this.x = x;
        this.y = y;
        this.z = z;
        this.solid = !!solid;
        this.#content = content;
        this.#interacted = interacted;

        if (insert) {
            this.insert(override);
        }
    }

    /** @type {T} */
    get content() { return this.#content; }
    set content(content) {
        if (typeof content == 'function') {
            content = content;
        } else if (typeof content == 'string') {
            for (let conv of Tile.#converters) {
                try {
                    let c = conv(content);
                    content = c;
                    break;
                } catch {}
            }
        } else if (isinstance(content, Color, HTMLCanvasElement, HTMLImageElement, SVGImageElement, HTMLVideoElement, ImageBitmap));
        else return;
        this.#content = content;
    }
    get can_interact() { return !!this.#interacted; }

    get is_visible_world() {
        let x_low = globals.focused_entity.x - display_size[0] / 2 - 1;
        let x_high = globals.focused_entity.x + display_size[0] / 2;
        let y_low = globals.focused_entity.y - display_size[1] / 2 - 1;
        let y_high = globals.focused_entity.y + display_size[1] / 2;

        return this.x >= x_low && this.x <= x_high && this.y >= y_low && this.y <= y_high;
    }
    get is_visible_mini() {
        let x_low = globals.focused_entity.x - display_size[0] * 2 - 1;
        let x_high = globals.focused_entity.x + display_size[0] * 2;
        let y_low = globals.focused_entity.y - display_size[1] * 2 - 1;
        let y_high = globals.focused_entity.y + display_size[1] * 2;

        return number_between(this.x, x_low, x_high) && number_between(this.y, y_low, y_high);
    }

    /**
     * @param {Object} params
     * @param {number} [params.x]
     * @param {number} [params.y]
     * @param {CanvasRenderingContext2D} [params.context]
     * @param {DrawMode} [params.mode]
     */
    draw({x = null, y = null, context = null, mode = 'world'} = {}) {
        context ??= canvas_context;
        let x_start, y_start, width, height;

        switch (mode) {
            case 'world':
                x_start = x ?? (this.x - (globals.focused_entity.x - display_size[0] / 2)) * tile_size[0];
                y_start = y ?? (this.y - (globals.focused_entity.y - display_size[1] / 2)) * tile_size[1];
                width = tile_size[0];
                height = tile_size[1];
                break;
            case 'storage':
                x_start = (this.x * 3 + 1) * tile_size[0];
                y_start = (this.y * 3 + 1) * tile_size[1];
                width = tile_size[0] * 2;
                height = tile_size[1] * 2;
                break;
            case 'mini':
                x_start = x ?? (this.x - globals.focused_entity.x) * tile_size[0] / 4 + display_size[0] * tile_size[0] / 2;
                y_start = y ?? (this.y - globals.focused_entity.y) * tile_size[1] / 4 + display_size[1] * tile_size[1] / 2;
                width = tile_size[0] / 4;
                height = tile_size[1] / 4;
                break;
            default:
                console.error(`Unknown mode ${mode}`);
                return;
        }

        let content = this.#content;

        if (typeof content == 'function') {
            content.call(this, {x: x ?? x_start, y: y ?? y_start, context, mode});
        } else if (typeof content == 'string') {
            context.textAlign = 'center';
            context.fillStyle = get_theme_value('text_default_tile_color');
            context.font = `${height}px ${get_theme_value('text_font')}`;
            x_start += width / 2;
            y_start += height * .85;

            context.fillText(content, x_start, y_start);
        } else if (content instanceof Color) {
            context.fillStyle = content;
            // Add a little to the size to prevent white lines from appearing at some player positions
            context.fillRect(x_start, y_start, width + .25, height + .25);
        } else if (isinstance(content, HTMLCanvasElement, HTMLImageElement, SVGImageElement, HTMLVideoElement, ImageBitmap)) {
            context.drawImage(content, x_start, y_start, width + .25, height + .25);
        } else {
            console.error(`Unknown tile content type ${content}`);
        }
    }
    /**
     * Inserts the tile in the grid
     *
     * @param {boolean} [overwrite=false]
     */
    insert(overwrite = false) {
        if (Tile.grid.includes(this)) return;
        let i = Tile.grid.findIndex(t => t.x == this.x && t.y == this.y && t.z == this.z);
        if (overwrite || i == -1) {
            if (i != -1 && overwrite) Tile.grid[i] = this;
            else Tile.grid.push(this);
        }
        globals.can_walked = {};
        Tile.#visible_grid_world = false;
        Tile.#visible_grid_mini = false;
        Tile.#solid_tiles = false;
    }
    /**
     * Does an interaction with the tile
     *
     * @param {Entity} entity
     */
    interacted(entity) {
        this.#interacted?.call(this, entity);
    }
}
