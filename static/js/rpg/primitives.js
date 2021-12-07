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
