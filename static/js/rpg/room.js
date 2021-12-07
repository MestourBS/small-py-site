import { Tile } from './tile.js';
import { Item } from './item.js';
import { number_between } from './primitives.js';
import { AutonomousEntity } from './entity.js';
import { Direction, surrounding_square, coords_distance } from './coords.js';
import Random from './random.js';
import globals from './globals.js';
/** @typedef {import('./color.js').Color} Color */

/**
 * TODO LIST
 * =========
 *
 * room:
 *  * paths:
 *      ? curved
 *      - without touching other rooms/hallways (if possible)
 *      - diagonals only
 *
 *  * maps:
 *      - no hallways, everything touches another room
 *
 *  ? room decorating?
 */

/**
 * ASCII to tile content map
 *
 * @type {{[k: string]: string|Color|CanvasImageSource|((this: Entity) => void)}}
 */
const ascii_colors = {
    '#': '#333',
    '.': '#ccc',
    '■': '#335',
    '□': '#ccf',
    '▮': '#533',
    '▯': '#fcc',
    '▬': '#353',
    '▭': '#cfc',
    '●': '#553',
    '○': '#ffc',
    '◆': '#535',
    '◇': '#fcf',
    '◉': '#355',
    '◎': '#cff',
    '1': '#555',
    '0': '#eee',
};
/**
 * ASCII symbols for ascii displays.
 *
 * @type {{
 *  solids: string[],
 *  nonsolids: string[],
 * }}
 */
export const ascii_symbols = {
    solids: ['#', '■', '▮', '▬', '●', '◆', '◉', '1'],
    nonsolids: ['.', '□', '▯', '▭', '○', '◇', '◎', '0'],
};

/**
 * @template {(string[]|Tile)} T
 */
