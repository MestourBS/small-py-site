import { canvas_write, context as canvas_context, cut_lines, regex_modifier } from './canvas.js';
import { display_size, get_theme_value, tile_size } from './display.js';
import globals from './globals.js';
import { number_between } from './primitives.js';
import { Color } from './color.js';
/**
 * @template T
 * @typedef TypesOption<T>
 * @prop {StringCanvasOption<T>} string
 * @prop {NumberCanvasOption<T>} number
 * @prop {BooleanCanvasOption<T>} boolean
 * @prop {ListCanvasOption<T>} list
 * @prop {ColorCanvasOption<T>} color
 * @prop {KeyCanvasOption<T>} key
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
 * @param {string} [params.value]
 */
function optionCKNSHeight({context=canvas_context, value=this.value}={}) {
    let left = option_sizes[0] - tile_size[0];
    let options = {
        context,
        min_left: option_sizes[0] * 1.5,
        min_right: option_sizes[0] * 1.5,
    };

    let lines = cut_lines(value, left, options)[1].length || 1;

    if (this.label) lines += (cut_lines(this.label, left, options)[1].length || -.25) + .25;

    return lines;
}
/**
 * @this {StringCanvasOption|NumberCanvasOption}
 * @param {Object} [params]
 * @param {CanvasRenderingContext2D} [params.context]
 * @param {string} [params.value]
 */
function optionNSDraw({context=canvas_context, value=this.value}={}) {
    let y_start = BaseCanvasOption.options.filter(o => o.index < this.index && o.height({context}) > 0)
        .map(o => o.height({context}) + 1)
        .reduce((s, h) => s + h, 0);
    y_start *= option_sizes[1];
    y_start -= Math.max(0, BaseCanvasOption.selected.cursor_position({context})[1] - display_size[1] / 2 * tile_size[1]);
    let height = (this.height({context}) + .5) * option_sizes[1];

    // Option is not visible
    if (y_start >= display_size[1] * tile_size[1] || y_start + height <= 0) return;

    let x_start = option_sizes[0];
    let width = display_size[0] * tile_size[0] - option_sizes[0] * 2;

    let border_name = `border_option${'_error'.repeat(this.error)}${'_selected'.repeat(this.selected)}_color`;

    let options = {min_left: option_sizes[0] * 1.5, min_right: option_sizes[0] * 1.5, context, font_size: option_sizes[1]};
    let left = x_start - tile_size[0];

    // Write label if it exists
    if (this.label) {
        options.min_left = option_sizes[0];
        canvas_write(this.label, left, y_start, options);
        let lbl_lines = cut_lines(this.label, left, options)[1].length + .25;
        let lbl_height = lbl_lines * option_sizes[1];
        y_start += lbl_height;
        height -= lbl_height;
        options.min_left = option_sizes[0] * 1.5;
    }

    context.fillStyle = get_theme_value('background_option_color');
    context.strokeStyle = get_theme_value(border_name);
    context.fillRect(x_start, y_start, width, height);
    context.strokeRect(x_start, y_start, width, height);

    canvas_write(value, left, y_start, options);

    // Draw cursor
    if (this.selected && document.hasFocus() && Math.round(Date.now() / 1000 % 1)) {
        let cursor = globals.cursors.options;

        let behind = value.slice(0, cursor[0]) || ' ';

        let [_, lines] = cut_lines(behind, left, options);

        y_start += ((lines.length || 1) - .75) * option_sizes[1];
        let line = lines[lines.length - 1] ?? '';
        line = line.slice(0, cursor[0]);
        left += context.measureText(line).width + option_sizes[0] * 1.5;
        let in_modifier = false;

        let fullline = cut_lines(value, left, options)[1][lines.length - 1] ?? '';
        let matches = [...fullline.matchAll(regex_modifier)];
        matches.forEach(match => {
            if (match.index > cursor[0]) return;
            if (match.index + match[0].length > cursor[0]) {
                match[0] = match[0].slice(0, cursor[0] - match.index - match[0].length);
                in_modifier = true;
            }
            left -= context.measureText(match[0]).width;
        });

        let color = `write_cursor${'_modifier'.repeat(in_modifier)}_color`;
        context.strokeStyle = get_theme_value(color);
        context.beginPath();
        context.moveTo(left, y_start);
        context.lineTo(left, y_start + option_sizes[1]);
        context.stroke();
        context.closePath();
    }
}
/**
 * @this {StringCanvasOption|NumberCanvasOption}
 * @param {Object} [params]
 * @param {CanvasRenderingContext2D} [params.context]
 * @param {string} [params.value]
 */
