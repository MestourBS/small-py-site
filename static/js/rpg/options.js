import { canvas_write, context as canvas_context } from './canvas.js';
import { display_size, get_theme_value, tile_size } from './display.js';
import globals from './globals.js';
import { number_between } from './primitives.js';
/**
 * @template T
 * @typedef TypesOption<T>
 * @prop {StringCanvasOption<T>} string
 * @prop {NumberCanvasOption<T>} number
 * @prop {BooleanCanvasOption<T>} boolean
 */

/**
 * @type {[number, number]}
 */
const option_sizes = new Proxy([20, 20], {
    get(target, prop) {
        return target[prop];
    },
    set(target, prop, value) {
        if (prop == 'length') return;

        if (!isNaN(prop)) value = Math.max(20, value);

        target[prop] = value;
    },
});

/**
 * @this {StringCanvasOption|NumberCanvasOption}
 * @param {Object} [params]
 * @param {CanvasRenderingContext2D} [params.context]
 */
function optionSNHeight({context=canvas_context}={}) {
    let max_width = display_size[0] * tile_size[0] - option_sizes[0] * 2;
    let width = context.measureText(this.value).width;

    return Math.ceil(width / max_width) || 1;
}
/**
 * @this {StringCanvasOption|NumberCanvasOption}
 * @param {Object} [params]
 * @param {CanvasRenderingContext2D} [params.context]
 */
function optionSNDraw({context=canvas_context}={}) {
    let y_start = BaseCanvasOption.options.filter(o => o.index < this.index && o.height({context}) > 0)
        .map(o => o.height({context}) + 1)
        .reduce((s, h) => s + h, 0) - Math.max(0, globals.cursors.options[1] - display_size[1] / 2);
    y_start *= option_sizes[1];
    let height = (this.height({context}) + .5) * option_sizes[1];

    // Option is not visible
    if (y_start >= display_size[1] * tile_size[1] || y_start + height <= 0) return;

    let x_start = option_sizes[0];
    let width = display_size[0] * tile_size[0] - option_sizes[0] * 2;

    let border_name = `border_option${'_error'.repeat(this.error)}${'_selected'.repeat(this.selected)}_color`;
    context.fillStyle = get_theme_value('background_option_color');
    context.strokeStyle = get_theme_value(border_name);

    context.fillRect(x_start, y_start, width, height);
    context.strokeRect(x_start, y_start, width, height);

    canvas_write(this.value, x_start, y_start, {min_left: option_sizes[0], min_right: option_sizes[0]});
}

/**
 * @template T
 */
