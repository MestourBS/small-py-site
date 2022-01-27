/**
 * Finds all prime factors of a number
 *
 * @param {number} number
 * @returns {number[]}
 */
export function prime_factors(number) {
    const factors = [];
    let divider = 2;
    number = Math.abs(number);

    while (number >= 2) {
        if (number % divider == 0) {
            factors.push(divider);
            number /= divider;
        } else {
            divider++;
        }
    }

    return factors;
}

/**
 * Finds all shared prime factors of a set of numbers
 *
 * @param {...number} numbers
 * @returns {number[]}
 */
export function shared_factors(...numbers) {
    const factors = [];
    let divider = 2;
    numbers = numbers.map(n => Math.abs(n));

    while (Math.min(...numbers) >= 2) {
        if (numbers.every(n => n % divider == 0)) {
            factors.push(divider);
            numbers = numbers.map(n => n /= divider);
        } else {
            divider++;
        }
    }

    return factors;
}

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
 * Makes a number look good
 *
 * @param {number} number
 * @param {Object} [params]
 * @param {number[]} [params.cutoffs] Powers of 10 which change the `Intl.NumberFormat` options
 * @param {Intl.NumberFormatOptions[]} [params.options] Options for each cutoff point
 */
export function beautify(number, {cutoffs=[6], options=[{notation: 'standard'}, {notation: 'engineering'}]}={}) {
    if (!options.length) options = [{notation: 'standard'}];
    const pow = Math.log10(number);
    const options_index = cutoffs.filter(n => n <= pow).length % options.length;
    const option = options[options_index];

    return new Intl.NumberFormat({}, option).format(number);
}

/**
 * Groups an array by the results of func call
 *
 * @template T
 * @param {T[]} array
 * @param {(value: T, index: number, array: T[]) => any} func
 * @returns {{
 *  [key: string]: T[],
 *  [Symbol.iterator](): Generator<[string, T[]]>,
 * }}
 */
export function array_group_by(array, func) {
    return array.reduce(/** @param {{[k: string]: T[]}} r */(r, value, index, array) => {
        const key = func(value, index, array);
        const arr = (r[key] ??= []);
        arr.push(value);
        return r;
    }, {
        *[Symbol.iterator]() {
            const keys = Object.keys(this);

            for (const key of keys) {
                yield [key, this[key]];
            }
        },
    });
}
