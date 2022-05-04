/**
 * @typedef {{x: number, y: number}} Point
 *
 * @typedef Circle
 * @prop {Point} center
 * @prop {number} radius
 * @prop {number} angle_start
 * @prop {number} angle_end
 * @prop {string} border
 * @prop {string} fill
 */

/**
 * @type {{
 *  arc_intersections: (arc: Circle, angle_min: number, angle_max: number, circle: Circle) => Point[],
 *  circles_intersections: (circlea: Circle, circleb: Circle) => Point[],
 *  line_angle: (pointa: Point, pointb: Point, absolute?: boolean) => number,
 *  circle_point_at: (circle: Circle, angle: number) => Point,
 *  circle_contains_point: (circle: Circle, point: Point) => boolean,
 * }}
 */
const { arc_intersections, circles_intersections, line_angle, circle_point_at, circle_contains_point } = await import('/static/js/cidle/position.js');
/**
 * @type {{
 *  context: CanvasRenderingContext2D,
 * }}
 */
const { context } = await import('/static/js/cidle/canvas.js');

const { PI } = Math;
/** @type {Circle[]} */
const circles = [
    {
        center: { x: 300, y: 300 },
        radius: 50,
        angle_start: 0,
        angle_end: PI * 2,
        border: '#000',
        fill: '#FFF',
    },
    {
        center: { x: 300, y: 350 },
        radius: 50,
        angle_start: 0,
        angle_end: PI * 2,
        border: '#0F0',
        fill: '#0F07',
    },
    {
        center: { x: 350, y: 300 },
        radius: 50,
        angle_start: 0,
        angle_end: PI * 2,
        border: '#F00',
        fill: '#F007',
    },
];
/** @param {Circle} circle */
const circleDraw = circle => {
    context.beginPath();
    context.fillStyle = circle.fill;
    context.strokeStyle = circle.border;
    context.arc(circle.center.x, circle.center.y, circle.radius, circle.angle_start, circle.angle_end);
    context.fill();
    context.stroke();
    context.closePath();
};

circles.forEach(circleDraw);

/** @param {Circle} circle @param {Circle[]} circles */
((circle, circles, fill = '#7773', border = '#777') => {
    const i = circles.indexOf(circle);
    /** @typedef {{center: Point, radius: number, angle_start: number, angle_end: number, counterclockwise: boolean}} Step */
    /** @type {Step[]} */
    const path = [{
        center: circle.center,
        radius: circle.radius,
        angle_start: circle.angle_start,
        angle_end: circle.angle_end,
        counterclockwise: false,
    }];
    circles.filter((c, n) => n > i && circles_intersections(c, circle).length == 2).forEach(c => {
        const intersects_with = path.filter(p => arc_intersections(p, p.angle_start, p.angle_end, c).length > 0);
        if (!intersects_with.length) return;
        const indexes = intersects_with.map(i => path.indexOf(i));

        /** @type {Step[]} */
        const steps = [
        ];
        let i = 0;
        let length = 0;

        if (!indexes.length) return;
        else if (indexes.length == 1) {
            //! fails on right and top-right
            [i] = indexes;
            length = 1;
            const p = path[i];
            const intersections = arc_intersections(p, p.angle_start, p.angle_end, c)
                .sort((a, b) => line_angle(p.center, a, true) - line_angle(p.center, b, true));
            if (intersections.length != 2) return;
            const [firsti, lasti] = intersections;
            /** @type {Step} */
            const firsts = {
                center: {
                    x: p.center.x,
                    y: p.center.y,
                },
                radius: p.radius,
                angle_start: p.angle_start,
                angle_end: line_angle(p.center, firsti, true),
                counterclockwise: p.counterclockwise,
            };
            /** @type {Step} */
            const middle = {
                center: {
                    x: c.center.x,
                    y: c.center.y,
                },
                radius: c.radius,
                angle_start: line_angle(c.center, firsti, true),
                angle_end: line_angle(c.center, lasti, true),
                counterclockwise: true,
            };
            /** @type {Step} */
            const lasts = {
                center: {
                    x: p.center.x,
                    y: p.center.y,
                },
                radius: p.radius,
                angle_start: line_angle(p.center, lasti, true),
                angle_end: p.angle_end,
                counterclockwise: p.counterclockwise,
            };
            steps.push(firsts, middle, lasts);
        } else if (indexes.length == 2) {
            return;
            const i1 = Math.min(...indexes);
            const i2 = Math.max(...indexes);

            const first = path[i1];
            const last = path[i2];

            const firsti = arc_intersections(first, first.angle_start, first.angle_end, c)[0];
            const lasti = arc_intersections(last, last.angle_start, last.angle_end, c)[0];
            console.log(firsti, lasti);

            steps.push(
                /*
                {
                    center: {
                        x: first.center.x,
                        y: first.center.y,
                    },
                    radius: first.radius,
                    angle_start: line_angle(first.center, firsti, true),
                    angle_end: first.angle_end,
                    counterclockwise: first.counterclockwise,
                },
                {
                    center: {
                        x: c.center.x,
                        y: c.center.y,
                    },
                    radius: c.radius,
                    angle_start: line_angle(c.center, lasti, true),
                    angle_end: line_angle(c.center, firsti, true),
                    counterclockwise: true,
                },
                {
                    center: {
                        x: last.center.x,
                        y: last.center.y,
                    },
                    radius: last.radius,
                    angle_start: last.angle_start,
                    angle_end: line_angle(last.center, lasti, true),
                    counterclockwise: last.counterclockwise,
                },
                */
            );
            path.splice(i1, i2 - i1 + 1, ...steps);
            length = i2 - i1 + 1;
            i = i1;
        } else if (indexes.length == 3) {
            //todo
        } else {
            console.log(`${indexes.length} indexes`);
        }
        path.splice(i, length, ...steps);
    });
    console.log(path);

    context.beginPath();
    context.fillStyle = fill;
    context.strokeStyle = border;
    path.forEach(({ center, radius, angle_start, angle_end, counterclockwise }) => {
        context.arc(center.x, center.y, radius, angle_start, angle_end, counterclockwise);
    });
    context.fill();
    context.stroke();
    context.closePath();
})(circles[0], circles);
