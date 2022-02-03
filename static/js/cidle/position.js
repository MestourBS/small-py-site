import { number_between } from './primitives.js';
/**
 * @typedef {{x: number, y: number}|{0: number, 1: number}|[number, number]} PointLike
 * @typedef {{x: number, y: number}} Point
 */

/**
 * Tries to convert something into a coordinates object ({x: number, y: number})
 *
 * @param {PointLike} coords
 * @returns {Point}
 */
export function to_point(coords) {
    let x = 0;
    let y = 0;
    if ('x' in coords && 'y' in coords && (!isNaN(coords.x + coords.y))) ({x, y} = coords);
    if (0 in coords && 1 in coords && (!isNaN(coords[0] + coords[1]))) {
        x = coords[0];
        y = coords[1];
    }

    return {x, y};
}

/**
 * Calculates the distance between 2 points, squared
 *
 * @param {PointLike} pointa
 * @param {PointLike} pointb
 * @returns {number}
 */
export function coords_distance(pointa, pointb) {
    const point_a = to_point(pointa);
    const point_b = to_point(pointb);

    return (point_a.x - point_b.x) ** 2 + (point_a.y - point_b.y) ** 2;
}

/**
 * Calculates a function that gives a parallel to a line
 *
 * @param {[PointLike, PointLike]} line
 * @returns {(vector: [number, number]) => [Point, Point]}
 */
function parallel(line) {
    const [pointa, pointb] = line.map(to_point);

    return (vector) => {
        const pax = pointa.x + vector[0];
        const pay = pointa.y + vector[1];
        const pbx = pointb.x + vector[0];
        const pby = pointb.y + vector[1];

        return [
            to_point([pax, pay]),
            to_point([pbx, pby]),
        ]
    }
}

/**
 * Calculates a function that gives a parallel to a line on a perpendicular
 *
 * @param {[PointLike, PointLike]} line
 * @returns {(dist: number) => [Point, Point]}
 */
export function parallel_perpendicular(line) {
    const [pointa, pointb] = line.map(to_point);

    let x_dist = pointb.x - pointa.x;
    let y_dist = pointb.y - pointa.y;
    let diff_root = 1;

    if (x_dist == 0 && y_dist == 0) {
        return dist => [to_point(pointa), to_point(pointb)];
    } else if (x_dist == 0) {
        y_dist = 1;
    } else if (y_dist == 0) {
        x_dist = 1;
    } else {
        diff_root = coords_distance(pointa, pointb) ** .5;
    }

    /**
     * @param {number} dist
     * @returns {[number, number]}
     */
    const to_vector = (dist = 0) => {
        dist /= diff_root;
        return [y_dist * dist, -x_dist * dist];
    };
    const func = parallel(line);

    return dist => func(to_vector(dist));
}

/**
 * Checks if a point is in a shape
 *
 * @param {PointLike} point
 * @param {number} minx
 * @param {number} maxx
 * @param {number} miny
 * @param {number} maxy
 * @returns {boolean}
 */
export function rect_contains_point(point, minx, maxx, miny, maxy) {
    point = to_point(point);

    return number_between(point.x, minx, maxx) && number_between(point.y, miny, maxy);
}
