import { context as canvas_context, display_size, grid_spacing } from './canvas.js';
import globals from './globals.js';
import { check_can_afford } from './inventory.js';
/**
 * @typedef {import('./canvas.js').GameTab} GameTab
 * @typedef {import('./position.js').PointLike} PointLike
 */

//todo complete machines (storage & maker in one)
//todo move group of machines

export const stars = [
    '✦', '★', '✶', '✷', '✹', '⭐', '🌟',
];

export class Machine {
    /** @type {{[id: string]: Machine}} */
    static #machine_registry = {};
    /** @type {Machine[]} */
    static #machines = [];
    /** @type {Machine[]|false} */
    static #visible_machines = false;
    /** @type {[number, number]} */
    static #vis_pos = [NaN, NaN];

    /** @type {Machine[]} */
    static get machines() {
        // Allows children classes to access it themselves
        if (this != Machine) return Machine.machines;

        return [...this.#machines];
    }
    /** @type {Machine[]} */
    static get visible_machines() {
        // Allows children classes to access it themselves
        if (this != Machine) return Machine.visible_machines;

        const {position} = globals;
        if (position.some((n, i) => n != this.#vis_pos[i])) {
            this.#visible_machines = false;
            this.#vis_pos = [...position];
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
    static get_machine_copy(id, parts={}) {
        // Allows children classes to access it themselves
        if (this != Machine) return Machine.get_machine_copy(id, parts);

        if (!(id in this.#machine_registry)) {
            throw new RangeError(`Unknown machine id (${id})`);
        }
        if ('id' in parts) delete parts.id;

        const machine = this.#machine_registry[id];
        return machine.clone(parts ?? machine);
    }
    static reset_visible_machines() {
        if (this != Machine) {
            Machine.reset_visible_machines();
            return;
        }

        this.#visible_machines = false;
    }

    /**
     * @param {Object} params
     * @param {string?} [params.id]
     * @param {number?} [params.x]
     * @param {number?} [params.y]
     * @param {string?} [params.name]
     * @param {number} [params.level]
     * @param {string|HTMLImageElement?} [params.image]
     * @param {boolean} [params.insert]
     */
    constructor({id = null, x = null, y = null, name = null, level = 0, image = null, insert = true}) {
        if ((x == null) != (y == null)) throw new TypeError(`Both machine x and y must be either null or not null simultaneously (${x}, ${y})`);
        if (isNaN(x)) throw new TypeError(`Machine x is NaN (${x})`);
        if (isNaN(y)) throw new TypeError(`Machine y is NaN (${y})`);
        if (isNaN(level)) throw new TypeError(`Machine level is NaN (${level})`);
        if (typeof image == 'string') {
            const i = new Image;
            i.src = image;
            image = i;
        } else if (image != null && !(image instanceof Image)) throw new TypeError(`Image must be an url, an image object or null (${image})`);

        this.#id = id;
        this.#x = x;
        this.#y = y;
        this.#name = name;
        this.#level = level;
        this.#image = image;

        if (insert) {
            Machine.#machines.push(this);

            if (id && !(id in Machine.#machine_registry)) {
                Machine.#machine_registry[id] = this;
            }
        }
    }

    #x;
    #y;
    #id;
    #name;
    #level;
    /** @type {HTMLImageElement} */
    #image;
    #moving = false;

    get x() { return this.#x; }
    get y() { return this.#y; }
    get id() { return this.#id; }
    get is_visible() { return false; }
    get image() { return this.#image; }
    get radius() { return 0; }
    get index() { return Machine.machines.indexOf(this); }
    /** @type {[string, number][]|false} */
    get upgrade_costs() { return false; }

    get moving() { return this.#moving; }
    set moving(moving) { this.#moving = !!moving; }

    get name() { return this.#name ?? this.#id; }
    set name(name) { this.#name = name + ''; }

    get level() { return this.#level; }
    set level(level) {
        if (!isNaN(level)) {
            this.#level = Math.max(0, level);
            Machine.machines.forEach(m => m.can_upgrade = false);
            check_can_afford();
        }
    }
    get can_upgrade() { return false; }
    set can_upgrade(can) {}

    /**
     * Converts a level to an amount of stars
     *
     * @param {number} [level]
     * @returns {string}
     */
    level_to_stars(level = this.level) {
        return level.toString(5).split('').map((s, i) => stars[i].repeat(+s)).join('');
    }

    toJSON() {
        return {
            x: this.#x,
            y: this.#y,
            id: this.#id,
            level: this.#level,
        };
    }

    /**
     * Removes the machine from the machine list
     */
    destroy() {
        let i = Machine.#machines.indexOf(this);
        while (i != -1) {
            Machine.#machines.splice(i, 1);
            i = Machine.#machines.indexOf(this);
        }
        if (Machine.#visible_machines !== false) {
            let i = Machine.#visible_machines.indexOf(this);
            while (i != -1) {
                Machine.#visible_machines.splice(i, 1);
                i = Machine.#visible_machines.indexOf(this);
            }
        }
    }

    /**
     * Adds the machine to the machine list
     *
     * @param {Object} [params]
     * @param {number?} [params.x] New X position
     * @param {number?} [params.y] New Y position
     */
    insert({x, y}={}) {
        let i = Machine.#machines.indexOf(this);
        if (i == -1) Machine.#machines.push(this);

        this.#x = x ?? this.#x;
        this.#y = y ?? this.#y;

        if (this.is_visible && Machine.#visible_machines !== false) {
            let i = Machine.#visible_machines.indexOf(this);
            if (i == -1) Machine.#visible_machines.push(this);
        }
    }

    /**
     * Checks whether the machine contains the point at [X, Y] (absolute in grid)
     *
     * @param {PointLike} point
     */
    contains_point(point) { return false; }

    /**
     * Draws the machine
     *
     * @param {Object} [params]
     * @param {CanvasRenderingContext2D} [params.context]
     * @param {number?} [params.x] Override for the x position
     * @param {number?} [params.y] Override for the y position
     * @param {boolean} [params.transparent]
     * @param {boolean} [params.markers]
     */
    draw({context=canvas_context, x=null, y=null, transparent=false, markers=true}={}) {
        if (this.constructor != Machine) throw new Error(`${this.constructor.name} has no draw function!`);
    }

    /**
     * Copies the machine
     *
     * @param {Object} [parts]
     * @param {number?} [parts.x]
     * @param {number?} [parts.y]
     * @param {string?} [parts.name]
     * @param {string|HTMLImageElement?} [parts.image]
     * @param {boolean} [parts.insert]
     */
    clone({x, y, name, level, image, insert=true}={}) {
        x ??= this.x;
        y ??= this.y;
        name ??= this.#name;
        level ??= this.#level;
        image ??= this.#image;
        const id = this.id;
        return new Machine({id, x, y, name, level, image, insert});
    }

    /**
     * Computes the pane arguments for a pane
     *
     * @param {Object} [params]
     * @param {MouseEvent} [params.event]
     * @param {boolean} [params.markers]
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
    panecontents({event=null, markers=true}={}) { return null; }

    /**
     * Action to perform on click
     *
     * @param {MouseEvent} event
     */
    click(event) {
        if (event.shiftKey) {
            this.move();
        }
    }

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

    /**
     * Returns a path that follows the machine's border
     *
     * @param {number} [x] X position override of the machine
     * @param {number} [y] Y position override of the machine
     * @returns {[keyof CanvasRenderingContext2D, any[]][]}
     */
    border_path(x, y) { return []; }

    /**
     * Starts moving the machine
     */
    move() {
        this.#moving = true;
        globals.adding['world'] = {
            click: (x, y, event) => {
                if (event.shiftKey == globals.press_to_snap) {
                    x = Math.round(x / grid_spacing) * grid_spacing;
                    y = Math.round(y / grid_spacing) * grid_spacing;
                }
                this.#x = x;
                this.#y = y;
                this.#moving = false;
                delete globals.adding['world'];
                event.preventDefault();
                return true;
            },
            draw: (x, y, event) => {
                if (event?.shiftKey == globals.press_to_snap) {
                    let x_off = (display_size.width / 2) % grid_spacing - globals.position[0] % grid_spacing;
                    let y_off = (display_size.height / 2) % grid_spacing - globals.position[1] % grid_spacing;
                    x = Math.round((x - x_off) / grid_spacing) * grid_spacing + x_off;
                    y = Math.round((y - y_off) / grid_spacing) * grid_spacing + y_off;
                }
                this.draw({x, y: y, transparent: true});
            },
        };
    }
}
/**
 * Returns an object containing the data to be saved
 *
 * @returns {{x: number, y: number, level: number, id: string}[]}
 */
export function save_data() {
    return Machine.machines.filter(m => m.x != null && m.y != null).map(m => m.toJSON());
}
/**
 * Loads the saved data
 *
 * @param {{id: string, ...parts}[]} [data]
 */
export function load_data(data=[]) {
    if (!Array.isArray(data) || !data.length) return;

    data.forEach(({id, ...parts}) => {
        Machine.get_machine_copy(id, parts);
    });

    Machine.reset_visible_machines();
}

export default Machine;
