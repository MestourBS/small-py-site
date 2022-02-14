import { mouse_position } from './actions.js';
import { get_theme_value as theme } from './display.js';
import globals from './globals.js';
import { check_can_afford, draw as draw_inventory } from './inventory.js';
import Machine from './machine.js';
import { MakerMachine, time_speed } from './maker.js';
import { Pane } from './pane.js';
import { beautify, stable_pad_number, number_between } from './primitives.js';
import Resource from './resource.js';
import StorageMachine, { space_boost } from './storage.js';
/**
 * @typedef {keyof game_tabs} GameTab
 */

//todo change draw to draw different parts of the canvas as required
//todo show resources sources
//todo changelog tab
//todo prevent flickering gain
//todo unlockable tabs
//todo reduce impact of resources tab

/**
 * Canvas of the game
 *
 * @type {HTMLCanvasElement}
 */
export const canvas = document.getElementById('cidle_game');
/**
 * For drawing on the canvas
 *
 * @type {CanvasRenderingContext2D}
 */
export const context = canvas.getContext('2d');
export const display_size = {
    get x() { return canvas.width; },
    get y() { return canvas.height; },
    get width() { return canvas.width; },
    get height() { return canvas.height; },
    /** @type {[number, number][]} */
    get corners() { return [[0, 0], [0, this.height], [this.width, this.height], [this.width, 0]]; },
};
const game_tabs = {
    world: {
        reset: true,
        name: gettext('games_cidle_tab_world'),
        /** @type {false|string[]} @private */
        _cut_name: false,
        /** @type {false|string} @private */
        _cut_params: false,
        cut_name(params) {
            const p = JSON.stringify(params);
            if (this._cut_params != p) {
                this._cut_name = cut_lines(this.name, params);
                this._cut_params = p;
            }
            return this._cut_name;
        },
        draw: () => {
            draw_grid();
            MakerMachine.maker_machines.filter(m => m.can_produce()).forEach(m => m.draw_connections({context}));
            Machine.visible_machines.forEach(m => m.draw({context}));
            Pane.get_visible_panes('world').forEach(p => p.draw({context}));

            let {x, y, event} = mouse_position;
            globals.adding[globals.game_tab]?.draw?.(x, y, event);
        },
    },
    inventory: {
        reset: true,
        name: gettext('games_cidle_tab_inventory'),
        /** @type {false|string[]} @private */
        _cut_name: false,
        /** @type {false|string} @private */
        _cut_params: false,
        cut_name(params) {
            const p = JSON.stringify(params);
            if (this._cut_params != p) {
                this._cut_name = cut_lines(this.name, params);
                this._cut_params = p;
            }
            return this._cut_name;
        },
        draw: ({top=0}={}) => {
            draw_inventory({context, top});
            Pane.get_visible_panes('inventory').forEach(p => p.draw({context}));
        },
        click: event => check_can_afford(),
    },
    resources: {
        reset: false,
        name: gettext('games_cidle_tab_resources'),
        /** @type {false|string[]} @private */
        _cut_name: false,
        /** @type {false|string} @private */
        _cut_params: false,
        /** @returns {string} */
        cut_name(params) {
            const p = JSON.stringify(params);
            if (this._cut_params != p) {
                this._cut_name = cut_lines(this.name, params);
                this._cut_params = p;
            }
            return this._cut_name;
        },
        /**
         * @type {{
         *  speed?: {amount?: number, height?: number},
         *  space?: {amount?: number, height?: number},
         *  resources?: {[resource: string]: {amount?: string, max?: string, per_second?: string, index?: number}},
         *  rows?: number,
         *  y?: number,
         * }}
         */
        data: {},
        draw() {
            const data = this.data;
            data.resources ??= {};

            const x = theme('tab_padding');
            let y = theme('tab_padding') + tabs_heights();
            const speed = time_speed();
            const space = space_boost();
            const font_size = theme('font_size');
            const dont_width = ['res'];
            /**
             * @type {{
             *  res: string,
             *  name: string,
             *  amount: string,
             *  max: string,
             *  per_second: string,
             * }[]}
             */
            const table = Resource.all_resources().map(res => {
                const {amount, max} = StorageMachine.stored_resource(res);
                if (!max) return;

                let per_second = MakerMachine.maker_machines.filter(m => {
                    if (m.paused || !m.can_produce()) return false;

                    return m.consumes.some(([r]) => r == res) || m.produces.some(([r]) => r == res);
                }).reduce((ps, m) => {
                    const pro = m.produces.find(([r]) => r == res);
                    const mult = m.max_produce_multiplier();
                    const con = m.consumes.find(([r]) => r == res);
                    return ps + ((pro?.[1] ?? 0) - (con?.[1] ?? 0)) * mult;
                }, 0);
                if (Math.abs(per_second) < 1e-3) per_second = 0;

                return {res, amount, max, per_second};
            }).filter(d => d != null).sort((a, b) => {
                if (!globals.stable_resource_order) {
                    if (a.max != b.max) return a.max - b.max;
                    if (a.per_second != b.per_second) return a.per_second - b.per_second;
                    if (a.amount != b.amount) return a.amount - b.amount;
                }
                return a.res > b.res;
            }).map(res_data => {
                const {res, amount, max, per_second} = res_data;
                const {name} = Resource.resource(res);

                let a = `${stable_pad_number(beautify(amount))}`;
                let ps = '';

                if (per_second) {
                    ps = beautify(per_second);
                    if (per_second > 0) ps = `+${ps}`;
                    ps += '/s';
                }
                let m = `/${beautify(max)}`;

                return {res, name, amount: a, max: m, per_second: ps};
            });
            const rows = Math.min(((speed != 1) + (space != 1)) * 2, 3) + table.length;
            if (rows != data.rows || y != data.y) {
                canvas_reset();
                data.resources = {};
                data.space = {};
                data.speed = {};
                data.rows = rows;
                data.y = y;
            }

            const max_width = display_size.width / (Object.keys(table[0]).length + (speed != 1) - dont_width.length);

            /** @type {{[k: string]: number}} */
            const table_widths = table.reduce((widths, res_data) => {
                Object.entries(res_data).forEach(([key, value]) => {
                    if (dont_width.includes(key)) return;
                    widths[key] = Math.min(max_width, Math.max(widths[key] ?? 0, context.measureText(value).width));
                });
                return widths;
            }, {});

            // Show time speed
            if (speed != 1) {
                data.speed ??= {};
                if (data.speed.amount != speed) {
                    data.speed.amount = speed;
                    const speed_str = gettext('games_cidle_time_speed', {speed: beautify(speed)});
                    const cut_time_speed = cut_lines(speed_str);
                    canvas_write(speed_str, x, y);
                    data.speed.height = (cut_time_speed.length + .5) * font_size;
                }
                y += data.speed.height;
            }

            // Show space multiplier
            if (space != 1) {
                data.space ??= {};
                if (data.space.amount != space) {
                    data.space.amount = space;
                    const space_str = gettext('games_cidle_space_boost', {space: beautify(space)});
                    const cut_space_boost = cut_lines(space_str);
                    canvas_write(space_str, x, y);
                    data.space.height = (cut_space_boost.length + .5) * font_size;
                }
                y += data.space.height;
            }

            // Space between timespace bonuses and the rest
            if (speed != 1 || space != 1) y += font_size;


            table.forEach((res_data, i) => {
                const {res, amount, max, per_second} = res_data;
                const own_data = (data.resources[res] ??= {});
                const redraw_all = own_data.index != i;

                const {color} = Resource.resource(res);
                const background_color = Resource.resource(res).background_color ?? 'white';

                const height = (Object.values(res_data).map(s => cut_lines(s, {max_width}).length).reduce((h, l) => Math.max(h, l), 0) + .5) * font_size;
                let data_x = x;

                Object.entries(res_data).forEach(([key, value]) => {
                    if (!(key in table_widths)) return;

                    const width = table_widths[key] + grid_spacing;

                    if (redraw_all || value != own_data[key]) {
                        if (background_color) {
                            context.fillStyle = background_color;
                            context.fillRect(data_x, y, width, height);
                        }

                        canvas_write(value, data_x, y, {base_text_color: color});
                    }

                    data_x += width;
                });
                if (speed != 1 && res != 'time' && per_second) {
                    canvas_write(`x${beautify(speed)}`, data_x, y, {base_text_color: color});
                }

                y += height;
                own_data.amount = amount;
                own_data.index = i;
                own_data.max = max;
                own_data.per_second = per_second;
            });
        },
        click() {
            canvas_reset();
            this.data.resources = {};
            this.data.space = {};
            this.data.speed = {};
            this.data.rows = 0;
            this.data.y = 0;
        },
    },
    help: {
        reset: false,
        name: gettext('games_cidle_tab_help'),
        /** @type {false|string[]} @private */
        _cut_name: false,
        /** @type {false|string} @private */
        _cut_params: false,
        /** @returns {string} */
        cut_name(params) {
            const p = JSON.stringify(params);
            if (this._cut_params != p || !this._cut_name) {
                this._cut_name = cut_lines(this.name, params);
                this._cut_params = p;
            }
            return this._cut_name;
        },
        /**
         * @type {{
         *  machines_text_lines?: string[],
         *  inventory_text_lines?: string[],
         *  resources_text_lines?: string[],
         *  machines_text_checks?: Set<string>,
         *  drawn: boolean,
         * }}
         */
        data: {},
        draw() {
            const data = this.data;
            if (data.drawn) return;
            canvas_reset();

            const x = theme('tab_padding');
            let y = theme('tab_padding') + tabs_heights();

            /** @type {string[]} */
            const machines_text = (data.machines_text_lines ??= [
                '{bold}' + gettext('games_cidle_help_machine_title'),
                gettext('games_cidle_help_machine_intro'),
                gettext('games_cidle_help_machine_pane'),
                gettext('games_cidle_help_machine_type'),
                gettext('games_cidle_help_machine_pause'),
                gettext('games_cidle_help_machine_move'),
            ]);
            const machines_checks = (data.machines_text_checks ??= new Set);
            if (!machines_checks.has('upgrade') && Machine.machines.some(m => m.level > 0 || m.can_upgrade)) {
                machines_text.push(gettext('games_cidle_help_machine_upgrade'));
                machines_checks.add('upgrade');
            }
            if (!machines_checks.has('optional') && MakerMachine.maker_machines.some(m => m.produces.some(([,,o=false]) => o))) {
                machines_text.push(gettext('games_cidle_help_machine_optional'));
                machines_checks.add('optional');
            }
            if (!machines_checks.has('unpausable') && MakerMachine.maker_machines.some(m => m.unpausable && m.is_visible)) {
                machines_text.push(gettext('games_cidle_help_machine_unpausable'));
                machines_checks.add('unpausable');
            }
            if (!machines_checks.has('time') && StorageMachine.any_storage_for('time')) {
                machines_text.push(gettext('games_cidle_help_machine_time'));
                machines_checks.add('time');
            }
            if (!machines_checks.has('space') && StorageMachine.any_storage_for('space')) {
                machines_text.push(gettext('games_cidle_help_machine_space'));
                machines_checks.add('space');
            }

            /** @type {string[]} */
            const inventory_text = (data.inventory_text_lines ??= [
                '{bold}' + gettext('games_cidle_help_inventory_title'),
                gettext('games_cidle_help_inventory_intro'),
                gettext('games_cidle_help_inventory_craft'),
                gettext('games_cidle_help_inventory_place'),
                gettext('games_cidle_help_inventory_unlock'),
            ]);

            /** @type {string[]} */
            const resources_text = (data.resources_text_lines ??= [
                '{bold}' + gettext('games_cidle_help_resources_title'),
                gettext('games_cidle_help_resources_intro'),
            ]);

            const text = [
                ...machines_text,
                ' ',
                ...inventory_text,
                ' ',
                ...resources_text,
            ];

            text.map(l => cut_lines(l, {max_width: display_size.width - x * 2}))
                .flat()
                .forEach(line => {
                    canvas_write(line, x, y);
                    y += theme('font_size') * 1.1;
                });

            data.drawn = true;
        },
        click() {
            canvas_reset();
            this.data.drawn = false;
        },
    },
};
/**
 * Regex for color matching in text writing
 *
 * @type {RegExp}
 */
