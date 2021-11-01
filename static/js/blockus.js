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
     * Options table
     *
     * @type {HTMLTableElement}
     */
    const OPTIONS = document.getElementById('options');
    /**
     * Span for the score
     *
     * @type {HTMLSpanElement}
     */
    const SCORE = document.getElementById('blockus_score');
    /**
     * Available themes
     *
     * @type { {[key: string]: {
     *  name: string,
     *  blockus: {
     *      playing: {
        *      background: string,
        *      color: string,
     *      },
     *      pause: {
        *      background: string,
        *      color: string,
     *      },
     *      gameover: {
        *      background: string,
        *      color: string,
     *      },
     *  },
     *  score: {
     *      background: string,
     *      color: string,
     *  },
     * } } }
     */
    const THEMES = {
        'dark': {
            name: gettext('game_blockus_theme_name_dark'),
            blockus: {
                playing: {
                    background: '#000',
                    color: '#fff',
                },
                pause: {
                    background: '#033',
                    color: '#fff',
                },
                gameover: {
                    background: '#400',
                    color: '#fff',
                },
            },
            score: {
                background: '#000',
                color: '#fff',
            },
        },
        'light': {
            name: gettext('game_blockus_theme_name_light'),
            blockus: {
                playing: {
                    background: '#fff',
                    color: '#000',
                },
                pause: {
                    background: '#ddd',
                    color: '#000',
                },
                gameover: {
                    background: '#f77',
                    color: '#000',
                },
            },
            score: {
                background: '#fff',
                color: '#000',
            },
        },
    };
    /**
     * Size of a single block, in width and height
     *
     * @type {[number, number]}
     */
    const BLOCK_SIZE = [20, 20];
    /**
     * Available shapes for blocks
     *
     * A path is a set of relative coordinates multiplied by block size
     *
     * All paths are drawn as lines then filled with the block's color, one after another
     *
     * All paths are looped back to the inital coordinate set, to make sure they close
     *
     * @type { {[key: string]: {
     *  paths: [number,number][][],
     *  name: string,
     * } } }
     */
    const BLOCK_SHAPES = {
        'square': {
            name: gettext('game_blockus_shape_square'),
            paths: [
                [[0,0], [0,1], [1,1], [1,0]],
            ],
        }
    };
    /**
     * Unit types for beautify
     *
     * @type { {[key: string]: {
     *  units: [string][],
     *  name: string,
     * } } }
     */
    const UNITS = {
        'none': {
            units: [],
            name: gettext('game_blockus_unit_none'),
        },
        'SI': {
            units: ['', 'k', 'M', 'G', 'T', 'P', 'E', 'Z', 'Y'],
            name: gettext('game_blockus_unit_si'),
        },
        'numeral': {
            units: ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'S', 'Se', 'O', 'N',
                'D', 'UD', 'DD', 'TD', 'QaD', 'QiD', 'SD', 'SeD', 'OD', 'ND',
                'V', 'UV', 'DV', 'TV', 'QaV', 'QiV', 'SV', 'SeV', 'OV', 'NV'],
                name: gettext('game_blockus_unit_numeral'),
        },
    };
    /**
     * Size of a shape (min, max)
     *
     * @type {[number, number]}
     */
    const SHAPE_SIZE = [4, 4];
    /**
     * Size of the board (width, height)
     *
     * @type {[number, number]}
     */
    const BOARD_SIZE = [15, 30];
    /**
     * Colors bound to shapes, has no effect with `rainbow_shapes`, or `rainbow_blocks` active
     *
     * @type { {[key: string]: string} }
     */
    const SHAPE_COLORS = {};
    /**
     * Enum of directions
     *
     * @enum {[number, number]}
     */
    const DIRECTION = Object.freeze({
        'right': [0, 1],
        0: [0, 1],
        'up': [-1, 0],
        1: [-1, 0],
        'left': [0, -1],
        2: [0, -1],
        'down': [1, 0],
        3: [1, 0],
    });
    /**
     * Amount of times the loop runs each second
     */
    const TPS = 30;
    /**
     * @type { {
     *  playing: {
     *      [key: string]: string[],
     *  },
     *  pause: {
     *      [key: string]: string[],
     *  },
     *  gameover: {
     *      [key: string]: string[],
     *  },
     * } }
     */
    const KEYBINDS = {
        playing: {
            'arrowright': ['move_shape_right'],
            'arrowleft': ['move_shape_left'],
            'arrowdown': ['move_shape_down'],
            'a': ['move_shape_left'],
            's': ['move_shape_down'],
            'd': ['move_shape_right'],
            'q': ['rotate_shape_counter_clockwise'],
            'e': ['rotate_shape_clockwise'],
            'p': ['game_state_pause'],
        },
        pause: {
            'p': ['game_state_playing'],
            'r': ['reset_game'],
        },
        gameover: {
            'r': ['reset_game'],
        },
    };
    /**
     * Actions that can be called by the keybinds
     *
     * @type { {[key: string]: {
     *  func: (any) => void,
     *  name: string,
     * } } }
     */
    const ACTIONS = new Proxy(Object.freeze({
        'move_shape_right': {
            func: () => {
                if (!current_shape || game_state != 'playing') return;
                current_shape.move(DIRECTION.right, 10/TPS);
                current_shadow = current_shape.get_shadow();
            },
            name: gettext('game_blockus_action_move_shape_right'),
        },
        'move_shape_left': {
            func: () => {
                if (!current_shape || game_state != 'playing') return;
                current_shape.move(DIRECTION.left, 10/TPS);
                current_shadow = current_shape.get_shadow();
            },
            name: gettext('game_blockus_action_move_shape_left'),
        },
        'move_shape_down': {
            func: () => {descend(10/TPS);},
            name: gettext('game_blockus_action_move_shape_down'),
        },
        'game_state_pause': {
            func: () => {
                game_state = 'pause';
                current_shadow = null;
            },
            name: gettext('game_blockus_action_game_state_pause'),
        },
        'game_state_playing': {
            func: () => {
                game_state = 'playing';
                current_shadow = null;
            },
            name: gettext('game_blockus_action_game_state_playing'),
        },
        'rotate_shape_clockwise': {
            func: () => {
                current_shape.rotate(true);
                current_shadow = current_shape.get_shadow();
            },
            name: gettext('game_blockus_action_rotate_shape_clockwise'),
        },
        'rotate_shape_counter_clockwise': {
            func: () => {
                current_shape.rotate(false);
                current_shadow = current_shape.get_shadow();
            },
            name: gettext('game_blockus_action_rotate_shape_counter_clockwise'),
        },
        'reset_game': {
            func: () => {if (confirm(gettext('game_blockus_reset_confirm'))) {reset();}},
            name: gettext('game_blockus_action_reset_game'),
        },
    }), {
        get: (obj, prop) => {
            if (prop in obj) return obj[prop];

            return () => {};
        },
        set: (obj, prop, val) => {},
    });

    /**
     * Current theme
     *
     * @type {string}
     */
    let theme = Object.keys(THEMES)[0];
    /**
     * Current block shape
     *
     * @type {string}
     */
    let block_shape = Object.keys(BLOCK_SHAPES)[0];
    /**
     * Current unit type
     *
     * @type {string}
     */
    let unit = Object.keys(UNITS)[0];
    /**
     * Whether to trim the score or not
     */
    let trim_score = true;
    /**
     * Score
     *
     * @type {number}
     */
    let score = 0;
    /**
     * Determines whether shapes have a random color
     *
     * @type {boolean}
     */
    let rainbow_shapes = false;
    /**
     * Determines whether blocks have a random color
     *
     * @type {boolean}
     */
    let rainbow_blocks = false;
    /**
     * Random color each block each draw
     *
     * **⚠ Warning: Heavy on CPU, may cause problems for photosensitive people ⚠**
     *
     * @type {boolean}
     */
    let painbow_mode = false;
    /**
     * Determines whether shapes can have diagonals
     *
     * @type {boolean}
     */
    let diagonal_shapes = false;
    /**
     * Determines whether the canvas needs to be refreshed or not
     *
     * @type {boolean}
     */
    let refresh_canvas = true;
    /**
     * Determines whether the score needs to be refreshed or not
     *
     * @type {boolean}
     */
    let refresh_score = false;
    /**
     * Determines whether the dom needs to be refreshed or not
     *
     * @type {boolean}
     */
    let refresh_dom = true;
    /**
     * Current player shape
     *
     * @type {Shape|null}
     */
    let current_shape = null;
    /**
     * Bottom grid shadow of the current shape
     *
     * @type {Shape|null}
     */
    let current_shadow = null;
    /**
     * Current game state
     *
     * @type {'playing'|'pause'|'gameover'}
     */
    let game_state = 'playing';
    /**
     * Whether the loop should tick or not
     *
     * @type {Boolean}
     */
    let loop_cancel = false;
    /**
     * Current contents of OPTIONS
     *
     * @type {'empty'|'options'|'keybinds'}
     */
    let options_content = 'empty';
    /**
     * Moment of the last move, in ms
     *
     * @type {number}
     */
    let last_move;

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
            end = UNITS[unit].units[e] || `e${e * 3}`;
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
     * Updates the score
     */
    function update_score() {
        SCORE.innerText = beautify(score, trim_score);
    }
    /**
     * Displays the fps in the top left corner
     *
     * @param {number} fps
     */
    function show_fps(fps) {
        if (!fps) return;

        CONTEXT.strokeStyle = THEMES[theme].blockus[game_state].color;
        CONTEXT.strokeText(fps.toString(), 10, 10);
    }
    /**
     * Generates a random color
     *
     * @returns {string}
     */
    function random_color() {
        let color = '#000000'.replace(/0/g, () => Math.floor(Math.random() * 16).toString(16));
        return color;
    }
    /**
     * Creates a random set of coordinates for a shape
     *
     * @returns { {
     *  coords: [number, number][];
     *  color: string;
     *  center: [number, number];
     * } }
     */
    function random_shape() {
        // Generate coordinates
        let length = Math.round(Math.random() * (SHAPE_SIZE[1] - SHAPE_SIZE[0])) + SHAPE_SIZE[0];
        let rolled = [0, 0];
        let coords = [rolled];
        for (let i = 0; i < length - 1; i++) {
            let max = 4 + diagonal_shapes * 4;
            rolled = [...rolled];
            let roll = Math.floor(Math.random() * max);
            switch (roll) {
                // normal
                case 1:
                    rolled[0]++;
                    break;
                case 2:
                    rolled[0]--;
                    break;
                case 3:
                    rolled[1]++;
                    break;
                case 4:
                    rolled[1]--;
                    break;
                // diagonals
                case 5:
                    rolled[0]++;
                    rolled[1]++;
                    break;
                case 6:
                    rolled[0]--;
                    rolled[1]++;
                    break;
                case 7:
                    rolled[0]++;
                    rolled[1]--;
                    break;
                case 8:
                    rolled[0]--;
                    rolled[1]--;
                    break;
            }
            if (coords.some(r => r[0] == rolled[0] && r[1] == rolled[1])) i--;
            else coords.push(rolled);
        }

        // Make sure everything is above 0
        for (let i = 0; i < 2; i++) {
            while (coords.some(r => r[i] < 0)) {
                coords.forEach(r => {
                    r[i]++;
                });
            }
        }

        // Select central coords
        let max = [0, 0];
        coords.forEach(c => {
            max[0] = Math.max(c[0], max[0]);
            max[1] = Math.max(c[1], max[1]);
        });
        let center = [Math.floor(max[0] / 2), Math.floor(max[1] / 2)];

        // Get shape color
        let color = '#000000';
        if (!rainbow_shapes) {
            /**
             * @type { {[key: number]: string[]} }
             */
            let map = {};

            for (let i = 0; i <= max[0]; i++) {
                map[i] = Array(max[1] + 1);
                map[i].fill(' ');
            }
            coords.forEach(c => {
                map[c[0]][c[1]] = '■';
            });
            let key = Object.values(map).map(l => l.join('')).join('|');

            if (!(key in SHAPE_COLORS)) SHAPE_COLORS[key] = random_color();
            color = SHAPE_COLORS[key];
        } else if (!rainbow_blocks) {
            color = random_color();
        }

        return {
            coords,
            color,
            center,
        };
    }
    /**
     * Resets the current shape
     */
    function reset_shape() {
        let {coords, color, center} = random_shape();
        current_shape = new Shape(color, coords, Math.floor(BOARD_SIZE[0] / 2), 0, center);
        current_shadow = current_shape.get_shadow();
    }
    /**
     * Gets the opposite of a color in either black or white
     *
     * @param {string} color
     * @returns {string}
     */
    function anti_bicolor(color) {
        let red = 0;
        let green = 0;
        let blue = 0;
        let result = '#';

        if (color.startsWith('#')) color = color.slice(1);
        if (color.length == 3) {
            red = parseInt(color.substr(0, 1), 16) * 0x11;
            green = parseInt(color.substr(1, 1), 16) * 0x11;
            blue = parseInt(color.substr(2, 1), 16) * 0x11;
        } else {
            red = parseInt(color.substr(0, 2), 16);
            green = parseInt(color.substr(2, 2), 16);
            blue = parseInt(color.substr(4, 2), 16);
        }

        if ((red + green + blue) / 3 > 127) {
            result += '000000';
        } else {
            result += 'ffffff';
        }

        return result;
    }
    /**
     * Empties the canvas display
     */
    function canvas_reset() {
        CANVAS.style.width = (BLOCK_SIZE[0] * BOARD_SIZE[0]) + 'px';
        CANVAS.style.height = (BLOCK_SIZE[1] * BOARD_SIZE[1]) + 'px';
        SCORE.style.width = (BLOCK_SIZE[0] * BOARD_SIZE[0]) + 'px';
        CANVAS.width = BLOCK_SIZE[0] * BOARD_SIZE[0];
        CANVAS.height = BLOCK_SIZE[1] * BOARD_SIZE[1];
    }
    /**
     * Refreshes the canvas contents
     */
    function canvas_refresh() {
        canvas_reset();
        Block.GRID.sort((a, b) => {
            if (b._y != a._y) return b._y - a._y;
            return b._x - a._x;
        }).forEach(b => b.draw());

        if (current_shadow) current_shadow.draw();
        if (current_shape) current_shape.draw();

        refresh_canvas = false;
    }
    /**
     * Applies the selected theme styles to the DOM
     */
    function dom_styles_apply() {
        let chosen = THEMES[theme];

        CANVAS.style.backgroundColor = chosen.blockus[game_state].background;
        SCORE.style.backgroundColor = chosen.score.background;
        SCORE.style.color = chosen.score.color;
        SCORE.style.textAlign = 'right';
    }
    /**
     * Launches the game
     */
    function init() {
        options_load();
        keybinds_load();

        canvas_reset();
        dom_styles_apply();
        reset_shape();

        let almost_paused = false;
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
        document.getElementById('select_options').addEventListener('click', e => {
            destroy_options();
            if (options_content != 'options') {
                options_create();
                options_content = 'options';
            } else {
                options_save();
                options_content = 'empty';
            }
        });
        document.getElementById('select_keybinds').addEventListener('click', e => {
            destroy_options();
            if (options_content != 'keybinds') {
                keybinds_create();
                options_content = 'keybinds';
            } else {
                keybinds_save();
                options_content = 'empty';
            }
        });

        last_move = Date.now();
        requestAnimationFrame(loop);
    }
    /**
     * Resets the game
     */
    function reset() {
        loop_cancel = true;

        for (let shape in SHAPE_COLORS) {
            delete SHAPE_COLORS[shape];
        }
        Block.GRID.length = 0;
        score = 0;
        game_state = 'playing';
        update_score();
        reset_shape();
        canvas_refresh();

        loop_cancel = false;
    }
    /**
     * Main game loop
     */
    function loop() {
        let now = Date.now();
        let diff = now - last_move;
        let fps = 1 / (diff / 1e3);
        diff /= 5e2;
        last_move = now;

        canvas_refresh();
        show_fps(Math.round(fps));

        if (!loop_cancel) {
            descend(diff);

            if (!current_shadow) {
                current_shadow = current_shape.get_shadow();
            }

            if (refresh_score) {
                update_score();
            }
            if (refresh_dom) {
                dom_styles_apply();
            }
        }

        requestAnimationFrame(loop);
    }
    /**
     * Moves the current shape down
     *
     * If it can't move down, it creates a new one
     *
     * @param {number} diff
     */
    function descend(diff = 1) {
        if (!current_shape || game_state != 'playing' || diff <= 0) return;

        if (current_shape.can_move(DIRECTION.down, diff)) {
            current_shape.move(DIRECTION.down, diff);
        } else {
            current_shape.add_to_grid();
            current_shape = null;
            current_shadow = null;

            // Check rows
            check_rows();

            // Check game over
            if (Block.GRID.some(b => b._y < 0)) {
                game_state = 'gameover';
                refresh_dom = true;
                current_shadow = null;
            }

            // Reset current shape
            reset_shape();
        }
    }
    /**
     * Checks for any now row
     *
     * Awards bonus points when a row is completed
     */
    function check_rows() {
        /**
         * @type {number[]}
         */
        let rows = [];
        for (let i = 0; i < BOARD_SIZE[1]; i++) {
            if (Block.GRID.filter(b => b._y == i).length == BOARD_SIZE[0]) rows.push(i);
        }
        if (!rows.length) return;

        for (let i of rows) {
            while (Block.GRID.filter(b => b._y == i).length) {
                let j = Block.GRID.findIndex(b => b._y == i);
                Block.GRID.splice(j, 1);
            }
            Block.GRID.filter(b => b._y < i).forEach(b => b.move(DIRECTION.down, 1, true));
        }

        // Neat popup for points gained
        let gain = Math.round(rows.length ** 1.75) * 100;

        make_popup(gain, CANVAS.offsetTop + Math.max(...rows) * BLOCK_SIZE[1], CANVAS.offsetLeft + (BOARD_SIZE[0] / 2 - 1) * BLOCK_SIZE[0]);

        // Update score
        score += gain;
        refresh_score = true;
    }
    /**
     * Creates a neat popup
     *
     * @param {String} text
     * @param {Number} top where it is from the top of the page
     * @param {Number} left where it is from the left of the page
     * @param {...String} cls CSS classes to add to the popup, if empty defaults to popup
     */
    function make_popup(text, top, left, ...cls) {
        if (!cls.length) cls.push('popup');

        let popup = document.createElement('div');
        popup.classList.add(...cls);
        popup.style.top = `${top}px`;
        popup.style.left = `${left}px`;
        popup.innerText = text;
        document.body.appendChild(popup);
        setTimeout(() => {
            popup.parentElement.removeChild(popup);
        }, 1e3);
    }
    /**
     * Calls the action that corresponds to the key pressed
     *
     * @this {CANVAS}
     * @param {KeyboardEvent} e
     */
    function keydown(e) {
        if (game_state in KEYBINDS) {
            let key = e.key.toLowerCase();
            let actions = KEYBINDS[game_state][key];
            if (!actions?.length) return;

            for (let action of actions) {
                if (!(action in ACTIONS)) return;
                ACTIONS[action].func();
            }
        } else {
            console.error(`Unknown game state: "${game_state}"`);
        }
        e.preventDefault();
    }
    /**
     * Creates the option fields
     */
    function options_create() {
        function make_theme() {
            let theme_row = document.createElement('tr');
            let theme_label_cell = document.createElement('td');
            let theme_select_cell = document.createElement('td');
            let theme_label = document.createElement('label');
            let theme_select = document.createElement('select');

            theme_row.appendChild(theme_label_cell);
            theme_row.appendChild(theme_select_cell);
            theme_label_cell.appendChild(theme_label);
            theme_select_cell.appendChild(theme_select);

            theme_label.innerText = gettext('game_blockus_option_theme');

            for (let id in THEMES) {
                let option = document.createElement('option');
                if (id == theme) option.selected = true;
                option.value = id;
                option.innerText = THEMES[id].name;
                theme_select.appendChild(option);
            }

            theme_select.addEventListener('change', e => option_update('theme', theme_select.value, e));

            return theme_row;
        }
        function make_block_width() {
            let width_row = document.createElement('tr');
            let width_label_cell = document.createElement('td');
            let width_cell = document.createElement('td');
            let width_label = document.createElement('label');
            let width = document.createElement('input');

            width_row.appendChild(width_label_cell);
            width_row.appendChild(width_cell);
            width_label_cell.appendChild(width_label);
            width_cell.appendChild(width);

            width_label.innerText = gettext('game_blockus_option_block_width');
            width.type = 'number';
            width.min = 1;
            width.value = BLOCK_SIZE[0];

            width.addEventListener('change', e => {
                if (confirm(gettext('game_blockus_warn_option_reset'))) option_update('block_width', width.value, e);
            });

            return width_row;
        }
        function make_block_height() {
            let height_row = document.createElement('tr');
            let height_label_cell = document.createElement('td');
            let height_cell = document.createElement('td');
            let height_label = document.createElement('label');
            let height = document.createElement('input');

            height_row.appendChild(height_label_cell);
            height_row.appendChild(height_cell);
            height_label_cell.appendChild(height_label);
            height_cell.appendChild(height);

            height_label.innerText = gettext('game_blockus_option_block_height');
            height.type = 'number';
            height.min = 1;
            height.value = BLOCK_SIZE[1];

            height.addEventListener('change', e => {
                if (confirm(gettext('game_blockus_warn_option_reset'))) option_update('block_height', height.value, e);
            });

            return height_row;
        }
        function make_block_shape() {
            let shape_row = document.createElement('tr');
            let shape_label_cell = document.createElement('td');
            let shape_select_cell = document.createElement('td');
            let shape_label = document.createElement('label');
            let shape_select = document.createElement('select');

            shape_row.appendChild(shape_label_cell);
            shape_row.appendChild(shape_select_cell);
            shape_label_cell.appendChild(shape_label);
            shape_select_cell.appendChild(shape_select);

            shape_label.innerText = gettext('game_blockus_option_shape');

            for (let id in BLOCK_SHAPES) {
                let option = document.createElement('option');
                if (id == block_shape) option.selected = true;
                option.value = id;
                option.innerText = BLOCK_SHAPES[id].name;
                shape_select.appendChild(option);
            }

            shape_select.addEventListener('change', e => option_update('shape', shape_select.value, e));

            return shape_row;
        }
        function make_units() {
            let unit_row = document.createElement('tr');
            let unit_label_cell = document.createElement('td');
            let unit_select_cell = document.createElement('td');
            let unit_label = document.createElement('label');
            let unit_select = document.createElement('select');

            unit_row.appendChild(unit_label_cell);
            unit_row.appendChild(unit_select_cell);
            unit_label_cell.appendChild(unit_label);
            unit_select_cell.appendChild(unit_select);

            unit_label.innerText = gettext('game_blockus_option_unit');

            for (let id in UNITS) {
                let option = document.createElement('option');
                if (id == unit) option.selected = true;
                option.value = id;
                option.innerText = UNITS[id].name;
                unit_select.appendChild(option);
            }

            unit_select.addEventListener('change', e => option_update('unit', unit_select.value, e));

            return unit_row;
        }
        function make_shape_size_min() {
            let size_min_row = document.createElement('tr');
            let size_min_label_cell = document.createElement('td');
            let size_min_cell = document.createElement('td');
            let size_min_label = document.createElement('label');
            let size_min = document.createElement('input');

            size_min_row.appendChild(size_min_label_cell);
            size_min_row.appendChild(size_min_cell);
            size_min_label_cell.appendChild(size_min_label);
            size_min_cell.appendChild(size_min);

            size_min_label.innerText = gettext('game_blockus_option_block_size_min');
            size_min.type = 'number';
            size_min.min = 1;
            size_min.value = SHAPE_SIZE[0];

            size_min.addEventListener('change', e => option_update('size_min', size_min.value, e));

            return size_min_row;
        }
        function make_shape_size_max() {
            let size_max_row = document.createElement('tr');
            let size_max_label_cell = document.createElement('td');
            let size_max_cell = document.createElement('td');
            let size_max_label = document.createElement('label');
            let size_max = document.createElement('input');

            size_max_row.appendChild(size_max_label_cell);
            size_max_row.appendChild(size_max_cell);
            size_max_label_cell.appendChild(size_max_label);
            size_max_cell.appendChild(size_max);

            size_max_label.innerText = gettext('game_blockus_option_block_size_max');
            size_max.type = 'number';
            size_max.min = 1;
            size_max.value = SHAPE_SIZE[1];

            size_max.addEventListener('change', e => option_update('size_max', size_max.value, e));

            return size_max_row;
        }
        function make_board_width() {
            let width_row = document.createElement('tr');
            let width_label_cell = document.createElement('td');
            let width_cell = document.createElement('td');
            let width_label = document.createElement('label');
            let width = document.createElement('input');

            width_row.appendChild(width_label_cell);
            width_row.appendChild(width_cell);
            width_label_cell.appendChild(width_label);
            width_cell.appendChild(width);

            width_label.innerText = gettext('game_blockus_option_board_width');
            width.type = 'number';
            width.min = 1;
            width.value = BOARD_SIZE[0];

            width.addEventListener('change', e => {
                if (confirm(gettext('game_blockus_warn_option_reset'))) option_update('board_width', width.value, e);
            });

            return width_row;
        }
        function make_board_height() {
            let height_row = document.createElement('tr');
            let height_label_cell = document.createElement('td');
            let height_cell = document.createElement('td');
            let height_label = document.createElement('label');
            let height = document.createElement('input');

            height_row.appendChild(height_label_cell);
            height_row.appendChild(height_cell);
            height_label_cell.appendChild(height_label);
            height_cell.appendChild(height);

            height_label.innerText = gettext('game_blockus_option_board_height');
            height.type = 'number';
            height.min = 1;
            height.value = BOARD_SIZE[1];

            height.addEventListener('change', e => {
                if (confirm(gettext('game_blockus_warn_option_reset'))) option_update('board_height', height.value, e);
            });

            return height_row;
        }
        function make_trim_score() {
            let trim_row = document.createElement('tr');
            let trim_label_cell = document.createElement('td');
            let trim_cell = document.createElement('td');
            let trim_label = document.createElement('label');
            let trim = document.createElement('input');

            trim_row.appendChild(trim_label_cell);
            trim_row.appendChild(trim_cell);
            trim_label_cell.appendChild(trim_label);
            trim_cell.appendChild(trim);

            trim_label.innerText = gettext('game_blockus_option_trim_score');
            trim.type = 'checkbox';
            trim.checked = trim_score;

            trim.addEventListener('change', e => {
                option_update('trim_score', trim.checked, e);
            });

            return trim_row;
        }
        function make_rainbow_shapes() {
            let rainbow_row = document.createElement('tr');
            let rainbow_label_cell = document.createElement('td');
            let rainbow_cell = document.createElement('td');
            let rainbow_label = document.createElement('label');
            let rainbow = document.createElement('input');

            rainbow_row.appendChild(rainbow_label_cell);
            rainbow_row.appendChild(rainbow_cell);
            rainbow_label_cell.appendChild(rainbow_label);
            rainbow_cell.appendChild(rainbow);

            rainbow_label.innerText = gettext('game_blockus_option_rainbow_shapes');
            rainbow.type = 'checkbox';
            rainbow.checked = rainbow_shapes;

            rainbow.addEventListener('change', e => {
                option_update('rainbow_shapes', rainbow.checked, e);
            });

            return rainbow_row;
        }
        function make_rainbow_blocks() {
            let rainbow_row = document.createElement('tr');
            let rainbow_label_cell = document.createElement('td');
            let rainbow_cell = document.createElement('td');
            let rainbow_label = document.createElement('label');
            let rainbow = document.createElement('input');

            rainbow_row.appendChild(rainbow_label_cell);
            rainbow_row.appendChild(rainbow_cell);
            rainbow_label_cell.appendChild(rainbow_label);
            rainbow_cell.appendChild(rainbow);

            rainbow_label.innerText = gettext('game_blockus_option_rainbow_blocks');
            rainbow.type = 'checkbox';
            rainbow.checked = rainbow_blocks;

            rainbow.addEventListener('change', e => {
                option_update('rainbow_blocks', rainbow.checked, e);
            });

            return rainbow_row;
        }
        function make_painbow_mode() {
            let painbow_row = document.createElement('tr');
            let painbow_label_cell = document.createElement('td');
            let painbow_cell = document.createElement('td');
            let painbow_label = document.createElement('label');
            let painbow = document.createElement('input');

            painbow_row.appendChild(painbow_label_cell);
            painbow_row.appendChild(painbow_cell);
            painbow_label_cell.appendChild(painbow_label);
            painbow_cell.appendChild(painbow);

            painbow_label.innerText = gettext('game_blockus_option_painbow_mode');
            painbow.type = 'checkbox';
            painbow.checked = painbow_mode;

            painbow.addEventListener('change', e => {
                option_update('painbow_mode', painbow.checked, e);
            });

            return painbow_row;
        }
        function make_diagonals() {
            let diagonals_row = document.createElement('tr');
            let diagonals_label_cell = document.createElement('td');
            let diagonals_cell = document.createElement('td');
            let diagonals_label = document.createElement('label');
            let diagonals = document.createElement('input');

            diagonals_row.appendChild(diagonals_label_cell);
            diagonals_row.appendChild(diagonals_cell);
            diagonals_label_cell.appendChild(diagonals_label);
            diagonals_cell.appendChild(diagonals);

            diagonals_label.innerText = gettext('game_blockus_option_diagonals');
            diagonals.type = 'checkbox';
            diagonals.checked = diagonal_shapes;

            diagonals.addEventListener('change', e => {
                option_update('diagonal_shapes', diagonals.checked, e);
            });

            return diagonals_row;
        }

        let rows = [make_theme, make_block_width, make_block_height,
            make_block_shape, make_units, make_shape_size_min,
            make_shape_size_max, make_board_width, make_board_height,
            make_trim_score, make_rainbow_shapes, make_rainbow_blocks,
            make_painbow_mode, make_diagonals,
        ];

        for (let r of rows) {
            OPTIONS.appendChild(r());
        }
    }
    /**
     * Updates an option's effect on the game
     *
     * @param {string} option_name
     * @param {any} value
     * @param {Event} e
     */
    function option_update(option_name, value, e) {
        switch(option_name) {
            // Selects
            case 'theme':
                if (value in THEMES) theme = value;
                else {
                    let i = Object.keys(THEMES).indexOf(theme);
                    /** @type {HTMLSelectElement} */
                    let target = e.target;
                    target.selectedIndex = i;
                }
                return;
            case 'shape':
                if (value in BLOCK_SHAPES) block_shape = value;
                else {
                    let i = Object.keys(BLOCK_SHAPES).indexOf(block_shape);
                    /** @type {HTMLSelectElement} */
                    let target = e.target;
                    target.selectedIndex = i;
                }
                return;
            case 'unit':
                if (value in UNITS) unit = value;
                else {
                    let i = Object.keys(UNITS).indexOf(unit);
                    /** @type {HTMLSelectElement} */
                    let target = e.target;
                    target.selectedIndex = i;
                }
                return;
            // Numbers
            case 'block_width':
                if (value >= 1) {
                    BLOCK_SIZE[0] = +value;
                    reset();
                } else {
                    /** @type {HTMLInputElement} */
                    let target = e.target;
                    target.value = BLOCK_SIZE[0];
                }
                return;
            case 'block_height':
                if (value >= 1) {
                    BLOCK_SIZE[1] = +value;
                    reset();
                } else {
                    /** @type {HTMLInputElement} */
                    let target = e.target;
                    target.value = BLOCK_SIZE[1];
                }
                return;
            case 'board_width':
                if (value >= 1) {
                    BOARD_SIZE[0] = +value;
                    reset();
                } else {
                    /** @type {HTMLInputElement} */
                    let target = e.target;
                    target.value = BOARD_SIZE[0];
                }
                return;
            case 'board_height':
                if (value >= 1) {
                    BOARD_SIZE[1] = +value;
                    reset();
                } else {
                    /** @type {HTMLInputElement} */
                    let target = e.target;
                    target.value = BOARD_SIZE[1];
                }
                return;
            // Ranges
            case 'size_min':
                if (value >= 1 && value <= SHAPE_SIZE[1]) SHAPE_SIZE[0] = +value;
                else if (value > SHAPE_SIZE[1]) SHAPE_SIZE[0] = SHAPE_SIZE[1];
                {/** @type {HTMLInputElement} */
                let target = e.target;
                target.value = SHAPE_SIZE[0];}
                return;
            case 'size_max':
                if (value >= 1 && value >= SHAPE_SIZE[0]) SHAPE_SIZE[1] = +value;
                else if (value < SHAPE_SIZE[0]) SHAPE_SIZE[1] = SHAPE_SIZE[0];
                {/** @type {HTMLInputElement} */
                let target = e.target;
                target.value = SHAPE_SIZE[1];}
                return;
            // Booleans
            case 'trim_score':
                trim_score = !!value;
                return;
            case 'rainbow_shapes':
                rainbow_shapes = !!value;
                return;
            case 'rainbow_blocks':
                rainbow_blocks = !!value;
                return;
            case 'painbow_mode':
                painbow_mode = !!value;
                return;
            case 'diagonal_shapes':
                diagonal_shapes = !!value;
                return;
            // Default
            default:
                console.error(`Unknown option: "${option_name}"`);
                return;
        }
    }
    /**
     * Saves the options to the localstorage
     */
    function options_save() {
        let options = {
            // Selects
            theme, block_shape, unit,
            // Numbers
            block_size: BLOCK_SIZE, board_size: BOARD_SIZE,
            // Ranges
            shape_size: SHAPE_SIZE,
            // Booleans
            trim_score, rainbow_shapes, rainbow_blocks, diagonal_shapes, //painbow_mode,
        };

        let json = JSON.stringify(options);
        localStorage.setItem('blockus_options', json);
    }
    /**
     * Retrives the options from the localstorage
     */
    function options_load() {
        let json = localStorage.getItem('blockus_options');

        if (!json) return;

        let options;
        try {
            options = JSON.parse(json);
        } catch {
            localStorage.removeItem('blockus_options');
            return;
        }

        // Selects
        let _theme = options.theme ?? theme;
        if (_theme in THEMES) theme = _theme;

        let _block_shape = options.block_shape ?? block_shape;
        if (_block_shape in THEMES) block_shape = _block_shape;

        let _unit = options.unit ?? unit;
        if (_unit in UNITS) unit = _unit;

        // Numbers
        let _block_size = options.block_size ?? BLOCK_SIZE;
        for (let i = 0; i < 2; i++) {
            if (isNaN(_block_size[i])) continue;
            BLOCK_SIZE[i] = +(_block_size[i] ?? BLOCK_SIZE[i]);
        }

        let _board_size = options.board_size ?? BOARD_SIZE;
        for (let i = 0; i < 2; i++) {
            if (isNaN(_board_size[i])) continue;
            BOARD_SIZE[i] = +(_board_size[i] ?? BOARD_SIZE[i]);
        }

        // Ranges
        let _shape_size = options.shape_size ?? SHAPE_SIZE;
        for (let i = 0; i < 2; i++) {
            if (isNaN(_shape_size[i])) continue;
            SHAPE_SIZE[i] = +(_shape_size[i] ?? SHAPE_SIZE[i]);
        }
        if (SHAPE_SIZE[0] > SHAPE_SIZE[1]) {
            [SHAPE_SIZE[0], SHAPE_SIZE[1]] = [SHAPE_SIZE[1], SHAPE_SIZE[0]];
        }

        // Booleans
        trim_score = !!(options.trim_score ?? trim_score);

        rainbow_shapes = !!(options.rainbow_shapes ?? rainbow_shapes);

        rainbow_blocks = !!(options.rainbow_blocks ?? rainbow_blocks);

        painbow_mode = !!(options.painbow_mode ?? painbow_mode);

        diagonal_shapes = !!(options.diagonal_shapes ?? diagonal_shapes);
    }
    /**
     * Creates the keybinds fields
     */
    function keybinds_create() {
        /**
         * @param {'playing'|'pause'|'gameover'} name
         * @param { {[key: string]: string[]} } keygroup
         */
        function make_keygroup(name, keygroup) {
            let group = document.createElement('tbody');
            let group_head_row = document.createElement('tr');
            let group_head_cell = document.createElement('td');
            let group_head = document.createElement('b');

            group.appendChild(group_head_row);
            group_head_row.appendChild(group_head_cell);
            group_head_cell.appendChild(group_head);
            group_head.innerText = {
                'playing': "{{ gettext('game_blockus_keybinds_group_playing') }}",
                'pause': "{{ gettext('game_blockus_keybinds_group_pause') }}",
                'gameover': "{{ gettext('game_blockus_keybinds_group_gameover') }}",
            }[name];

            for (let [action, keys] of Object.entries(keygroup)) {
                /**
                 * @param {string} key
                 * @param {number} index
                 */
                function make_cell(key) {
                    let cell = document.createElement('td');
                    let input = document.createElement('input');

                    input.type = 'text';
                    input.value = key;
                    input.title = "{{ gettext('game_blockus_keybind_leave_blank_tip') }}";

                    input.addEventListener('change', e => {
                        keybind_update(name, action, input.value, key);

                        key = input.value;
                    });

                    cell.appendChild(input);
                    return cell;
                }

                let row = document.createElement('tr');
                let action_cell = document.createElement('td');
                let add_button = document.createElement('button');

                row.appendChild(action_cell);
                keys.map(make_cell).forEach(e => row.appendChild(e));
                row.appendChild(add_button);

                action_cell.innerText = ACTIONS[action].name;
                add_button.innerText = '➕';
                add_button.addEventListener('click', () => {
                    let cell = make_cell('', row.children.length - 2);
                    row.insertBefore(cell, add_button);
                });

                group.appendChild(row);
            }

            OPTIONS.appendChild(group);
        }

        /**
         * @type { {[key: string]: string[]} }
         */
        let playing = {};
        /**
         * @type { {[key: string]: string[]} }
         */
        let pause = {};
        /**
         * @type { {[key: string]: string[]} }
         */
        let gameover = {};
        let complete = {playing, pause, gameover};
        let actions = Object.keys(ACTIONS);

        for (let id of actions) {
            playing[id] = [];
            pause[id] = [];
            gameover[id] = [];
        }
        for (let state of Object.keys(KEYBINDS)) {
            /**
             * @type { {[key: string]: string[]} }
             */
            let target_map = complete[state];
            /**
             * @type { {[key: string]: string[]} }
             */
            let target_source = KEYBINDS[state];

            for (let [key, actions] of Object.entries(target_source)) {
                for (let action of actions) {
                    if (!target_map[action].includes(key)) target_map[action].push(key);
                }
            }
        }

        Object.entries(complete).forEach(([name, group]) => make_keygroup(name, group));
    }
    /**
     * Updates a keybind
     *
     * @param {'playing'|'pause'|'gameover'} group_id
     * @param {string} action
     * @param {string} key If empty, removes the previous key
     * @param {string} previous
     */
    function keybind_update(group_id, action, key, previous) {
        if (!(group_id in KEYBINDS)) return;

        let group = KEYBINDS[group_id];

        if (previous != '') {
            if (!(previous in group)) return;

            let actions = group[previous];

            if (!actions.includes(action)) return;

            let i = actions.indexOf(action);
            actions.splice(i, 1);
        }
        if (key != '') {
            key = key.toLowerCase();
            if (!(key in group)) group[key] = [];
            group[key].push(action);
        }
    }
    /**
     * Saves the keybinds to the localstorage
     */
    function keybinds_save() {
        /**
         * @type { {[key: string]: string[]} }
         */
        let playing = {};
        /**
         * @type { {[key: string]: string[]} }
         */
        let pause = {};
        /**
         * @type { {[key: string]: string[]} }
         */
        let gameover = {};
        let complete = {playing, pause, gameover};
        let actions = Object.keys(ACTIONS);

        for (let id of actions) {
            playing[id] = [];
            pause[id] = [];
            gameover[id] = [];
        }
        for (let state of Object.keys(KEYBINDS)) {
            /**
             * @type { {[key: string]: string[]} }
             */
            let target_map = complete[state];
            /**
             * @type { {[key: string]: string[]} }
             */
            let target_source = KEYBINDS[state];

            for (let [key, actions] of Object.entries(target_source)) {
                for (let action of actions) {
                    if (!target_map[action].includes(key)) target_map[action].push(key);
                }
            }
        }

        let json = JSON.stringify(complete);

        localStorage.setItem('blockus_keybinds', json);
    }
    /**
     * Retrives the keybinds from the localstorage
     */
    function keybinds_load() {
        let json = localStorage.getItem('blockus_keybinds');

        if (!json) return;

        /**
         * @type { {
         *  playing: {
         *      [key: string]: string[];
         *  };
         *  pause: {
         *      [key: string]: string[];
         *  };
         *  gameover: {
         *      [key: string]: string[];
         *  };
         * } }
         */
        let keybinds;
        try {
            keybinds = JSON.parse(json);
        } catch {
            localStorage.removeItem('blockus_keybinds');
            return;
        }

        for (let state of Object.keys(keybinds)) {
            if (!(state in KEYBINDS)) continue;

            /**
             * @type { {[key: string]: string[]} }
             */
            let target_map = KEYBINDS[state];
            /**
             * @type { {[key: string]: string[]} }
             */
            let target_source = keybinds[state];

            for (let [key, actions] of Object.entries(target_source)) {
                key = key.toLowerCase();
                for (let action of actions) {
                    if (!(action in ACTIONS)) continue;

                    if (!(key in target_map)) target_map[key] = [action];
                    else if (!target_map[key].includes(action)) target_map[key].push(action);
                }
            }
        }
    }
    /**
     * Empties the options
     */
    function destroy_options() {
        OPTIONS.textContent = '';
    }
    /**
     * Mixes 2 colors and returns the average
     *
     * @param {string} colora
     * @param {string} colorb
     * @returns {string}
     */
    function blend_colors(colora, colorb) {
        if (colora.startsWith('#')) colora = colora.slice(1);
        if (colorb.startsWith('#')) colorb = colorb.slice(1);

        if (colora.length == 3) {
            colora = colora[0].repeat(2) + colora[1].repeat(2) + colora[2].repeat(2);
        }
        if (colorb.length == 3) {
            colorb = colorb[0].repeat(2) + colorb[1].repeat(2) + colorb[2].repeat(2);
        }

        let colorc = '#';
        for (let i = 0; i < 6; i+=2) {
            let a = parseInt(colora.slice(i, i+2), 16);
            let b = parseInt(colorb.slice(i, i+2), 16);
            colorc += Math.round((a + b) / 2).toString(16).padStart(2, '0');
        }

        return colorc;
    }

    class Block {
        /**
         * Game grid
         *
         * @private
         * @type {Block[]}
         */
        static _GRID = [];
        /**
         * Game grid
         *
         * @constant
         * @type {Block[]}
         */
        static get GRID() {
            return this._GRID;
        }
        /**
         * Checks if a pair of coordinates are out of bounds
         *
         * @param {[number, number]} coords Coords as [x, y]
         * @returns {boolean}
         */
        static out_of_bounds(coords) {
            for (let i = 0; i < 2; i++) {
                if (coords[i] < 0 || coords[i] > BOARD_SIZE[i] - 1) return true;
            }
            return false;
        }

        /**
         * Creates a new block
         *
         * @param {string} color - The color of the block
         * @param {number} x - The x position of the block
         * @param {number} y - The y position of the block
         */
        constructor(color, x, y, transparent = false) {
            if (!/^#[0-9a-f]{3}([0-9a-f]{3})?$/.test(color)) {
                throw new Error('invalid block color');
            }
            if (typeof x !== 'number') {
                throw new Error('invalid block x coordinate');
            }
            if (typeof y !== 'number') {
                throw new Error('invalid block y coordinate');
            }
            if (rainbow_blocks) color = random_color();
            this._transparent = !!transparent;
            this._color = color;
            this._x = x;
            this._y = y;
        }
        /**
         * Draws the block
         */
        draw() {
            if (painbow_mode && rainbow_blocks) {
                this._color = random_color();
            }

            let start_x = this._x * BLOCK_SIZE[0];
            let start_y = this._y * BLOCK_SIZE[1];

            for (let path of BLOCK_SHAPES[block_shape].paths) {
                // Close path
                path = [...path, path[0]];
                CONTEXT.moveTo(start_x + path[0][0], start_y + path[0][1]);
                CONTEXT.beginPath();
                for (let i = 1; i < path.length; i++) {
                    let point = path[i];
                    CONTEXT.lineTo(start_x + point[0] * BLOCK_SIZE[0], start_y + point[1] * BLOCK_SIZE[1]);
                }

                CONTEXT.closePath();
                CONTEXT.fillStyle = this._color;
                CONTEXT.strokeStyle = this._transparent ? '#777' : anti_bicolor(this._color);
                CONTEXT.stroke();
                CONTEXT.fill();
            }
        }
        /**
         * Checks whether the block can move in a given direction
         *
         * @param {DIRECTION} dir
         * @param {number} [amount]
         * @returns {boolean}
         */
        can_move(dir, amount = 1) {
            let target_x = this._x + dir[1] * amount;
            let target_y = this._y + dir[0] * amount;

            if (this.out_of_bounds([target_x, target_y])) return false;

            target_x = Math.round(target_x);
            target_y = Math.round(target_y);

            return !Block.GRID.some(b => b._x == target_x && b._y == target_y);
        }
        /**
         * Moves the block in a given direction
         *
         * @param {DIRECTION} dir
         * @param {number} [amount]
         * @param {boolean} [force] True if you really want it move in a direction
         */
        move(dir, amount = 1, force = false) {
            if (!this.can_move(dir, amount) && !force) return;

            this._x = Math.floor((this._x + dir[1] * amount) * 100) / 100;
            this._y = Math.floor((this._y + dir[0] * amount) * 100) / 100;

            refresh_canvas = true;
        }
        /**
         * Shoves a block in the grid
         */
        add_to_grid() {
            // We don't exist
            if (this.out_of_bounds()) return;

            this._x = Math.round(this._x);
            this._y = Math.round(this._y);

            let i;
            if (i = Block.GRID.findIndex(b => b._x == this._x && b._y == this._y) != -1) {
                if (Block.GRID[i] != this) return; // Already in, let's leave

                // There's already a block there, so we replace its data
                Block.GRID[i]._color = this._color;
            } else {
                Block.GRID.push(this);
            }
        }
        /**
         * Checks if a pair of coordinates are out of bounds
         *
         * @param {[number, number]|null} coords Coords as [x, y], if null checks the block itself
         * @returns {boolean}
         */
        out_of_bounds(coords = null) {
            coords ??= [this._x, this._y];
            return Block.out_of_bounds(coords);
        }
    }
    class Shape {
        /**
         * Creates a new shape
         *
         * @param {string} color The color of the shape
         * @param {[number, number][]} coords The relative coordinates of the shape's blocks
         * @param {number} x The x position of the center block
         * @param {number} y The y position of the center block
         * @param {[number, number]} center Potentially non existant block that serves as the center of all rotations
         */
        constructor(color, coords, x, y, center = [0, 0], transparent = false) {
            if (!/^#[0-9a-f]{3}([0-9a-f]{3})?$/.test(color)) {
                throw new Error('invalid shape color');
            }
            if (typeof x !== 'number') {
                throw new Error('invalid shape x coordinate');
            }
            if (typeof y !== 'number') {
                throw new Error('invalid shape y coordinate');
            }
            if (!Array.isArray(coords)) {
                throw new Error('invalid shape blocks coordinate');
            }
            if (!Array.isArray(center)) {
                throw new Error('invalid shape center coordinate');
            }
            this._transparent = !!transparent;
            this._center = [center[0] + x, center[1] + y];
            /**
             * @type {Block[]}
             */
            this._blocks = [];
            coords.forEach(c => {
                this._blocks.push(new Block(color, c[0] + x, c[1] + y, !!transparent));
            });
        }
        /**
         * Draws the shape
         */
        draw() {
            /**
             * Only used in painbow_mode
             *
             * @type {false|string}
             */
            let color = false;
            if (painbow_mode && !rainbow_blocks && rainbow_shapes) {
                color = random_color();
            }
            this._blocks.forEach(b => {
                if (painbow_mode && !rainbow_blocks && rainbow_shapes) {
                    b._color = color;
                }
                b.draw();
            })
        }
        /**
         * Checks if the shape can move in a given direction
         *
         * @param {DIRECTION} dir
         * @param {number} [amount]
         * @returns {boolean}
         */
        can_move(dir, amount = 1) {
            return this._blocks.every(b => b.can_move(dir, amount));
        }
        /**
         * Moves the block in a given direction
         *
         * @param {DIRECTION} dir
         * @param {number} [amount]
         * @param {boolean} [force] True if you really want it move in a direction
         */
        move(dir, amount = 1, force = false) {
            if (!this.can_move(dir, amount) && !force) return;

            this._blocks.forEach(b => b.move(dir, amount, force));
            this._center[0] = Math.floor((this._center[0] +dir[1] * amount) * 100) / 100;
            this._center[1] = Math.floor((this._center[1] +dir[0] * amount) * 100) / 100;
        }
        /**
         * Checks if the shape can rotate in a given direction
         *
         * @param {boolean} clockwise
         * @returns {boolean}
         */
        can_rotate(clockwise = true) {
            let center = this._center;
            let [x_center, y_center] = center;
            let can_rotate = true;

            this._blocks.forEach(b => {
                if (!can_rotate) return;

                /**
                 * Start X
                 */
                let x_start = b._x - x_center;
                /**
                 * End X
                 */
                let x_end = b._x - x_center;
                /**
                 * Start Y
                 */
                let y_start = b._y - y_center;
                /**
                 * End Y
                 */
                let y_end = b._y - y_center;

                // Rotate
                if (clockwise) {
                    x_end += (x_start + y_start) * -1;
                    y_end += x_start - y_start;
                } else {
                    x_end += y_start - x_start;
                    y_end += (x_start + y_start) * -1;
                }

                // Offset by the central block
                x_end += x_center;
                y_end += y_center;

                if (Block.out_of_bounds([x_end, y_end]) || Block.GRID.some(b => b[0] == x_end && b[1] == y_end))
                    can_rotate = false;
            });
            return can_rotate;
        }
        /**
         * Rotates the shape
         *
         * @param {boolean} clockwise
         * @param {boolean} force True if you really want to rotate the shape
         */
        rotate(clockwise = true, force = false) {
            if (!this.can_rotate(clockwise) && !force) return;

            let center = this._center;
            let [x_center, y_center] = center;

            this._blocks.forEach(b => {
                /**
                 * Start X
                 */
                let x_start = b._x - x_center;
                /**
                 * End X
                 */
                let x_end = b._x - x_center;
                /**
                 * Start Y
                 */
                let y_start = b._y - y_center;
                /**
                 * End Y
                 */
                let y_end = b._y - y_center;

                // Rotate
                if (clockwise) {
                    x_end += (x_start + y_start) * -1;
                    y_end += x_start - y_start;
                } else {
                    x_end += y_start - x_start;
                    y_end += (x_start + y_start) * -1;
                }

                // Offset by the central block
                x_end += x_center;
                y_end += y_center;

                // Move the block itself
                b._x = x_end;
                b._y = y_end;
            });
            refresh_canvas = true;
        }
        /**
         * Adds every block to the grid
         */
        add_to_grid() {
            this._blocks.forEach(b => b.add_to_grid());
        }
        /**
         * Returns the lowest placed version of this shape
         *
         * It's also transparent!
         *
         * @returns {Shape}
         */
        get_shadow() {
            let color = blend_colors(this._blocks[0]._color, THEMES[theme].blockus[game_state].background);
            let coords = this._blocks.map(b => [Math.round(b._x), Math.round(b._y)]);
            let center = [...this._center.map(Math.round)];

            let clone = new Shape(color, coords, 0, 0, center, true);

            while(clone.can_move(DIRECTION.down)) clone.move(DIRECTION.down);

            return clone;
        }
    }

    init();
//})();
