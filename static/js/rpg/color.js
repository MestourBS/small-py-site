export class Color {
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

        let rgb = [0, 0, 0];
        for (let i = 0; i < 3; i++) rgb[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);

        let [red, green, blue] = rgb;

        return new Color(red, green, blue);
    }
    /**
     * Converts red, green, blue into a Color object
     *
     * Just use the constructor
     *
     * @param {number} red
     * @param {number} green
     * @param {number} blue
     * @returns {Color}
     */
    static from_rgb(red, green, blue) {
        if (isNaN(red)) throw new TypeError(`${red} is not a number`);
        if (isNaN(green)) throw new TypeError(`${green} is not a number`);
        if (isNaN(blue)) throw new TypeError(`${blue} is not a number`);

        red = Math.min(255, Math.max(0, red));
        green = Math.min(255, Math.max(0, green));
        blue = Math.min(255, Math.max(0, blue));

        return new Color(red, green, blue);
    }
    /**
     * Converts a `rgb(red, green, blue)` or a `rgba(red, green, blue, alpha)` into a Color object
     *
     * @param {string} cssrgb
     * @returns {Color}
     */
    static from_css_rgb(cssrgb) {
        if (!cssrgb.match(/^rgba?\((\d+), ?(\d+), ?(\d+)/i)) throw new TypeError(`${cssrgb} is not in the format 'rgb(<red>, <green>, <blue>)' or 'rgba(<red>, <green>, <blue>, <alpha>)`);

        let [,red, green, blue] = cssrgb.match(/^rgba?\((\d+), ?(\d+), ?(\d+)/i);
        return new Color(+red, +green, +blue);
    }
    /**
     * Converts a `hsl(hue, saturation, lightness)` into a Color object
     *
     * @param {string} csshsl
     * @returns {Color}
     */
    static from_css_hsl(csshsl) {
        if (!csshsl.match(/^hsla?\((\d+), ?(\d+)%, ?(\d+)/i)) throw new TypeError(`${csshsl} is not in the format 'hsl(<hue>, <saturation>, <lightness>)' or 'hsla(<hue>, <saturation>, <lightness>, <alpha>)'`);

        let [,hue, saturation, lightness] = csshsl.match(/^hsla?\((\d+), ?(\d+)%, ?(\d+)/i);

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

        return new Color(red, green, blue);
    }
    /**
     * Converts an object with the red, green, and blue properties into a Color object
     *
     * @param {{red: number, green: number, blue: number}} color
     */
    static from_object(color) {
        if (!('red' in color)) throw new TypeError(`${color} has no red property`);
        if (!('green' in color)) throw new TypeError(`${color} has no green property`);
        if (!('blue' in color)) throw new TypeError(`${color} has no blue property`);
        if (isNaN(color.red)) throw new TypeError(`${color.red} is NaN`);
        if (isNaN(color.green)) throw new TypeError(`${color.green} is NaN`);
        if (isNaN(color.blue)) throw new TypeError(`${color.blue} is NaN`);

        let {red, green, blue} = color;

        red = Math.min(255, Math.max(0, red));
        green = Math.min(255, Math.max(0, green));
        blue = Math.min(255, Math.max(0, blue));

        return new Color(red, green, blue);
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

        return new Color(red, green, blue);
    }

    /** @type {number} */
    #red;
    /** @type {number} */
    #green;
    /** @type {number} */
    #blue;
    /** @type {string|false} */
    #string_hex = false;
    /** @type {string|false} */
    #string_rgb = false;
    /** @type {string|false} */
    #string_hsl = false;

    /**
     * @param {Color|string|number|{red: number, green: number, blue: number}} red
     * @param {number} [green]
     * @param {number} [blue]
     */
    constructor(red, green, blue) {
        if (typeof red == 'object' && 'red' in red && 'green' in red && 'blue' in red) ({red, green, blue} = red);
        else if (typeof red == 'string') ({red, green, blue} = Color.from_hex(red));
        else if (typeof red == 'number' && typeof green == 'number' && typeof blue == 'number');
        else throw new TypeError(`Invalid color arguments: ${red.toString()},${green.toString()},${blue.toString()}`);

        this.#red = red;
        this.#green = green;
        this.#blue = blue;
    }

    /**
     * @param {'hex'|'rgb'|'hsl'} format
     */
    toString(format='hex') {
        let string;
        switch (format) {
            default:
                console.error(`Unknown mode ${format}, defaulting to rgb`);
            case 'hex':
                if (!this.#string_hex) {
                    this.#string_hex = `#${this.#red.toString(16).padStart(2,'0')}${this.#green.toString(16).padStart(2,'0')}${this.#blue.toString(16).padStart(2,'0')}`;
                }
                string = this.#string_hex;
                break;
            case 'rgb':
                if (!this.#string_rgb) {
                    this.#string_rgb = `rgb(${this.#red}, ${this.#green}, ${this.#blue})`;
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

                    this.#string_hsl = `hsl(${h}, ${s}%, ${l}%)`;
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
            this.#red = Math.min(255, Math.max(0, red));
            this.#string_hex = false;
            this.#string_rgb = false;
            this.#string_hsl = false;
        }
    }
    get green() { return this.#green; }
    set green(green) {
        if (!isNaN(green)) {
            this.#green = Math.min(255, Math.max(0, green));
            this.#string_hex = false;
            this.#string_rgb = false;
            this.#string_hsl = false;
        }
    }
    get blue() { return this.#blue; }
    set blue(blue) {
        if (!isNaN(blue)) {
            this.#blue = Math.min(255, Math.max(0, blue));
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

        return new Color(gray, gray, gray);
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

        return new Color(red, green, blue);
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

        return new Color(Math.floor(red), Math.floor(green), Math.floor(blue));
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

        return new Color(Math.floor(red), Math.floor(green), Math.floor(blue));
    }
    /**
     * Mixes 2 colors
     *
     * @param {Color} color
     * @param {'average'|'max'|'min'|'add'|'substract'|'multiply'|'xor'|'and'|'or'} mode
     * @returns {Color}
     */
    mix(color, mode='average') {
        let red = 0;
        let green = 0;
        let blue = 0;

        switch (mode) {
            case 'average':
                red = (this.#red + color.#red) / 2;
                green = (this.#green + color.#green) / 2;
                blue = (this.#blue + color.#blue) / 2;
                break;
            case 'max':
                red = Math.max(this.#red, color.#red);
                green = Math.max(this.#green, color.#green);
                blue = Math.max(this.#blue, color.#blue);
                break;
            case 'min':
                red = Math.min(this.#red, color.#red);
                green = Math.min(this.#green, color.#green);
                blue = Math.min(this.#blue, color.#blue);
                break;
            case 'add':
                red = Math.min(255, this.#red + color.#red);
                green = Math.min(255, this.#green + color.#green);
                blue = Math.min(255, this.#blue + color.#blue);
                break;
            case 'substract':
                red = Math.max(0, this.#red - color.#red);
                green = Math.max(0, this.#green - color.#green);
                blue = Math.max(0, this.#blue - color.#blue);
                break;
            case 'multiply':
                red = Math.min(255, this.#red * color.#red);
                green = Math.min(255, this.#green * color.#green);
                blue = Math.min(255, this.#blue * color.#blue);
                break;
            case 'xor':
                red = this.#red ^ color.#red;
                green = this.#green ^ color.#green;
                blue = this.#blue ^ color.#blue;
                break;
            case 'and':
                red = this.#red & color.#red;
                green = this.#green & color.#green;
                blue = this.#blue & color.#blue;
                break;
            case 'or':
                red = this.#red | color.#red;
                green = this.#green | color.#green;
                blue = this.#blue | color.#blue;
                break;
            default:
                console.error(`Unknown color mix mode ${mode}`);
                return null;
        }

        return new Color(red, green, blue);
    }
}
export default Color;