export class Room {
    static SHAPES = {
        'square': {
            func: (grid, width, height, walls='#', floors='.', empty=' ') => {
                return grid.map((row, y) => {
                    let row_wall = y == 0 || y ==height - 1;
                    return row.map((_, x) => {
                        let is_wall = row_wall || x == 0 || x == width - 1;
                        return is_wall ? walls : floors;
                    });
                });
            },
            cond: (width, height) => width >= 3 && height >= 3,
        },
        'round': {
            func: (grid, width, height, walls='#', floors='.', empty=' ') => {
                // @see https://math.stackexchange.com/questions/76457/check-if-a-point-is-within-an-ellipse
                let x_origin = width / 2;
                let y_origin = height / 2;
                let limit = (x_origin ** 2) * (y_origin ** 2);

                grid = grid.map((row, y) => {
                    return row.map((_, x) => {
                        let res = ((x - x_origin) ** 2) * (y_origin ** 2) + ((y - y_origin) ** 2) * (x_origin ** 2);

                        if (res <= limit) return floors;
                        return empty;
                    });
                });

                grid.forEach((row, y) => {
                    row.forEach((cell, x) => {
                        if (cell == empty) return;

                        /** @type {string[]} */
                        let neighbours = [];

                        if (y > 0) neighbours.push(grid[y-1][x]);
                        if (y < height - 1) neighbours.push(grid[y+1][x]);
                        else neighbours.push(empty);
                        if (x > 0) neighbours.push(grid[y][x-1]);
                        if (x < width - 1) neighbours.push(grid[y][x+1]);
                        else neighbours.push(empty);

                        if (neighbours.some(c => c == empty)) grid[y][x] = walls;
                    });
                });

                return grid
            },
            cond: (width, height) => width >= 3 && height >= 3,
        },
        'plus': {
            func: (grid, width, height, walls='#', floors='.', empty=' ') => {
                /** @param {number} n */
                function get_sizes(n) {
                    if (n < 5) return [0, n];

                    // Minimum sizes
                    let sizes = [1, 3];

                    n -= 5;
                    if (n % 3) {
                        let add_target = +(n % 3 == 1);
                        n -= n % 3;

                        sizes[add_target]++;
                    }
                    sizes = sizes.map(s => s + n/3);

                    return sizes;
                }
                let [space_x, center_x] = get_sizes(width);
                let [space_y, center_y] = get_sizes(height);

                return grid.map((row, y) => {
                    let y_empty = y < space_y || y > space_y + center_y - 1;
                    let y_wall = y == space_y || y == space_y + center_y - 1;
                    let y_floor = !y_empty && !y_wall;
                    let is_wall = y == 0 || y == height - 1;

                    return row.map((_, x) => {
                        let x_empty = x <= space_x || x > space_x + center_x - 1;
                        let x_wall = x == space_x || x == space_x + center_x - 1;
                        let x_floor = !x_empty && !x_wall;

                        let wall = is_wall || x == 0 || x == width - 1;

                        if ((!x_empty || !y_empty) && wall) return walls;
                        if (x_floor || y_floor) {
                            return floors;
                        }
                        if (x_wall || y_wall) {
                            return walls;
                        }
                        return empty;
                    });
                });
            },
            cond: (width, height) => width >= 5 && height >= 5,
        },
        'donut_square': {
            func: (grid, width, height, walls='#', floors='.', empty=' ') => {
                /** @param {number} n */
                function get_sizes(n) {
                    if (n < 7) return [n, 0];

                    // Minimum sizes
                    let sizes = [3, 1];

                    n -= 7;
                    if (n % 3) {
                        let add_target = +(n % 3 == 1);
                        n -= n % 3;

                        sizes[add_target]++;
                    }
                    sizes = sizes.map(s => s + n/3);

                    return sizes;
                }

                let [side_x, hole_width] = get_sizes(width);
                let [side_y, hole_height] = get_sizes(height);

                return grid.map((row, y) => {
                    let y_floor = y < side_y - 1 || y > side_y + hole_height;
                    let y_wall = y == side_y - 1 || y == side_y + hole_height;
                    let y_empty = !y_floor && !y_wall;
                    let is_wall = y == 0 || y == height - 1;

                    return row.map((_, x) => {
                        let x_floor = x < side_x - 1 || x > side_x + hole_width;
                        let x_wall = x == side_x - 1 || x == side_x + hole_width;
                        let x_empty = !x_floor && !x_wall;
                        let wall = is_wall || x == 0 || x == width - 1;

                        if (wall) return walls;
                        if (x_empty && y_empty) return empty;
                        if ((x_wall && !y_floor) || (y_wall && !x_floor)) return walls;
                        return floors;
                    });
                });
            },
            cond: (width, height) => width >= 9 && height >= 9,
        },
        'donut_round': {
            func: (grid, width, height, walls='#', floors='.', empty=' ') => {
                let hole_width = width / 2.02; // Really close, but somehow far enough to take only ~33% of the size
                let hole_height = height / 2.02; // Really close, but somehow far enough to take only ~33% of the size
                let x_origin = width / 2;
                let y_origin = height / 2;
                let limit = (x_origin ** 2) * (y_origin ** 2);
                let hole_limit = (hole_width ** 2) * (hole_height ** 2);

                grid = grid.map((row, y) => {
                    return row.map((_, x) => {
                        let res = ((x - x_origin) ** 2) * (y_origin ** 2) + ((y - y_origin) ** 2) * (x_origin ** 2);

                        if (res <= limit - hole_limit) return empty;
                        if (res <= limit) return floors;
                        return empty;
                    });
                });

                grid.forEach((row, y) => {
                    row.forEach((cell, x) => {
                        if (cell == empty) return;

                        /** @type {string[]} */
                        let neighbours = [];

                        if (y > 0) neighbours.push(grid[y-1][x]);
                        if (y < height - 1) neighbours.push(grid[y+1][x]);
                        else neighbours.push(empty);
                        if (x > 0) neighbours.push(grid[y][x-1]);
                        if (x < width - 1) neighbours.push(grid[y][x+1]);
                        else neighbours.push(empty);

                        if (neighbours.some(c => c == empty)) grid[y][x] = walls;
                    });
                });

                return grid;
            },
            cond: (width, height) => width >= 8 && height >= 8,
        },
        'rhombus': { // ◊
            func: (grid, width, height, walls='#', floors='.', empty=' ') => {
                // Compute distance from vertical axis
                let ratio = width / height;

                grid = grid.map((row, y) => {
                    let x_max = Math.ceil(Math.abs(y - (height - 1) / 2) * ratio);
                    return row.map((_, x) => {
                        if (x > width / 2) x = Math.ceil(Math.abs(width - x));
                        if (x < x_max) return empty;
                        if (x == x_max) return walls;
                        return floors;
                    });
                });

                return grid.map((row, y) => {
                    return row.map((cell, x) => {
                        if (cell != floors) return cell;

                        /** @type {string[]} */
                        let neighbours = [];
                        if (y > 0) neighbours.push(grid[y-1][x]);
                        else neighbours.push(empty);
                        if (y < height - 1) neighbours.push(grid[y+1][x]);
                        else neighbours.push(empty);
                        if (x > 0) neighbours.push(grid[y][x-1]);
                        else neighbours.push(empty);
                        if (x < width - 1) neighbours.push(grid[y][x+1]);
                        else neighbours.push(empty);

                        if (neighbours.some(c => c == empty)) return walls;
                        return cell;
                    });
                });
            },
            cond: (width, height) => width >= 3 && height >= 3,
        },
        'triangle_north': { // △
            func: (grid, width, height, walls='#', floors='.', empty=' ') => {
                // Compute distance from axis
                let ratio = width / height / 2;

                grid = grid.map((row, y) => {
                    let x_max = Math.ceil((height - y) * ratio);
                    return row.map((_, x) => {
                        if (x > width / 2) x = Math.ceil(Math.abs(width - x));
                        if (x < x_max) return empty;
                        if (x == x_max) return walls;
                        return floors;
                    });
                });

                return grid.map((row, y) => {
                    return row.map((cell, x) => {
                        if (cell != floors) return cell;

                        /** @type {string[]} */
                        let neighbours = [];
                        if (y > 0) neighbours.push(grid[y-1][x]);
                        else neighbours.push(empty);
                        if (y < height - 1) neighbours.push(grid[y+1][x]);
                        else neighbours.push(empty);
                        if (x > 0) neighbours.push(grid[y][x-1]);
                        else neighbours.push(empty);
                        if (x < width - 1) neighbours.push(grid[y][x+1]);
                        else neighbours.push(empty);

                        if (neighbours.some(c => c == empty)) return walls;
                        return cell;
                    });
                });
            },
            cond: (width, height) => width >= 4 && height >= 4,
        },
        'triangle_south': { // ▽
            func: (grid, width, height, walls='#', floors='.', empty=' ') => {
                // Compute distance from axis
                let ratio = width / height / 2;

                grid = grid.map((row, y) => {
                    let x_max = Math.ceil(y * ratio);
                    return row.map((_, x) => {
                        if (x > width / 2) x = Math.ceil(Math.abs(width - x));
                        if (x < x_max) return empty;
                        if (x == x_max) return walls;
                        return floors;
                    });
                });

                return grid.map((row, y) => {
                    return row.map((cell, x) => {
                        if (cell != floors) return cell;

                        /** @type {string[]} */
                        let neighbours = [];
                        if (y > 0) neighbours.push(grid[y-1][x]);
                        else neighbours.push(empty);
                        if (y < height - 1) neighbours.push(grid[y+1][x]);
                        else neighbours.push(empty);
                        if (x > 0) neighbours.push(grid[y][x-1]);
                        else neighbours.push(empty);
                        if (x < width - 1) neighbours.push(grid[y][x+1]);
                        else neighbours.push(empty);

                        if (neighbours.some(c => c == empty)) return walls;
                        return cell;
                    });
                });
            },
            cond: (width, height) => width >= 4 && height >= 4,
        },
        //! fix lines up/down (alternating)
        'triangle_east': { // ▷
            func: (grid, width, height, walls='#', floors='.', empty=' ') => {
                // Compute distance from axis
                let ratio = height / width / 2;

                grid = grid.map((row, y) => {
                    return row.map((_, x) => {
                        let y_max = Math.ceil(x * ratio);
                        if (y > width / 2) y = Math.ceil(Math.abs(height - y));
                        if (y < y_max) return empty;
                        if (y == y_max) return walls;
                        return floors;
                    });
                });

                return grid.map((row, y) => {
                    return row.map((cell, x) => {
                        if (cell != floors) return cell;

                        /** @type {string[]} */
                        let neighbours = [];
                        if (y > 0) neighbours.push(grid[y-1][x]);
                        else neighbours.push(empty);
                        if (y < height - 1) neighbours.push(grid[y+1][x]);
                        else neighbours.push(empty);
                        if (x > 0) neighbours.push(grid[y][x-1]);
                        else neighbours.push(empty);
                        if (x < width - 1) neighbours.push(grid[y][x+1]);
                        else neighbours.push(empty);

                        if (neighbours.some(c => c == empty)) return walls;
                        return cell;
                    });
                });
            },
            cond: (width, height) => width >= 4 && height >= 4,
        },
        //! fix lines up/down (alternating)
        'triangle_west': { // ◁
            func: (grid, width, height, walls='#', floors='.', empty=' ') => {
                // Compute distance from axis
                let ratio = height / width / 2;

                grid = grid.map((row, y) => {
                    return row.map((_, x) => {
                        let y_max = Math.ceil((width - x) * ratio);
                        if (y > width / 2) y = Math.ceil(Math.abs(height - y));
                        if (y < y_max) return empty;
                        if (y == y_max) return walls;
                        return floors;
                    });
                });

                return grid.map((row, y) => {
                    return row.map((cell, x) => {
                        if (cell != floors) return cell;

                        /** @type {string[]} */
                        let neighbours = [];
                        if (y > 0) neighbours.push(grid[y-1][x]);
                        else neighbours.push(empty);
                        if (y < height - 1) neighbours.push(grid[y+1][x]);
                        else neighbours.push(empty);
                        if (x > 0) neighbours.push(grid[y][x-1]);
                        else neighbours.push(empty);
                        if (x < width - 1) neighbours.push(grid[y][x+1]);
                        else neighbours.push(empty);

                        if (neighbours.some(c => c == empty)) return walls;
                        return cell;
                    });
                });
            },
            cond: (width, height) => width >= 4 && height >= 4,
        },
    };
    static PATHS = {
        /**
         * As direct as possible
         *
         * @param {[number, number]} start
         * @param {[number, number]} end
         */
        'straight': (start, end) => {
            /** @type {[number, number][]} */
            let coords = [];
            let dist_x = start[0] - end[0];
            let dist_y = start[1] - end[1];
            let sign_x = Math.sign(dist_x);
            let sign_y = Math.sign(dist_y);
            let ratio = dist_y / dist_x;

            if (isNaN(ratio) || (!dist_x && !dist_y)) {
                coords.push(start);
            } else if (!isFinite(ratio)) {
                let x = start[0];
                let range = [
                    Math.min(start[1], end[1]) - 1,
                    Math.max(start[1], end[1]) + 1,
                ];
                for (let y = start[1] + sign_y; number_between(y, ...range); y -= sign_y) {
                    coords.push([x, y]);
                }
            } else if (Math.abs(ratio) <= 1) {
                let range = [
                    Math.min(start[0], end[0]) - 1,
                    Math.max(start[0], end[0]) + 1,
                ];
                for (let x = start[0] + sign_x; number_between(x, ...range); x -= sign_x) {
                    let y = Math.round((x - start[0]) * ratio) + start[1];
                    coords.push([x, y]);
                }
            } else {
                ratio **= -1;
                let range = [
                    Math.min(start[1], end[1]) - 1,
                    Math.max(start[1], end[1]) + 1,
                ];
                for (let y = start[1] + sign_y; number_between(y, ...range); y -= sign_y) {
                    let x = Math.round((y - start[1]) * ratio) + start[0];
                    coords.push([x, y]);
                }
            }

            return coords;
        },
        /**
         * Move horizontally first, then vertically
         *
         * @param {[number, number]} start
         * @param {[number, number]} end
         */
        'horizontal_vertical': (start, end) => {
            /** @type {[number, number][]} */
            let coords = [];
            let dist_x = start[0] - end[0];
            let dist_y = start[1] - end[1];
            let sign_x = Math.sign(dist_x);
            let sign_y = Math.sign(dist_y);

            if (sign_x) {
                let y = start[1];
                for (let x = start[0]; number_between(x, start[0], end[0]); x -= sign_x) {
                    coords.push([x, y]);
                }
            }
            if (sign_y) {
                let x = end[0];
                for (let y = start[1] - sign_y; number_between(y, start[1], end[1]); y -= sign_y) {
                    coords.push([x, y]);
                }
            }
            if (!sign_x && !sign_y) coords.push([...start]);

            return coords;
        },
        /**
         * Move vertically first, then horizontally
         *
         * @param {[number, number]} start
         * @param {[number, number]} end
         */
        'vertical_horizontal': (start, end) => {
            let dist_x = start[0] - end[0];
            let dist_y = start[1] - end[1];
            let sign_x = Math.sign(dist_x);
            let sign_y = Math.sign(dist_y);
            /** @type {[number, number][]} */
            let coords = [];

            if (sign_y) {
                for (let y = start[1]; number_between(y, start[1], end[1]); y -= sign_y) {
                    let x = end[0];
                    coords.push([x, y]);
                }
            }
            if (sign_x) {
                for (let x = start[0] - sign_x; number_between(x, start[0], end[0]); x -= sign_x) {
                    let y = start[1];
                    coords.push([x, y]);
                }
            }
            if (!sign_x && !sign_y) coords.push([...start]);

            return coords;
        },
    };
    static MAPS = {
        'simple': (room_amount=null, spawn_player=true) => {
            /** @type {Room<Tile>[]} */
            let rooms = [];
            if (spawn_player) {
                rooms.push(Room.make_spawn());
            }

            // Add rooms
            room_amount ??= Math.ceil(Random.range(3, 20));

            let all_coords = [[0, 0]];
            let dist = 3 * room_amount;
            for (let i = 0; i <= room_amount; i++) {
                // Allows making room nearer
                let coords = [...Random.array_element(all_coords)];
                coords[0] += Math.floor(Random.range(-dist, 1 + dist));
                coords[1] += Math.floor(Random.range(-dist, 1 + dist));
                all_coords.push(coords);
                rooms.push(Random.Room.room().to_tiles(...coords, false));
            }

            let map = Room.link({rooms});
            map.insert();

            // Spawn player
            if (spawn_player) {
                let target = Random.array_element(rooms[0].grid.filter(t => !t.solid));
                if (!target) target = Random.array_element(rooms[0].grid);
                let {x = 0, y = 0} = target;
                globals.player.x = x;
                globals.player.y = y;
            }

            return map;
        },
        'grid': (room_amount=null, spawn_player=true) => {
            /** @type {Room<Tile>[]} */
            let rooms = [];
            let room_width = Math.ceil(Random.range(5, 25));
            let room_height = Math.ceil(Random.range(5, 25));
            if (spawn_player) {
                rooms.push(Room.make_spawn(room_width, room_height));
            }

            // Add rooms
            room_amount ??= Math.ceil(Random.range(3, 20));
            let grid_width = Math.ceil(room_amount ** .5);
            let dist_x = Math.floor(Random.range(2, 3) * room_width);
            let dist_y = Math.floor(Random.range(2, 3) * room_height);
            let x_offset = Math.floor(Random.range(0, grid_width));
            let y = -Math.floor(Random.range(0, Math.ceil(room_amount / grid_width)));

            while (room_amount >= 0) {
                let top = y * dist_y;
                y++;

                for (let x = 0; x <= grid_width; x++) {
                    if (room_amount < 0) break;
                    let left = (x - x_offset) * dist_x;
                    if (spawn_player && !top && !left) continue;

                    rooms.push(Random.Room.room({width: room_width, height: room_height}).to_tiles(left, top, false));
                    room_amount--;
                }
            }

            let map = Room.link({rooms});
            map.insert();

            // Spawn player
            if (spawn_player) {
                let target = Random.array_element(rooms[0].grid.filter(t => !t.solid));
                if (!target) target = Random.array_element(map.grid.filter(t => !t.solid));
                let {x = 0, y = 0} = target;
                globals.player.x = x;
                globals.player.y = y;
            }

            return map;
        },
        'huge': (room_amount=null, spawn_player=true) => {
            /** @type {Room<Tile>[]} */
            let rooms = [];
            let width = Math.ceil(Random.range(10, 50));
            let height = Math.ceil(Random.range(10, 50));
            if (spawn_player) {
                rooms.push(Room.make_spawn(width, height));
            }

            // Add rooms
            room_amount ??= Math.ceil(Random.range(3, 20));

            let rx = rooms.map(r => r.grid.map(t => t.x)).flat();
            let ry = rooms.map(r => r.grid.map(t => t.y)).flat();
            let corners = {
                min_x: Math.min(...rx, 0),
                max_x: Math.max(...rx, 0),
                min_y: Math.min(...ry, 0),
                max_y: Math.min(...ry, 0),
            };
            let dist = 5 * room_amount; //? what if 10 tho
            for (let i = 0; i <= room_amount; i++) {
                let x = Math.floor(Random.range(corners.min_x - dist, corners.max_x + dist));
                let y = Math.floor(Random.range(corners.min_y - dist, corners.max_y + dist));
                let room = Random.Room.room({width, height}).to_tiles(x, y, false);
                rooms.push(room);

                let rx = room.grid.map(t => t.x);
                let ry = room.grid.map(t => t.y);
                corners.min_x = Math.min(corners.min_x, ...rx);
                corners.max_x = Math.max(corners.max_x, ...rx);
                corners.min_y = Math.min(corners.min_y, ...ry);
                corners.max_y = Math.max(corners.max_y, ...ry);
            }

            let map = Room.link({rooms});
            map.insert();

            // Spawn player
            if (spawn_player) {
                let target = Random.array_element(rooms[0].grid.filter(t => !t.solid));
                if (!target) target = Random.array_element(rooms[0].grid);
                let {x = 0, y = 0} = target;
                globals.player.x = x;
                globals.player.y = y;
            }

            return map;
        },
    };