export const regex_modifier = /(?<!\\)\{(.+?)\}/g;
/**
 * Regex for escaped color matching
 *
 * @type {RegExp}
 */
const regex_not_modifier = /\\\{.+?\}/g;
/**
 * Cache of splits
 *
 * As {`font` => `line` => `lines`}
 *
 * @type {{[font: string]: {
 *  [line: string]: string[],
 * }}}
 */
const pre_split = {};
/**
 * List of existing modifier types, for shortened usages
 *
 * @type {string[]}
 */
const modifier_types = ['color', 'italic', 'bold'];
const max_tabs_per_line = 5;
export const grid_spacing = 50;

/**
 * Empties the canvas display
 */
function canvas_reset() {
    const width = canvas.parentElement.offsetWidth;
    const height = canvas.parentElement.offsetHeight - 25;

    if (canvas.width != width || canvas.height != height) {
        canvas.style.width = `${width}px`;
        canvas.width = width;
        canvas.style.height = `${height}px`;
        canvas.height = height;
    } else {
        const c = context.fillStyle;
        context.fillStyle = 'white';
        context.fillRect(0, 0, width, height);
        context.fillStyle = c;
    }
}
/**
 * Refreshes the canvas contents
 */
export function canvas_refresh() {
    const {game_tab} = globals;

    let top = tabs_heights({context});

    if (game_tab in game_tabs) {
        const tab = game_tabs[game_tab];

        if (tab.reset) canvas_reset();

        tab.draw({top});
    } else {
        console.error(`Unknown game tab ${game_tab}`);
    }

    draw_tabs({context});
}
/**
 * Draws the tabs
 *
 * @param {Object} [params]
 * @param {CanvasRenderingContext2D} [params.context]
 * @returns {number}
 */
