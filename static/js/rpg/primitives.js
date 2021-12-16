// Number functions
/**
 * Checks if a number is between min and max, inclusive
 *
 * @see https://stackoverflow.com/a/61476262
 *
 * @param {number} number
 * @param {number} min
 * @param {number} max
 * @returns {boolean}
 */
export function number_between(number, min, max) {
    return (number - min) * (number - max) <= 0;
}
/**
 * Makes a number look better than javascript's `Number.toString`
 *
 * @param {number} number
 * @param {Object} options
 * @param {boolean} [options.trim=true] Whether to trim trailing zeroes
 * @param {number} [options.min_short=6] Minimum power of 10 at which we use short notation
 * @param {number} [options.precision=3] Precision of the floating point of the number
 * @param {number} [options.power_step=1] Step for the number's power.
 *  A step of `n` will result in a number as `<whole>.<floating point>e<n * k>`
 * @param {{'-1'?: string, '1'?: string, '0'?: string}} [options.signs] Signs for positive/negative/0 numbers
 * @returns {string}
 */
export function beautify(number, {trim = true, min_short = 6, precision = 3, power_step = 1, signs = {'-1':'-'}} = {}) {
    power_step = Math.floor(power_step);
    if (isNaN(number) || number == 0) return '0';
    if (!isFinite(number)) return (Math.sign(number) in signs ? signs[Math.sign(number)] : '') + '∞';
    if (isNaN(power_step) || !isFinite(power_step) || !power_step) return number.toString();

    /** @type {-1|0|1} */
    let sign = Math.sign(number);
    number = Math.abs(number);
    // log10 does not work with a negative number
    let power = Math.floor(Math.log10(number));
    let base_power = power;
    if (power % power_step) {
        power -= (power % power_step);
        if (power > base_power) power -= power_step;
    }
    if (power >= min_short || power < 0) {
        number /= 10 ** power;
    }

    let whole = BigInt(Math.floor(number)).toString();
    let fraction = BigInt(Math.round(number % 1 * 10 ** precision)).toString();

    if (+fraction || !trim) {
        fraction = fraction.padStart(precision, '0');

        if (trim) fraction = fraction.replace(/0+$/, '');
    } else {
        fraction = '';
    }

    let str_sign = sign in signs ? signs[sign] : '';
    let str_fraction = fraction.length ? `.${fraction}` : '';
    let str_exp = (power >= min_short || power < 0) ? `e${power}` : '';

    return `${str_sign}${whole}${str_fraction}${str_exp}`;
}
/**
 * Calculates the average of multiple numbers
 *
 * @param {...number} numbers
 * @returns {number}
 */
export function average(...numbers) {
    if (!numbers.length) return 0;

    return numbers.reduce((a,b) => a+b, 0) / numbers.length;
}

// Object functions
/**
 * Checks if an object is an instance of any class given
 *
 * @param {any} obj
 * @param {...function(new: any)} classes
 * @returns {boolean}
 */
export function isinstance(obj, ...classes) {
    for (let cls of classes) {
        if (obj instanceof cls) return true;
    }
    return false;
}
