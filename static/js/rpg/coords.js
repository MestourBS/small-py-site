import { Tile } from './tile.js';
import { Entity } from './entity.js';
import globals from './globals.js';

/**
 * Enum of directions, as [x, y]
 *
 * Includes various tools for direction calculating, which return Direction when possible
 *
 * @enum {readonly [number, number]}
 */
export const Direction = Object.freeze({
    'right': Object.freeze([1, 0]),
    'up': Object.freeze([0, -1]),
    'left': Object.freeze([-1, 0]),
    'down': Object.freeze([0, 1]),

    /** @type {([r,d]: [number, number]) => readonly [number, number]} */
    fromDir([r, d]) {
        let res = [Math.sign(r), Math.sign(d)];
        return this.to_dir(res);
    },
    /** @type {([r,d]: [number, number]) => readonly [number, number]} */
    opposite([r, d]) {
        let opposite = [Math.sign(r) * -1, Math.sign(d) * -1];
        return this.to_dir(opposite);
    },
    /** @type {([r,d]: [number, number]) => [readonly [number, number], readonly [number, number]]} [clockwise, counterclockwise] around [0, 0] */
    perpendicular([r, d]) {
        let clockwise = Object.freeze([d * -1, r]);
        let counterclockwise = Object.freeze([d, r * -1]);

        return [clockwise, counterclockwise].map(this.to_dir);
    },
    /** @type {([r, d]: [number, number]) => Direction} */
    to_dir([r, d]) {
        for (let id of ['right', 'up', 'left', 'down']) {
            /** @type {Direction} */
            let dir = Direction[id];

            if (r == dir[0] && d == dir[1]) return dir;
        }
        return Object.freeze([r,d]);
    },
});

/**
 * Returns the list of coordinates surrounding a space, in the shape of a square
 *
 * @param {number} center_x
 * @param {number} center_y
 * @param {number} [radius=hallway_radius]
 * @returns {[number,number][]}
 */
export function surrounding_square(center_x, center_y, radius) {
    /** @type {[number,number][]} */
    let coords = [];
    for (let x = center_x - radius; x <= center_x + radius; x++) {
        for (let y = center_y - radius; y <= center_y + radius; y++) {
            coords.push([x,y]);
        }
    }
    return coords;
}
/**
 * Calculates the distance between 2 points
 *
 * @param {[number, number]} point_a
 * @param {[number, number]} point_b
 * @returns {number}
 */
export function coords_distance(point_a, point_b) {
    if ([...point_a, ...point_b].some(n => isNaN(n) || !isFinite(n))) return Infinity;
    let dist_x = Math.abs(point_a[0] - point_b[0]);
    let dist_y = Math.abs(point_a[1] - point_b[1]);

    return Math.hypot(dist_x, dist_y);
}
/**
 * Checks whether you can walk over a coordinate
 *
 * @param {[number, number]} coords
 * @param {Entity|Entity[]} [excluded] Entities to exclude from checks
 * @returns {boolean}
 */
export function can_walk(coords, excluded=[]) {
    let [x, y] = coords;
    if (!Array.isArray(excluded)) excluded = [excluded];

    if (!(coords.toString() in globals.can_walked)) {
        let cw = Tile.solid_tiles.filter(t => t.x == x && t.y == y && !(t instanceof Entity)).length == 0;
        globals.can_walked[coords.toString()] = cw;
    }
    return globals.can_walked[coords.toString()] && !Entity.entities.some(e => !excluded.includes(e) && e.solid && Math.round(e.x) == x && Math.round(e.y) == y);
}