function draw_tabs({context=canvas.getContext('2d')}={}) {
    /** @type {GameTab[]} */
    const tabs = Object.keys(game_tabs);
    if (tabs.length <= 1) return 0;

    const padding = theme('tab_padding');
    const max_width = (display_size.width - padding * 2) / Math.min(max_tabs_per_line, tabs.length);
    /** @type {[GameTab, string[]][]} [tab, name (as lines)][] */
    const cut = tabs.map(tab => [tab, game_tabs[tab].cut_name({context, max_width})]);
    const y_diff = (Math.max(...cut.map(([_,name]) => name.length)) + .5) * theme('font_size') + padding * 2;

    let x = 0;
    let y = 0;
    for (const [id, name] of cut) {
        const selected = id == globals.game_tab;
        const text_color = theme(selected ? 'tab_selected_text_color_fill' : 'tab_text_color_fill');
        const tab_color = theme(selected ? 'tab_selected_color_fill' : 'tab_color_fill');
        const tab_border = theme('tab_color_border');

        // Draw tab
        context.fillStyle = tab_color;
        context.strokeStyle = tab_border;
        context.beginPath();
        context.moveTo(x * max_width, y * y_diff);
        context.lineTo(x * max_width, (y + 1) * y_diff);
        context.lineTo((x + 1) * max_width, (y + 1) * y_diff);
        context.lineTo((x + 1) * max_width, y * y_diff);
        context.lineTo(x * max_width, y * y_diff);
        context.fill();
        context.stroke();
        context.closePath();

        // Draw tab text
        canvas_write(name, x * max_width + padding, y * y_diff + padding, {base_text_color: text_color, context});

        // Move tab position
        x = (x + 1) % max_tabs_per_line;
        y += (x == 0);
    }
    y += (x != 0);

    return y * y_diff;
}
/**
 * Draws a light grid
 */