    // Ascii stuff
    /**
     * Makes a room, in ascii format (takes less memory)
     *
     * @param {Object} params
     * @param {number} [params.height]
     * @param {number} [params.width]
     * @param {string} [params.shape]
     * @param {string} [params.walls]
     * @param {string} [params.floors]
     * @param {string} [params.empty]
     * @returns {Room<string[]>}
     */
    static make_ascii({height=10, width=10, shape='square', walls='#', floors='.', empty=' '}={}) {
        let grid = new Room({grid: this.make_grid(width, height)});

        grid.shape(shape, walls, floors, empty);

        return grid;
    };

    // Tiles stuff
    /**
     * Creates a spawn room
     *
     * @param {number} [width]
     * @param {number} [height]
     * @returns {Room<Tile>}
     */
    static make_spawn(width=20, height=20) {
        return Random.Room.room({width, height}).to_tiles(0, 0, false);
    };

    // Ascii & Tiles stuff
    /**
     * Merges multiple rooms into one, by overwriting walls with floors
     *
     * @param {...Room} rooms
     * @returns {Room<Tile>}
     */
    static merge(...rooms) {
        rooms.forEach(r => r.to_tiles(null, null, false));

        /** @type {Tile[]} */
        let master_grid = [];

        rooms.forEach(r => {
            /** @type {Tile[]} */
            let grid = r.grid;
            grid.forEach(tile => {
                let i = master_grid.findIndex(t => t.x == tile.x && t.y == tile.y);
                if (i == -1) {
                    master_grid.push(tile);
                } else {
                    let target = master_grid[i];
                    if (target.solid && !tile.solid) {
                        master_grid[i] = tile;
                    } else if (target.solid == tile.solid && Math.round(Math.random())) {
                        master_grid[i] = tile;
                    }
                }
            });
        });

        return new Room({grid: master_grid});
    }
    /**
     * Links multiple rooms with hallways
     *
     * @param {Object} params
     * @param {Room[]} params.rooms
     * @param {string} [params.walls]
     * @param {string} [params.floors]
     * @param {string[]} [params.hallways]
     * @returns {Room<Tile>}
     */
    static link({rooms, walls=null, floors=null, hallways=[]}) {
        rooms.forEach(r => r.to_tiles(null, null, false));
        let abs = Math.abs;

        /** @type {Room<Tile>[]} */
        let separate_rooms = [];

        for (let room of rooms) {
            let matching_rooms = separate_rooms.filter(r => {
                let r_floors = r.grid.filter(t => !t.solid);
                /** @type {Tile[]} */
                let room_floors = room.grid.filter(t => !t.solid);

                return room_floors.some(tile => {
                    let neighbours = [
                        r_floors.find(t => t.x == tile.x+1 && t.y == tile.y),
                        r_floors.find(t => t.x == tile.x-1 && t.y == tile.y),
                        r_floors.find(t => t.x == tile.x && t.y == tile.y+1),
                        r_floors.find(t => t.x == tile.x && t.y == tile.y-1),
                        r_floors.find(t => t.x == tile.x && t.y == tile.y),
                    ].filter(t => t !== undefined && t !== null);

                    return neighbours.length > 0;
                });
            });

            if (!matching_rooms.length) {
                separate_rooms.push(room);
            } else {
                let matching_indexes = matching_rooms.map(r => separate_rooms.indexOf(r));
                let index = Math.min(...matching_indexes);

                separate_rooms[index] = this.merge(room, ...matching_rooms);
                matching_indexes.sort((a,b) => b-a).forEach(i => {
                    if (i != index) separate_rooms.splice(i, 1);
                });
            }
        }

        /** @type {number[]} */
        let centers = separate_rooms.map(room => {
            let gsx = [...room.grid].sort((a,b) => a.x-b.x);
            let gsy = [...room.grid].sort((a,b) => a.y-b.y);
            let min_x = gsx[0].x;
            let max_x = gsx.pop().x;
            let min_y = gsy[0].y;
            let max_y = gsy.pop().y;
            return [(min_x + max_x) / 2, (min_y + max_y) / 2];
        });
        /** @type {[number, number][]} */
        let links = separate_rooms.map((_, index) => {
            /**
             * Selected room indexes
             */
            let rooms = {
                'up': -1,
                'down': -1,
                'left': -1,
                'right': -1,
                'up_left': -1,
                'up_right': -1,
                'down_left': -1,
                'down_right': -1,
            };
            let center = centers[index];

            /**
             * Distance between this room and the room at `index`
             *
             * @type {{[k:number]: number}}
             */
            let room_dists = {};
            separate_rooms.forEach((_, i) => {
                if (i == index) return;

                let rcenter = centers[i];

                room_dists[i] = coords_distance(center, rcenter);

                let dist_x = center[0] - rcenter[0];
                let dist_y = center[1] - rcenter[1];
                if (!dist_x && !dist_y) return; // Same center, ignore it

                /** @type {'up'|'down'|'left'|'right'|'up_left'|'up_right'|'down_left'|'down_right'} */
                let target;
                if (abs(dist_x) * 3 < abs(dist_y)) {
                    target = dist_y > 0 ? 'up' : 'down';
                } else if (abs(dist_y) * 3 < abs(dist_x)) {
                    target = dist_x > 0 ? 'left' : 'right';
                } else {
                    let dir = Direction.fromDir([dist_x, dist_y]);
                    if (dir[0] == dir[1]) {
                        target = dir[0] < 0 ? 'down_left' : 'up_right';
                    } else {
                        target = dir[0] < 0 ? 'up_left' : 'down_right';
                    }
                }

                let ind = rooms[target];
                if ((room_dists[ind] ?? Infinity) > room_dists[i]) {
                    rooms[target] = i;
                }
            });

            let rindexes = Object.values(rooms).filter(n => n != -1);
            let connections = 1 + Math.floor(Random.range(0, Math.min(rindexes.length, 3)));
            return Random.array_shuffle(rindexes).map(i => [i, index].sort((a,b)=>a-b)).splice(0, connections);
        }).flat();
        // Remove duplicates
        links = links.filter((link, index) => {
            let i = links.findIndex(l => l[0] == link[0] && l[1] == link[1]);
            return [index, -1].includes(i);
        });
        // Connect rooms
        links.forEach((link, i) => {
            // Get only walls to connect
            let [index_from, index_to] = link;
            let room_from = separate_rooms[index_from].grid.filter(function(tile) {
                if (!tile.solid) return false;

                /** @type {Tile[]} */
                let neighbours = [
                    this.find(t => t.y == tile.y+1 && t.x == tile.x),
                    this.find(t => t.y == tile.y-1 && t.x == tile.x),
                    this.find(t => t.y == tile.y && t.x == tile.x+1),
                    this.find(t => t.y == tile.y && t.x == tile.x-1),
                ].filter(t => t !== undefined && t !== null);

                // There's no neighbour
                if (!neighbours.length) return true;
                // One of the neighbours is a floor
                return neighbours.some(t => !t.solid);
            }, separate_rooms[index_from].grid);
            let room_to = separate_rooms[index_to].grid.filter(function(tile) {
                if (!tile.solid) return false;

                /** @type {Tile[]} */
                let neighbours = [
                    this.find(t => t.y == tile.y+1 && t.x == tile.x),
                    this.find(t => t.y == tile.y-1 && t.x == tile.x),
                    this.find(t => t.y == tile.y && t.x == tile.x+1),
                    this.find(t => t.y == tile.y && t.x == tile.x-1),
                ].filter(t => t !== undefined && t !== null);

                // There's no neighbour
                if (!neighbours.length) return true;
                // One of the neighbours is a floor
                return neighbours.some(t => !t.solid);
            }, separate_rooms[index_to].grid);
            // If there's no wall, all tiles are valid
            if (!room_from.length) room_from = separate_rooms[index_from].grid;
            if (!room_to.length) room_to = separate_rooms[index_to].grid;

            // Determine walls to connect
            /** @type {[Tile,Tile]} */
            let nearests = [Random.array_element(room_from), Random.array_element(room_to)];
            let dist = Math.hypot(Math.abs(nearests[0].x - nearests[1].x), Math.abs(nearests[0].y - nearests[1].y));
            room_from.forEach(t => {
                let d = Math.hypot(Math.abs(t.x - nearests[1].x), Math.abs(t.y - nearests[1].y));
                if (d < dist) {
                    dist = d;
                    nearests[0] = t;
                }
            });
            room_to.forEach(t => {
                let d = Math.hypot(Math.abs(t.x - nearests[0].x), Math.abs(t.y - nearests[0].y));
                if (d < dist) {
                    dist = d;
                    nearests[1] = t;
                }
            });

            // Prepare to make hallway
            let [tile_from, tile_to] = nearests.sort((a,b) => a.x != b.x ? a.x - b.x : a.y - b.y);
            let start = [tile_from.x, tile_from.y];
            let end = [tile_to.x, tile_to.y];

            /** @type {(start: [number, number], end: [number, number]) => [number, number][]} */
            let path;
            if (i in hallways && hallways[i] in this.PATHS) {
                path = this.PATHS[hallways[i]];
            } else {
                path = Random.Room.path();
            }
            let coords = path(start, end);
            let hall_floors = floors ?? ascii_colors[Random.array_element(ascii_symbols.nonsolids)];
            let hallway_radius = Math.ceil(Random.range(1, 2));
            /** @type {Tile[]} */
            let grid = [];

            // Make the hallway, screw anything in the way
            coords.forEach(([x, y]) => {
                grid.push(...surrounding_square(x, y, hallway_radius)
                    .filter(c => !grid.some(t => t.x == c[0] && t.y == c[1]))
                    .map(([x, y]) => new Tile({x, y, z:0, content: hall_floors, insert: false})));
            });

            // Convert edges into walls
            let hall_walls = walls ?? ascii_colors[Random.array_element(ascii_symbols.solids)];
            grid.forEach(/**@this {Tile[]}*/function(tile) {
                /** @type {Tile?[]} */
                let neighbours = [
                    this.find(t => t.x == tile.x-1 && t.y == tile.y),
                    this.find(t => t.x == tile.x+1 && t.y == tile.y),
                    this.find(t => t.x == tile.x && t.y == tile.y-1),
                    this.find(t => t.x == tile.x && t.y == tile.y+1),
                ];

                if (neighbours.some(t => typeof t == 'undefined')) {
                    tile.solid = true;
                    tile.content = hall_walls;
                }
            }, grid);

            if (grid.length == 0) {
                let mode;
                for (let [id, func] of Object.entries(this.PATHS)) {
                    if (func == path) {
                        mode = id;
                        break;
                    }
                }
                console.error(`Could not link rooms ${index_from} and ${index_to}. `+
                `From (x: ${tile_from.x}, y: ${tile_from.y}), to (x: ${tile_to.x}, y: ${tile_to.y}). `+
                `Mode: ${mode}`);
            }

            let hallway = new Room({grid});

            separate_rooms.push(hallway);
        });

        return this.merge(...separate_rooms);
    }
    /**
     * Makes an empty grid
     *
     * @param {number} width
     * @param {number} height
     * @returns {string[][]}
     */
    static make_grid(width, height) {
        return new Array(height).fill(0).map(_ => new Array(width).fill(' '));
    }

