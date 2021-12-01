import { ascii_symbols, Room } from './room.js';
import { targetings, pathfindings } from './entity.js';
import Color from './color.js';

/**
 * Random generators
 */
export const Random = Object.freeze({
    Room: {
        /**
         * Generates a random room
         *
         * @param {Object} params
         * @param {number} [params.min_width]
         * @param {number} [params.max_width]
         * @param {number} [params.min_height]
         * @param {number} [params.max_height]
         * @param {number} [params.width]
         * @param {number} [params.height]
         * @param {string} [params.walls]
         * @param {string} [params.floors]
         * @param {keyof Room.SHAPES} [params.shape]
         * @returns {Room<string[]>}
         */
        room: ({min_width=7, max_width=null, min_height=7, max_height=null, height=null, width=null, walls=null, floors=null, shape=null}={}) => {
            if (width === null) {
                max_width ??= min_width + 10;
                width = Math.floor(Random.range(min_width, max_width));
            }
            if (height === null) {
                max_height ??= min_height + 10;
                height = Math.floor(Random.range(min_height, max_height));
            }

            walls ??= Random.Room.wall();
            floors ??= Random.Room.floor();
            shape ??= Random.Room.shape(width, height);
            let empty = ' ';

            let room = Room.make_ascii({height, width, shape, walls, floors, empty});

            return room;
        },
        wall: () => Random.array_element(ascii_symbols.solids),
        floor: () => Random.array_element(ascii_symbols.nonsolids),
        /**
         * @param {number} width
         * @param {number} height
         */
        shape: (width, height) => Random.array_element(Object.entries(Room.SHAPES).filter(s => s[1].cond(width, height)).map(s => s[0])),
        /** @returns {(room_amount?: any, spawn_player?: boolean) => Room<Tile<any>>} */
        map: () => Random.array_element(Object.values(Room.MAPS)),
    },
    AutonomousEntity: {
        /** @returns {(this: AutonomousEntity) => Tile} */
        targeting: () => Random.array_element(Object.entries(targetings).filter(([id]) => id != 'null').map(a => a[1])),
        /** @returns {(this: AutonomousEntity) => readonly [number, number]} */
        pathfinding: () => Random.array_element(Object.entries(pathfindings).filter(([id]) => id != 'null').map(a => a[1])),
    },

    /**
     * Generates a random color
     *
     * @type {() => Color}
     */
    get color() { return Color.from_random },
    /**
     * Gets a random element from the array
     *
     * @template T
     * @param {T[]} array
     * @returns {T}
     */
    array_element: array => {
        array = array.filter(t => !!(t ?? false));

        if (!array.length) return;

        let index = Math.floor(Random.range(0, array.length));
        return array[index];
    },
    /**
     * Shuffles an array
     *
     * @template T
     * @param {T[]} array
     * @returns {T[]}
     */
    array_shuffle: array => {
        array = [...array];

        let current_index = array.length;
        let random_index;

        while (current_index > 0) {
            random_index = Math.floor(Random.range(0, array.length));
            current_index--;

            [array[current_index], array[random_index]] = [array[random_index], array[current_index]];
        }

        return array;
    },
    /**
     * Random number between min and max
     *
     * Min is included, not max
     *
     * The number is **not** rounded
     *
     * @param {number} min
     * @param {number} max
     * @returns {number}
     */
    range: (min, max) => {
        if (min > max) [min, max] = [max, min];
        return min + Math.random() * (max - min);
    },
    /**
     * Gets a random face emoji
     *
     * @see https://unicode.org/emoji/charts/full-emoji-list.html
     *
     * @returns {string}
     */
    emoji_person: () => {
        /**
         * String.fromCodePoint
         */
        /** @type {([number, number]|number)[][]} ([min codepoint, max codepoint]|codepoint)[][] min and max are inclusive */
        const emoji_ranges = [
            //#region Emojis
            [[0x2639, 0x263A], 0xFE0F],
            [[0x1F600, 0x1F637]],
            [[0x1F641, 0x1F644]],
            [[0x1F910, 0x1F915]],
            [0x1F917],
            [[0x1F970, 0x1F976]],
            [[0x1F978, 0x1F97A]],
            [[0x1F920, 0x1F925]],
            [[0x1F927, 0x1F92F]],
            [0x1F9D0],
            //#endregion Emojis

            //#region People, yellow color
            [0x1F385, 0xFE0F],
            [[0x1F3C2, 0x1F3C4], 0xFE0F],
            [[0x1F466, 0x1F469], 0xFE0F],
            [0x1F3C7, 0xFE0F],
            [[0x1F3CA, 0x1F3CC], 0xFE0F],
            [[0x1F46B, 0x1F46E], 0xFE0F],
            [[0x1F470, 0x1F478], 0xFE0F],
            [0x1F47C, 0xFE0F],
            [[0x1F481, 0x1F483], 0xFE0F],
            [[0x1F486, 0x1F487], 0xFE0F],
            [0x1F48F, 0xFE0F],
            [0x1F491, 0xFE0F],
            [[0x1F574, 0x1F575], 0xFE0F],
            [0x1F57A, 0xFE0F],
            [[0x1F645, 0x1F647], 0xFE0F],
            [0x1F64B, 0xFE0F],
            [[0x1F64D, 0x1F64E], 0xFE0F],
            [0x1F6A3, 0xFE0F],
            [[0x1F6B4, 0x1F6B6], 0xFE0F],
            [0x1F6C0, 0xFE0F],
            [0x1F926, 0xFE0F],
            [[0x1F934, 0x1F939], 0xFE0F],
            [[0x1F93D, 0x1F93E], 0xFE0F],
            [0x1F977, 0xFE0F],
            [[0x1F9B8, 0x1F9B9], 0xFE0F],
            [[0x1F9CD, 0x1F9CF], 0xFE0F],
            [[0x1F9D1, 0x1F9DF], 0xFE0F],
            //#endregion People, yellow color

            //#region Colored people
            [0x1F385, [0x1F3FB, 0x1F3FF]],
            [[0x1F3C2, 0x1F3C4], [0x1F3FB, 0x1F3FF]],
            [[0x1F3CA, 0x1F3CC], [0x1F3FB, 0x1F3FF]],
            [0x1F3C7, [0x1F3FB, 0x1F3FF]],
            [[0x1F466, 0x1F469], [0x1F3FB, 0x1F3FF]],
            [[0x1F46B, 0x1F46E], [0x1F3FB, 0x1F3FF]],
            [[0x1F470, 0x1F478], [0x1F3FB, 0x1F3FF]],
            [0x1F47C, [0x1F3FB, 0x1F3FF]],
            [[0x1F481, 0x1F483], [0x1F3FB, 0x1F3FF]],
            [[0x1F486, 0x1F487], [0x1F3FB, 0x1F3FF]],
            [0x1F48F, [0x1F3FB, 0x1F3FF]],
            [0x1F491, [0x1F3FB, 0x1F3FF]],
            [[0x1F574, 0x1F575], [0x1F3FB, 0x1F3FF]],
            [0x1F57A, [0x1F3FB, 0x1F3FF]],
            [[0x1F645, 0x1F647], [0x1F3FB, 0x1F3FF]],
            [0x1F64B, [0x1F3FB, 0x1F3FF]],
            [[0x1F64D, 0x1F64E], [0x1F3FB, 0x1F3FF]],
            [0x1F6A3, [0x1F3FB, 0x1F3FF]],
            [[0x1F6B4, 0x1F6B6], [0x1F3FB, 0x1F3FF]],
            [0x1F6C0, [0x1F3FB, 0x1F3FF]],
            [0x1F926, [0x1F3FB, 0x1F3FF]],
            [[0x1F934, 0x1F939], [0x1F3FB, 0x1F3FF]],
            [[0x1F93D, 0x1F93E], [0x1F3FB, 0x1F3FF]],
            [0x1F977, [0x1F3FB, 0x1F3FF]],
            [[0x1F9B8, 0x1F9B9], [0x1F3FB, 0x1F3FF]],
            [[0x1F9CD, 0x1F9CF], [0x1F3FB, 0x1F3FF]],
            [[0x1F9D1, 0x1F9DF], [0x1F3FB, 0x1F3FF]],
            //#endregion Colored people
        ];
        /** @param {(number|[number, number])[]} range */
        const get_weight = range => {
            return range.map(r => Array.isArray(r) ? r[1] - r[0] + 1 : 1).reduce((s, n) => s + n, 0);
        };
        const total_weight = 412;
        let target_weight = Math.floor(Random.range(0, total_weight + 1));
        let i = -1;
        while (target_weight >= 0) {
            i++;
            let range = emoji_ranges[i];
            target_weight -= get_weight(range);
        }
        let range = emoji_ranges[i].map(r => Array.isArray(r) ? Math.floor(Random.range(r[0], r[1]+1)) : r);
        return String.fromCodePoint(...range);
    },
});
export default Random;

//? object functions as module functions