function draw_grid() {
    context.strokeStyle = theme('grid_color_border');
    context.beginPath();
    let x = -grid_spacing - globals.position[0] % grid_spacing + canvas.width / 2 % grid_spacing;
    let y = -grid_spacing - globals.position[1] % grid_spacing + canvas.height / 2 % grid_spacing;
    for (;x < canvas.width; x += grid_spacing) {
        if (x <= 0) continue;
        context.moveTo(x, 0);
        context.lineTo(x, canvas.height);
    }
    for (;y < canvas.height; y += grid_spacing) {
        if (y <= 0) continue;
        context.moveTo(0, y);
        context.lineTo(canvas.width, y);
    }
    context.stroke();
    context.closePath();
}
/**
 * Computes the tabs heights
 *
 * @param {Object} [params]
 * @param {CanvasRenderingContext2D} [params.context]
 * @returns {number}
 */
export function tabs_heights({context=canvas.getContext('2d')}={}) {
    /** @type {GameTab[]} */
    const tabs = Object.keys(game_tabs);
    if (tabs.length <= 1) return 0;


    const padding = theme('tab_padding');
    const max_width = (display_size.width - padding * 2) / Math.min(max_tabs_per_line, tabs.length);
    /** @type {[GameTab, string[]][]} [tab, name (as lines)][] */
    const cut = tabs.map(tab => [tab, game_tabs[tab].cut_name({context, max_width})]);
    const y_diff = (Math.max(...cut.map(([_,name]) => name.length)) + .5) * theme('font_size') + padding * 2;
    const tabs_lines = Math.ceil(tabs.length / max_tabs_per_line);

    return y_diff * tabs_lines;
}
/**
 * Performs a click on the tabs
 *
 * @param {number} x
 * @param {number} y
 * @param {MouseEvent} event
 */
