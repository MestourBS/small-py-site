import { context as canvas_context } from './canvas.js';
import { isinstance } from './primitives.js';
import { tile_size, display_size, get_theme_value } from './display.js';
import Color from './color.js';
import globals from './globals.js';
/** @typedef {import('./entity.js').Entity} Entity */

/**
 * @template {Color|string|CanvasImageSource|(x: number, y: number, context?: CanvasRenderingContext2D, this: Tile<T>) => void} T
 */
export class Tile {
    /**
     * Current game grid
     *
     * @type {Tile[]}
     */
    static grid = [];
    /** @type {Tile[]|false} */
    static #visible_grid = false;
    /** @type {Tile[]|false} */
    static #solid_tiles = false;
    static focused_x;
    static focused_y;

    /** @type {Tile[]} */
    static get visible_grid() {
        if (this.focused_x != globals.focused_entity.x || this.focused_y != globals.focused_entity.y) {
            this.#visible_grid = false;
            this.focused_x = globals.focused_entity.x;
            this.focused_y = globals.focused_entity.y;
        }
        if (this.#visible_grid === false) {
            this.#visible_grid = this.grid.filter(t => t.is_visible);
        }
        return this.#visible_grid;
    }
    /** @param {Tile[]|false} value */
    static set visible_grid(value) {
        if (value === false) {
            this.#visible_grid = false;
            return;
        }

        if (!Array.isArray(value)) value = [];
        else if (!value.every(t => t instanceof Tile)) value = value.filter(t => t instanceof Tile);

        this.#visible_grid = value;
    }
    static get solid_tiles() {
        if (this.#solid_tiles === false) {
            this.#solid_tiles = this.grid.filter(t => t.solid);
        }
        return this.#solid_tiles;
    }

    /** @type {T} */
    #content;
    /** @type {null|(entity: Entity, this: Tile<T>) => void} */
    #interacted;

    /** @type {((content: string) => T)[]} */
    #converters = [
        Color.from_hex,
        Color.from_css_rgb,
        Color.from_html_name,
    ];

    /**
     * @param {Object} params
     * @param {number} params.x
     * @param {number} params.y
     * @param {number} params.z
     * @param {T} params.content
     * @param {boolean} [params.solid=false]
     * @param {boolean} [params.insert=true]
     * @param {(entity: Entity, this: Tile<T>) => void} [params.interacted]
     * @param {boolean} [params.override=true]
     */
    constructor({x, y, z, content, solid=false, insert=true, interacted=null, override=true}) {
        override &&= insert;

        if (typeof x != 'number') throw new TypeError(`Invalid Tile parameter x: ${x}`);
        if (typeof y != 'number') throw new TypeError(`Invalid Tile parameter y: ${y}`);
        if (typeof z != 'number') throw new TypeError(`Invalid Tile parameter z: ${z}`);
        if (typeof content == 'function'); // Don't bind to this, it will break future rebinds
        else if (isinstance(content, Color, HTMLCanvasElement, HTMLImageElement, SVGImageElement, HTMLVideoElement, ImageBitmap));
        else if (typeof content == 'string') {
            for (let conv of this.#converters) {
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
            for (let conv of this.#converters) {
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

    toJSON() {
        let json = {
            x: this.x,
            y: this.y,
            z: this.z,
            solid: this.solid,
            content: '',
        };

        if (this.#content instanceof Color) {
            json.content = this.#content.toJSON();
        } else if ('src' in this.#content) {
            json.content = this.#content.src;
        }

        return json;
    }

    get is_visible() {
        let x_low = globals.focused_entity.x - display_size[0] / 2 - 1;
        let x_high = globals.focused_entity.x + display_size[0] / 2;
        let y_low = globals.focused_entity.y - display_size[1] / 2 - 1;
        let y_high = globals.focused_entity.y + display_size[1] / 2;

        return this.x >= x_low && this.x <= x_high && this.y >= y_low && this.y <= y_high;
    }

    /**
     * @param {number} [x]
     * @param {number} [y]
     * @param {CanvasRenderingContext2D} [context]
     */
    draw(x = null, y = null, context = null) {
        context ??= canvas_context;

        let x_start = x ?? (this.x - (globals.focused_entity.x - display_size[0] / 2)) * tile_size[0];
        let y_start = y ?? (this.y - (globals.focused_entity.y - display_size[1] / 2)) * tile_size[1];
        let content = this.#content;

        if (typeof content == 'function') {
            content.call(this, x ?? x_start, y ?? y_start, context);
        } else if (typeof content == 'string') {
            context.textAlign = 'center';
            context.fillStyle = '#000';
            context.font = `${tile_size[1]}px ${get_theme_value('text_font')}`;
            x_start += tile_size[0] / 2;
            y_start += tile_size[1] - 5;

            context.fillText(content, x_start, y_start);
        } else if (content instanceof Color) {
            context.fillStyle = content.toString();
            // Add .5 to the dimensions to prevent white lines from appearing at some player speeds
            context.fillRect(x_start, y_start, tile_size[0] + .5, tile_size[1] + .5);
        } else if (isinstance(content, HTMLCanvasElement, HTMLImageElement, SVGImageElement, HTMLVideoElement, ImageBitmap)) {
            context.drawImage(content, x_start, y_start, tile_size[0] + .5, tile_size[1] + .5);
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
        Tile.#visible_grid = false;
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
