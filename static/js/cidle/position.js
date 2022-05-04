import { number_between } from './primitives.js';
/**
 * X-likes
 * @typedef {{x: number, y: number}|{0: number, 1: number}|Point} PointLike
 * @typedef {{x: number, y: number, radius: number}|{0: number, 1: number, 2: number}|
 *  {center: PointLike, radius: number}|{0: PointLike, 1: number}|Disk} DiskLike
 * @typedef {{x: number, y: number, width: number, height: number}|
 *  {min_x: number, max_x: number, min_y: number, max_y: number}} RectLike
 * @typedef {[PointLike, PointLike]} LineLike
 *
 * Composite types
 * @typedef {[Point, Point]} Line
 */

export class Point {
    /**
     * @param {PointLike} coords
     */
    constructor(coords) {
        if (typeof coords != 'object');
        else if ('x' in coords && 'y' in coords && !isNaN(coords.x + coords.y)) {
            this.#x = coords.x;
            this.#y = coords.y;
        } else if (0 in coords && 1 in coords && !isNaN(coords[0] + coords[1])) {
            this.#x = coords[0];
            this.#y = coords[1];
        }
    }

    #x = 0;
    #y = 0;

    get x() { return this.#x; }
    set x(x) { if (!isNaN(x)) this.#x = x; }
    get y() { return this.#y; }
    set y(y) { if (!isNaN(y)) this.#y = y; }

    /**
     * Calculates the distance between 2 points, **squared**
     *
     * @param {PointLike} point
     * @returns {number}
     */
    distance(point) {
        const p = (point instanceof Point ? point : new Point(point));

        return (this.x - p.x) ** 2 + (this.y - p.y) ** 2;
    }
}

export class Disk {
    /**
     * @param {DiskLike} [disk]
     */
    constructor(disk) {
        if (typeof disk != 'object') return;

        if ('center' in disk) {
            this.#center = new Point(disk.center);
        } else if (0 in disk && !(2 in disk) && typeof disk[0] == 'object') {
            this.#center = new Point(disk[0]);
        } else if (('x' in disk && 'y' in disk) ||
            (0 in disk && 1 in disk && !isNaN(disk[0] + disk[1]))) {
            this.#center = new Point(disk);
        }

        if ('radius' in disk && !isNaN(disk.radius)) {
            this.#radius = disk.radius;
        } else if (2 in disk && !isNaN(disk[2])) {
            this.#radius = disk[2];
        } else if (!(2 in disk) && !isNaN(disk[1])) {
            this.#radius = disk[1];
        }
    }

    #center = new Point;
    #radius = 0;

    get center() { return new Point(this.#center); }
    set center(center) { if (center instanceof Point) this.#center = center; }
    get radius() { return this.#radius; }
    set radius(radius) { if (!isNaN(radius)) this.#radius = radius; }

    /**
     * Checks the intersection between 2 circles
     *
     * @see https://stackoverflow.com/a/12221389
     *
     * @param {DiskLike} disk
     * @returns {Point[]}
     */
    intersections(disk) {
        const d = (disk instanceof Disk ? disk : new Disk(disk));

        const dist = coords_distance(this.center, d.center) ** .5;

        if (dist > (this.radius + d.radius)) {
            // No intersection
            return [];
        }
        if (dist < Math.abs(this.radius - d.radius)) {
            // A circle is fully within the other
            return [];
        }

        const dist_x = d.center.x - this.center.x;
        const dist_y = d.center.y - this.center.y;

        const a = (this.radius ** 2 - d.radius ** 2 + dist ** 2) / (dist * 2);
        const h = (this.radius ** 2 - a ** 2) ** .5;

        const inter_x = this.center.x + dist_x * a / dist;
        const inter_y = this.center.y + dist_y * a / dist;

        const offset_x = -dist_y * h / dist;
        const offset_y = dist_x * h / dist;

        if (offset_x == 0 && offset_y == 0) {
            return [new Point([inter_x, inter_y])];
        }

        return [
            new Point([
                inter_x + offset_x,
                inter_y + offset_y,
            ]),
            new Point([
                inter_x - offset_x,
                inter_y - offset_y,
            ]),
        ];
    }

    /**
     * Checks whether the disk contains a point
     *
     * @param {PointLike} point
     * @returns {boolean}
     */
    contains_point(point) {
        return this.#center.distance(point) <= this.#radius ** 2;
    }

    /**
     * Gets the intersections with a specific arc
     *
     * @param {number} angle_min Lowest angle of the arc
     * @param {number} angle_max Highest angle of the arc
     * @param {DiskLike} circle Other circle
     * @returns {Point[]}
     */
    arc_intersections(angle_min, angle_max, circle) {
        const full_circle = Math.PI * 2;

        // Put angles in [0;PI)
        while (angle_min < 0) angle_min += full_circle;
        angle_min %= full_circle;

        while (angle_max < 0) angle_max += full_circle;
        angle_max %= full_circle;

        const intersections = this.intersections(circle);

        if (angle_max == angle_min) return intersections;
        else return intersections.filter(i => number_between(line_angle(this.center, i, true), angle_min, angle_max));
    }

    /**
     * Gets the point at an angle
     *
     * @param {number} angle
     * @returns {Point}
     */
    point_at(angle) {
        return new Point([
            Math.cos(angle) * this.#radius + this.center.x,
            Math.sin(angle) * this.#radius + this.center.y,
        ]);
    }
}

class Rectangle {
    /**
     * @param {RectLike} rect
     */
    constructor(rect) {
        if (typeof rect != 'object');
        else if ('x' in rect && 'y' in rect && 'width' in rect && 'height' in rect &&
            !isNaN(rect.x + rect.y + rect.width + rect.height)) {
            this.#min_x = rect.x
            this.#max_x = rect.x + rect.width;

            this.#min_y = rect.y;
            this.#max_y = rect.y + rect.height;
        } else if ('min_x' in rect && 'min_y' in rect && 'max_x' in rect && 'max_y' in rect &&
            !isNaN(rect.min_x + rect.min_y + rect.max_x + rect.max_y)) {
            this.#min_x = rect.min_x;
            this.#max_x = rect.max_x;
            this.#min_y = rect.min_y;
            this.#max_y = rect.max_y;
        }
        if (this.#min_x > this.#max_x) [this.#min_x, this.#max_x] = [this.#max_x, this.#min_x];
        if (this.#min_y > this.#max_y) [this.#min_y, this.#max_y] = [this.#max_y, this.#min_y];
    }

    #min_x = 0;
    #max_x = 0;
    #min_y = 0;
    #max_y = 0;

    get min_x() { return this.#min_x; }
    set min_x(min_x) { if (!isNaN(min_x)) this.#min_x = min_x; }
    get max_x() { return this.#max_x; }
    set max_x(max_x) { if (!isNaN(max_x)) this.#max_x = max_x; }
    get min_y() { return this.#min_y; }
    set min_y(min_y) { if (!isNaN(min_y)) this.#min_y = min_y; }
    get max_y() { return this.#max_y; }
    set max_y(max_y) { if (!isNaN(max_y)) this.#max_y = max_y; }

    get corners() {
        return [
            new Point([this.#min_x, this.#min_y]),
            new Point([this.#max_x, this.#min_y]),
            new Point([this.#max_x, this.#max_y]),
            new Point([this.#min_x, this.#max_y]),
        ];
    }

    /**
     * Checks if a point is in the rectangle
     *
     * @param {PointLike} point
     * @returns {boolean}
     */
    contains_point(point) {
        const p = (point instanceof Point ? point : new Point(point));

        return number_between(p.x, this.#min_x, this.#max_x) && number_between(p.y, this.#min_y, this.#max_y);
    }

    /**
     * Checks whether a line crosses a rectangle's borders
     *
     * @see https://jeffreythompson.org/collision-detection/line-rect.php
     *
     * @param {LineLike} line
     * @returns {boolean}
     */
    line_crosses(line) {
        const corners = this.corners;
        return [
            [corners[0], corners[1]],
            [corners[1], corners[2]],
            [corners[2], corners[3]],
            [corners[3], corners[0]],
        ].some(/**@param {Line} l*/l => lines_cross(line, l))
    }
}

/**
 * Calculates the distance between 2 points, **squared**
 *
 * @param {PointLike} pointa
 * @param {PointLike} pointb
 * @returns {number}
 */
export function coords_distance(pointa, pointb) {
    return new Point(pointa).distance(pointb);
}

/**
 * Calculates a function that gives a parallel to a line
 *
 * @param {LineLike} line
 * @returns {(vector: [number, number]) => Line}
 */
function parallel(line) {
    const [pointa, pointb] = line.map(p => new Point(p));

    return (vector) => {
        const pax = pointa.x + vector[0];
        const pay = pointa.y + vector[1];
        const pbx = pointb.x + vector[0];
        const pby = pointb.y + vector[1];

        return [
            new Point([pax, pay]),
            new Point([pbx, pby]),
        ]
    }
}

/**
 * Calculates a function that gives a parallel to a line on a perpendicular
 *
 * @param {LineLike} line
 * @returns {(dist: number) => Line}
 */
export function parallel_perpendicular(line) {
    const [pointa, pointb] = line.map(p => new Point(p));

    let x_dist = pointb.x - pointa.x;
    let y_dist = pointb.y - pointa.y;
    let diff_root = 1;

    if (x_dist == 0 && y_dist == 0) {
        return dist => [new Point(pointa), new Point(pointb)];
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
 * @param {number} min_x
 * @param {number} max_x
 * @param {number} min_y
 * @param {number} max_y
 * @returns {boolean}
 */
export function rect_contains_point(point, min_x, max_x, min_y, max_y) {
    return new Rectangle({ min_x, max_x, min_y, max_y }).contains_point(point);
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
 * @param {LineLike} linea
 * @param {LineLike} lineb
 * @returns {boolean}
 */
function lines_cross(linea, lineb) {
    if (linea == lineb) return true;

    /** @type {Line} */
    let line_a = linea.map(l => new Point(l));
    /** @type {Line} */
    let line_b = lineb.map(l => new Point(l));

    const [p1, p2] = line_a;
    const [p3, p4] = line_b;

    const u_a = ((p4.x - p3.x) * (p1.y - p3.y) - (p4.y - p3.y) * (p1.x - p3.x)) / ((p4.y - p3.y) * (p2.x - p1.x) - (p4.x - p3.x) * (p2.y - p1.y));
    const u_b = ((p2.x - p1.x) * (p1.y - p3.y) - (p2.y - p1.y) * (p1.x - p3.x)) / ((p4.y - p3.y) * (p2.x - p1.x) - (p4.x - p3.x) * (p2.y - p1.y));

    return number_between(u_a, 0, 1) && number_between(u_b, 0, 1);
}

/**
 * Checks whether a line crosses a rectangle's borders
 *
 * @see https://jeffreythompson.org/collision-detection/line-rect.php
 *
 * @param {LineLike} line
 * @param {number} rect_x Lowest X position of the rectangle
 * @param {number} rect_y Lowest Y position of the rectangle
 * @param {number} rect_width Rectangle width
 * @param {number} rect_height Rectangle height
 */
export function line_crosses_rectangle(line, rect_x, rect_y, rect_width, rect_height) {
    return new Rectangle({ x: rect_x, y: rect_y, width: rect_width, height: rect_height }).line_crosses(line);
}

/**
 * Checks the intersection between 2 circles
 *
 * @see https://stackoverflow.com/a/12221389
 *
 * @param {DiskLike} circlea
 * @param {DiskLike} circleb
 * @returns {Point[]}
 */
export function circles_intersections(circlea, circleb) {
    return new Disk(circlea).intersections(circleb);
}

/**
 * Finds the angle in multiple of PI from center to point
 *
 * @param {PointLike} center
 * @param {PointLike} point
 * @param {boolean} [absolute] If true, the angles will be in [0;PI)
 * @returns {number}
 */
export function line_angle(center, point, absolute = false) {
    const reference = new Point(center);
    const other = new Point(point);

    const dist_x = other.x - reference.x;
    const dist_y = other.y - reference.y;

    let angle = Math.atan2(dist_y, dist_x);

    if (absolute) {
        const circle = Math.PI * 2;
        while (angle < 0) angle += circle;
        angle %= circle;
    }

    return angle;
}

/**
 * Gets the intersections on a specific arc
 *
 * @param {DiskLike} arc
 * @param {number} angle_min Lowest angle of the arc
 * @param {number} angle_max Highest angle of the arc
 * @param {DiskLike} circle
 * @returns {Point[]}
 */
export function arc_intersections(arc, angle_min, angle_max, circle) {
    return new Disk(arc).arc_intersections(angle_min, angle_max, circle);
}

/**
 * Gets the point at an angle
 *
 * @param {DiskLike} circle
 * @param {number} angle
 * @returns {Point}
 */
export function circle_point_at(circle, angle) {
    return new Disk(circle).point_at(angle);
}

/**
 * Checks whether the circle contains a point
 *
 * @param {DiskLike} circle
 * @param {PointLike} point
 * @returns {boolean}
 */
export function circle_contains_point(circle, point) {
    return new Disk(circle).contains_point(point);
}