export function click(x, y, event) {
    /** @type {GameTab[]} */
    const tabs = Object.keys(game_tabs);
    if (tabs.length <= 1) return 0;
    const padding = theme('tab_padding');
    const max_width = (display_size.width - padding * 2) / Math.min(max_tabs_per_line, tabs.length);
    /** @type {[GameTab, string[]][]} [tab, name (as lines)][] */
    const cut = tabs.map(tab => [tab, game_tabs[tab].cut_name({context, max_width})]);
    const y_diff = (Math.max(...cut.map(([_,name]) => name.length)) + .5) * theme('font_size') + padding * 2;

    const tab_x = Math.ceil(x / max_width) - 1;
    const tab_y = Math.ceil(y / y_diff) - 1;
    const tab_index = tab_x + tab_y * max_tabs_per_line;
    if (tab_index in tabs) {
        globals.game_tab = tabs[tab_index];

        if (globals.game_tab in game_tabs) game_tabs[globals.game_tab]?.click?.(event);
    }
}
/**
 * Writes text, with modifiers if you want, on the canvas
 *
 * @param {string[]|string} lines Lines to write. Any amount of backslashes will disable modifiers.
 * Modifiers, written between curly brackets, are the following:
 * - `color:<any color accepted by canvas>`: Changes the following text to that color
 * - `color:reset`: Changes the following text to the default color
 * - `color:random`: Changes the following text to constantly randomized color
 * - `color:rainbow:<saturation?>:<lightness?>`: Changes the following text to an everchanging rainbow,
 *  saturation and lightness can be added to it
 * - `italic:<true|false|toggle>`: Changes the following text to be or not be italic. Use true/false to force it.
 * - `bold:<true|false|toggle>`: Changes the following text to be or not be bold. Use true/false to force it.
 * @param {number} left Distance from left edge
 * @param {number} top Distance from top edge
 * @param {Object} [context_options]
 * @param {number} [context_options.min_left] Minimum distance from the left edge of the canvas
 * @param {number} [context_options.min_right] Minimum distance from the right edge of the canvas
 * @param {CanvasTextAlign} [context_options.text_align]
 * @param {CanvasTextBaseline} [context_options.text_baseline]
 * @param {string} [context_options.base_text_color]
 * @param {number} [context_options.font_size]
 * @param {CanvasRenderingContext2D} [context_options.context]
 */
