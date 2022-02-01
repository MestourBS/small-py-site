import { get_theme_value as theme } from './display.js';
import globals from './globals.js';
import { draw as draw_inventory } from './inventory.js';
import Machine from './machine.js';
import { MakerMachine } from './maker.js';
import { Pane } from './pane.js';
/**
 * @typedef {keyof game_tabs} GameTab
 */

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
        name: gettext('games_cidle_tab_world'),
        /** @type {false|string[]} */
        _cut_name: false,
        get cut_name() {
            if (this._cut_name == false) {
                this._cut_name = cut_lines(this.name);
            }
            return this._cut_name;
        },
        draw: () => {
            MakerMachine.maker_machines.filter(m => m.can_produce()).forEach(m => m.draw_connections({context}));
            Machine.visible_machines.forEach(m => m.draw({context}));
            Pane.get_visible_panes('world').forEach(p => p.draw({context}));
        },
    },
    inventory: {
        name: gettext('games_cidle_tab_inventory'),
        /** @type {false|string[]} */
        _cut_name: false,
        get cut_name() {
            if (this._cut_name == false) {
                this._cut_name = cut_lines(this.name);
            }
            return this._cut_name;
        },
        draw: ({top=0}={}) => {
            draw_inventory({context, top});
            Pane.get_visible_panes('inventory').forEach(p => p.draw({context}));
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
    canvas_reset();

    //todo draw tabs & highlight current tab & store position from top

    if (game_tab in game_tabs) {
        game_tabs[game_tab].draw({top: 0});
    } else {
        console.error(`Unknown game tab ${game_tab}`);
    }
}
/**
 * Draws the tabs
 *
 * @returns {number}
 */
function draw_tabs() {
    const tabs = Object.keys(game_tabs);

    //todo
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
    min_left = 0, min_right = 0, text_align = 'left', text_baseline = 'alphabetic', base_text_color = theme('text_color_fill'),
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
    if (!lines?.length) return [0, []];

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
                        if (!separator.trim().length) len++;
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
