import { context as canvas_context } from './canvas.js';
import globals from './globals.js';
/**
 * @typedef {import('./position.js').PointLike} PointLike
 */

export class Machine {
    /** @type {{[id: string]: Machine}} */
    static #machine_registry = {};
    /** @type {Machine[]} */
    static #machines = [];
    /** @type {Machine[]|false} */
    static #visible_machines = false;
    /** @type {[number, number]} */
    static #vis_pos = [NaN, NaN];

    static get machines() { return [...this.#machines]; }
    static get visible_machines() {
        const pos = globals.position;
        if (pos.some((n, i) => n != this.#vis_pos[i])) {
            this.#visible_machines = false;
            this.#vis_pos = [...pos];
        }
        if (!this.#visible_machines) {
            this.#visible_machines = this.#machines.filter(m => m.is_visible);
        }
        return this.#visible_machines;
    }

    /**
     * Gets a copy of a machine
     *
     * @param {string} id
     * @param {Object} [parts]
     * @returns {Machine}
     */
    static get_machine_copy(id, parts=null) {
        if (!(id in this.#machine_registry)) {
            throw new RangeError(`Unknown machine id (${id})`);
        }

        const machine = this.#machine_registry[id];
        return machine.clone(parts ?? machine);
    }

    /**
     * @param {Object} params
     * @param {string?} [params.id]
     * @param {number?} [params.x]
     * @param {number?} [params.y]
     * @param {string?} [params.name]
     * @param {number} [params.level]
     */
    constructor({id = null, x = null, y = null, name = null, level = 0}) {
        if ((x == null) != (y == null)) throw new TypeError(`Both machine x and y must be either null or not null simultaneously (${x}, ${y})`);
        if (isNaN(x)) throw new TypeError(`Machine x is NaN (${x})`);
        if (isNaN(y)) throw new TypeError(`Machine y is NaN (${y})`);
        if (isNaN(level)) throw new TypeError(`Machine level is NaN (${level})`);

        this.#id = id;
        this.#x = x;
        this.#y = y;
        this.#name = name;
        this.#level = level;

        Machine.#machines.push(this);
        if (id && !(id in Machine.#machine_registry)) {
            Machine.#machine_registry[id] = this;
        }
    }

    #x;
    #y;
    #id;
    #name;
    #level;

    get x() { return this.#x; }
    get y() { return this.#y; }
    get id() { return this.#id; }
    get is_visible() { return false; }

    get name() { return this.#name ?? this.#id; }
    set name(name) { this.#name = name + ''; }

    get level() { return this.#level; }
    set level(level) { if (!isNaN(level)) this.#level = Math.max(0, level); }

    /**
     * Checks whether the machine contains the point at [X, Y] (absolute in grid)
     *
     * @param {PointLike} point
     */
    contains_point(point) { return false; }

    /** Draws the machine */
    draw({context=canvas_context}={}) { if (this.constructor != Machine) throw new Error(`${this.constructor.name} has no draw function!`); }

    /**
     * Copies the machine
     *
     * @param {Object} [parts]
     * @param {number} [parts.x]
     * @param {number} [parts.y]
     */
    clone({x, y}=this) {
        x ??= this.x;
        y ??= this.y;
        const id = this.id;
        return new Machine({id, x, y});
    }

    /**
     * Action to perform on click
     *
     * @param {MouseEvent} event
     */
    click(event) {}

    /**
     * Action to perform on context menu
     *
     * @param {MouseEvent} event
     */
    contextmenu(event) {}

    /**
     * Upgrades the machine
     */
    upgrade() {}
}

export default Machine;