export function canvas_write(lines, left, top, {
    min_left = -Infinity, min_right = 0, text_align = 'left', text_baseline = 'alphabetic', base_text_color = theme('text_color_fill'),
    font_size = theme('font_size'), context = canvas.getContext('2d'), font_family = theme('font_family'),
}={}) {
    lines = cut_lines(lines, left, {font_size, font_family, context, max_width: canvas.width - min_right - Math.max(min_left, left)});
    if (!lines.length) return;

    context.textAlign = text_align;
    context.textBaseline = text_baseline;
    context.fillStyle = base_text_color;

    const base_x = Math.max(left, min_left);
    /** @type {((type: string) => (modifier: string) => boolean)[]} */
    const selecting_functions = [
        type => modifier => modifier == type,
        type => modifier => modifier.startsWith(type),
        type => modifier => modifier.indexOf(type) != -1,
    ];
    /** @type {(args: string[]) => (index: number, def: string) => string} */
    const argument_getter = args => (index, def) => args[index] || def;

    // Draw text
    for (let i = 0; i < lines.length; i++) {
        const y = top + (i + 1) * font_size;
        if (y <= 0) continue;
        let x = base_x;
        const line = lines[i];

        if (line.match(regex_modifier)) {
            // Iterate over the pieces
            let modifier = false;
            let chunks = line.split(regex_modifier);
            for (let i = 0; i < chunks.length; i++) {
                if (modifier) {
                    let command = chunks[i].split(':');
                    let [type, ...args] = command;
                    let possibles = [];
                    /** @param {number} index @param {string} def @returns {string} */
                    const arg = argument_getter(args);
                    for (let f = 0; f < selecting_functions.length && !possibles.length; f++) {
                        let selector = selecting_functions[f];
                        possibles = modifier_types.filter(selector(type));
                    }
                    if (possibles.length == 1) {
                        type = possibles[0];
                    }

                    switch (type) {
                        case 'color':
                            let color = arg(0);
                            if (color.toLowerCase() == 'reset') color = base_text_color;
                            else if (color.toLowerCase() == 'rainbow') {
                                let saturation = arg(1);
                                if (isNaN(saturation)) saturation = '100'
                                let lightness = arg(2);
                                if (isNaN(lightness)) lightness = '50'
                                color = `hsl(${Date.now() / 10 % 360}, ${saturation}%, ${lightness}%)`;
                            }
                            context.fillStyle = color;
                            break;
                        case 'italic':
                            let italic = arg(0);
                            if (!['true', 'false', 'toggle'].includes(italic)) italic = 'toggle';
                            if (italic == 'toggle') {
                                italic = context.font.includes('italic') ? 'false' : 'true';
                            }
                            if (italic == 'true' && !context.font.includes('italic')) {
                                context.font = `italic ${context.font}`;
                            } else {
                                context.font = context.font.replace('italic', '');
                            }
                            break;
                        case 'bold':
                            let bold = arg(0);
                            if (!['true', 'false', 'toggle'].includes(bold)) bold = 'toggle';
                            if (bold == 'toggle') {
                                bold = context.font.includes('bold') ? 'false' : 'true';
                            }
                            if (bold == 'true' && !context.font.includes('bold')) {
                                context.font = `bold ${context.font}`;
                            } else {
                                context.font = context.font.replace('bold', '');
                            }
                            break;
                    }
                } else {
                    let text = chunks[i].replace(regex_not_modifier, n => n.slice(1));
                    context.fillText(text, x, y);
                    x += context.measureText(text).width;
                }
                modifier = !modifier;
            }
        } else {
            context.fillText(line.replace(regex_not_modifier, n => n.slice(1)), x, y);
        }
    }
}
/**
 * Cuts text into lines
 *
 * @param {string[]|string} lines Lines to write. Change color by writing `{color:<color>}`.
 *  Any amount of backslashes will disable colors. If color is `reset`, the color is reset back to its default value.
 * @param {Object} [context_options]
 * @param {number} [context_options.font_size]
 * @param {string} [context_options.font_family]
 * @param {CanvasRenderingContext2D} [context_options.context]
 * @param {number} [context_options.max_width] Max width of a single line
 * @returns {string[]}
 */