export class BaseCanvasOption {
    /** @type {BaseCanvasOption[]} */
    static #options = [];
    static get options() {return this.#options;}

    /**
     * @template O
     * @template {keyof option_types} T
     * @param {Object} params
     * @param {O} params.target
     * @param {keyof O} params.target_property
     * @param {T} params.type
     * @returns {TypesOption<O>[T]}
     */
    static make_option_type({target, target_property, type, ...options}) {
        if (!(type in option_types)) throw new RangeError(`Unknown option type: ${type}`);

        let t = option_types[type];

        options.object = target;
        options.property = target_property;

        return new t(options);
    }

    /** @type {T} */
    #target;
    /** @type {keyof T} */
    #prop;

    /**
     * @param {Object} params
     * @param {T} params.object
     * @param {keyof T} params.property
     */
    constructor({object, property}) {
        if (object == null) throw new TypeError(`Invalid option parameter object: ${object}`);
        if (!(property in object)) throw new TypeError(`Invalid option parameter property, not a property of object: ${property}, object: ${JSON.stringify(object)}`);

        this.#target = object;
        this.#prop = property;
    }

    get object_value() {return this.#target[this.#prop];}
    get index() {return BaseCanvasOption.#options.indexOf(this);}
    get error() {return false;}

    get value() {return this.#target[this.#prop];}
    set value(value) {this.#target[this.#prop] = value;}
    get selected() {return this.index == globals.cursors.options[1];}

    /**
     * Calculates the height, in lines, of the option
     *
     * @param {Object} [params]
     * @param {CanvasRenderingContext2D} [params.context]
     * @returns {number}
     */
    height({context=canvas_context}={}) {return 0;}

    /**
     * Draws the option
     *
     * @param {Object} [params]
     * @param {CanvasRenderingContext2D} [params.context]
     */
    draw({context=canvas_context}={}) {}

    /**
     * Applies a key event to the option
     *
     * @param {KeyboardEvent} event
     */
    keydown(event) {}
}

/**
 * @template T
 */
class StringCanvasOption extends BaseCanvasOption {
    #max_length;
    #regex;
    /** @type {string} */
    #value;

    /**
     * @param {Object} params
     * @param {T} params.object
     * @param {keyof T} params.property
     * @param {number} [params.max_length] Maximum length of string, defaults to infinity (limitless)
     * @param {RegExp|string|[string, string]} [params.regex] Regex pattern the string must match
     */
    constructor({object, property, max_length=Infinity, regex=/.*/}) {
        if (typeof max_length != 'number' || max_length < 0) throw new TypeError(`Invalid string option parameter max_length: ${max_length}`);
        if (typeof regex == 'string') {
            regex = new RegExp(regex);
        } else if (Array.isArray(regex)) {
            regex = new RegExp(...regex);
        } else if (!(regex instanceof RegExp)) throw new TypeError(`Invalid string option parameter regex: ${regex}`);
        if (typeof object[property] != 'string') throw new TypeError(`Invalid starting object value: ${object[property]}`);

        super({object, property});

        this.#max_length = Math.floor(max_length);
        this.#regex = regex;

        this.#value = this.object_value;
    }

    get error() {
        let value = this.#value;
        let regex = this.#regex;
        let max_length = this.#max_length;
        return typeof value != 'string' || value.length > max_length || !regex.test(value);
    }

    get value() {
        return this.#value;
    }
    set value(value) {
        this.#value = value.toString();

        if (!this.error) {
            super.value = value;
        }
    }

    height({context=canvas_context}={}) {
        return optionSNHeight.call(this, {context});
    }

    draw({context=canvas_context}={}) {
        optionSNDraw.call(this, {context});
    }

    /**
     * @inheritdoc
     * @param {KeyboardEvent} event
     */
    keydown(event) {
        if (event.altKey || event.ctrlKey || event.metaKey) return;
        event.preventDefault();

        if (event.key == 'Backspace') {
            //todo delete based on index
            this.value = this.value.slice(0, -1);
        } else if (['Delete', 'Del'].includes(event.key)) {
            //todo delete based on index
            this.value = this.value.slice(1);
        } else if (event.key == 'Spacebar') {
            this.value += ' ';
        } else if (!event.code.startsWith(event.key)) {
            // Probably good enough, might need a blacklist in the worst case scenario
            this.value += event.key;
        }
    }
}

/**
 * @template T
 */
class NumberCanvasOption extends BaseCanvasOption {
    #max;
    #min;
    /** @type {number} */
    #value;

    /**
     * @param {Object} params
     * @param {T} params.object
     * @param {keyof T} params.property
     * @param {number} [params.min] Lowest allowed number
     * @param {number} [params.max] Highest allowed number
     */
    constructor({object, property, min=-Number.MAX_VALUE, max=Number.MAX_VALUE}) {
        if (typeof min != 'number') throw new TypeError(`Invalid number option parameter min: ${min}`);
        if (typeof max != 'number') throw new TypeError(`Invalid number option parameter max: ${max}`);
        if (min > max) throw new TypeError(`Invalid number option parameters min and max: ${min}, ${max}`);
        if (typeof object[property] != 'number') throw new TypeError(`Invalid starting object value: ${object[property]}`);

        super({object, property});

        this.#min = min;
        this.#max = max;

        this.#value = object[property];
    }

    get error() {
        return !number_between(this.#value, this.#min, this.#max);
    }

    get value() {
        return this.#value;
    }
    set value(value) {
        this.#value = value;

        if (!this.error) {
            super.value = value;
        }
    }

    height({context=canvas_context}={}) {
        return optionSNHeight.call(this, {context});
    }

    draw({context=canvas_context}={}) {
        optionSNDraw.call(this, {context});
    }

    /**
     * @inheritdoc
     * @param {KeyboardEvent} event
     */
    keydown(event) {
        if (event.altKey || event.ctrlKey || event.metaKey) return;
        event.preventDefault();

        //todo prevent infinity

        if (event.key == 'Backspace') {
            //todo delete based on index
            this.value = Math.floor(this.value / 10);
        } else if (['Delete', 'Del'].includes(event.key)) {
            //todo delete based on index
            this.value = this.value.slice(1);
        } else if (!isNaN(event.key)) {
            this.value = this.value * 10 + +event.key;
        } else if (event.key == '+') {
            this.value += 1;
        } else if (event.key == '-') {
            this.value -= 1;
        }
    }
}

/**
 * @template T
 */
class BooleanCanvasOption extends BaseCanvasOption {
    /**
     * @param {Object} params
     * @param {T} params.object
     * @param {keyof T} params.property
     */
    constructor({object, property}) {
        if (typeof object[property] != 'boolean') throw new TypeError(`Invalid starting object value: ${object[property]}`);

        super({object, property});
    }

    get value() {return !!super.value;}
    set value(value) {super.value = !!value;}

    height({context=canvas_context}={}) {return 1;}

    draw({context=canvas_context}={}) {
        let y_start = BaseCanvasOption.options.filter(o => o.index < this.index && o.height({context}) > 0)
            .map(o => o.height({context}) + 1)
            .reduce((s, h) => s + h, 0) - Math.max(0, globals.cursors.options[1] - display_size[1] / 2);
        y_start *= option_sizes[1];
        let height = option_sizes[1];

        // Option is not visible
        if (y_start >= display_size[1] * tile_size[1] || y_start + height <= 0) return;

        let x_start = option_sizes[0];
        let width = option_sizes[0];

        let border_name = `border_option${'_error'.repeat(this.error)}${'_selected'.repeat(this.selected)}_color`;
        context.fillStyle = get_theme_value('background_option_color');
        context.strokeStyle = get_theme_value(border_name);

        context.fillRect(x_start, y_start, width, height);
        context.strokeRect(x_start, y_start, width, height);

        if (this.value) {
            context.strokeStyle = get_theme_value('checkmark_color');
            context.beginPath();
            context.moveTo(x_start, y_start);
            context.lineTo(x_start + width, y_start + height);
            context.moveTo(x_start + width, y_start);
            context.lineTo(x_start, y_start + height);
            context.stroke();
            context.closePath();
        }
    }

    /**
     * @inheritdoc
     * @param {KeyboardEvent} event
     */
    keydown(event) {
        if (event.altKey || event.ctrlKey || event.metaKey) return;
        event.preventDefault();

        if (['Enter', ' ', 'Spacebar'].includes(event.key)) {
            this.value = !this.value;
        }
    }
}

const option_types = {
    'string': StringCanvasOption,
    'number': NumberCanvasOption,
    'boolean': BooleanCanvasOption,
};