    // Map stuff
    /**
     * Creates a map
     *
     * @param {number} [room_amount]
     * @param {boolean} [spawn_player]
     */
    static make_map(room_amount=null, spawn_player=true) {
        let map = Random.Room.map()(room_amount, spawn_player);

        // Spawn items
        let map_floors = map.grid.filter(t => !t.solid);
        if (!map_floors.length) map_floors = map.grid;
        Item.get_random_items().forEach(id => {
            let target = Random.array_element(map_floors);
            let {x, y} = target;
            Item.get_item(id, {x, y, z: 1}).insert();
        });

        // Spawn entities
        let count = Math.floor(Random.range(1, 10));
        for (let i = 0; i < count; i++) {
            let target = Random.array_element(map_floors);
            let {x, y} = target;
            let pathfinding = Random.AutonomousEntity.pathfinding();
            let targeting = Random.AutonomousEntity.targeting();
            new AutonomousEntity({x, y, z: 9, content: Random.emoji_person(), pathfinding, targeting});
        }
    }

    /**
     * @param {Object} params
     * @param {T[]} params.grid Mandatory to determine the size of the room
     * @param {number} [params.offset_x=0]
     * @param {number} [params.offset_y=0]
     */
    constructor({grid, offset_x=0, offset_y=0}) {
        if (!Array.isArray(grid)) throw new TypeError(`Invalid room grid: ${grid.toString()}`);
        if (grid.some(t => !(t instanceof Tile) && !Array.isArray(t))) throw new TypeError(`Invalid room grid: ${grid.toString()}`);
        if ([...new Set(grid.map(t => t instanceof Tile ? 'tile' : 'array'))].length > 1) throw new TypeError(`Invalid room grid: ${grid.toString()}`);
        if (typeof offset_x != 'number') throw new TypeError(`Invalid room x offset: ${offset_x}`);
        if (typeof offset_y != 'number') throw new TypeError(`Invalid room y offset: ${offset_y}`);

        this.grid = grid;
        this.offset_x = offset_x;
        this.offset_y = offset_y;
    }