export function cut_lines(lines, {
    font_size = theme('font_size'), font_family = theme('font_family'),
    context = canvas.getContext('2d'), max_width = canvas.width,
}={}) {
    if (lines && !Array.isArray(lines)) lines = [lines];
    if (!lines?.length) return [];

    lines = lines.map(l => l + '');

    // Set text var
    context.font = `${font_size}px ${font_family}`;
    const longest_line = Math.max(...lines.map(l => context.measureText(l.replace(regex_modifier, '')).width));
    if (longest_line > max_width) {
        const own_splits = (pre_split[context.font] ??= {});

        lines = lines.map(line => {
            // If we have already split the line, we just skip the whole process
            if (line in own_splits) return own_splits[line];

            // Store colors and positions before removing them from the line
            // If they were kept, they would cause problems in both cutting and applying
            const modifiers_matches = [...line.matchAll(regex_modifier)];
            /** @type {[number, string][]} [index, fullcolor][] */
            const modifiers = [];
            modifiers_matches.forEach(match => {
                const less = modifiers.map(c => c[1].length).reduce((s, n) => s + n, 0);
                const index = match.index - less;
                modifiers.push([index, match[0]]);
            });

            line = line.replace(regex_modifier, '');
            const length = context.measureText(line).width;
            /** @type {string[]} */
            let slices = [];
            if (length <= max_width) slices = [line];
            else {
                const baseline = line;

                // Split, into words when possible
                const avg_char_width = length / line.length;
                while (context.measureText(line).width > max_width) {
                    // Approximate target character
                    let len = max_width / avg_char_width;
                    // Needs to be recreated every loop or it will cause problems
                    const regex_not_word = /[^\w]/g;

                    while (context.measureText(line.slice(0, len)).width < max_width) len++;
                    while (context.measureText(line.slice(0, len)).width > max_width) len--;

                    // Get previous non-alphanumeric if available
                    let slice = line.slice(0, len);
                    const separators = Array.from(new Set(slice.match(regex_not_word)));
                    if (separators.length) {
                        len = Math.max(...separators.map(s => slice.lastIndexOf(s)));
                        slice = line.slice(0, len);
                        // Remove spaces for a more fluid display
                        const separator = separators.find(s => slice.lastIndexOf(s) == len);
                        if (!separator?.trim?.()?.length) len++;
                    }

                    line = line.slice(len);

                    slices.push(slice);

                }

                slices.push(line);

                line = baseline;
            }
            // Put the colors back in the line(s)
            slices = slices.map((slice, index, slices) => {
                const index_start = slices.filter((_, i) => i < index).map(s => s.length).reduce((n, a) => n + a, 0);
                const index_end = index_start + slice.length;

                modifiers.filter(c => number_between(c[0], index_start, index_end))
                    .map(c => [...c])
                    .sort((a,b) => b[0]-a[0])
                    .forEach(/** @param {[number, string]} */([i, color]) => {
                        i -= index_start;
                        slice = slice.slice(0, i) + color + slice.slice(i);
                    });

                return slice;
            });
            // Store cut line, so we don't go through the whole process again
            own_splits[line] = slices;

            return slices;
        }).flat();
    }

    return lines;
}
/**
 * Returns whether the tab exists or not
 *
 * @param {string} tab
 * @returns {tab is GameTab}
 */
export function is_valid_tab(tab) {
    return tab in game_tabs;
}