function optionNSCursor({context=canvas_context, value=this.value}) {
    let y_start = BaseCanvasOption.options.filter(o => o.index < this.index && o.height({context}) > 0)
        .map(o => o.height({context}) + 1)
        .reduce((s, h) => s + h, 0) * option_sizes[1];
    let x_start = option_sizes[0] - tile_size[0];
    let options = {min_left: option_sizes[0] * 1.5, min_right: option_sizes[0] * 1.5, context, font_size: option_sizes[1]};

    if (this.label) {
        options.min_left = option_sizes[0];
        let lbl_lines = cut_lines(this.label, x_start, options)[1].length + .25;
        let lbl_height = lbl_lines * option_sizes[1];
        y_start += lbl_height;
        options.min_left = option_sizes[0] * 1.5;
    }

    let cursor = globals.cursors.options;
    let behind = value.slice(0, cursor[0]) || ' ';
    let [_, lines] = cut_lines(behind, x_start, options);

    y_start += ((lines.length || 1) - .75) * option_sizes[1];

    return [x_start, y_start, 1, option_sizes[1]];
}

/**
 * @template T
 * @hideconstructor
 */
export class BaseCanvasOption {
    /** @type {BaseCanvasOption[]} */
    static #options = [];
    static get options() {return this.#options;}
    static get selected() {return this.#options.find(o => o.selected);}

    /**
     * @template O
     * @template {keyof option_types} T
     * @param {Object} params
     * @param {O} params.target
     * @param {keyof O} params.target_property
     * @param {T} params.type
     * @param {string} [params.label]
     * @returns {TypesOption<O>[T]}
     */
    static make_option_type({target, target_property, type, label=null, ...options}) {
        if (!(type in option_types)) throw new RangeError(`Unknown option type: ${type}`);

        let t = option_types[type];

        options.object = target;
        options.property = target_property;
        options.label = label;

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
     * @param {string} [params.label]
     */
    constructor({object, property, label=null}) {
        if (object == null) throw new TypeError(`Invalid option parameter object: ${object}`);
        if (!(property in object)) throw new TypeError(`Invalid option parameter property, not a property of object: ${property}, object: ${JSON.stringify(object)}`);

        this.#target = object;
        this.#prop = property;
        this.label = label;
    }

    get object_value() {return this.#target[this.#prop];}
    get index() {return BaseCanvasOption.#options.indexOf(this);}
    get error() {return false;}
    get selected() {return this.index == globals.cursors.options[1];}

    get value() {return this.#target[this.#prop];}
    set value(value) {this.#target[this.#prop] = value;}

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
     * Calculates the cursor's position relative to top of all inputs within the input
     *
     * **Does not draw the cursor**
     *
     * @param {Object} [params]
     * @param {CanvasRenderingContext2D} [params.context]
     * @returns {[number, number, number, number]} [left, top, width, height]
     */
    cursor_position({context=canvas_context}={}) {
        let y_start = BaseCanvasOption.options.filter(o => o.index < this.index && o.height({context}) > 0)
            .map(o => o.height({context}) + 1)
            .reduce((s, h) => s + h, 0);

        return [option_sizes[0], y_start, 1, 1];
    }

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
     * @param {string} [params.label]
     * @param {number} [params.max_length] Maximum length of string, defaults to infinity (limitless)
     * @param {RegExp|string|[string, string]} [params.regex] Regex pattern the string must match
     */
    constructor({object, property, label=null, max_length=Infinity, regex=/.*/}) {
        if (typeof max_length != 'number' || max_length < 0) throw new TypeError(`Invalid string option parameter max_length: ${max_length}`);
        if (typeof regex == 'string') {
            regex = new RegExp(regex);
        } else if (Array.isArray(regex)) {
            regex = new RegExp(...regex);
        } else if (!(regex instanceof RegExp)) throw new TypeError(`Invalid string option parameter regex: ${regex}`);
        if (typeof object[property] != 'string') throw new TypeError(`Invalid starting object value: ${object[property]}`);

        super({object, property, label});

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

    height({context=canvas_context}={}) { return optionCKNSHeight.call(this, {context}); }

    draw({context=canvas_context}={}) { optionNSDraw.call(this, {context}); }

    cursor_position({context=canvas_context}) {
        return optionNSCursor.call(this, {context});
    }

    /**
     * @inheritdoc
     * @param {KeyboardEvent} event
     */
    keydown(event) {
        if (event.altKey || event.ctrlKey || event.metaKey) return;
        let prev_def = true;
        let cursor = globals.cursors.options;
        let index = cursor[0];

        switch(event.key) {
            case 'AltGraph': case 'Dead': return;
            case 'Backspace':
                //todo ctrl + backspace to delete until a non-letter
                if (index > 0) {
                    this.value = this.value.slice(0, index - 1) + this.value.slice(index);
                    cursor[0]--;
                }
                break;
            case 'Delete': case 'Del':
                //todo ctrl + delete to delete until a non-letter
                if (index < this.value.length) {
                    this.value = this.value.slice(0, index) + this.value.slice(index + 1);
                }
                break;
            case 'Spacebar':
                this.value += ' ';
                cursor[0]++;
                break;
            case 'ArrowLeft':
                if (cursor[0] > 0) {
                    cursor[0]--;
                }
                break;
            case 'ArrowRight':
                if (cursor[0] < this.value.length) {
                    cursor[0]++;
                }
                break;
            case 'Home':
                cursor[0] = 0;
                break;
            case 'End':
                cursor[0] = this.value.length;
                break;
            default:
                prev_def = false;
                break;
        }
        if (!event.code.startsWith(event.key) && [event.key.toLowerCase(), event.key.toUpperCase()].includes(event.key)) {
            this.value = this.value.slice(0, index) + event.key + this.value.slice(index);
            cursor[0]++;
        } else {
            if (prev_def) event.preventDefault();
        }
    }
}

/**
 * @template T
 */
class NumberCanvasOption extends BaseCanvasOption {
    /** @type {[RegExp, string][]} */
    static #trimmers = [
        [/^(\-?)0+(\d)/, '$1$2'],
        [/(\.\d+?)0+$/, '$1'],
    ];

    #max;
    #min;
    /** @type {string} */
    #value;

    /**
     * @param {Object} params
     * @param {T} params.object
     * @param {keyof T} params.property
     * @param {number} [params.min] Lowest allowed number
     * @param {number} [params.max] Highest allowed number
     * @param {string} [params.label]
     */
    constructor({object, property, label=null, min=-Infinity, max=Infinity}) {
        if (typeof min != 'number') throw new TypeError(`Invalid number option parameter min: ${min}`);
        if (typeof max != 'number') throw new TypeError(`Invalid number option parameter max: ${max}`);
        if (min > max) throw new TypeError(`Invalid number option parameters min and max: ${min}, ${max}`);
        if (typeof object[property] != 'number') throw new TypeError(`Invalid starting object value: ${object[property]}`);

        super({object, property, label});

        this.#min = min;
        this.#max = max;

        this.#value = object[property].toString();
    }

    get error() {
        return !number_between(this.#value, this.#min, this.#max);
    }

    /** @type {string} */
    get value() {
        return this.#value;
    }
    /** @param {string|number} value */
    set value(value) {
        this.#value = value;

        if (!this.error) {
            super.value = +value;
        }
    }

    height({context=canvas_context}={}) { return optionCKNSHeight.call(this, {context}); }

    draw({context=canvas_context}={}) { optionNSDraw.call(this, {context}); }

    cursor_position({context=canvas_context}) {
        return optionNSCursor.call(this, {context});
    }

    /**
     * @inheritdoc
     * @param {KeyboardEvent} event
     */
    keydown(event) {
        if (event.altKey || event.ctrlKey || event.metaKey) return;
        let prev_def = true;
        let cursor = globals.cursors.options;
        let index = cursor[0];

        switch (event.key) {
            case 'Backspace':
                //todo ctrl + backspace to delete until a non-letter
                if (index > 0) {
                    this.value = this.value.slice(0, index - 1) + this.value.slice(index);
                    cursor[0]--;
                }
                break;
            case 'Delete': case 'Del':
                //todo ctrl + delete to delete until a non-letter
                if (index < this.value.length) {
                    this.value = this.value.slice(0, index) + this.value.slice(index + 1);
                }
                break;
            case '-':
                if (this.value.startsWith('-')) {
                    this.value = this.value.slice(1);
                    cursor[0]--;
                } else {
                    this.value = '-' + this.value;
                    cursor[0]++;
                }
            case 'ArrowLeft':
                if (cursor[0] > 0) {
                    cursor[0]--;
                }
                break;
            case 'ArrowRight':
                if (cursor[0] < this.value.length) {
                    cursor[0]++;
                }
                break;
            case 'Home':
                cursor[0] = 0;
                break;
            case 'End':
                cursor[0] = this.value.length;
                break;
            default:
                prev_def = false;
                break;
        }

        //todo add comma support

        if (!isNaN(event.key)) {
            this.value = this.value.slice(0, index) + event.key + this.value.slice(index);
            cursor[0]++;
        } else {
            if (prev_def) event.preventDefault();
        }
        this.value = NumberCanvasOption.#trimmers.reduce((v, [t, s]) => v.replace(t, s), this.value);
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
     * @param {string} [params.label]
     */
    constructor({object, property, label=null}) {
        if (typeof object[property] != 'boolean') throw new TypeError(`Invalid starting object value: ${object[property]}`);

        super({object, property, label});
    }

    get value() {return !!super.value;}
    set value(value) {super.value = !!value;}

    height({context=canvas_context}={}) {
        let height = 1;

        if (this.label) {
            let options = {
                context,
                min_left: option_sizes[0] * 1.5,
                min_right: option_sizes[0] * 1.5,
            };
            let left = option_sizes[0] - tile_size[0];

            height += (cut_lines(this.label, left, options)[1].length || -.25) + .25;
        }

        return height;
    }

    draw({context=canvas_context}={}) {
        let y_start = BaseCanvasOption.options.filter(o => o.index < this.index && o.height({context}) > 0)
            .map(o => o.height({context}) + 1)
            .reduce((s, h) => s + h, 0);
        y_start *= option_sizes[1];
        y_start -= Math.max(0, BaseCanvasOption.selected.cursor_position({context})[1] - display_size[1] / 2 * tile_size[1]);
        let height = this.height({context}) * option_sizes[1];

        // Option is not visible
        if (y_start >= display_size[1] * tile_size[1] || y_start + height <= 0) return;

        let x_start = option_sizes[0];
        let width = option_sizes[0];

        if (this.label) {
            let options = {min_left: option_sizes[0], min_right: option_sizes[0] * 1.5, context, font_size: option_sizes[1]};
            canvas_write(this.label, x_start - tile_size[0], y_start, options);
            let lbl_lines = cut_lines(this.label, x_start - tile_size[0], options)[1].length + .25;
            let lbl_height = lbl_lines * option_sizes[1];
            y_start += lbl_height;
            height -= lbl_height;
        }

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

    cursor_position({context=canvas_context}) {
        let y_start = BaseCanvasOption.options.filter(o => o.index < this.index && o.height({context}) > 0)
            .map(o => o.height({context}) + 1)
            .reduce((s, h) => s + h, 0) * option_sizes[1];
        let x_start = option_sizes[0];
        let width = option_sizes[0];
        let height = this.height({context}) * option_sizes[1];

        if (this.label) {
            let options = {min_left: option_sizes[0], min_right: option_sizes[0] * 1.5, context, font_size: option_sizes[1]};
            let lbl_lines = cut_lines(this.label, x_start - tile_size[0], options)[1].length + .25;
            let lbl_height = lbl_lines * option_sizes[1];
            y_start += lbl_height;
            height -= lbl_height;
        }

        return [x_start, y_start, width, height];
    }

    /**
     * @inheritdoc
     * @param {KeyboardEvent} event
     */
    keydown(event) {
        if (event.altKey || event.ctrlKey || event.metaKey) return;
        let prev_def = true;

        switch (event.key) {
            case 'Enter': case ' ': case 'Spacebar':
                this.value = !this.value;
                break;
            case 'Backspace': case 'Delete': case 'Del':
                this.value = false;
                break;
            default:
                prev_def = false;
                break;
        }

        if (prev_def) {
            event.preventDefault();
        }
    }
}

/**
 * @template T
 */
class ListCanvasOption extends BaseCanvasOption {
    /** @type {[string, any][]} */
    #list;
    /** @type {number} */
    #key;

    /**
     * @param {Object} params
     * @param {T} params.object
     * @param {keyof T} params.property
     * @param {string} [params.label]
     * @param {string[]|[string, any][]|{[key: string]: any}} params.list
     */
    constructor({object, property, label=null, list}) {
        if (!Array.isArray(list)) {
            if (typeof list == 'object') list = Object.entries(list);
            else throw new TypeError(`Invalid list option parameter list: ${list}`);
        }
        list = list.map(l => [l[0], l[1] ?? l[0]]);
        let index = list.findIndex(l => l[1] == object[property]);
        if (index == -1) throw new TypeError(`Invalid starting object value: ${object[property]}`);

        super({object, property, label});

        this.#list = list;
        this.#key = index;
    }

    get error() {return !(this.#key in this.#list);}

    get value() {return this.#list[this.#key][1];}
    set value(value) {
        let key = this.#list.findIndex(([,v]) => v == value);

        if (key != -1) {
            this.#key = key;

            super.value = this.#list[this.#key][1];
        }
    }

    get value_key() {return this.#list[this.#key][0];}
    set value_key(value_key) {
        let key = this.#list.findIndex(([k]) => k == value_key);
        if (key != -1) {
            this.#key = key;

            super.value = this.#list[this.#key][1];
        }
    }
    get key() {return this.#key;}
    set key(key) {
        if (!isNaN(key)) {
            this.#key = Math.max(0, Math.min(this.#list.length, key));

            super.value = this.#list[this.#key][1];
        }
    }

    height({context=canvas_context}={}) {
        let left = option_sizes[0] - tile_size[0];
        let options = {
            context,
            min_left: option_sizes[0] * 1.5,
            min_right: option_sizes[0] * 1.5,
        };

        let lines = cut_lines(this.value_key, left, options)[1].length || 1;

        if (this.label) lines += (cut_lines(this.label, left, options)[1].length || -.25) + .25;

        if (this.selected) {
            lines += this.#list.map(([k]) => cut_lines(k, left, options)[1].length || 1)
                .reduce((s, l) => s + l + .5, 0);
        }

        return lines;
    }

    draw({context=canvas_context}={}) {
        let y_start = BaseCanvasOption.options.filter(o => o.index < this.index && o.height({context}) > 0)
            .map(o => o.height({context}) + 1)
            .reduce((s, h) => s + h, 0);
        y_start *= option_sizes[1];
        y_start -= Math.max(0, BaseCanvasOption.selected.cursor_position({context})[1] - display_size[1] / 2 * tile_size[1]);
        let height = (this.height({context}) + .5) * option_sizes[1];

        // Option is not visible
        if (y_start >= display_size[1] * tile_size[1] || y_start + height <= 0) return;

        let x_start = option_sizes[0];
        let width = display_size[0] * tile_size[0] - option_sizes[0] * 2;

        let border_name = `border_option${'_error'.repeat(this.error)}${'_selected'.repeat(this.selected)}_color`;

        let options = {min_left: option_sizes[0] * 1.5, min_right: option_sizes[0] * 1.5, context, font_size: option_sizes[1]};
        let left = x_start - tile_size[0];

        // Write label if it exists
        if (this.label) {
            options.min_left = option_sizes[0];
            canvas_write(this.label, left, y_start, options);
            let lbl_lines = cut_lines(this.label, left, options)[1].length + .25;
            let lbl_height = lbl_lines * option_sizes[1];
            y_start += lbl_height;
            options.min_left = option_sizes[0] * 1.5;
        }

        let value_height = (cut_lines(this.value_key, left, options)[1].length + .5) * option_sizes[1];
        context.fillStyle = get_theme_value('background_option_color');
        context.strokeStyle = get_theme_value(border_name);
        context.fillRect(x_start, y_start, width, value_height);
        context.strokeRect(x_start, y_start, width, value_height);

        canvas_write(this.value_key, left, y_start, options);
        y_start += value_height;

        if (this.selected) {
            // Write options
            for (let [key] of this.#list) {
                let height = (cut_lines(key, left, options)[1].length + .5) * option_sizes[1];
                let selected = this.value_key == key;
                let background_name = `background_option${'_selected'.repeat(selected)}_color`;
                context.fillStyle = get_theme_value(background_name);
                context.strokeStyle = get_theme_value('border_option_color');
                context.fillRect(x_start, y_start, width, height);
                context.strokeRect(x_start, y_start, width, height);

                if (selected) key = `{color:${get_theme_value('text_selected_color')}}${key}{color:reset}`;
                canvas_write(key, left, y_start, options);
                y_start += height;
            }
        }
    }

    cursor_position({context=canvas_context}={}) {
        let y_start = BaseCanvasOption.options.filter(o => o.index < this.index && o.height({context}) > 0)
            .map(o => o.height({context}) + 1)
            .reduce((s, h) => s + h, 0) * option_sizes[1];
        let x_start = option_sizes[0] - tile_size[0];
        let options = {min_left: option_sizes[0] * 1.5, min_right: option_sizes[0] * 1.5, context, font_size: option_sizes[1]};

        if (this.label) {
            options.min_left = option_sizes[0];
            let lbl_lines = cut_lines(this.label, x_start, options)[1].length + .25;
            let lbl_height = lbl_lines * option_sizes[1];
            y_start += lbl_height;
            options.min_left = option_sizes[0] * 1.5;
        }

        y_start += this.#list.filter((_, i) => i < this.#key)
            .map(([k]) => cut_lines(k, x_start, options)[1].length)
            .reduce((s, l) => s + l + .5, 0) * option_sizes[1];
        let width = display_size[0] * tile_size[0] - option_sizes[0] * 2;
        let height = (cut_lines(this.value_key, x_start, options)[1].length + .5) * option_sizes[1];

        return [x_start, y_start, width, height];
    }

    /**
     * @inheritdoc
     * @param {KeyboardEvent} event
     */
    keydown(event) {
        if (event.altKey || event.ctrlKey || event.metaKey) return;
        let prev_def = true;

        switch (event.key) {
            case 'ArrowLeft':
                if (this.#key > 0) {
                    this.#key--;
                }
                break;
            case 'ArrowRight':
                if (this.#key < this.#list.length - 1) {
                    this.#key++;
                }
                break;
            default:
                prev_def = false;
                break;
        }

        if (!event.code.startsWith(event.key) && [event.key.toLowerCase(), event.key.toUpperCase()].includes(event.key)) {
            let first = this.#list.findIndex(([s]) => s.startsWith(event.key));

            if (first != -1) {
                let next = this.#list.findIndex(([s], i) => s.startsWith(event.key) && i > this.#key);

                this.#key = (next == -1 ? first : next);
            }
        } else {
            if (prev_def) event.preventDefault();
        }

        super.value = this.#list[this.#key][1];
    }
}

/**
 * @template T
 */
class ColorCanvasOption extends BaseCanvasOption {
    /** @type {Color} */
    #value;

    /**
     * @param {Object} params
     * @param {T} params.object
     * @param {keyof T} params.property
     * @param {string} [params.label]
     * @param {Color|string|number|{red: number, green: number, blue: number}} [params.color]
     */
    constructor({object, property, label=null, color=null}) {
        try {
            color = new Color(color ?? object[property]);
        } catch {
            throw new TypeError(`Invalid color option argument color: ${color}`);
        }

        super({object, property, label});

        this.#value = color;
    }

    get value() { return this.#value.toString(); }
    set value(value) {
        try {
            value = new Color(value);
        } catch {
            return;
        }

        this.#value = value;
        super.value = value.toString();
    }

    height({context=canvas_context}={}) { return optionCKNSHeight.call(this, {context}); }

    draw({context=canvas_context}={}) {
        let y_start = BaseCanvasOption.options.filter(o => o.index < this.index && o.height({context}) > 0)
            .map(o => o.height({context}) + 1)
            .reduce((s, h) => s + h, 0);
        y_start *= option_sizes[1];
        y_start -= Math.max(0, BaseCanvasOption.selected.cursor_position({context})[1] - display_size[1] / 2 * tile_size[1]);
        let height = (this.height({context}) + .5) * option_sizes[1];

        // Option is not visible
        if (y_start >= display_size[1] * tile_size[1] || y_start + height <= 0) return;

        let x_start = option_sizes[0];
        let width = display_size[0] * tile_size[0] - option_sizes[0] * 3.5;

        let border_name = `border_option${'_error'.repeat(this.error)}${'_selected'.repeat(this.selected)}_color`;

        let options = {min_left: option_sizes[0] * 1.5, min_right: option_sizes[0] * 1.5, context, font_size: option_sizes[1]};
        let left = x_start - tile_size[0];

        // Write label if it exists
        if (this.label) {
            options.min_left = option_sizes[0];
            canvas_write(this.label, left, y_start, options);
            let lbl_lines = cut_lines(this.label, left, options)[1].length + .25;
            let lbl_height = lbl_lines * option_sizes[1];
            y_start += lbl_height;
            height -= lbl_height;
            options.min_left = option_sizes[0] * 1.5;
        }

        context.fillStyle = get_theme_value('background_option_color');
        context.strokeStyle = get_theme_value(border_name);
        context.fillRect(x_start, y_start, width, height);
        context.strokeRect(x_start, y_start, width, height);

        let value = this.value;
        if (this.selected && document.hasFocus() && Math.round(Date.now() / 1000 % 1)) {
            let cursor = globals.cursors.options;
            let index = cursor[0] + 1;

            let background_color = get_theme_value(`background_option_selected_color`);
            let text_color = get_theme_value(`text_selected_color`);

            let behind = value.slice(0, index) || ' ';

            let l = left + context.measureText(behind).width + x_start + option_sizes[0] * .5;
            let width = context.measureText(value[index]).width;

            context.fillStyle = background_color;
            context.fillRect(l, y_start, width, height);

            value = `${behind}{color:${text_color}}${value[index]}{color:reset}${value.slice(index + 1)}`;
        }

        canvas_write(value, left, y_start, options);

        context.fillStyle = this.#value.toString();
        context.strokeStyle = this.#value.invert();
        context.fillRect(x_start + width, y_start, option_sizes[0] * 1.5, height);
        context.strokeRect(x_start + width, y_start, option_sizes[0] * 1.5, height);
    }

    cursor_position({context=canvas_context}={}) {
        let y_start = BaseCanvasOption.options.filter(o => o.index < this.index && o.height({context}) > 0)
            .map(o => o.height({context}) + 1)
            .reduce((s, h) => s + h, 0) * option_sizes[1];
        let x_start = option_sizes[0] - tile_size[0];
        let options = {min_left: option_sizes[0] * 1.5, min_right: option_sizes[0] * 1.5, context, font_size: option_sizes[1]};
        let index = globals.cursors.options[0] + 1;

        if (this.label) {
            options.min_left = option_sizes[0];
            let lbl_lines = cut_lines(this.label, x_start, options)[1].length;
            let lbl_height = lbl_lines * option_sizes[1];
            y_start += lbl_height;
            options.min_left = option_sizes[0];
        }

        let width = context.measureText(this.value[index]).width;
        let height = (this.height({context}) + .5) * option_sizes[1];

        return [x_start, y_start, width, height];
    }

    /**
     * @inheritdoc
     * @param {KeyboardEvent} event
     */
    keydown(event) {
        if (event.altKey || event.ctrlKey || event.metaKey) return;
        let prev_def = true;
        let cursor = globals.cursors.options;
        let index = cursor[0] + 1;

        switch (event.key) {
            case 'ArrowLeft':
                if (cursor[0] > 0) {
                    cursor[0]--;
                }
                break;
            case 'ArrowRight':
                if (cursor[0] < this.value.length - 2) {
                    cursor[0]++;
                }
                break;
            case 'Backspace': case 'Delete': case 'Del':
                this.value = this.value.slice(0, index) + '0' + this.value.slice(index + 1);
                break;
            default:
                prev_def = false;
                break;
        }
        if (/^[\da-f]/i.test(event.key)) {
            this.value = this.value.slice(0, index) + event.key + this.value.slice(index + 1);
        } else {
            if (prev_def) event.preventDefault();
        }
    }
}

/**
 * @template T
 */
class KeyCanvasOption extends BaseCanvasOption {
    #capturing = false;
    /** @type {number} */
    #max_delay;
    #key = {
        alt: false,
        ctrl: false,
        shift: false,
        key: '',
    };

    /**
     * @param {Object} params
     * @param {T} params.object
     * @param {keyof T} params.property
     * @param {string} [params.label]
     * @param {number} [params.max_delay]
     */
    constructor({object, property, label=null, max_delay=250}) {
        if (isNaN(max_delay) || max_delay <= 0) throw new TypeError(`Invalid key option argument max_delay: ${max_delay}`);

        super({object, property, label});

        this.#max_delay = max_delay;
        /** @type {string} */
        let fullkey = object[property];
        let key_pieces = fullkey.split('+');
        for (let k of ['alt', 'ctrl', 'shift']) {
            if (key_pieces[0].toLowerCase() == k) {
                this.#key[k] = true;
                key_pieces.shift();
            }
        }
        this.#key.key = key_pieces[0];
    }

    get capturing() { return this.selected && this.#capturing; }

    get value() {
        return [
            'alt'.repeat(this.#key.alt),
            'ctrl'.repeat(this.#key.ctrl),
            'shift'.repeat(this.#key.shift),
            this.#key.key,
        ].filter(s => s?.length > 0).join('+');
    }
    set value(value) {
        let key_pieces = value.split('+');
        let key = key_pieces.pop();
        for (let k of ['alt', 'ctrl', 'shift']) {
            if (key_pieces[0]?.toLowerCase() == k) {
                this.#key[k] = true;
                key_pieces.length && key_pieces.shift();
            }
        }
        this.#key.key = key;

        super.value = this.value;
    }

    height({context=canvas_context}={}) { return optionCKNSHeight.call(this, {context}); }

    draw({context=canvas_context}={}) {
        let y_start = BaseCanvasOption.options.filter(o => o.index < this.index && o.height({context}) > 0)
            .map(o => o.height({context}) + 1)
            .reduce((s, h) => s + h, 0);
        y_start *= option_sizes[1];
        y_start -= Math.max(0, BaseCanvasOption.selected.cursor_position({context})[1] - display_size[1] / 2 * tile_size[1]);
        let height = (this.height({context}) + .5) * option_sizes[1];

        // Option is not visible
        if (y_start >= display_size[1] * tile_size[1] || y_start + height <= 0) return;

        let x_start = option_sizes[0];
        let width = display_size[0] * tile_size[0] - option_sizes[0] * 2;

        let options = {min_left: option_sizes[0] * 1.5, min_right: option_sizes[0] * 1.5, context, font_size: option_sizes[1]};
        let left = x_start - tile_size[0];

        // Write label if it exists
        if (this.label) {
            options.min_left = option_sizes[0];
            canvas_write(this.label, left, y_start, options);
            let lbl_lines = cut_lines(this.label, left, options)[1].length + .25;
            let lbl_height = lbl_lines * option_sizes[1];
            y_start += lbl_height;
            height -= lbl_height;
            options.min_left = option_sizes[0] * 1.5;
        }

        let border_name = `border_option${'_error'.repeat(this.error)}${'_selected'.repeat(this.selected)}_color`;
        let background_name = 'background_option_color';
        let value = this.value;
        if (this.capturing && document.hasFocus() && Math.round(Date.now() / 1000 % 1)) {
            background_name = 'background_option_selected_color';
            let color = get_theme_value('text_selected_color');
            value = `{color:${color}}${value}{color:reset}`;
        }

        context.fillStyle = get_theme_value(background_name);
        context.strokeStyle = get_theme_value(border_name);
        context.fillRect(x_start, y_start, width, height);
        context.strokeRect(x_start, y_start, width, height);

        canvas_write(value, left, y_start, options);
    }

    cursor_position({context=canvas_context}={}) {
        let y_start = BaseCanvasOption.options.filter(o => o.index < this.index && o.height({context}) > 0)
            .map(o => o.height({context}) + 1)
            .reduce((s, h) => s + h, 0) * option_sizes[1];
        let x_start = option_sizes[0] - tile_size[0];
        let options = {min_left: option_sizes[0] * 1.5, min_right: option_sizes[0] * 1.5, context, font_size: option_sizes[1]};

        if (this.label) {
            options.min_left = option_sizes[0];
            let lbl_lines = cut_lines(this.label, x_start, options)[1].length;
            let lbl_height = lbl_lines * option_sizes[1];
            y_start += lbl_height;
            options.min_left = option_sizes[0];
        }

        let width = display_size[0] * tile_size[0] - option_sizes[0] * 2;
        let height = (this.height({context}) + .5) * option_sizes[1];

        return [x_start, y_start, width, height];
    }

    /**
     * @inheritdoc
     * @param {KeyboardEvent} event
     */
    keydown(event) {
        if (event.metaKey) {
            this.#capturing = false;
            return;
        }
        if (!this.capturing) {
            if (['Enter', 'Spacebar', ' '].includes(event.key)) {
                event.preventDefault();
                this.#capturing = true;
                setTimeout(() => {
                    // This is to allow ctrl + a, and other composed keys
                    this.#capturing = false;
                }, this.#max_delay);
            }
        } else {
            event.preventDefault();

            this.#key.alt = event.altKey && event.key != 'Alt';
            this.#key.ctrl = event.ctrlKey && event.key != 'Control';
            this.#key.shift = event.shiftKey && event.key != 'Shift';
            this.#key.key = event.key.toLowerCase();

            this.value = this.value;
        }
    }
}

const option_types = {
    'string': StringCanvasOption,
    'number': NumberCanvasOption,
    'boolean': BooleanCanvasOption,
    'list': ListCanvasOption,
    'color': ColorCanvasOption,
    'key': KeyCanvasOption,
};