    get width() {
        if (this.grid.every(t => t instanceof Tile)) {
            /** @type {Tile[]} */
            let grid = this.grid;
            let xs = grid.map(t => t.x);
            return Math.max(...xs) - Math.min(...xs);
        } else {
            /** @type {string[][]} */
            let grid = this.grid;
            return Math.max(...grid.map(r => r.length));
        }
    }
    get height() {
        if (this.grid.every(t => t instanceof Tile)) {
            /** @type {Tile[]} */
            let grid = this.grid;
            let ys = grid.map(t => t.y);
            return Math.max(...ys) - Math.min(...ys);
        } else {
            /** @type {string[][]} */
            let grid = this.grid;
            return grid.length;
        }
    }

    /**
     * Regenerates the room with a different shape
     *
     * @param {string} [shape]
     * @param {string} [walls]
     * @param {string} [floors]
     * @param {string} [empty]
     * @this {Room<string[]>}
     */
    shape(shape='square', walls='#', floors='.', empty=' ') {
        let width = this.width;
        let height = this.height;

        if (Room.SHAPES[shape]?.cond(width, height)) {
            this.grid = Room.SHAPES[shape].func(Room.make_grid(width, height), width, height, walls, floors, empty);
        }

        return this;
    }
    /**
     * Converts the strings to tiles
     *
     * @param {number} [offset_x] Overrides `this.offset_x`
     * @param {number} [offset_y] Overrides `this.offset_y`
     * @param {boolean} [insert] Whether the new tile is inserted
     * @this {Room<Tile>}
     */
    to_tiles(offset_x, offset_y, insert=true) {
        if (this.grid.every(t => t instanceof Tile)) return;

        offset_x ??= this.offset_x;
        offset_y ??= this.offset_y;

        /** @type {Tile[]} */
        let tiles = [];

        this.grid.forEach((row, y) => {
            if (row instanceof Tile) {
                tiles.push(row);
            } else {
                y += offset_y;
                row.forEach((cell, x) => {
                    // Invalid cell, ignore
                    if (!Object.values(ascii_symbols).flat().includes(cell)) return;

                    /** @type {string} */
                    let solid = ascii_symbols.solids.includes(cell);
                    let content = ascii_colors[cell];
                    x += offset_x;

                    let tile = new Tile({x, y, z:0, content, solid, insert});
                    tiles.push(tile);
                });
            }
        });

        this.grid = tiles;

        return this;
    }
    /**
     * Inserts the room's tiles in the grid
     *
     * @this {Room<Tile>}
     */
    insert() {
        this.to_tiles();

        this.grid.filter(t => t instanceof Tile).forEach(/**@param {Tile} t*/t => t.insert());

        return this;
    }
}
