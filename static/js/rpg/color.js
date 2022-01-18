const regex_rgb = /^rgb\((\d+(?:\.\d+)?), *(\d+(?:\.\d+)?), *(\d+(?:\.\d+)?)\)$/i;
const regex_rgba = /^rgba\((\d+(?:\.\d+)?), *(\d+(?:\.\d+)?), *(\d+(?:\.\d+)?)\, *(\d+(?:\.\d+)?)\)$/i;
const regex_hsl = /^hsl\((\d+(?:\.\d+)?), *(\d+(?:\.\d+)?)%, *(\d+(?:\.\d+)?)%\)$/i
const regex_hsla = /^hsla\((\d+(?:\.\d+)?), *(\d+(?:\.\d+)?)%, *(\d+(?:\.\d+)?)%, *(\d+(?:\.\d+)?)%\)$/i;

export class Color {
    /**
     * Forces a number to be between 0 and 255 (inclusives)
     *
     * @param {number} number
     * @returns {number}
     */
    static #kib(number) {
        return Math.round(Math.max(0, Math.min(255, number)));
    }

    /**
     * Converts a #rrggbbaa color into a Color object
     *
     * @param {string} hex
     * @returns {Color}
     */
    static from_hex(hex) {
        if (!hex.match(/^#?(?:[\da-f]{3,4}){1,2}$/)) throw new TypeError(`${hex} is not a valid hex color`);
        if (hex.startsWith('#')) hex = hex.slice(1);

        if (hex.length <= 4) hex = hex.split('').map(s => s.repeat(2)).join('');

        let rgba = [0, 0, 0, 255];
        let max_i = 3 + (hex.length == 8);
        for (let i = 0; i < max_i; i++) {
            rgba[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
        }

        let [red, green, blue, alpha] = rgba;

        return new Color(red, green, blue, alpha);
    }
    /**
     * Converts red, green, blue into a Color object
     *
     * Just use the constructor
     *
     * @param {number} red
     * @param {number} green
     * @param {number} blue
     * @param {number} [alpha]
     * @returns {Color}
     */
    static from_rgb(red, green, blue, alpha=255) {
        if (isNaN(red)) throw new TypeError(`red (${red}) is not a number`);
        if (isNaN(green)) throw new TypeError(`green (${green}) is not a number`);
        if (isNaN(blue)) throw new TypeError(`blue (${blue}) is not a number`);
        if (isNaN(alpha)) throw new TypeError(`alpha (${alpha}) is not a number`);

        const kib = this.#kib;
        return new Color(kib(red), kib(green), kib(blue), kib(alpha));
    }
    /**
     * Converts a `rgb(red, green, blue)` or a `rgba(red, green, blue, alpha)` into a Color object
     *
     * @param {string} cssrgb
     * @returns {Color}
     */
    static from_css_rgb(cssrgb) {
        let has_alpha;
        if (cssrgb.match(regex_rgb)) has_alpha = false;
        else if (cssrgb.match(regex_rgba)) has_alpha = true;
        else throw new TypeError(`${cssrgb} is not in the format 'rgb(<red>, <green>, <blue>)' or 'rgba(<red>, <green>, <blue>, <alpha>)`);

        let [,red, green, blue, alpha='255'] = cssrgb.match(has_alpha ? regex_rgba : regex_rgb);
        const kib = this.#kib;
        return new Color(kib(red), kib(green), kib(blue), kib(alpha));
    }
    /**
     * Converts a `hsl(hue, saturation, lightness)` into a Color object
     *
     * @param {string} csshsl
     * @returns {Color}
     */
    static from_css_hsl(csshsl) {
        let has_alpha;
        if (csshsl.match(regex_hsl)) has_alpha = false;
        else if (csshsl.match(regex_hsla)) has_alpha = true;
        else throw new TypeError(`${csshsl} is not in the format 'hsl(<hue>, <saturation>, <lightness>)' or 'hsla(<hue>, <saturation>, <lightness>, <alpha>)'`);

        let [,hue, saturation, lightness, alpha=100] = csshsl.match(has_alpha ? regex_hsla : regex_hsl);

        alpha = alpha / 100 * 255;

        // @see https://stackoverflow.com/a/44134328
        lightness /= 100;
        const a = saturation * Math.min(lightness, 1 - lightness) / 100;
        /** @param {number} n */
        const f = n => {
            const k = (n + hue / 30) % 12;
            const color = lightness - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
            return Math.round(255 * color);
        };

        let red = f(0);
        let green = f(8);
        let blue = f(4);

        const kib = this.#kib;
        return new Color(kib(red), kib(green), kib(blue), kib(alpha));
    }
    /**
     * Converts an object with the red, green, and blue properties into a Color object
     *
     * @param {{red: number, green: number, blue: number, alpha?: number}} color
     */
    static from_object(color) {
        if (!('red' in color)) throw new TypeError(`${color} has no red property`);
        if (!('green' in color)) throw new TypeError(`${color} has no green property`);
        if (!('blue' in color)) throw new TypeError(`${color} has no blue property`);
        if (isNaN(color.red)) throw new TypeError(`color's red property (${color.red}) is NaN`);
        if (isNaN(color.green)) throw new TypeError(`color's green property (${color.green}) is NaN`);
        if (isNaN(color.blue)) throw new TypeError(`color's blue property (${color.blue}) is NaN`);
        if ('alpha' in color && isNaN(color.alpha)) throw new TypeError(`color's alpha property (${color.alpha}) is NaN`);

        let {red, green, blue, alpha=255} = color;

        const kib = this.#kib;
        return new Color(kib(red), kib(green), kib(blue), kib(alpha));
    }
    /**
     * Converts an html color name into a Color object
     *
     * @param {string} name
     */
    static from_html_name(name) {
        // Automatically converts color name to hex
        let context = document.createElement('canvas').getContext('2d');
        context.fillStyle = name;
        return this.from_hex(context.fillStyle);
    }
    /**
     * Generates a random color
     *
     * @returns {Color}
     */
    static from_random() {
        let red = Math.floor(Math.random() * 255);
        let green = Math.floor(Math.random() * 255);
        let blue = Math.floor(Math.random() * 255);
        let alpha = Math.floor(Math.random() * 255);

        return new Color(red, green, blue, alpha);
    }

    /** @type {number} */
    #red;
    /** @type {number} */
    #green;
    /** @type {number} */
    #blue;
    /** @type {number} */
    #alpha;
    /** @type {string|false} */
    #string_hex = false;
    /** @type {string|false} */
    #string_rgb = false;
    /** @type {string|false} */
    #string_hsl = false;

    /**
     * @param {Color|string|number|{red: number, green: number, blue: number, alpha?: number}} red
     * @param {number} [green]
     * @param {number} [blue]
     * @param {number} [alpha]
     */
    constructor(red, green, blue, alpha=255) {
        if (typeof red == 'object') {
            if (isNaN(red?.red) || isNaN(red?.green) || isNaN(red?.blue) || ('alpha' in red && isNaN(red.alpha)))
            ({red, green, blue, alpha=alpha} = red);
        } else if (typeof red == 'string') ({red, green, blue, alpha=alpha} = Color.from_hex(red));
        else if (!isNaN(red) && !isNaN(green) && !isNaN(blue));
        else throw new TypeError(`Invalid color arguments: ${red},${green},${blue}`);
        if (isNaN(alpha)) throw new TypeError(`Invalid color alpha: ${alpha}`);

        const kib = Color.#kib;

        this.#red = kib(red);
        this.#green = kib(green);
        this.#blue = kib(blue);
        this.#alpha = kib(alpha);
    }

    /**
     * @param {'hex'|'rgb'|'hsl'} [format]
     * @param {boolean|'auto'} [alpha]
     */
    toString(format='hex', alpha='auto') {
        let string;
        if (alpha == 'auto') alpha = this.#alpha < 255;
        switch (format) {
            default:
                console.error(`Unknown mode ${format}, defaulting to rgb`);
            case 'hex':
                if (!this.#string_hex) {
                    this.#string_hex = `#${this.#red.toString(16).padStart(2,'0')}${this.#green.toString(16).padStart(2,'0')}${this.#blue.toString(16).padStart(2,'0')}`;
                    if (alpha) this.#string_hex += this.#alpha.toString(16).padStart(2,'0');
                }
                string = this.#string_hex;
                break;
            case 'rgb':
                if (!this.#string_rgb) {
                    let rgb = 'rgb';
                    let colors = [this.#red, this.#green, this.#blue];
                    if (alpha) {
                        rgb += 'a';
                        colors.push(this.#alpha);
                    }
                    this.#string_rgb = `${rgb}(${colors.join(', ')})`;
                }
                string = this.#string_rgb;
                break;
            case 'hsl':
                if (!this.#string_hsl) {
                    // @see https://stackoverflow.com/a/58426404
                    let red = this.#red / 255;
                    let green = this.#green / 255;
                    let blue = this.#blue / 255;

                    let cmin = Math.min(red, green, blue);
                    let cmax = Math.max(red, green, blue);
                    let delta = cmax - cmin;
                    let h = 0;
                    let s = 0;
                    let l = 0;

                    if (delta == 0) h = 0;
                    else if (cmax == red) h = ((green - blue) / delta) % 6;
                    else if (cmax == green) h = ((blue - red) / delta) + 2;
                    else h = ((red - green) / delta) + 4;

                    h = Math.round(h * 60);

                    if (h < 0) h += 360;

                    l = (cmax + cmin) / 2;

                    s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));

                    s = +(s * 100).toFixed(1);
                    l = +(l * 100).toFixed(1);

                    let hsl = 'hsl';
                    let values = [h.toString(), `${s}%`, `${l}%`];
                    if (alpha) {
                        hsl += 'a';
                        values.push(`${this.#alpha / 255 * 100}%`)
                    }
                    this.#string_hsl = `${hsl}(${values.join(', ')})`;
                }
                string = this.#string_hsl;
                break;
        }
        return string;
    }
    toJSON() { return this.toString(); }
    valueOf() { return this.toString(); }

    get red() { return this.#red; }
    set red(red) {
        if (!isNaN(red)) {
            const kib = Color.#kib;
            this.#red = kib(red);
            this.#string_hex = false;
            this.#string_rgb = false;
            this.#string_hsl = false;
        }
    }
    get green() { return this.#green; }
    set green(green) {
        if (!isNaN(green)) {
            const kib = Color.#kib;
            this.#green = kib(green);
            this.#string_hex = false;
            this.#string_rgb = false;
            this.#string_hsl = false;
        }
    }
    get blue() { return this.#blue; }
    set blue(blue) {
        if (!isNaN(blue)) {
            const kib = Color.#kib;
            this.#blue = kib(blue);
            this.#string_hex = false;
            this.#string_rgb = false;
            this.#string_hsl = false;
        }
    }
    get alpha() { return this.#alpha; }
    set alpha(alpha) {
        if (!isNaN(alpha)) {
            const kib = Color.#kib;
            this.#alpha = kib(alpha);
            this.#string_hex = false;
            this.#string_rgb = false;
            this.#string_hsl = false;
        }
    }

    /**
     * Returns a grayscale version of the color
     *
     * @returns {Color}
     */
    grayscale() {
        let gray = Math.round((this.#red + this.#green + this.#blue) / 3);

        return new Color(gray, gray, gray, this.#alpha);
    }
    /**
     * Returns an inverted version of the color
     *
     * @returns {Color}
     */
    invert() {
        let red = 255 - this.#red;
        let green = 255 - this.#green;
        let blue = 255 - this.#blue;

        return new Color(red, green, blue, this.#alpha);
    }
    /**
     * Clones the color
     *
     * @returns {Color}
     */
    clone() {
        return new Color(this);
    }
    /**
     * Makes a darker version of this color
     *
     * @param {number} [percent] Between 1 and 0, with 1 being 100% darker and 0 being 0% darker
     * @returns {Color}
     */
    darken(percent = 1) {
        if (isNaN(percent) || percent < 0 || percent > 1) return;
        if (percent == 0) return this.clone();

        percent = 1 - percent;
        let {red, green, blue} = this;

        red *= percent;
        green *= percent;
        blue *= percent;

        return new Color(Math.floor(red), Math.floor(green), Math.floor(blue), this.#alpha);
    }
    /**
     * Makes a brighter version of this color
     *
     * @param {number} [percent] Between 1 and 0, with 1 being 100% brighter and 0 being 0% brighter
     */
    brighten(percent = 1) {
        if (isNaN(percent) || percent < 0 || percent > 1) return;
        if (percent == 0) return this.clone();

        percent = 1 - percent;
        let {red, green, blue} = this;

        red = 255 - (255 - red) * percent;
        green = 255 - (255 - green) * percent;
        blue = 255 - (255 - blue) * percent;

        return new Color(Math.floor(red), Math.floor(green), Math.floor(blue), this.#alpha);
    }
    /**
     * Mixes 2 colors
     *
     * @param {Color} color
     * @param {'average'|'max'|'min'|'add'|'substract'|'multiply'|'xor'|'and'|'or'} mode
     * @returns {Color}
     */
    mix(color, mode='average') {
        const ops = {
            'average': (a, b) => (a + b) / 2,
            'max': Math.max,
            'min': Math.min,
            'add': (a, b) => a + b,
            'substract': (a, b) => a - b,
            'multiply': (a, b) => a * b,
            'xor': (a, b) => a ^ b,
            'and': (a, b) => a & b,
            'or': (a, b) => a | b,
        };

        if (!(mode in ops)) {
            console.error(`Unknown color mix mode ${mode}`);
            return null;
        }

        let result = {
            red: 0,
            green: 0,
            blue: 0,
            alpha: 0,
        };

        /** @type {(a: number, b: number) => number} */
        let op = ops[mode];
        const kib = Color.#kib;

        for (let prop of Object.keys(result)) {
            result[prop] = kib(op(this[prop], color[prop]));
        }

        return new Color(result);
    }
}
export default Color;
