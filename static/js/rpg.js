if (typeof gettext != 'function') {
    /**
     * @param {string} text Variables are inserted with `%(<name>)s`
     * @param {{[k: string]: string|number}} variables
     * @returns {string}
     */
    function gettext(text, variables) {}
}
if (typeof ngettext != 'function') {
    /**
     * @param {string} text Variables are inserted with `%(<name>)s`
     * @param {string} text_plural Variables are inserted with `%(<name>)s`
     * @param {number} n
     * @param {{[k: string]: string|number}} variables
     * @returns {string}
     */
    function ngettext(text, text_plural, n, variables) {}
}

//(() => {
    /**
     * Canvas of the game
     *
     * @type {HTMLCanvasElement}
     */
    const CANVAS = document.getElementById('blockus_game');
    /**
     * For drawing on the canvas
     *
     * @type {CanvasRenderingContext2D}
     */
    const CONTEXT = CANVAS.getContext('2d');
    /**
     * Available themes
     *
     * Structure: theme_id => {name => theme name, css key => css value}
     *
     * @type {{[k: string]: {
     *  name: string,
     *  [k: string]: string,
     * },}}
     */
    const THEMES = {
        'dark': {
            name: gettext('games_rpg_themes_dark'),
        },
        'light': {
            name: gettext('games_rpg_themes_light'),
        },
    };
    /**
     * Tile size in [width, height]
     *
     * @type {[number, number]}
     */
    const TILE_SIZE = [20, 20];
    /**
     * Amount of tiles displayed, as [width, height]
     *
     * @type {[number, number]}
     */
    const DISPLAY_SIZE = [30, 30];
    /**
     * Unit types for beautify
     *
     * @type {string[]}
     */
    const UNITS = ['', 'k', 'M', 'G', 'T', 'P', 'E', 'Z', 'Y'];
    /**
     * Enum of directions, as [x, y]
     *
     * Includes various tools for direction calculating, which return DIRECTION when possible
     *
     * @enum {readonly [number, number]}
     * @type {{
     *  right: readonly [number, number],
     *  up: readonly [number, number],
     *  left: readonly [number, number],
     *  down: readonly [number, number],
     *  fromDir: ([r, d]: [number, number]) => readonly [number, number],
     *  opposite: ([r, d]: [number, number]) => readonly [number, number],
     *  perpendicular: ([r, d]: [number, number]) => (readonly [number, number])[],
     * }}
     */
    const DIRECTION = Object.freeze({
        'right': Object.freeze([1, 0]),
        'up': Object.freeze([0, -1]),
        'left': Object.freeze([-1, 0]),
        'down': Object.freeze([0, 1]),

        /** @type {([r,d]: [number, number]) => readonly [number, number]} */
        fromDir([r, d]) {
            let res = [Math.sign(r), Math.sign(d)];
            return Object.freeze(this.to_dir(res));
        },
        /** @type {([r,d]: [number, number]) => readonly [number, number]} */
        opposite([r, d]) {
            let opposite = [Math.sign(r) * -1, Math.sign(d) * -1];
            return Object.freeze(opposite);
        },
        /** @type {([r,d]: [number, number]) => (readonly [number, number])[]} [clockwise, counterclockwise] from [0, 0] */
        perpendicular([r, d]) {
            let clockwise = Object.freeze([d * -1, r]);
            let counterclockwise = Object.freeze([d, r * -1]);

            return [clockwise, counterclockwise].map(this.to_dir);
        },
        /** @type {([r, d]: [number, number]) => DIRECTION} */
        to_dir([r, d]) {
            for (let id of ['right', 'up', 'left', 'down']) {
                /** @type {DIRECTION} */
                let dir = DIRECTION[id];

                if (r == dir[0] && d == dir[1]) return dir;
            }
            return [r,d];
        },
    });
    /**
     * Game keybinds
     *
     * Effects are obtained with `KEYBINDS[<game_state>|others][mapped_key]`.
     * `mapped_key` is the lowercased key, with alt, ctrl and/or shift prepended if they are pressed.
     * Checks are done in an alphabetical order, so alt+key takes priority over ctrl+key.
     * Longer composites take precedence over shorter ones, so alt+ctrl+key > alt+key.
     * Composite building is also done in an alphabetical way, so alt+ctrl+key is correct, unlike ctrl+alt+key.
     *
     * - Actions are in-game actions (movement, attack, etc.)
     * - Others are other actions (pause, resume, inventory, etc.)
     *
     * @type {{
     *  playing?: {[k: string]: string[]},
     *  pause?: {[k: string]: string[]},
     *  inventory?: {[k: string]: string[]},
     *  status?: {[k: string]: string[]},
     *  others: {[k: string]: string[]},
     * }}
     */
    const KEYBINDS = {
        playing: {
            'a': ['move_player_left'],
            'd': ['move_player_right'],
            's': ['move_player_down'],
            'w': ['move_player_up'],
            'arrowleft': ['move_player_left'],
            'arrowright': ['move_player_right'],
            'arrowdown': ['move_player_down'],
            'arrowup': ['move_player_up'],
            'i': ['show_inventory'],
            'o': ['show_status'],
        },
        inventory: {
            'a': ['move_cursor_inventory_left'],
            'd': ['move_cursor_inventory_right'],
            's': ['move_cursor_inventory_down'],
            'w': ['move_cursor_inventory_up'],
            'arrowleft': ['move_cursor_inventory_left'],
            'arrowright': ['move_cursor_inventory_right'],
            'arrowdown': ['move_cursor_inventory_down'],
            'arrowup': ['move_cursor_inventory_up'],
            ' ': ['use_inventory_selected'],
            'q': ['drop_inventory_selected'],
            'i': ['hide_inventory'],
            'e': ['toggle_equip_inventory_selected'],
        },
        status: {
            'o': ['hide_status'],
        },
        others: {
            'p': ['game_pause_toggle'],
        },
    };
    /**
     * @type {{[k: string]: {
     *  name: string,
     *  func: () => void,
     * }}}
     */
    const ACTIONS = new Proxy(Object.freeze({
        'move_player_left': {
            name: gettext('games_rpg_action_move_player_left'),
            func: () => {
                player.move(DIRECTION.left, 1/10);
            },
        },
        'move_player_right': {
            name: gettext('games_rpg_action_move_player_right'),
            func: () => {
                player.move(DIRECTION.right, 1/10);
            },
        },
        'move_player_down': {
            name: gettext('games_rpg_action_move_player_down'),
            func: () => {
                player.move(DIRECTION.down, 1/10);
            },
        },
        'move_player_up': {
            name: gettext('games_rpg_action_move_player_up'),
            func: () => {
                player.move(DIRECTION.up, 1/10);
            },
        },
        'move_cursor_inventory_left': {
            name: gettext('games_rpg_action_move_cursor_inventory_left'),
            func: () => {
                let items_per_row = inventory_items_per_row();
                let index = cursors.inventory[1] * items_per_row + cursors.inventory[0];
                if (cursors.inventory[0] == items_per_row) {
                    // We're in the equipment section, so we reach for the nearest item
                    // Cursor is outside the inventory rows, reduce it by 1
                    index--;
                    let position = Math.max(0, player.inventory.length - 1);
                    let prevs = Object.keys(player.equipment).sort((a,b) => b-a)
                        .filter(n => n < cursors.inventory[1] && n >= Math.floor(position / items_per_row));

                    if (player.inventory.length - 1 <= index) {
                        if (prevs.length) {
                            cursors.inventory[1] = +prevs[0];
                        } else {
                            cursors.inventory[0] = position % items_per_row;
                            cursors.inventory[1] = Math.floor(position / items_per_row);
                        }
                    } else {
                        cursors.inventory[0] = index % items_per_row;
                        cursors.inventory[1] = Math.floor(index / items_per_row);
                    }
                } else {
                    if (index - 1 < 0) return;

                    cursors.inventory[0] += DIRECTION.left[0];
                    cursors.inventory[1] += DIRECTION.left[1];

                    if (cursors.inventory[0] < 0) {
                        if (cursors.inventory[1] > 0) {
                            cursors.inventory[1]--;
                            if (cursors.inventory[1] in player.equipment) cursors.inventory[0] = items_per_row;
                            else cursors.inventory[0] = (index - 1) % items_per_row;
                        } else {
                            cursors.inventory[1] = 0;
                        }
                    }
                }
            },
        },
        'move_cursor_inventory_right': {
            name: gettext('games_rpg_action_move_cursor_inventory_right'),
            func: () => {
                let items_per_row = inventory_items_per_row();
                let index = cursors.inventory[1] * items_per_row + cursors.inventory[0];
                if (cursors.inventory[0] == items_per_row) {
                    // We're in the equipment section, so we reach for the nearest item
                    index--;
                    let nexts = Object.keys(player.equipment).sort((a,b) => a-b).filter(n => n > cursors.inventory[1]);

                    if (player.inventory.length - 1 <= index) {
                        if (nexts.length) {
                            cursors.inventory[1] = +nexts[0];
                        }
                    } else {
                        cursors.inventory[0] = 0;
                        cursors.inventory[1]++;
                    }
                } else {
                    cursors.inventory[0] += DIRECTION.right[0];
                    cursors.inventory[1] += DIRECTION.right[1];

                    let out_index = index + 1 >= player.inventory.length;
                    let out_row = cursors.inventory[0] == items_per_row && !(cursors.inventory[1] in player.equipment);
                    out_row ||= cursors.inventory[0] > items_per_row;

                    if (out_row && out_index) {
                        // We're beyond the inventory and not in the equipment
                        cursors.inventory[0] -= DIRECTION.right[0];
                        cursors.inventory[1] -= DIRECTION.right[1];
                    } else if (out_row) {
                        // We're not in the equipment, we can still get in the inventory
                        cursors.inventory[0] = 0;
                        cursors.inventory[1]++;
                    } else if (out_index) {
                        // We're beyond the inventory, let's get to the next equipment slot
                        let nexts = Object.keys(player.equipment).sort((a,b) => a-b).filter(n => n >= cursors.inventory[1]);
                        if (!nexts.length) {
                            // We're beyond the equipment too, undo
                            cursors.inventory[0] -= DIRECTION.right[0];
                            cursors.inventory[1] -= DIRECTION.right[1];
                        } else {
                            // Get to the next equipment slot, somewhere below
                            cursors.inventory[0] = items_per_row;
                            cursors.inventory[1] = +nexts[0];
                        }
                    }
                }
            },
        },
        'move_cursor_inventory_down': {
            name: gettext('games_rpg_action_move_cursor_inventory_down'),
            func: () => {
                let items_per_row = inventory_items_per_row();
                if (cursors.inventory[0] == items_per_row) {
                    // We're in the equipment section, should be easy, right?
                    let nexts = Object.keys(player.equipment).sort((a,b) => a-b).filter(n => n > cursors.inventory[1]);
                    if (nexts.length) {
                        cursors.inventory[1] = +nexts[0];
                    }
                } else {
                    let index = cursors.inventory[1] * items_per_row + cursors.inventory[0];
                    if (index + items_per_row >= player.inventory.length) return;

                    cursors.inventory[1]++;
                }
            },
        },
        'move_cursor_inventory_up': {
            name: gettext('games_rpg_action_move_cursor_inventory_up'),
            func: () => {
                let items_per_row = inventory_items_per_row();
                if (cursors.inventory[1] <= 0) return;

                if (cursors.inventory[0] == items_per_row) {
                    let prevs = Object.keys(player.equipment).sort((a,b) => b-a).filter(n => n < cursors.inventory[1]);

                    if (prevs.length) {
                        cursors.inventory[1] = +prevs[0];
                    }
                } else {
                    let dir = DIRECTION.up;
                    cursors.inventory[0] += dir[0];
                    cursors.inventory[1] += dir[1];
                }
            },
        },
        'move_cursor_status_down': {
            name: gettext('games_rpg_action_move_cursor_status_down'),
            func: () => {
                let rows = 4; // health, speed, range, inventory
                if (debug_status) rows += 4; //x, y, z, solid
                if (player.name) rows++;
                rows += Object.keys(player.defense).length;
                rows += Object.keys(player.damage).length;
                if (rows + 4 <= DISPLAY_SIZE[1]) return;

                let dir = DIRECTION.down;
                cursors.status[0] += dir[0];
                cursors.status[1] += dir[1];
            },
        },
        'move_cursor_status_up': {
            name: gettext('games_rpg_action_move_cursor_status_up'),
            func: () => {
                if (cursors.status[1] <= 0) return;

                let dir = DIRECTION.up;
                cursors.status[0] += dir[0];
                cursors.status[1] += dir[1];
            },
        },
        'use_inventory_selected': {
            name: gettext('games_rpg_action_use_inventory_selected'),
            func: () => {
                let items_per_row = inventory_items_per_row();
                if (cursors.inventory[0] < items_per_row) {
                    let index = cursors.inventory[1] * items_per_row + cursors.inventory[0];
                    player.use_item(index);
                } // You can't use an equipped item!
            },
        },
        'drop_inventory_selected': {
            name: gettext('games_rpg_action_drop_inventory_selected'),
            func: () => {
                let items_per_row = inventory_items_per_row();
                let index;
                let equip = cursors.inventory[0] >= items_per_row;
                if (!equip) {
                    index = cursors.inventory[1] * items_per_row + cursors.inventory[0];
                } else {
                    index = cursors.inventory[1];
                }

                player.drop_item(index, equip);
            },
        },
        'toggle_equip_inventory_selected': {
            name: gettext('games_rpg_action_toggle_equip_inventory_selected'),
            func: () => {
                let items_per_row = inventory_items_per_row();
                if (cursors.inventory[0] == items_per_row) {
                    player.unequip_item(cursors.inventory[1]);
                } else {
                    let index = cursors.inventory[1] * items_per_row + cursors.inventory[0];
                    player.equip_item(index);
                }
            },
        },
        'game_pause': {
            name: gettext('games_rpg_action_game_pause'),
            func: () => {
                game_state = 'pause';
            },
        },
        'game_resume': {
            name: gettext('games_rpg_action_game_resume'),
            func: () => {
                game_state = 'playing';
            },
        },
        'game_pause_toggle': {
            name: gettext('games_rpg_action_game_pause_toggle'),
            func: () => {
                game_state = game_state == 'playing' ? 'pause' : 'playing';
            },
        },
        'show_inventory': {
            name: gettext('games_rpg_action_show_inventory'),
            func: () => {
                game_state = 'inventory';
                cursors.inventory[0] = 0;
                cursors.inventory[1] = 0;
            },
        },
        'hide_inventory': {
            name: gettext('games_rpg_action_hide_inventory'),
            func: () => {
                game_state = 'playing';
            },
        },
        'show_status': {
            name: gettext('games_rpg_action_show_status'),
            func: () => {
                game_state = 'status';
                cursors.status[0] = 0;
                cursors.status[1] = 0;
            },
        },
        'hide_status': {
            name: gettext('games_rpg_action_hide_status'),
            func: () => {
                game_state = 'playing';
            },
        },
    }),{
        get: (obj, prop) => obj[prop] ?? {name: '', func: () => {}},
        set: (obj, prop, val) => {},
    });
    /**
     * ASCII symbols for ascii displays.
     *
     * @type {{
     *  solids: string[],
     *  nonsolids: string[],
     * }}
     */
    const ASCII_SYMBOLS = {
        solids: ['#', '■', '▮', '▬', '●', '◆', '◉', '1'],
        nonsolids: ['.', '□', '▯', '▭', '○', '◇', '◎', '0'],
    };
    /**
     * ASCII to tile content map
     *
     * @type {{[k: string]: string|Color|CanvasImageSource|((this: Entity) => void)}}
     */
    const ASCII_COLORS = {
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
     * Existing damage/defense types
     *
     * @type {{[k: string]: string}}
     */
    const TYPES = {
        'none': gettext('games_rpg_type_none'),
    };
    /**
     * Existing entity attributes
     *
     * @type {{[k: string]: string}}
     */
    const ATTRIBUTES = {
        'health': gettext('games_rpg_status_health'),
        'health_max': gettext('games_rpg_status_health_max'),
        'speed': gettext('games_rpg_status_speed'),
        'range': gettext('games_rpg_status_range'),
        'inventory': gettext('games_rpg_status_inventory'),
        'defense': gettext('games_rpg_status_defense', {type: '%(type)s'}),
        'damage': gettext('games_rpg_status_damage', {type: '%(type)s'}),
    };
    /**
     * Existing entity equipment slots
     *
     * @type {{[k: number]: {
     *  name: string,
     *  image?: CanvasImageSource,
     * }}}
     */
    const EQUIP_SLOTS = {
        0: {
            name: gettext('games_rpg_slot_head'),
            image: null,
        },
        1: {
            name: gettext('games_rpg_slot_face'),
            image: null,
        },
        2: {
            name: gettext('games_rpg_slot_neck'),
            image: null,
        },
        3: {
            name: gettext('games_rpg_slot_chest'),
            image: null,
        },
        4: {
            name: gettext('games_rpg_slot_arm'),
            image: null,
        },
        5: {
            name: gettext('games_rpg_slot_hand'),
            image: null,
        },
        6: {
            name: gettext('games_rpg_slot_leg'),
            image: null,
        },
        7: {
            name: gettext('games_rpg_slot_foot'),
            image: null,
        },
    };
    /**
     * List of functions for targeting
     *
     * @type {{[k: string]: (this: AutonomousEntity) => Tile|null}}
     */
    const TARGETINGS = {
        'null': () => null,
        'roaming': function() {
            return Random.array_element(Tile.grid.filter(t => !t.solid && t != this && (!(t instanceof Item) || t.owner != this)));
        },
        'player': function() {
            return player;
        },
        'item': function() {
            /** @type {Item[]} */
            let items = Tile.grid.filter(t => t instanceof Item && !t.owner);
            if (!items.length) {
                items = Entity.entities.filter(t => t != this).map(t => t.inventory[0]).flat();
            }
            return Random.array_element(items);
        },
        'entity': function() {
            return Random.array_element(Entity.entities);
        },
    };
    /**
     * List of functions for pathfinding
     *
     * @type {{[k: string]: (this: AutonomousEntity) => DIRECTION|null}}
     */
    const PATHFINDINGS = {
        'null': () => null,
        /** @this {AutonomousEntity} */
        'direct': function() {
            if (!this.target) return null;

            let {x, y} = this.target;

            let dist_x = x - this.x;
            let dist_y = y - this.y;

            if (!dist_x && !dist_y) return null;

            // Get the space to move around before moving
            let left = dist_x < 0;
            let right = dist_x > 0;
            let up = dist_y < 0;
            let down = dist_y > 0;

            let space = this.get_cardinal_space({left, right, up, down});

            let can_horizontal = false;
            let can_vertical = false;
            let dir_horizontal = null;
            let dir_vertical = null;

            if (Math.sign(dist_x) == 1) {
                can_horizontal = space['1'][0] > 0;
                dir_horizontal = DIRECTION.right;
            } else if (Math.sign(dist_x) == -1) {
                can_horizontal = space['-1'][0] > 0;
                dir_horizontal = DIRECTION.left;
            }
            if (Math.sign(dist_y) == 1) {
                can_vertical = space['1'][1] > 0;
                dir_vertical = DIRECTION.down;
            } else if (Math.sign(dist_y) == -1) {
                can_vertical = space['-1'][1] > 0;
                dir_vertical = DIRECTION.up;
            }

            // Move on the side, or up/down, or on the side/never
            if (Math.abs(dist_x) >= Math.abs(dist_y) && can_horizontal) {
                return dir_horizontal;
            } else if (Math.abs(dist_y) > 0 && can_vertical) {
                return dir_vertical;
            } else {
                return dir_horizontal;
            }
        },
        /** @this {AutonomousEntity} */
        'smart': function() {
            if (!this.target) return null;

            /** Direct reference to `this.path` */
            let path = this.path;
            let round = Math.round;

            /** @type {[number, number]} */
            let position = [round(this.x), round(this.y)];
            /** @type {[number, number]} */
            let target = [round(this.target.x), round(this.target.y)];
            /** @param {[number, number]} coords */
            let is_target = coords => coords_distance(coords, target) < .1;

            // We're already there
            if (is_target([this.x, this.y])) return null;

            // Check if the path leads to the target
            if (path && path.length) {
                let end = path[path.length - 1];

                if (coords_distance(end, target) > 10) {
                    this.path = path = null;
                }
            }

            // Try to compute towards the target
            if (!path || !path.length) {
                this.path = path = (new Path).find(position, target, [this, this.target]);
            }

            // Follow the path
            if (path && path.length) {
                let current = path[0];
                if (coords_distance(current, [this.x, this.y]) < .05) {
                    // We passed the first step
                    path.shift();
                    if (path.length) current = path[0];
                    else return null;
                }

                let dist_x = current[0] - this.x;
                let dist_y = current[1] - this.y;

                // Get the space to move around before moving
                let left = dist_x < 0;
                let right = dist_x > 0;
                let up = dist_y < 0;
                let down = dist_y > 0;

                let space = this.get_cardinal_space({left, right, up, down});

                let can_horizontal = false;
                let can_vertical = false;
                let dir_horizontal = null;
                let dir_vertical = null;

                if (Math.sign(dist_x) == 1) {
                    can_horizontal = space['1'][0] > 0;
                    dir_horizontal = DIRECTION.right;
                } else if (Math.sign(dist_x) == -1) {
                    can_horizontal = space['-1'][0] > 0;
                    dir_horizontal = DIRECTION.left;
                }
                if (Math.sign(dist_y) == 1) {
                    can_vertical = space['1'][1] > 0;
                    dir_vertical = DIRECTION.down;
                } else if (Math.sign(dist_y) == -1) {
                    can_vertical = space['-1'][1] > 0;
                    dir_vertical = DIRECTION.up;
                }

                // Move on the side, or up/down
                let dir = dir_horizontal;
                if (dist_y && Math.abs(dist_x) < Math.abs(dist_y) && can_vertical) {
                    dir = dir_vertical;
                }

                if (!can_horizontal && !can_vertical) {
                    this.path = null;
                }

                // If we're past the current step, we remove it
                /*if (dir && number_between(current[0], this.x, this.x + dir[0]) || number_between(current[1], this.y, this.y + dir[1])) {
                    path.shift();
                }*/

                return dir;
            }

            return null;
        },
        //todo? even smarter taking speed into account
    };
    /**
     * Random generators
     */
    const Random = Object.freeze({
        Room: {
            wall: () => Random.array_element(ASCII_SYMBOLS.solids),
            floor: () => Random.array_element(ASCII_SYMBOLS.nonsolids),
            /**
             * @param {number} width
             * @param {number} height
             */
            shape: (width, height) => Random.array_element(Object.entries(Room.SHAPES).filter(s => s[1].cond(width, height)).map(s => s[0])),
        },
        AutonomousEntity: {
            targeting: () => Random.array_element(Object.entries(TARGETINGS).filter(([id]) => id != 'null').map(a => a[1])),
            pathfinding: () => Random.array_element(Object.entries(PATHFINDINGS).filter(([id]) => id != 'null').map(a => a[1])),
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
         * @param {string} [params.shape]
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
        /**
         * Random number between min and max
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
        emoji_face: () => String.fromCharCode(55357, 56420 + Math.floor(Random.range(0, 36))),
    });

    /**
     * Current theme
     *
     * @type {string}
     */
    let theme = Object.keys(THEMES)[0];
    /**
     * Current game state
     *
     * @type {'playing'|'inventory'|'pause'|'status'}
     */
    let game_state = 'playing';
    /**
     * Player character
     *
     * @type {Entity}
     */
    let player;
    /**
     * Last time the loop was called
     *
     * @type {number}
     */
    let loop_last;
    /**
     * Whether the loop processing is active
     *
     * @type {boolean}
     */
    let loop_process = true;
    /**
     * Whether keybind checking is strict or not
     *
     * If strict, alt+ctrl+key will never trigger alt+key
     *
     * @type {boolean}
     */
    let strict_keys = true;
    /**
     * Currently selected items, as [x, y]
     *
     * @type {{
     *  inventory: [number, number],
     *  status: [number, number],
     * }}
     */
    let cursors = {
        inventory: [0, 0],
        status: [0, 0],
    };
    /**
     * Whether the status shows as much as possible or not
     */
    let debug_status = false;
    /**
     * Cache for checking whether a coordinate can be walked
     *
     * @type {{[k: string]: boolean}}
     */
    let can_walked = {};

    // Number functions
    /**
     * Makes a number look good
     *
     * @param {number} number
     * @param {boolean} trim If true, trailing 0s are removed
     * @param {number} min_short Minimum e/3 at which to shorten
     * @returns {string}
     */
    function beautify(number, trim = true, min_short = 2) {
        if (isNaN(number)) return '0';
        if (!isFinite(number)) return (number < 0 ? '-' : '+') + '∞';
        let num = String(BigInt(Math.floor(number)));
        let part = String(BigInt(Math.floor((Math.abs(number) * 1e3) % 1e3)));
        let e = 0;
        let end = '';

        if (num.length > 3 * min_short) {
            while (num.length > 3) {
                part = num.slice(-3);
                num = num.slice(0, -3);
                e++;
            }
        }

        if (e >= min_short) {
            end = UNITS[e] ?? `e${e * 3}`;
        }
        if (Number(part) || !trim) {
            while (part.length < 3) {
                part = `0${part}`;
            }
            part = `.${part}`;
            while (part.endsWith('0') && trim) {
                part = part.slice(0, -1);
            }
        } else {
            part = '';
        }

        return `${num}${part}${end}`.trimEnd();
    }
    /**
     * Calculates the average of multiple numbers
     *
     * @param {...number} numbers
     * @returns {number}
     */
    function average(...numbers) {
        return numbers.reduce((s, n) => s + n, 0) / numbers.length;
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
    function number_between(number, min, max) {
        if (isNaN(number) || isNaN(min) || isNaN(max)) return false;

        return (number - min) * (number - max) <= 0;
    }
    /**
     * Calculates the prime factors of a number
     *
     * @param {number} number
     * @returns {number[]}
     */
    function prime_factors(number) {
        /** @type {number[]} */
        let factors = [];
        let divisor = 2;

        while (number >= 2) {
            if (number % divisor == 0) {
                factors.push(divisor);
                number /= divisor;
            } else {
                divisor++;
            }
        }

        return factors;
    }

    // Array functions
    /**
     * Sums all arrays into a single one
     *
     * **Returns a different array**
     *
     * @param {...number[]} arrays
     * @returns {number[]}
     */
    function add_arrays(...arrays) {
        let sum = [];
        arrays.forEach(arr => {
            for (let i = 0; i < arr.length; i++) {
                if (!(i in arr)) continue;
                if (!(i in sum)) sum[i] = arr[i];
                else sum[i] += arr[i];
            }
        });
        return sum;
    }

    // Object functions
    /**
     * Checks if an object is an instance of any class given
     *
     * @param {any} obj
     * @param {...() => any} classes
     * @returns {boolean}
     */
    function isinstance(obj, ...classes) {
        for (let cls of classes) {
            if (obj instanceof cls) return true;
        }
        return false;
    }

    // Canvas function
    /**
     * Empties the canvas display
     */
    function canvas_reset() {
        let width = TILE_SIZE[0] * DISPLAY_SIZE[0];
        let height = TILE_SIZE[1] * DISPLAY_SIZE[1];

        if (CANVAS.width != width || CANVAS.height != height) {
            CANVAS.style.width = `${TILE_SIZE[0] * DISPLAY_SIZE[0]}px`;
            CANVAS.width = TILE_SIZE[0] * DISPLAY_SIZE[0];
            CANVAS.style.height = `${TILE_SIZE[1] * DISPLAY_SIZE[1]}px`;
            CANVAS.height = TILE_SIZE[1] * DISPLAY_SIZE[1];
        } else {
            let c = CONTEXT.fillStyle;
            CONTEXT.fillStyle = game_state == 'pause' ? '#000' : '#fff';
            CONTEXT.fillRect(0, 0, width, height);
            CONTEXT.fillStyle = c;
        }
    }
    /**
     * Refreshes the canvas contents
     */
    function canvas_refresh() {
        canvas_reset();

        switch (game_state) {
            case 'playing': case 'pause':
                show_game();
                break;
            case 'inventory':
                show_inventory(player);
                break;
            case 'status':
                show_status(player);
                break;
            default:
                console.error(`Unknown game state ${game_state}`);
                break;
        }

        show_player_mini_status();
    }
    /**
     * Shows the player mini status at the bottom right
     */
    function show_player_mini_status() {
        let width = Math.min(Math.max(Math.ceil(player.health_max / 10), 10), DISPLAY_SIZE[0]) * TILE_SIZE[0];
        let height = TILE_SIZE[1];
        let left = (DISPLAY_SIZE[0] * TILE_SIZE[0]) - width;
        let top = (DISPLAY_SIZE[1] * TILE_SIZE[1]) - height;

        let text_position = left + width / 2;
        let width_fill = Math.ceil(player.health / player.health_max * width) || 0;
        let width_empty = width - width_fill;

        CONTEXT.fillStyle = '#0f0';
        CONTEXT.fillRect(left, top, width_fill, height);
        CONTEXT.fillStyle = '#f00';
        CONTEXT.fillRect(left + width_fill, top, width_empty, height);
        CONTEXT.font = `${TILE_SIZE[1]}px monospace`;
        CONTEXT.fillStyle = '#000';
        CONTEXT.textAlign = 'center';
        CONTEXT.fillText(`${player.health}/${player.health_max}`, text_position, top + height * .8, width);
    }
    /**
     * Shows the grid, the player and the entities
     */
    function show_game() {
        Tile.visible_grid.sort((a, b) => {
            if (a == player) return 1;
            if (b == player) return -1;
            if (a.z != b.z) return a.z - b.z;
            if (b.y != a.y) return b.y - a.y;
            return b.x - a.x;
        }).forEach(t => t.draw());
    }
    /**
     * Shows the inventory of an entity
     *
     * @param {Entity} entity
     */
    function show_inventory(entity) {
        // Draw inventory background
        CONTEXT.fillStyle = '#ccc';
        CONTEXT.fillRect(0, 0, TILE_SIZE[0] * DISPLAY_SIZE[0], TILE_SIZE[1] * DISPLAY_SIZE[1]);
        let items_per_row = inventory_items_per_row();
        let item_rows = Math.max(Math.floor(DISPLAY_SIZE[1] / 3) - 1, 1);
        for (let y = 0; y < item_rows; y++) {
            for (let x = 0; x < items_per_row + 1; x++) {
                let offset_x = TILE_SIZE[0];
                let offset_y = TILE_SIZE[1];
                let x_start = x * 3 * TILE_SIZE[0] + offset_x;
                let y_start = y * 3 * TILE_SIZE[1] + offset_y;

                let color = '#000';
                if (x == items_per_row) {
                    color = '#a77';

                    if (y in entity.equipment) {
                        color = '#ff6';
                    }
                }

                CONTEXT.strokeStyle = color;
                CONTEXT.fillStyle = color;
                let func = x != items_per_row || y in entity.equipment ? 'strokeRect' : 'fillRect';
                CONTEXT[func](x_start, y_start, TILE_SIZE[0] * 2, TILE_SIZE[1] * 2);
                if (x == items_per_row && y in EQUIP_SLOTS && EQUIP_SLOTS[y].image) {
                    CONTEXT.drawImage(EQUIP_SLOTS[y].image, x_start, y_start, TILE_SIZE[0] * 2, TILE_SIZE[1] * 2);
                }
            }
        }
        // Draw items
        entity.inventory.forEach(([i,a]) => i.draw_inventory(a));
        Object.values(entity.equipment).forEach(i => {if (i) i.draw_inventory(1);});
        // Draw cursor
        let offset_x = TILE_SIZE[0];
        let offset_y = TILE_SIZE[1];
        let x_start = cursors.inventory[0] * 3 * TILE_SIZE[0] + offset_x;
        let y_start = cursors.inventory[1] * 3 * TILE_SIZE[1] + offset_y;
        CONTEXT.strokeStyle = '#0ff';
        CONTEXT.strokeRect(x_start, y_start, TILE_SIZE[0] * 2, TILE_SIZE[1] * 2);

        // Prepare tooltip
        let item = null;
        let amount = 1;
        if (cursors.inventory[0] == items_per_row && cursors.inventory[1] in entity.equipment) {
            item = entity.equipment[cursors.inventory[1]];
        } else if (cursors.inventory[0] < items_per_row) {
            let item_index = cursors.inventory[1] * items_per_row + cursors.inventory[0];
            if (item_index in entity.inventory) [item, amount] = entity.inventory[item_index];
        }
        if (item) {
            let lines = [
                gettext('games_rpg_status_name') + ': ' + (item.name || gettext('games_rpg_status_name_unnamed') + ` (${amount})`),
            ];
            if (item.description) lines.push(gettext('games_rpg_status_description') + ': ' + item.description);
            if (Object.keys(item.on_use).length) {
                lines.push('---', gettext('games_rpg_status_on_use'));
                Object.entries(item.on_use).forEach(([attr, change]) => {
                    if (typeof change == 'number') {
                        attr = ATTRIBUTES[attr];
                        let sign = {'1': '+', '-1': '-', '0': ''}[Math.sign(change)];
                        lines.push(`${attr}: ${sign}${change}`);
                    } else {
                        Object.entries(change).forEach(([type, change]) => {
                            attr = gettext(ATTRIBUTES[attr], {type});
                            let sign = {'1': '+', '-1': '-', '0': ''}[Math.sign(change)];
                            lines.push(`${attr}: ${sign}${change}`);
                        });
                    }
                });
            }
            if (Object.keys(item.passive).length) {
                lines.push('---', gettext('games_rpg_status_passive'));
                Object.entries(item.passive).forEach(([attr, change]) => {
                    if (typeof change == 'number') {
                        attr = ATTRIBUTES[attr];
                        let sign = {'1': '+', '-1': '-', '0': ''}[Math.sign(change)];
                        lines.push(`${attr}: ${sign}${change}`);
                    } else {
                        Object.entries(change).forEach(([type, change]) => {
                            attr = gettext(ATTRIBUTES[attr], {type});
                            let sign = {'1': '+', '-1': '-', '0': ''}[Math.sign(change)];
                            lines.push(`${attr}: ${sign}${change}`);
                        });
                    }
                });
            }
            if (item.equip_slot != null) {
                lines.push('---', gettext('games_rpg_status_equipped'), gettext('games_rpg_status_equip_slot', {slot: EQUIP_SLOTS[item.equip_slot].name}));
                Object.entries(item.equipped).forEach(([attr, change]) => {
                    if (typeof change == 'number') {
                        attr = ATTRIBUTES[attr];
                        let sign = {'1': '+', '-1': '-', '0': ''}[Math.sign(change)];
                        lines.push(`${attr}: ${sign}${change}`);
                    } else {
                        Object.entries(change).forEach(([type, change]) => {
                            attr = gettext(ATTRIBUTES[attr], {type});
                            let sign = {'1': '+', '-1': '-', '0': ''}[Math.sign(change)];
                            lines.push(`${attr}: ${sign}${change}`);
                        });
                    }
                });
            }

            canvas_tooltip(lines, x_start, y_start + TILE_SIZE[1] * 2.25);
        }
    }
    /**
     * Shows the status of an entity
     *
     * @param {Entity} entity
     */
    function show_status(entity) {
        // Get what must be written
        let lines = [];
        let name_line = gettext('games_rpg_status_name') + ': ' + (entity.name || gettext('games_rpg_status_name_unnamed'));
        lines.push(name_line);
        if (debug_status) {
            lines.push(`x: ${entity.x}`, `y: ${entity.y}`, `z: ${entity.z}`, `solid: ${entity.solid}`);
            if (entity.target) {
                lines.push(`target: at ${entity.target.x}, ${entity.target.y}`);
            }
        }
        let health_line = ATTRIBUTES['health'] + `: ${entity.health}/${entity.health_max}`;
        if (entity.bonus_health_max) health_line += ` (${entity.base_health_max} +${entity.bonus_health_max})`;
        lines.push(health_line);
        Object.entries(entity.defense).forEach(([type, def]) => {
            let line = gettext(ATTRIBUTES['defense'], {type: TYPES[type]}) + `: ${def}`;
            if (type in entity.bonus_defense) {
                line += ` (${entity.base_defense[type] ?? 0} +${entity.bonus_defense[type]})`;
            }
            lines.push(line);
        });
        Object.entries(entity.damage).forEach(([type, dmg]) => {
            let line = gettext(ATTRIBUTES['damage'], {type: TYPES[type]}) + `: ${dmg}`;
            if (type in entity.bonus_damage) {
                line += ` (${entity.base_damage[type] ?? 0} +${entity.bonus_damage[type]})`;
            }
            lines.push(line);
        });
        let speed_line = `${ATTRIBUTES['speed']}: ${entity.speed}`;
        if (entity.bonus_speed) speed_line += ` (${entity.base_speed} +${entity.bonus_speed})`;
        let range_line = `${ATTRIBUTES['range']}: ${entity.range}`;
        if (entity.bonus_range) range_line += ` (${entity.base_range} +${entity.bonus_range})`;
        let inventory_count = entity.inventory.map(([_, a]) => a).reduce((s, a) => s + a, 0);
        let inventory_line = `${ATTRIBUTES['inventory']}: ${inventory_count} ` +
            (inventory_count > 1 ? gettext('games_rpg_status_items') : gettext('games_rpg_status_item'));
        lines.push(speed_line, range_line, inventory_line);

        // Write
        let left = 2 * TILE_SIZE[0];
        let base_top = (2 - cursors.status[1]) * TILE_SIZE[1];
        CONTEXT.textAlign = 'left';
        CONTEXT.font = `${TILE_SIZE[1]}px monospace`;
        CONTEXT.fillStyle = '#000';
        for (let i = 0; i < lines.length; i++) {
            let top = base_top + (i + 1) * TILE_SIZE[1];
            if (top <= 0) continue;

            let line = lines[i];
            CONTEXT.fillText(line, left, top);
        }

        // Scroll arrows
        let can_scroll_up = cursors.status[1] > 0;
        let can_scroll_down = lines.length + 4 > DISPLAY_SIZE[1];
        if (can_scroll_up) {
            CONTEXT.textAlign = 'right';
            CONTEXT.font = `${TILE_SIZE[1] * 3}px monospace`;
            let left = (DISPLAY_SIZE[0] - .5) * TILE_SIZE[0];
            let top = 3 * TILE_SIZE[1];

            CONTEXT.fillText('⇑', left, top);
        }
        if (can_scroll_down) {
            CONTEXT.textAlign = 'right';
            CONTEXT.font = `${TILE_SIZE[1] * 3}px monospace`;
            let left = (DISPLAY_SIZE[0] - .5) * TILE_SIZE[0];
            let top = TILE_SIZE[1] * (DISPLAY_SIZE[1] - 2);

            CONTEXT.fillText('⇓', left, top);
        }
    }
    /**
     * Writes a bunch of lines
     *
     * @param {string[]} lines Lines to write
     * @param {number} left Distance from left edge
     * @param {number} top Distance from top edge
     */
    function canvas_tooltip(lines, left, top) {
        let width = TILE_SIZE[0] * (lines.map(l => l.length).reduce((m, l) => Math.max(m, l), 0) + 2) * 2 / 3;
        let height = TILE_SIZE[1] * (lines.length + .5);
        if (left + width > TILE_SIZE[0] * DISPLAY_SIZE[0]) {
            let overshot = left + width - TILE_SIZE[0] * DISPLAY_SIZE[0];
            left = Math.max(0, left - overshot);
        }
        if (top + height > TILE_SIZE[1] * DISPLAY_SIZE[1]) {
            let overshot = top + height - TILE_SIZE[1] * DISPLAY_SIZE[1];
            top = Math.max(0, top - overshot);
        }

        CONTEXT.fillStyle = '#ccc';
        CONTEXT.strokeStyle = '#000';
        CONTEXT.fillRect(left, top, width, height);
        CONTEXT.strokeRect(left, top, width, height);

        CONTEXT.textAlign = 'left';
        CONTEXT.font = `${TILE_SIZE[1]}px monospace`;
        CONTEXT.fillStyle = '#000';

        for (let i = 0; i < lines.length; i++) {
            let y = top + (i + 1) * TILE_SIZE[1];
            let x = left + TILE_SIZE[0];
            if (y <= 0) continue;

            let line = lines[i];
            CONTEXT.fillText(line, x, y);
        }
    }

    // Coordinates functions
    /**
     * Returns the list of coordinates surrounding a space, in the shape of a square
     *
     * @param {number} center_x
     * @param {number} center_y
     * @param {number} [radius=hallway_radius]
     * @returns {[number,number][]}
     */
    function surrounding_square(center_x, center_y, radius) {
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
    function coords_distance(point_a, point_b) {
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
    function can_walk(coords, excluded=null) {
        let [x, y] = coords;
        if (excluded instanceof Entity) excluded = [excluded];

        if (!(coords.toString() in can_walked)) {
            let cw = Tile.solid_tiles.filter(t => t.x == x && t.y == y && !(t instanceof Entity)).length == 0;
            can_walked[coords.toString()] = cw;
        }
        return can_walked[coords.toString()] && !Entity.entities.some(e => !excluded.includes(e) && e.solid && Math.round(e.x) == x && Math.round(e.y) == y);
    }

    // Game functions
    /**
     * Starts the game
     */
    function init() {
        let almost_paused = !document.hasFocus();
        document.addEventListener('keydown', keydown);
        document.addEventListener('blur', () => {
            if (game_state == 'playing') {
                almost_paused = true;
                game_state = 'pause';
            }
        });
        document.addEventListener('focus', () => {
            if (almost_paused) {
                almost_paused = false;
                game_state = 'playing';
            }
        });
        create_items();

        loop_last = Date.now();
        canvas_reset();
        player = new Entity({x: 0, y: 0, z: 10, content: function(x, y) {
            CONTEXT.textAlign = 'center';
            CONTEXT.fillStyle = '#f00';
            CONTEXT.font = `${TILE_SIZE[1]}px monospace`;
            let x_start = (x - (player.x - DISPLAY_SIZE[0] / 2) + .5) * TILE_SIZE[0];
            let y_start = (y - (player.y - DISPLAY_SIZE[1] / 2) + .8) * TILE_SIZE[1];

            CONTEXT.fillText('☺', x_start, y_start);
        }, health: 10, speed: 2, equip_slots: [0, 3, 5]});

        Room.make_map();

        requestAnimationFrame(loop);
    }
    /**
     * Main game loop
     */
    function loop() {
        let now = Date.now();
        let diff = now - loop_last;
        loop_last = now;

        canvas_refresh();

        if (game_state == 'playing') {
            /** @type {AutonomousEntity[]} */
            Entity.entities.filter(t => t instanceof AutonomousEntity).forEach(t => t.move(null, diff / 500));
        }

        requestAnimationFrame(loop);
    }
    /**
     * Calls the action that corresponds to the key pressed
     *
     * @this {Document}
     * @param {KeyboardEvent} e
     */
    function keydown(e) {
        let to_check = [KEYBINDS.others];
        if (game_state in KEYBINDS) to_check.push(KEYBINDS[game_state]);
        to_check.reverse();

        // Get the key
        let key = e.key.toLowerCase();
        if (strict_keys) {
            // There's only one key we want
            if (e.shiftKey) key = `shift+${key}`;
            if (e.ctrlKey) key = `ctrl+${key}`;
            if (e.altKey) key = `alt+${key}`;
        } else {
            // Compose keys, get most complex valid one
            let keys = [key];
            if (e.shiftKey) keys.push(...keys.map(k => `shift+${k}`));
            if (e.ctrlKey) keys.push(...keys.map(k => `ctrl+${k}`));
            if (e.altKey) keys.push(...keys.map(k => `alt+${k}`));
            keys.sort((a, b) => {
                if (a.length == b.length) return a < b;
                return b.length - a.length;
            });
            key = keys.find(k => to_check.some(kb => k in kb)) ?? key;
        }

        /** @type {string[]} */
        let actions = [];
        to_check.forEach(kb => {
            if (key in kb) actions.push(...kb[key]);
        });
        actions.forEach(a => {
            ACTIONS[a].func();
        });
    }
    /**
     * Returns the amount of inventory items per row
     *
     * @returns {number}
     */
    function inventory_items_per_row() {
        return Math.max(Math.floor(DISPLAY_SIZE[0] / 3) - 2, 1);
    }
    /**
     * Creates the items for the player
     */
    function create_items() {
        /**
         * @type {{
         *  content: Color|string|CanvasImageSource|(x: number, y: number, inventory: boolean, this: Item) => void,
         *  id: string,
         *  name?: string,
         *  description?: string,
         *  on_use?: {[k: string]: number},
         *  passive?: {[k: string]: number},
         *  equipped?: {[k: string]: number},
         *  equip_slot?: number,
         *  x?: number,
         *  y?: number,
         *  z?: number,
         * }[]}
         */
        let items = [
            {
                content: '∅',
                id: 'no',
                passive: {
                    speed: .25,
                },
            },
            {
                content: '✔',
                id: 'yes',
                on_use: {
                    health: 1,
                },
            },
            {
                content: '🎂',
                id: 'cake',
                on_use: {
                    health: 5,
                },
                passive: {
                    health_max: 1,
                },
            },
            {
                content: '🧱',
                id: 'bricks',
            },
            {
                content: '✨',
                id: 'sparks',
                equip_slot: 1,
                equipped: {
                    speed: 10,
                },
            },
            {
                content: '🏁',
                id: 'flag',
                equip_slot: 0,
                equipped: {
                    health_max: 1,
                },
            },
            {
                content: '🎁',
                id: 'gift',
                equip_slot: 0,
                equipped: {
                    speed: 1,
                },
            },
            {
                content: '☘',
                id: 'clover',
            },
            {
                content: '🔥',
                id: 'fire',
            },
            {
                content: '💲',
                id: 'cash',
            },
        ];

        items.forEach(item => {
            if (Item.get_item(item.id)) return;

            item.x = 0;
            item.y = 0;
            item.z = 1;

            new Item(item);
        });
    }

    /**
     * @template {(string[]|Tile)} T
     */
    class Room {
        /**
         * @type {{[k: string]: {
         *  func: (grid: string[][], width: number, height: number, walls?: string, floors?: string, empty?: string) => string[][],
         *  cond: (width: number, height: number) => boolean,
         * }}}
         */
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
                    // Compute distance from axis
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
            //todo? triangle(s)
            //todo? pentagram
        };
        /**
         * @type {{[k: string]: (start: [number, number], end: [number, number]) => [number, number][]}
         */
        static PATHS = {
            // As direct as possible
            'straight': (start, end) => {
                let dist_x = start[0] - end[0];
                let dist_y = start[1] - end[1];
                let sign_x = Math.sign(dist_x);
                let sign_y = Math.sign(dist_y);
                let ratio = dist_y / dist_x;
                /** @type {[number, number][]} */
                let coords = [];

                if (isNaN(ratio) || (!dist_x && !dist_y)) {
                    let [x, y] = start;
                    coords.push([x, y]);
                } else if (!isFinite(ratio)) {
                    let x = start[0];
                    let range = [
                        Math.min(start[1], end[1]) - 1,
                        Math.max(start[1], end[1]) + 1,
                    ];
                    for (let y = start[1] - 1; number_between(y, ...range); y -= sign_y) {
                        coords.push([x, y]);
                    }
                } else if (Math.abs(ratio) <= 1) {
                    let range = [
                        Math.min(start[0], end[0]) - 1,
                        Math.max(start[0], end[0]) + 1,
                    ];
                    for (let x = start[0] - 1; number_between(x, ...range); x -= sign_x) {
                        let y = Math.round((x - start[0]) * ratio) + start[1];
                        coords.push([x, y]);
                    }
                } else {
                    ratio **= -1;
                    let range = [
                        Math.min(start[1], end[1]) - 1,
                        Math.max(start[1], end[1]) + 1,
                    ];
                    for (let y = start[1] - 1; number_between(y, ...range); y -= sign_y) {
                        let x = Math.round((y - start[1]) * ratio) + start[0];
                        coords.push([x, y]);
                    }
                }

                return coords;
            },
            // Move horizontally first, then vertically
            'horizontal_vertical': (start, end) => {
                let dist_x = start[0] - end[0];
                let dist_y = start[1] - end[1];
                let sign_x = Math.sign(dist_x);
                let sign_y = Math.sign(dist_y);
                /** @type {[number, number][]} */
                let coords = [];

                if (sign_x) {
                    for (let x = start[0]; number_between(x, start[0], end[0]); x -= sign_x) {
                        let y = start[1];
                        coords.push([x, y]);
                    }
                }
                if (sign_y) {
                    for (let y = start[1] - sign_y; number_between(y, start[1], end[1]); y -= sign_y) {
                        let x = end[0];
                        coords.push([x, y]);
                    }
                }
                if (!sign_x && !sign_y) coords.push([...start]);

                return coords;
            },
            // Move vertically first, then horizontally
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
            //todo without touching other rooms/hallways (if possible)
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
         * @returns {Room<Tile>}
         */
        static make_spawn() {
            return Random.room({width: 20, height: 20, shape: 'donut_round'}).to_tiles(0, 0, false);
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
         * @returns {Room<Tile>}
         */
        static link({rooms, walls=null, floors=null}) {
            rooms.forEach(r => r.to_tiles(null, null, false));

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

            /** @type {[number, number][]} */
            let links = separate_rooms.map((_, index) => {
                //todo reduce connections to only a few nearby rooms
                let connections = 1 + Math.floor(Random.range(0, Math.ceil(rooms.length ** .5)));
                let links = separate_rooms.map((_, i) => i).filter(i => i != index).map(i => [index, i].sort((a,b) => a-b));
                links = Random.array_shuffle(links);
                return links.splice(0, connections);
            }).flat();
            // Remove duplicates
            links = links.filter((link, index) => {
                let i = links.findIndex(l => l[0] == link[0] && l[1] == link[1]);
                return [index, -1].includes(i);
            });
            // Connect rooms
            links.forEach(link => {
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

                let path = Random.array_element(Object.values(this.PATHS));
                let coords = path(start, end);
                let hall_floors = floors ?? ASCII_COLORS[Random.array_element(ASCII_SYMBOLS.nonsolids)];
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
                let hall_walls = walls ?? ASCII_COLORS[Random.array_element(ASCII_SYMBOLS.solids)];
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
            /** @type {Room<Tile>[]} */
            let rooms = [];
            if (spawn_player) {
                rooms.push(this.make_spawn());
            }

            room_amount ??= Math.ceil(Random.range(3, 20));

            let all_coords = [[0, 0]];
            let dist = 3 * room_amount;
            for (let i = 0; i <= room_amount; i++) {
                // Allows making room nearer
                let coords = [...Random.array_element(all_coords)];
                coords[0] += Math.floor(Random.range(-dist, 1 + dist));
                coords[1] += Math.floor(Random.range(-dist, 1 + dist));
                all_coords.push(coords);
                rooms.push(Random.room().to_tiles(...coords, false));
            }

            let map = this.link({rooms});
            map.insert();

            // Spawn player
            if (spawn_player) {
                let target = Random.array_element(rooms[0].grid.filter(t => !t.solid));
                if (!target) target = Random.array_element(rooms[0].grid);
                let {x = 0, y = 0} = target;
                player.x = x;
                player.y = y;
            }

            // Spawn items
            let map_floors = map.grid.filter(t => !t.solid);
            if (!map_floors.length) map_floors = map.grid;
            Item.get_random_items().forEach(id => {
                let target = Random.array_element(map_floors);
                let {x, y} = target;
                Item.get_item(id, {x, y, z: 1}).insert();
            });
            let count = Math.trunc(Random.range(1, 10));
            for (let i = 0; i < count; i++) {
                let target = Random.array_element(map_floors);
                let {x, y} = target;
                let pathfinding = Random.AutonomousEntity.pathfinding();
                let targeting = Random.AutonomousEntity.targeting();
                new AutonomousEntity({x, y, z: 9, content: Random.emoji_face(), pathfinding, targeting});
            }
        }

        //todo? room decorating

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
                        if (!Object.values(ASCII_SYMBOLS).flat().includes(cell)) return;

                        /** @type {string} */
                        let solid = ASCII_SYMBOLS.solids.includes(cell);
                        let content = ASCII_COLORS[cell];
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
    class Color {
        /**
         * Converts a #rrggbbaa color into a Color object
         *
         * @param {string} hex
         * @returns {Color}
         */
        static from_hex(hex) {
            if (!hex.match(/^#?(?:[\da-f]{3,4}){1,2}$/)) throw new TypeError(`${hex} is not a valid hex color`);
            if (hex.startsWith('#')) hex = hex.slice(1);

            if (hex.length <= 4) {
                let h = '';
                for (let i = 0; i < hex.length; i++) h += hex[i].repeat(2);
                hex = h;
            }

            let rgb = [0, 0, 0];
            for (let i = 0; i < 3; i++) rgb[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);

            let [red, green, blue] = rgb;

            return new Color(red, green, blue);
        }
        /**
         * Converts red, green, blue into a Color object
         *
         * Just use the constructor
         *
         * @param {number} red
         * @param {number} green
         * @param {number} blue
         */
        static from_rgb(red, green, blue) {
            if (isNaN(red)) throw new TypeError(`${red} is not a number`);
            if (isNaN(green)) throw new TypeError(`${green} is not a number`);
            if (isNaN(blue)) throw new TypeError(`${blue} is not a number`);

            red = Math.min(255, Math.max(0, red));
            green = Math.min(255, Math.max(0, green));
            blue = Math.min(255, Math.max(0, blue));

            return new Color(red, green, blue);
        }
        /**
         * Converts a `rgb(red, green, blue)` or a `rgba(red, green, blue, alpha)` into a Color object
         *
         * @param {string} cssrgb
         * @returns {Color}
         */
        static from_css_rgb(cssrgb) {
            if (!cssrgb.match(/^rgba?\(/)) throw new TypeError(`${cssrgb} is not in the format 'rgb(<red>, <green>, <blue>)' or 'rgba(<red>, <green>, <blue>, <alpha>)`);

            let [,red, green, blue] = cssrgb.match(/rgba?\((\d+), ?(\d+), ?(\d+)/);
            return new Color(+red, +green, +blue);
        }
        /**
         * Converts an object with the red, green, and blue properties into a Color object
         *
         * @param {{red: number, green: number, blue: number}} color
         */
        static from_object(color) {
            if (!('red' in color)) throw new TypeError(`${color.toString} has no red property`);
            if (!('green' in color)) throw new TypeError(`${color.toString} has no green property`);
            if (!('blue' in color)) throw new TypeError(`${color.toString} has no blue property`);

            let {red, green, blue} = color;

            red = Math.min(255, Math.max(0, red));
            green = Math.min(255, Math.max(0, green));
            blue = Math.min(255, Math.max(0, blue));

            return new Color(red, green, blue);
        }
        /**
         * Generates a random color
         *
         * @returns {Color}
         */
        static from_random() {
            let red = Math.floor(Math.random() * 255);
            let green = Math.floor(Math.random() * 255);
            let blue = Math.floor(Math.random() * 255);

            return new Color(red, green, blue);
        }

        /** @type {number} */
        #red;
        /** @type {number} */
        #green;
        /** @type {number} */
        #blue;
        /** @type {string|false} */
        #string;

        /**
         * @param {Color|string|number|{red: number, green: number, blue: number}} red
         * @param {number} [green]
         * @param {number} [blue]
         */
        constructor(red, green, blue) {
            if (typeof red == 'object' && 'red' in red && 'green' in red && 'blue' in red) ({red, green, blue} = red);
            else if (typeof red == 'string') ({red, green, blue} = Color.from_hex(red));
            else if (typeof red == 'number' && typeof green == 'number' && typeof blue == 'number');
            else throw new TypeError(`Invalid color arguments: ${red.toString()},${green.toString()},${blue.toString()}`);

            this.#red = red;
            this.#green = green;
            this.#blue = blue;
        }

        toString() {
            if (!this.#string) {
                this.#string = `#${this.#red.toString(16).padStart(2,'0')}${this.#green.toString(16).padStart(2,'0')}${this.#blue.toString(16).padStart(2,'0')}`;
            }
            return this.#string;
        }
        toJSON() { return this.toString(); }

        get red() { return this.#red; }
        set red(red) {
            if (!isNaN(red)) {
                this.#red = Math.min(255, Math.max(0, red));
                this.#string = false;
            }
        }
        get green() { return this.#green; }
        set green(green) {
            if (!isNaN(green)) {
                this.#green = Math.min(255, Math.max(0, green));
                this.#string = false;
            }
        }
        get blue() { return this.#blue; }
        set blue(blue) {
            if (!isNaN(blue)) {
                this.#blue = Math.min(255, Math.max(0, blue));
                this.#string = false;
            }
        }

        /**
         * Returns a grayscale version of the color
         *
         * @returns {Color}
         */
        grayscale() {
            let gray = Math.round((this.#red + this.#green + this.#blue) / 3);

            return new Color(gray, gray, gray);
        }
        /**
         * Returns an inverted version of the color
         *
         * @returns {Color}
         */
        invert() {
            let red = 255 - this.#red;
            let green = 255 - this.#green;
            let blue = 255 - this.#blue;

            return new Color(red, green, blue);
        }
        /**
         * Clones the color
         *
         * @returns {Color}
         */
        clone() {
            return new Color(this);
        }
        /**
         * Mixes 2 colors
         *
         * @param {Color} color
         * @param {'average'|'max'|'min'|'add'|'substract'|'multiply'|'xor'|'and'|'or'} mode
         * @returns {Color}
         */
        mix(color, mode='average') {
            let red = 0;
            let green = 0;
            let blue = 0;

            switch (mode) {
                case 'average':
                    red = (this.#red + color.#red) / 2;
                    green = (this.#green + color.#green) / 2;
                    blue = (this.#blue + color.#blue) / 2;
                    break;
                case 'max':
                    red = Math.max(this.#red, color.#red);
                    green = Math.max(this.#green, color.#green);
                    blue = Math.max(this.#blue, color.#blue);
                    break;
                case 'min':
                    red = Math.min(this.#red, color.#red);
                    green = Math.min(this.#green, color.#green);
                    blue = Math.min(this.#blue, color.#blue);
                    break;
                case 'add':
                    red = Math.min(255, this.#red + color.#red);
                    green = Math.min(255, this.#green + color.#green);
                    blue = Math.min(255, this.#blue + color.#blue);
                    break;
                case 'substract':
                    red = Math.max(0, this.#red - color.#red);
                    green = Math.max(0, this.#green - color.#green);
                    blue = Math.max(0, this.#blue - color.#blue);
                    break;
                case 'multiply':
                    red = Math.min(255, this.#red * color.#red);
                    green = Math.min(255, this.#green * color.#green);
                    blue = Math.min(255, this.#blue * color.#blue);
                    break;
                case 'xor':
                    red = this.#red ^ color.#red;
                    green = this.#green ^ color.#green;
                    blue = this.#blue ^ color.#blue;
                    break;
                case 'and':
                    red = this.#red & color.#red;
                    green = this.#green & color.#green;
                    blue = this.#blue & color.#blue;
                    break;
                case 'or':
                    red = this.#red | color.#red;
                    green = this.#green | color.#green;
                    blue = this.#blue | color.#blue;
                    break;
                default:
                    console.error(`Unknown color mix mode ${mode}`);
                    return null;
            }

            return new Color(red, green, blue);
        }
    }
    /**
     * @template {Color|string|CanvasImageSource|(x: number, y: number, this: Tile) => void} T
     */
    class Tile {
        /**
         * Current game grid
         *
         * @type {Tile[]}
         */
        static grid = [];
        /** @type {Tile[]|false} */
        static #visible_grid = false;
        /** @type {Tile[]|false} */
        static #solid_tiles = false;
        static #player_x;
        static #player_y;

        static get visible_grid() {
            if (this.#player_x != player.x || this.#player_y != player.y) {
                this.#visible_grid = false;
                this.#player_x = player.x;
                this.#player_y = player.y;
            }
            if (this.#visible_grid === false) {
                this.#visible_grid = this.grid.filter(t => t.is_visible);
            }
            return this.#visible_grid;
        }
        static set visible_grid(value) {
            if (value === false) {
                this.#visible_grid = false;
                return;
            }

            if (!Array.isArray(value)) value = [];
            else if (!value.every(t => t instanceof Tile)) value = value.filter(t => t instanceof Tile);

            this.#visible_grid = value;
        }
        static get solid_tiles() {
            if (this.#solid_tiles === false) {
                this.#solid_tiles = this.grid.filter(t => t.solid);
            }
            return this.#solid_tiles;
        }

        /** @type {T} */
        #content;
        /** @type {null|(entity: Entity, this: Tile<T>) => void} */
        #interacted;

        /**
         * @param {Object} params
         * @param {number} params.x
         * @param {number} params.y
         * @param {number} params.z
         * @param {T} params.content
         * @param {boolean} [params.solid=false]
         * @param {boolean} [params.insert=true]
         * @param {(entity: Entity, this: Tile<T>) => void} [params.interacted]
         * @param {boolean} [params.override=true]
         */
        constructor({x, y, z, content, solid=false, insert=true, interacted=null, override=true}) {
            if (typeof x != 'number') throw new TypeError(`Invalid tile parameter x: ${x}`);
            if (typeof y != 'number') throw new TypeError(`Invalid tile parameter y: ${y}`);
            if (typeof z != 'number') throw new TypeError(`Invalid tile parameter z: ${z}`);
            if (typeof content == 'function'); // Don't bind to this, it will break future rebinds
            else if (isinstance(content, Color, HTMLCanvasElement, HTMLImageElement, SVGImageElement, HTMLVideoElement, ImageBitmap));
            else if (typeof content == 'string') {
                /** @type {((content: string) => Color)[]} */
                let converters = [
                    Color.from_hex,
                    Color.from_css_rgb,
                ];
                for (let conv of converters) {
                    try {
                        let c = conv(content);
                        content = c;
                        break;
                    } catch {}
                }
            } else throw new TypeError(`Invalid tile parameter content: ${content}`);
            if (typeof interacted != 'function' && interacted != null) throw new TypeError(`Invalid tile parameter interacted: ${interacted}`);

            this.x = x;
            this.y = y;
            this.z = z;
            this.solid = !!solid;
            this.#content = content;
            this.#interacted = interacted;

            if (insert) {
                this.insert(override);
            }
        }

        /** @type {T} */
        get content() { return this.#content; }
        set content(content) {
            if (typeof content == 'function') {
                content = content.bind(this);
            } else if (typeof content == 'string') {
                /** @type {((content: string) => Color)[]} */
                let converters = [
                    Color.from_hex,
                    Color.from_css_rgb,
                ];
                for (let conv of converters) {
                    try {
                        let c = conv(content);
                        content = c;
                        break;
                    } catch {}
                }
            } else if (isinstance(content, Color, HTMLCanvasElement, HTMLImageElement, SVGImageElement, HTMLVideoElement, ImageBitmap));
            else return;
            this.#content = content;
        }

        toJSON() {
            let json = {
                x: this.x,
                y: this.y,
                z: this.z,
                solid: this.solid,
                content: '',
            };

            if (this.#content instanceof Color) {
                json.content = this.#content.toJSON();
            } else if ('src' in this.#content) {
                json.content = this.#content.src;
            }

            return json;
        }

        get is_visible() {
            let x_low = player.x - DISPLAY_SIZE[0] / 2 - 1;
            let x_high = player.x + DISPLAY_SIZE[0] / 2;
            let y_low = player.y - DISPLAY_SIZE[1] / 2 - 1;
            let y_high = player.y + DISPLAY_SIZE[1] / 2;

            return this.x >= x_low && this.x <= x_high && this.y >= y_low && this.y <= y_high;
        }

        draw() {
            let x_start = (this.x - (player.x - DISPLAY_SIZE[0] / 2)) * TILE_SIZE[0];
            let y_start = (this.y - (player.y - DISPLAY_SIZE[1] / 2)) * TILE_SIZE[1];
            let content = this.#content;

            if (typeof content == 'function') {
                content.call(this, this.x, this.y);
            } else if (typeof content == 'string') {
                CONTEXT.fillStyle = '#000';
                CONTEXT.font = `${TILE_SIZE[1]}px monospace`;
                x_start += TILE_SIZE[0] / 2;
                y_start += TILE_SIZE[1] - 5;

                CONTEXT.fillText(content, x_start, y_start);
            } else if (content instanceof Color) {
                CONTEXT.fillStyle = content.toString();
                // Add .5 to the dimensions to prevent white lines from appearing at some player speeds
                CONTEXT.fillRect(x_start, y_start, TILE_SIZE[0] + .5, TILE_SIZE[1] + .5);
            } else if (isinstance(content, HTMLCanvasElement, HTMLImageElement, SVGImageElement, HTMLVideoElement, ImageBitmap)) {
                CONTEXT.drawImage(content, x_start, y_start, TILE_SIZE[0] + .5, TILE_SIZE[1] + .5);
            } else {
                console.error(`Unknown tile content type ${content}`);
            }
        }
        /**
         * Inserts the tile in the grid
         *
         * @param {boolean} [overwrite=false]
         */
        insert(overwrite = false) {
            if (Tile.grid.includes(this)) return;
            let i = Tile.grid.findIndex(t => t.x == this.x && t.y == this.y && t.z == this.z);
            if (overwrite || i == -1) {
                if (i != -1 && overwrite) Tile.grid[i] = this;
                else Tile.grid.push(this);
            }
            can_walked = {};
            Tile.#visible_grid = false;
            Tile.#solid_tiles = false;
        }
        /**
         * Does an interaction with the tile
         *
         * @param {Entity} entity
         */
        interacted(entity) {
            this.#interacted && this.#interacted.call(this, entity);
        }
    }
    /**
     * @template {Color|string|CanvasImageSource|(x: number, y: number, inventory?: 0|1|2, this: Item) => void} T
     */
    class Item extends Tile {
        /** @type {{[k: string]: Item}} */
        static #items = {};
        /**
         * Gets an item
         *
         * @param {string} item_id
         * @param {Item} overrides
         * @returns {Item?}
         */
        static get_item(item_id, overrides={}) {
            if (item_id in this.#items) {
                let item = this.#items[item_id];
                return item.copy(overrides);
            }
            return null;
        }
        /**
         * Gets a few random item_ids
         *
         * @param {number} [amount]
         * @returns {string[]}
         */
        static get_random_items(amount=null) {
            let ids = [];

            if (amount == null) {
                Object.keys(this.#items).forEach(id => {
                    ids.push(...new Array(Math.ceil(Random.range(0, 10))).fill(id));
                });
            } else {
                for (let i = 0; i < amount; i++) {
                    ids.push(Random.array_element(Object.keys(this.#items)));
                }

            }
            return ids;
        };

        /**
         * @param {Object} params
         * @param {number} params.x
         * @param {number} params.y
         * @param {number} params.z
         * @param {T} params.content
         * @param {string} params.id
         * @param {string} [params.name]
         * @param {string} [params.description]
         * @param {{[k: string]: number|{[k: string]: number}}} [params.on_use]
         * @param {{[k: string]: number|{[k: string]: number}}} [params.passive]
         * @param {{[k: string]: number|{[k: string]: number}}} [params.equipped]
         * @param {number} [params.equip_slot]
         * @param {Entity} [params.owner]
         * @param {boolean} [params.insert]
         */
        constructor({
            x, y, z, id, name=null, description=null, content, insert=false,
            on_use={}, passive={}, equipped={}, equip_slot=null, owner=null
        }) {
            if (typeof on_use != 'object') throw new TypeError(`Invalid item parameter on_use: ${on_use}`);
            if (typeof passive != 'object') throw new TypeError(`Invalid item parameter passive: ${passive}`);
            if (typeof equipped != 'object') throw new TypeError(`Invalid item parameter equipped: ${equipped}`);
            if (isNaN(equip_slot)) throw new TypeError(`Invalid item parameter equip_slot: ${equip_slot}`);
            if (owner && !(owner instanceof Entity)) throw new TypeError(`Invalid item parameter owner: ${owner}`);

            super({x, y, z, content, solid: false, insert, override: false, interacted: function(e) {
                // Recalculate x and y according to current position in inventory
                let inv = e.inventory;
                this.owner = e;
                let i = inv.findIndex(([i,]) => i.id == this.id);
                if (i == -1) {
                    i = inv.length;
                    inv.push([this, 1]);
                } else {
                    inv[i][1]++;
                }
                this.re_position();

                // Remove from grid
                if (Tile.grid.includes(this)) {
                    let i = Tile.grid.indexOf(this);
                    Tile.grid.splice(i, 1);
                }
                if (Tile.visible_grid.includes(this)) {
                    let i = Tile.visible_grid.indexOf(this);
                    Tile.visible_grid.splice(i, 1);
                }
            }});

            this.name = name == null ? '' : name.toString();
            this.description = description == null ? '' : description.toString();
            /** @type {Entity|null} */
            this.owner = null;
            this.on_use = on_use;
            this.passive = passive;
            this.equipped = equipped;
            this.equip_slot = equip_slot == null ? null : +equip_slot;
            this.id = id;

            if (!(id in Item.#items)) Item.#items[id] = this;
        }

        get is_visible() {
            return !this.owner && super.is_visible;
        }
        get is_visible_inventory() {
            let item_rows = Math.max(Math.ceil((Math.floor(DISPLAY_SIZE[0] / 3) - 1) / 2), 1);
            let min_y = 0;
            let max_y = item_rows;

            if (cursors.inventory[1] > item_rows) {
                min_y += cursors.inventory[1] - item_rows;
                max_y += cursors.inventory[1] - item_rows;
            }

            return number_between(this.y, min_y, max_y);
        }

        /**
         * Creates a copy of this item
         *
         * @template {T} U
         * @param {Item<U>} overrides
         * @returns {Item<U|T>}
         */
        copy(overrides={}) {
            let {x, y, z, id, content, on_use, passive, stored, name, description, equipped, equip_slot, owner} = this;
            let item = {x, y, z, id, content, on_use: {}, passive: {}, equipped: {}, equip_slot, stored, insert: false, name, description, owner};
            Object.entries(on_use).forEach(([attr, change]) => {
                if (typeof change == 'number') {
                    item.on_use[attr] = change;
                } else {
                    item.on_use[attr] = {};
                    Object.entries(change).forEach(([type, change]) => {
                        item.on_use[attr][type] = change;
                    });
                }
            });
            Object.entries(passive).forEach(([attr, change]) => {
                if (typeof change == 'number') {
                    item.passive[attr] = change;
                } else {
                    item.passive[attr] = {};
                    Object.entries(change).forEach(([type, change]) => {
                        item.passive[attr][type] = change;
                    });
                }
            });
            Object.entries(equipped).forEach(([attr, change]) => {
                if (typeof change == 'number') {
                    item.equipped[attr] = change;
                } else {
                    item.equipped[attr] = {};
                    Object.entries(change).forEach(([type, change]) => {
                        item.equipped[attr][type] = change;
                    });
                }
            });
            Object.entries(overrides).forEach(([attr, value]) => {
                item[attr] = value;
            });
            return new Item(item);
        }
        /**
         * Calculates the item's position according to the owner's inventory
         *
         * @param {Entity} [entity] owner
         */
        re_position(entity = null) {
            entity ??= this.owner;
            if (!entity) return;

            // x and y are dependant on inventory index
            let inv = entity.inventory;
            let i = inv.findIndex(([i,]) => i == this);

            let items_per_row = inventory_items_per_row();
            if (i != -1) {
                this.x = i % items_per_row;
                this.y = Math.floor(i / items_per_row);
            } else {
                this.x = items_per_row;
                this.y = this.equip_slot;
            }
        }
        /**
         * @param {number} [amount]
         */
        draw_inventory(amount=1) {
            let offset_x = TILE_SIZE[0];
            let offset_y = TILE_SIZE[1];
            let x_start = this.x * 3 * TILE_SIZE[0] + offset_x;
            let y_start = this.y * 3 * TILE_SIZE[1] + offset_y;
            /** @type {T} */
            let content = this.content;

            if (typeof content == 'function') {
                let inventory = +!!this.owner;
                if (this.owner && this.owner.equipment[this.equip_slot] == this) inventory++;
                content.call(this, this.x, this.y, inventory);
            } else if (typeof content == 'string') {
                CONTEXT.textAlign = 'center';
                CONTEXT.fillStyle = '#000';
                CONTEXT.font = `${TILE_SIZE[1] * 2}px monospace`;
                let x = x_start + TILE_SIZE[0];
                let y = y_start + TILE_SIZE[1] * 1.75;

                CONTEXT.fillText(content, x, y);
            } else if (content instanceof Color) {
                CONTEXT.fillStyle = content.toString();
                CONTEXT.fillRect(x_start, y_start, TILE_SIZE[0] * 2, TILE_SIZE[1] * 2);
            } else if (isinstance(content, HTMLCanvasElement, HTMLImageElement, SVGImageElement, HTMLVideoElement, ImageBitmap)) {
                CONTEXT.drawImage(content, x_start, y_start, TILE_SIZE[0] * 2, TILE_SIZE[1] * 2);
            } else {
                console.error(`Unknown tile content type ${content}`);
            }

            if (amount != 1) {
                CONTEXT.textAlign = 'right';
                CONTEXT.fillStyle = '#fff';
                CONTEXT.font = `${TILE_SIZE[1]}px sans-serif`;
                let x = x_start + TILE_SIZE[0] * 2;
                let y = y_start + TILE_SIZE[1] * 2;

                CONTEXT.fillText(amount, x, y);
                CONTEXT.shadowBlur = 0;
            }
        }
    }
    /**
     * @template {Color|string|CanvasImageSource|(x: number, y: number, this: Entity) => void} T
     */
    class Entity extends Tile {
        /** @type {Entity[]} */
        static entities = [];

        /** @type {number} */
        #health;
        /** @type {number} */
        #health_max;
        /** @type {{[k: string]: number}} */
        #defense;
        /** @type {{[k: string]: number}} */
        #damage;
        /** @type {number} */
        #speed;
        /** @type {number} */
        #range;

        /** @type {[Item, number][]} */
        #inventory = [];
        /** @type {{[k: number]: Item|null}} */
        #equipment = {};
        //todo factions & intents
        //todo skills

        /**
         * @param {Object} params
         * @param {number} params.x
         * @param {number} params.y
         * @param {number} params.z
         * @param {T} params.content
         * @param {string} [params.name]
         * @param {number} [params.health]
         * @param {number} [params.health_max]
         * @param {number|{[k: string]: number}} [params.defense]
         * @param {number|{[k: string]: number}} [params.damage]
         * @param {number} [params.speed]
         * @param {number} [params.range] Interaction range
         * @param {number[]} [params.equip_slots]
         */
        constructor({
            x, y, z, content, name=null,
            health=10, health_max=null, defense=1, damage=1,
            speed=1, range=.75, equip_slots=[]
        }) {
            health_max ??= health;
            if (typeof health != 'number') throw new TypeError(`Invalid entity parameter health: ${health}`);
            if (typeof health_max != 'number') throw new TypeError(`Invalid entity parameter health_max: ${health_max}`);
            if (typeof defense == 'number') {
                defense = {'none': defense};
            } else if (typeof defense != 'object') throw new TypeError(`Invalid entity parameter defense: ${defense}`);
            if (typeof damage == 'number') {
                damage = {'none': damage};
            } else if (typeof damage != 'object') throw new TypeError(`Invalid entity parameter damage: ${damage}`);
            if (typeof speed != 'number') throw new TypeError(`Invalid entity parameter speed: ${speed}`);
            if (typeof range != 'number') throw new TypeError(`Invalid entity parameter range: ${range}`);
            if (!Array.isArray(equip_slots)) throw new TypeError(`Invalid entity parameter equip_slots: ${equip_slots}`);

            super({x, y, z, content, solid: health > 0, override: false});

            this.name = name == null ? '' : name.toString();
            this.#health = health;
            this.#health_max = health_max;
            this.#defense = defense;
            this.#damage = damage;
            this.#speed = speed;
            this.#range = range;
            equip_slots.sort((a,b) => a-b).forEach(n => this.#equipment[n] = null);

            Entity.entities.push(this);
        }

        get health() { return Math.min(this.#health, this.health_max); }
        set health(health) {
            if (!isNaN(health)) {
                this.#health = Math.max(Math.min(this.health_max, health), 0);
                this.solid = this.#health > 0;
                if (this.#health <= 0) {
                    while (this.#inventory.length > 0) {
                        this.drop_item(0, false, 'max');
                    }
                    Object.keys(this.#equipment).forEach(n => this.drop_item(+n, true));
                }
            }
        }
        get health_max() { return Math.max(this.base_health_max + this.bonus_health_max, 0); }
        get bonus_health_max() {
            let bonus = this.#inventory.map(([item, amount]) => {
                if (!amount) return 0;
                return (item.passive?.health_max ?? 0) * amount;
            }).reduce((s, n) => s + n, 0);
            bonus += Object.values(this.#equipment)
                .filter(i => i != null)
                .map(i => +(i?.equipped?.health_max ?? 0))
                .reduce((s, n) => s + n, 0);

            return bonus;
        }
        get base_health_max() { return this.#health_max; }
        set base_health_max(health_max) { if (!isNaN(health_max)) this.#health_max = Math.max(+health_max, 0); }
        get defense() {
            /** @type {{[k: string]: number}} */
            let defense = {};

            Object.entries(this.base_defense).forEach(([type, def]) => {
                if (!defense.hasOwnProperty(type)) defense[type] = def;
                else defense[type] += def;
            });
            Object.entries(this.bonus_defense).forEach(([type, def]) => {
                if (!defense.hasOwnProperty(type)) defense[type] = def;
                else defense[type] += def;
            });

            return defense;
        }
        get bonus_defense() {
            /** @type {{[k: string]: number}} */
            let defense = {};

            this.#inventory.forEach(([item, amount]) => {
                if (!amount) return;
                if (!item.passive.hasOwnProperty('defense') || typeof item.passive.defense != 'object') return;
                let item_defense = item.passive.defense;
                Object.entries(item_defense).forEach(([type, def]) => {
                    if (!defense.hasOwnProperty(type)) defense[type] = def * amount;
                    else defense[type] += def * amount;
                });
            });
            Object.values(this.#equipment)
                .filter(i => i != null)
                .forEach(item => {
                    if (!item.equipped.hasOwnProperty('defense') || typeof item.equipped.defense != 'object') return;
                    let item_defense = item.equipped.defense;
                    Object.entries(item_defense).forEach(([type, def]) => {
                        if (!defense.hasOwnProperty(type)) defense[type] = def;
                        else defense[type] += def;
                    });
                });

            return defense;
        }
        get base_defense() { return this.#defense; }
        set base_defense(defense) {
            if (typeof defense == 'number') defense = {'none': defense};
            else if (typeof defense != 'object') return;
            this.#defense = defense;
        }
        get damage() {
            /** @type {{[k: string]: number}} */
            let damage = {};

            Object.entries(this.base_damage).forEach(([type, dmg]) => {
                if (!damage.hasOwnProperty(type)) damage[type] = dmg;
                else damage[type] += dmg;
            });
            Object.entries(this.bonus_damage).forEach(([type, dmg]) => {
                if (!damage.hasOwnProperty(type)) damage[type] = dmg;
                else damage[type] += dmg;
            });

            return damage;
        }
        get bonus_damage() {
            /** @type {{[k: string]: number}} */
            let damage = {};

            this.#inventory.forEach(([item, amount]) => {
                if (!amount) return;
                if (!item.passive.hasOwnProperty('damage') || typeof item.passive.damage != 'object') return;
                let item_damage = item.passive.damage;
                Object.entries(item_damage).forEach(([type, dmg]) => {
                    if (!damage.hasOwnProperty(type)) damage[type] = dmg * amount;
                    else damage[type] += dmg * amount;
                });
            });
            Object.values(this.#equipment)
                .filter(i => i != null)
                .forEach(item => {
                    if (!item.equipped.hasOwnProperty('damage') || typeof item.equipped.damage != 'object') return;
                    let item_damage = item.equipped.damage;
                    Object.entries(item_damage).forEach(([type, dmg]) => {
                        if (!damage.hasOwnProperty(type)) damage[type] = dmg;
                        else damage[type] += dmg;
                    });
                });

            return damage;
        }
        get base_damage() { return this.#damage; }
        set base_damage(damage) {
            if (typeof damage == 'number') damage = {'none': damage};
            else if (typeof damage != 'object') return;
            this.#damage = damage;
        }
        get speed() { return Math.max(this.base_speed + this.bonus_speed, 0); }
        get bonus_speed() {
            let bonus = this.#inventory.map(([item, amount]) => {
                if (!amount) return 0;
                return (item.passive?.speed ?? 0) * amount;
            }).reduce((s, n) => s + n, 0);
            bonus += Object.values(this.#equipment)
                .filter(i => i != null)
                .map(i => +(i?.equipped?.speed ?? 0))
                .reduce((s, n) => s + n, 0);

            return bonus;
        }
        get base_speed() { return this.#speed; }
        set base_speed(speed) { if (!isNaN(speed)) this.#speed = Math.max(+speed, 0); }
        get range() { return Math.max(this.base_range + this.bonus_range, 0); }
        get bonus_range() {
            let bonus = this.#inventory.map(([item, amount]) => {
                if (!amount) return 0;
                return (item.passive?.range ?? 0) * amount;
            }).reduce((s, n) => s + n, 0);
            bonus += Object.values(this.#equipment)
                .filter(i => i != null)
                .map(i => +(i?.equipped?.range ?? 0))
                .reduce((s, n) => s + n, 0);

            return bonus;
        }
        get base_range() { return this.#range; }
        set base_range(range) { if (!isNaN(range)) this.#range = Math.max(+range, 0); }

        get inventory() { return this.#inventory; }
        get visible_inventory() { return this.#inventory.filter(([i]) => i.is_visible_inventory); }
        get equipment() { return this.#equipment; }
        get visible_equipment() { return Object.fromEntries(
            Object.entries(this.#equipment)
                .filter(([_, item]) => item != null && item.is_visible_inventory)
        ); }

        /**
         * Moves an entity somewhere
         *
         * @param {DIRECTION} direction
         * @param {number} [multiplier] speed multiplier
         */
        move(direction, multiplier=1) {
            let amounts = direction.map(n => n * multiplier * this.speed);
            direction = direction.map(Math.sign);
            let left = direction[0] == -1;
            let right = direction[0] == 1;
            let up = direction[1] == -1;
            let down = direction[1] == 1;
            let space = this.get_cardinal_space({left, right, up, down});

            // Get the lowest movement available in the directions
            amounts = amounts.map((n, i) => {
                if (direction[i] in space) {
                    // Needs abs, otherwise the game won't know you can't go through walls on the left or up
                    return Math.min(Math.abs(n), space[direction[i]][i]) * Math.sign(n);
                }
                return 0;
            });

            if (amounts.some(n => n != 0)) {
                // Move around
                this.x += amounts[0];
                this.y += amounts[1];

                if (this.is_visible != Tile.visible_grid.includes(this)) {
                    if (this.is_visible) {
                        // Not in the visible grid, but should be
                        Tile.visible_grid.push(this);
                    } else {
                        // In the visible grid, but should not be
                        let i = Tile.visible_grid.indexOf(this);
                        Tile.visible_grid.splice(i, 1);
                    }
                }
            }

            // Interact with next tile(s)
            let x_range = [Math.floor(this.x + .5 - amounts[0]), Math.ceil(this.x - .5)];
            let y_range = [Math.floor(this.y + .5 - amounts[1]), Math.ceil(this.y - .5)];

            switch (direction[0]) {
                case 1:
                    x_range[1]++;
                    break;
                case -1:
                    x_range[0]--;
            }
            switch (direction[1]) {
                case 1:
                    y_range[1]++;
                    break;
                case -1:
                    y_range[0]--;
            }

            // Interact with tiles
            Tile.grid.filter(t => number_between(t.x, ...x_range) && number_between(t.y, ...y_range)).forEach(t => t.interacted(this));
        }
        /**
         * Calculates the movement space available in all 4 cardinal directions
         *
         * @param {Object} params
         * @param {boolean} [params.left]
         * @param {boolean} [params.right]
         * @param {boolean} [params.up]
         * @param {boolean} [params.down]
         * @returns {{
         *  '-1': [number, number],
         *  '1': [number, number],
         * }} -1: [left, up], 1: [right, down]
         */
        get_cardinal_space({left=false, right=false, up=false, down=false}={}) {
            let result = {
                /** Left. up */
                '-1': [Infinity, Infinity],
                /** Right, down */
                '1': [Infinity, Infinity],
            };

            let x_range = [Math.floor(this.x + .05), Math.ceil(this.x - .05)];
            let y_range = [Math.floor(this.y + .05), Math.ceil(this.y - .05)];

            if (left) {
                let tiles_left = Tile.solid_tiles.filter(t => {
                    if (t.x >= this.x) return false;

                    let range = [Math.floor(t.y + .05), Math.ceil(t.y - .05)];
                    return range.some(c => number_between(c, ...y_range));
                });
                if (tiles_left.length) {
                    let least_left = tiles_left.map(t => t.x + 1).reduce((max, x) => Math.max(max, x), -Infinity);
                    result['-1'][0] = Math.max(0, this.x - least_left);
                }
            }
            if (right) {
                let tiles_right = Tile.solid_tiles.filter(t => {
                    if (t.x <= this.x) return false;

                    let range = [Math.floor(t.y + .05), Math.ceil(t.y - .05)];
                    return range.some(c => number_between(c, ...y_range));
                });
                if (tiles_right.length) {
                    let least_right = tiles_right.map(t => t.x - 1).reduce((min, x) => Math.min(min, x), Infinity);
                    result['1'][0] = Math.max(0, least_right - this.x);
                }
            }
            if (up) {
                let tiles_up = Tile.solid_tiles.filter(t => {
                    if (t.y >= this.y) return false;

                    let range = [Math.floor(t.x + .05), Math.ceil(t.x - .05)];
                    return range.some(c => number_between(c, ...x_range));
                });
                if (tiles_up.length) {
                    let least_up = tiles_up.map(t => t.y + 1).reduce((max, y) => Math.max(max, y), -Infinity);
                    result['-1'][1] = Math.max(0, this.y - least_up);
                }
            }
            if (down) {
                let tiles_down = Tile.solid_tiles.filter(t => {
                    if (t.y <= this.y) return false;

                    let range = [Math.floor(t.x + .05), Math.ceil(t.x - .05)];
                    return range.some(c => number_between(c, ...x_range));
                });
                if (tiles_down.length) {
                    let least_down = tiles_down.map(t => t.y - 1).reduce((min, y) => Math.min(min, y), Infinity);
                    result['1'][1] = Math.max(0, least_down - this.y);
                }
            }

            return result;
        }
        /**
         * Uses an item in the inventory
         *
         * @param {Item|number|string} item item|index|id
         * @param {number|'max'} [amount=1]
         */
        use_item(item, amount=1) {
            let index;
            if (item instanceof Item) {
                index = this.#inventory.findIndex(([i]) => i.id == item.id);
            } else if (typeof item == 'string') {
                index = this.#inventory.findIndex(([i]) => i.id == item);
            } else if (typeof item == 'number') {
                index = item;
            }

            if (!(index in this.#inventory)) return;

            let [real_item, real_amount] = this.#inventory[index];
            if (amount == 'max') amount = real_amount;
            else amount = Math.min(amount, real_amount);

            if (!amount || isNaN(amount) || !Object.keys(real_item.on_use).length) return;
            Object.entries(real_item.on_use).forEach(([attr, change]) => {
                if (`base_${attr}` in this) {
                    attr = `base_${attr}`;
                }
                if (!(attr in this)) return;

                this[attr] += change * amount;
            });

            if (amount >= real_amount) {
                this.#inventory.splice(index, 1)[0][0].owner = null;
                this.#inventory.filter((_, i) => i >= index).forEach(([i]) => i.re_position());

                // Check if cursor is at the end of the inventory and move it backwards if it is
                let items_per_row = inventory_items_per_row();
                let cursor_index = cursors.inventory[1] * items_per_row + cursors.inventory[0];
                if (cursor_index == this.#inventory.length) {
                    if (cursors.inventory[0] > 0) {
                        cursors.inventory[0]--;
                    } else if (cursors.inventory[1] > 0) {
                        cursors.inventory[0] = items_per_row - 1;
                        cursors.inventory[1]--;
                    } //Else that was the last item, so we don't move it
                }
            } else {
                this.#inventory[index][1] -= amount;
            }
        }
        /**
         * Drops an item from the inventory
         *
         * @param {Item|number|string} item item|index|id
         * @param {boolean} [equip] Whether the item is equipped or not
         * @param {number|'max'} [amount=1]
         */
        drop_item(item, equip=false, amount=1) {
            let index;
            if (item instanceof Item) {
                if (equip) {
                    let entry = Object.entries(this.#equipment).find(([_, i]) => i == item);
                    if (!entry) return;
                    index = +entry[0];
                } else index = this.#inventory.findIndex(([i]) => i.id == item.id);
            } else if (typeof item == 'string') {
                if (equip) {
                    let entry = Object.entries(this.#equipment).find(([_, i]) => i.id == item);
                    if (!entry) return;
                    index = +entry[0];
                } else index = this.#inventory.findIndex(([i]) => i.id == item);
            } else if (typeof item == 'number') {
                index = item;
            }

            let real_item;
            let real_amount = 1;
            if (equip) {
                if (!(index in this.#equipment) || !this.#equipment[index]) return;

                real_item = this.#equipment[index];
            } else {
                if (!(index in this.#inventory)) return;

                [real_item, real_amount] = this.#inventory[index];
            }

            if (amount == 'max') amount = real_amount;
            else amount = Math.min(amount, real_amount);

            if (!amount || isNaN(amount)) return;

            // You can't wear 2 shirts in the game
            if (equip) this.#equipment[index] = null;
            else if (amount >= real_amount) {
                real_item.owner = null;
                let items_per_row = inventory_items_per_row();

                this.#inventory.splice(index, 1);
                this.#inventory.filter((_, i) => i >= index).forEach(([i]) => i.re_position());

                // Check if cursor is at the end of the inventory and move it backwards if it is
                let cursor_index = cursors.inventory[1] * items_per_row + cursors.inventory[0];
                if (cursor_index == this.#inventory.length) {
                    if (cursors.inventory[0] > 0) {
                        cursors.inventory[0]--;
                    } else if (cursors.inventory[1] > 0) {
                        cursors.inventory[0] = items_per_row - 1;
                        cursors.inventory[1]--;
                    } //Else that was the last item, so we don't move it
                }
            } else {
                this.#inventory[index][1] -= amount;
            }

            // Spawn the items on the floor
            /** @type {[number, number][]} */
            let grid = [];
            let id = real_item.id;

            let check_grid = () => {
                if (grid.length) return;

                /** @type {(([x,y]: [number, number]) => boolean)[]} */
                let filters = [
                    // Only allow as a grid around the entity
                    ([x,y]) => {
                        if (x == Math.round(this.x) && y == Math.round(this.y)) return false;
                        let _x = Math.round(this.x) - x;
                        if (_x % 2) return false;
                        let _y = Math.round(this.y) - y;
                        if (_y % 2) return false;

                        // Only allow non-solid tiles that are without items
                        let tiles = Tile.grid.filter(t => t.x == x && t.y == y);
                        return !tiles.some(t => t.solid || t instanceof Item) && tiles.length;
                    },
                    // Grid doesn't have enough space, so we fill the gaps
                    ([x,y]) => {
                        if (x == Math.round(this.x) && y == Math.round(this.y)) return false;

                        // Only allow non-solid tiles that are without items
                        let tiles = Tile.grid.filter(t => t.x == x && t.y == y);
                        return !tiles.some(t => t.solid || t instanceof Item) && tiles.length;
                    },
                    // Just don't put it on a solid tile
                    ([x,y]) => {
                        if (x == Math.round(this.x) && y == Math.round(this.y)) return false;

                        // Only allow non-solid tiles
                        let tiles = Tile.grid.filter(t => t.x == x && t.y == y);
                        return tiles.every(t => !t.solid) && tiles.length;
                    },
                    // Just put it on a tile
                    ([x,y]) => {
                        if (x == Math.round(this.x) && y == Math.round(this.y)) return false;

                        // Only allow tiles
                        return Tile.grid.some(t => t.x == x && t.y == y);
                    },
                    // Ignore the entity
                    ([x,y]) => {
                        return x != Math.round(this.x) || y != Math.round(this.y);
                    },
                ];
                for (let filter of filters) {
                    let radius = 0;

                    while (!grid.length) {
                        radius++;

                        let surroudings = surrounding_square(Math.round(this.x), Math.round(this.y), radius * 2);
                        let _grid = surroudings.filter(filter);
                        if (_grid.length) {
                            grid = _grid;
                            break;
                        }
                    }
                }

                grid = Random.array_shuffle(grid);
            }

            for (let i = 0; i < amount; i++) {
                check_grid();
                let coords = grid.pop();

                let [x, y] = coords;
                let item = Item.get_item(id, {x, y});
                item.insert();
            }

            Tile.visible_grid = false;
        }
        /**
         * Equips an item in the inventory
         *
         * @param {Item|number|string} item item|index|id
         */
        equip_item(item) {
            let index;
            if (item instanceof Item) {
                index = this.#inventory.findIndex(([i]) => i.id == item.id);
            } else if (typeof item == 'string') {
                index = this.#inventory.findIndex(([i]) => i.id == item);
            } else if (typeof item == 'number') {
                index = item;
            }

            if (!(index in this.#inventory)) return;

            let [real_item, amount] = this.#inventory[index];

            if (!amount || isNaN(amount) || !(real_item.equip_slot in this.#equipment)) return;
            if (this.#equipment[real_item.equip_slot]) {
                // If the item is already equipped, what is the point?
                if (this.#equipment[real_item.equip_slot].id == real_item.id) return;
                this.unequip_item(real_item.equip_slot);
            }

            if (amount > 1) {
                this.#inventory[index][1]--;
            } else {
                this.#inventory.splice(index, 1);
                this.#inventory.filter((_,i) => i >= index).forEach(([i]) => i.re_position());

                // Check if cursor is at the end of the inventory and move it backwards if it is
                let items_per_row = inventory_items_per_row();
                let cursor_index = cursors.inventory[1] * items_per_row + cursors.inventory[0];
                if (cursor_index == this.#inventory.length) {
                    if (cursors.inventory[0] > 0) {
                        cursors.inventory[0]--;
                    } else if (cursors.inventory[1] > 0) {
                        cursors.inventory[0] = items_per_row - 1;
                        cursors.inventory[1]--;
                    } //Else that was the last item, so we don't move it
                }
            }

            let new_item = real_item.copy();
            new_item.owner = this;
            this.#equipment[new_item.equip_slot] = new_item;
            new_item.re_position();
        }
        /**
         * Unequips an item and puts it back in the inventory
         *
         * @param {Item|number|string} item item|equip_slot|id
         */
        unequip_item(item) {
            let index;
            if (item instanceof Item) {
                let entry = Object.entries(this.#equipment).find(([_, i]) => i.id == item.id);
                index = +(entry[0] ?? -1);
            } else if (typeof item == 'string') {
                let entry = Object.entries(this.#equipment).find(([_, i]) => i.id == item);
                index = +(entry[0] ?? -1);
            } else if (typeof item == 'number') {
                index = item;
            }

            if (!(index in this.#equipment) || !this.#equipment[index]) return;

            let real_item = this.#equipment[index];
            this.#equipment[index] = null;

            let inventory_index = this.#inventory.findIndex(([i]) => i.id == real_item.id);
            if (inventory_index == -1) {
                this.#inventory.push([real_item, 1]);
                real_item.re_position();
            } else {
                this.#inventory[inventory_index][1]++;
            }
        }
        //todo attack/interact with entity
    }
    /**
     * @template {Color|string|CanvasImageSource|(x: number, y: number, this: AutonomousEntity) => void} T
     */
    class AutonomousEntity extends Entity {
        /** @type {Tile|null} */
        #target;
        #target_never = false;
        /** @type {(this: AutonomousEntity<T>) => Tile|null} */
        #targeting;
        /** @type {(this: AutonomousEntity<T>) => DIRECTION|null} */
        #pathfinding;
        /** @type {[number, number][]|null} */
        path = null;

        /**
         * @param {Object} params
         * @param {number} params.x
         * @param {number} params.y
         * @param {number} params.z
         * @param {T} params.content
         * @param {string} [params.name]
         * @param {number} [params.health]
         * @param {number} [params.health_max]
         * @param {number|{[k: string]: number}} [params.defense]
         * @param {number|{[k: string]: number}} [params.damage]
         * @param {number} [params.speed]
         * @param {number} [params.range] Interaction range
         * @param {(this: AutonomousEntity) => Tile|null} [params.targeting]
         * @param {(this: AutonomousEntity) => DIRECTION|null} [params.pathfinding]
         */
        constructor({
            x, y, z, content,
            name=null, health=10, health_max=null, defense=1, damage=1, speed=1, range=.5,
            targeting=()=>null, pathfinding=()=>null
        }) {
            if (typeof targeting != 'function') throw new TypeError(`Invalid moving entity parameter targeting: ${targeting}`);
            if (typeof pathfinding != 'function') throw new TypeError(`Invalid moving entity parameter pathfinding: ${pathfinding}`);

            super({x, y, z, content, name, health, health_max, defense, damage, speed, range});

            this.#targeting = targeting;
            this.#pathfinding = pathfinding;
        }

        get target() {
            // The function always returns null so...
            if (this.#target_never) return null;

            if (this.#target == null && !this.#reset_target()) {
                this.#target_never = true;
            }

            // Check if we've reached the target, and get a new one if so
            let target = this.#target;
            let x_range = [target.x - .1, target.x + .1];
            let y_range = [target.y - .1, target.y + .1];
            if (this.#target.solid) {
                // If we're next to the target, get a new one
                x_range[0]--;
                x_range[1]++;
                y_range[0]--;
                y_range[1]++;
            }
            if (number_between(this.x, ...x_range) && number_between(this.y, ...y_range)) this.#reset_target();

            if (this.#target instanceof Item && this.#target.owner) {
                this.#target = this.#target.owner;
            }
            return this.#target;
        }
        set target(target) {
            if (target instanceof Tile || target == null) {
                this.#target = target;
                this.path = null;
            }
        }
        get targeting() { return this.#targeting; }
        set targeting(targeting) {
            if (typeof targeting == 'function') {
                this.#targeting = targeting;
                this.#target_never = false;
            }
        }
        get pathfinding() { return this.#pathfinding; }
        set pathfinding(pathfinding) {
            if (typeof pathfinding == 'function') {
                this.#pathfinding = pathfinding;
                this.path = null;
            }
        }

        #reset_target() {
            /** @type {Tile|null} */
            let target = this.#targeting.call(this);
            if (target) {
                this.#target = target;
                this.path = null;
            }
            return !!target;
        }
        /**
         * @param {DIRECTION} [dir]
         * @param {number} [multiplier]
         */
        move(dir=null, multiplier=1) {
            dir ??= this.#pathfinding.call(this);
            if (dir && !dir.every(n => n == 0)) super.move(dir, multiplier);
        }
    }
    /**
     * Serves as a priority heap
     *
     * **If using non-primary values, the old values must be obtained separately**
     *
     * @see https://esstudio.site/2018/10/31/implementing-binary-heaps-with-javascript.html
     * @see https://medium.com/@polyismstudio/a-pathfinding-in-javascript-1963759cf26
     *
     * @template T
     */
    class MinHeap {
        /** @param {(value: T) => number} selector */
        constructor(selector) {
            /** @type {T[]} */
            this.items = [];
            this.selector = selector;
        }

        seek() { return this.items[0]; }

        /** @param {T} item */
        push(item) {
            let i = this.items.length;
            let root = Math.floor((i + 1) / 2 - 1);
            this.items.push(item);

            while (i > 0 && this.selector(this.items[root]) > this.selector(this.items[i])) {
                [this.items[i], this.items[root]] = [this.items[root], this.items[i]];
                i = root;
                root = Math.floor((i + 1) / 2 - 1);
            }
        }

        pop() {
            if (this.items.length <= 1) return this.items.pop();
            const ret = this.items[0];
            this.items[0] = this.items.pop();
            let i = 0;
            let branch = (i + 1) * 2;

            while(true) {
                let lowest = this.selector(this.items[branch]) < this.selector(this.items[branch - 1]) ? branch : branch - 1;
                if (this.selector(this.items[i]) > this.selector(this.items[lowest])) {
                    [this.items[i], this.items[lowest]] = [this.items[lowest], this.items[i]];
                    i = lowest;
                    branch = (i + 1) * 2;
                } else break;
            }
            return ret;
        }

        /** @param {T} item */
        delete(item) {
            let i = this.items.indexOf(item);
            this.items[i] = this.items.pop();
            let branch = (i + 1) * 2;

            while(true) {
                let lowest = this.selector(this.items[branch]) < this.selector(this.items[branch - 1]) ? branch : branch - 1;
                if (this.selector(this.items[i]) > this.selector(this.items[lowest])) {
                    [this.items[i], this.items[lowest]] = [this.items[lowest], this.items[i]];
                    i = lowest;
                    branch = (i + 1) * 2;
                } else break;
            }
        }

        /** @param {T[]} arr */
        heapify(arr) {
            arr.forEach(this.push);
        }
    }
    /**
     * @see https://medium.com/@polyismstudio/a-pathfinding-in-javascript-1963759cf26
     */
    class Path {
        /** @type {[number, number]} */
        start;
        /** @type {[number, number]} */
        goal;

        /** @param {[number, number]} start @param {[number, number]} goal @param {Entity|Entity[]} [e] */
        find(start, goal, e=null) {
            this.start = start;
            this.goal = goal;

            /** @type {{[k: string]: boolean}} */
            const visited_set = {}; // Processed coords
            /** @type {{[k: string]: [number, number]}} */
            const paths = {}; // Path back to the start
            /** @type {{[k: string]: number}} */
            const score_g = {}; // Distance from start to position
            /** @type {{[k: string]: number}} */
            const score_f = {}; // Approximate distance from position to goal
            /** @type {MinHeap<[number, number]>} */
            const open_set = new MinHeap(i => i in score_f ? score_f[i] : Infinity); // Nodes to be processed

            score_g[start] = 0;
            score_f[start] = this.cost_estimate(start, goal);
            open_set.push(start);

            // Loop until we find the path or we run out of tiles
            while (open_set.items.length) {
                let current = open_set.pop();

                if (this.is_goal(current)) {
                    // We found the path!
                    return this.path_back(paths, current);
                }

                visited_set[current] = true;
                const neighbours = this.neighbours(current);
                neighbours.forEach(neighbour => {
                    if (!can_walk(neighbour, e) || neighbour in visited_set) return;

                    const tentativeScore = score_g[current] + 1;

                    if (!score_f[neighbour]) {
                        paths[neighbour] = current;
                        score_g[neighbour] = tentativeScore;
                        score_f[neighbour] = tentativeScore + this.cost_estimate(neighbour, goal);
                        open_set.push(neighbour);
                    } else if (tentativeScore < score_g[neighbour]) {
                        let previous = open_set.items.find(c => c.every((n,i) => neighbour[i] == n));
                        paths[neighbour] = current;
                        score_g[neighbour] = tentativeScore;
                        score_f[neighbour] = tentativeScore + this.cost_estimate(neighbour, goal);
                        open_set.delete(previous);
                        open_set.push(neighbour);
                    }
                });
            }
        }

        /** @param {[number, number]} node1 @param {[number, number]} node2 */
        cost_estimate(node1, node2) {
            return (node1[0] - node2[0]) ** 2 + (node1[1] - node2[1]) ** 2;
        }

        /** @param {[number, number]} node */
        is_goal(node) {
            return node.every((n,i) => this.goal[i] == n);
        }

        /** @param {[number, number]} node @returns {[number, number][]} */
        neighbours(node) {
            return [
                [node[0] - 1, node[1]],
                [node[0] + 1, node[1]],
                [node[0], node[1] - 1],
                [node[0], node[1] + 1],
            ];
        }

        /** @param {{[k: string]: [number, number]}} cameFrom @param {[number, number]} current */
        path_back(cameFrom, current) {
            let counter = 0;
            /** @type {[number, number][]} */
            const path = [];
            while (current != this.start) {
                path.push(current);
                current = cameFrom[current];
                // Path is longer than a million tiles
                if (counter++ >= 1e6) {
                    return null;
                }
            }
            path.push(this.start);
            return path.reverse();
        }
    }

    init();
//})();
