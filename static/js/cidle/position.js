import { number_between } from './primitives.js';
/**
 * @typedef {{x: number, y: number}|{0: number, 1: number}|[number, number]} PointLike
 * @typedef {{x: number, y: number, [Symbol.iterator]: () => Generator<number>}} Point
 * @typedef {[Point, Point]} Line
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

    return {
        x, y,
        *[Symbol.iterator]() {
            yield this.x;
            yield this.y;
        },
    };
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
 * @returns {(vector: [number, number]) => Line}
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
 * @returns {(dist: number) => Line}
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

/**
 * Converts an angle to a point in a rhombus
 *
 * @param {number} angle Angle in multiple of PI
 * @returns {[number, number]} A pair of ratios for the relative positions as [x, y]
 */
export function angle_to_rhombus_point(angle) {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    return [cos ** 2 * Math.sign(cos), sin ** 2 * Math.sign(sin)].map(n => Math.abs(n) < 1e-6 ? 0 : n);
}

/**
 * Checks whether 2 lines cross
 *
 * @see https://jeffreythompson.org/collision-detection/line-rect.php
 *
 * @param {[PointLike, PointLike]} linea
 * @param {[PointLike, PointLike]} lineb
 * @returns {boolean}
 */
function lines_cross(linea, lineb) {
    if (linea == lineb) return true;

    /** @type {Line} */
    let line_a = linea.map(l => to_point(l));
    /** @type {Line} */
    let line_b = lineb.map(l => to_point(l));

    const [p1, p2] = line_a;
    const [p3, p4] = line_b;

    const u_a = ((p4.x - p3.x) * (p1.y - p3.y) - (p4.y - p3.y) * (p1.x - p3.x)) / ((p4.y - p3.y) * (p2.x - p1.x) - (p4.x - p3.x) * (p2.y - p1.y));
    const u_b = ((p2.x - p1.x) * (p1.y - p3.y) - (p2.y - p1.y) * (p1.x - p3.x)) / ((p4.y - p3.y) * (p2.x - p1.x) - (p4.x - p3.x) * (p2.y - p1.y));

    return number_between(u_a, 0, 1) && number_between(u_b, 0 ,1);
}

/**
 * Checks whether a line crosses a rectangle's borders
 *
 * @see https://jeffreythompson.org/collision-detection/line-rect.php
 *
 * @param {[PointLike, PointLike]} line
 * @param {number} rect_x Lowest X position of the rectangle
 * @param {number} rect_y Lowest Y position of the rectangle
 * @param {number} rect_width Rectangle width
 * @param {number} rect_height Rectangle height
 */
export function line_crosses_rectangle(line, rect_x, rect_y, rect_width, rect_height) {
    const corners = [
        to_point([rect_x, rect_y]),
        to_point([rect_x + rect_width, rect_y]),
        to_point([rect_x + rect_width, rect_y + rect_height]),
        to_point([rect_x, rect_y + rect_height]),
    ];
    /** @type {Line[]} */
    const lines = [
        [corners[0], corners[1]],
        [corners[1], corners[2]],
        [corners[2], corners[3]],
        [corners[3], corners[0]],
    ];

    return lines.some(p => lines_cross(line, p));
}
