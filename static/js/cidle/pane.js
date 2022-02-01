import { display_size, context as canvas_context, cut_lines, canvas_write, regex_modifier } from './canvas.js';
import { get_theme_value as theme } from './display.js';
import globals from './globals.js';
import { rect_contains_point, to_point } from './position.js';
import { array_group_by } from './primitives.js';
/**
 * @typedef {import('./canvas.js').GameTab} GameTab
 */

/**
 * @typedef {import('./position.js').PointLike} PointLike
 */

export class Pane {
    /** @type {{[id: string]: Pane}} */
    static #panes = {};
    /**
     * @type {{
     *  world: false|Pane[],
     *  inventory: false|Pane[],
     * }}
     */
    static #visible_panes = {};
    /** @type {[number, number]} */
    static #vis_pos = [NaN, NaN];

    static get panes() { return Object.values(this.#panes); }
    /**
     * Gets the visible panes of a tab
     *
     * @param {GameTab} tab
     * @returns {Pane[]}
     */
    static get_visible_panes(tab=globals.game_tab) {
        const pos = globals.position;
        if (pos.some((n, i) => this.#vis_pos[i] != n)) {
            this.#visible_panes[tab] = false;
            this.#vis_pos = [...pos];
        }
        if (!this.#visible_panes[tab]) {
            this.#visible_panes[tab] = this.panes.filter(p => p.tab == tab && p.is_visible);
        }
        return this.#visible_panes[tab];
    }
    /**
     * Gets the pane with a specific id
     *
     * @param {string} id
     * @returns {Pane|null}
     */
    static pane(id) {
        if (id in this.#panes) return this.#panes[id];
        return null;
    }

    /**
     * @param {Object} params
     * @param {number} params.x
     * @param {number} params.y
     * @param {boolean} [params.pinned] Whether the pane moves around with the focus
     * @param {string} params.id
     * @param {{content: (string|() => string)[], click?: (() => void)[], width?: number}[][]} [params.content]
     * @param {string|false} [params.title]
     * @param {GameTab} [params.tab]
     */
    constructor({x, y, pinned=false, id, content=[], title=false, tab=globals.game_tab}) {
        if (isNaN(x)) throw new TypeError(`Pane x must be a number (${x})`);
        if (isNaN(y)) throw new TypeError(`Pane y must be a number (${y})`);
        let is_valid_content = Array.isArray(content);
        is_valid_content &&= content.every(row => {
            if (!Array.isArray(row)) return false;

            return row.every(cell => {
                if (!('content' in cell) || !Array.isArray(cell.content)) return false;
                if (cell.content.some(t => typeof t == 'function')) this.#has_dynamic_cell = true;
                if ('click' in cell && (!Array.isArray(cell.click) || cell.click.some(f => typeof f != 'function'))) return false;
                if ('width' in cell && (isNaN(cell.width) || cell.width <= 0)) return false;
                return true;
            });
        });
        if (!is_valid_content) throw new TypeError(`Pane content must be a valid content table (${content})`);
        id += '';

        const title_bar = [
            {
                content: [() => (this.#pinned ? '{italic}' : '') + '📌'],
                click: [() => this.pin_toggle()],
            },
            {
                content: ['X'],
                click: [() => this.remove()],
            },
        ];
        if (title !== false) {
            title_bar.unshift({content: [`{bold}${title}`]});
        }
        content.forEach(row => {
            let len = row.map(cell => cell.width ?? 1).reduce((s, l) => s + l, 0);
            const last = row.length - 1;

            while (len < title_bar.length) {
                len++;
                row[last].width = (row[last].width ?? 1) + 1;
            }
        });
        content.unshift(title_bar);

        this.#x = x;
        this.#y = y;
        this.#pinned = !!pinned;
        this.#id = id;
        this.#content = content;
        this.#tab = tab;

        if (id in Pane.#panes) {
            Pane.#panes[id].remove();
        }
        Pane.#panes[id] = this;
        if (this.is_visible) {
            const panes = (Pane.#visible_panes[tab] ??= []);
            panes.push?.(this);
        }
    }

    #has_dynamic_cell = false;
    #x;
    #y;
    #pinned;
    #id;
    #content;
    /** @type {false|{content: string[], click?: (() => void)[], width?: number}[][]} */
    #cut_content = false;
    #tab;

    get x() { return this.#x; }
    get y() { return this.#y; }
    get pinned() { return this.#pinned; }
    get is_visible() {
        let {x, y} = this;

        x += display_size.width / 2 - globals.position[0];
        y += display_size.height / 2 - globals.position[1];
        const max_x = x + this.#table_widths().reduce((s, w) => s + w, 0);
        const max_y = y + this.#table_heights().reduce((s, h) => s + h, 0);

        return (x < display_size.width || max_x > 0) && (y < display_size.height || max_y > 0);
    }
    get id() { return this.#id; }
    get content() { return this.#cut_content ?? this.#content; }
    get tab() { return this.#tab; }

    /**
     * Cuts the content's cell text
     */
    #cut_content_lines({context=canvas_context}={}) {
        const longest_row = this.#content.map(row => {
            return row.map(c => c.width ?? 1).reduce((l, w) => l + w, 0);
        }).sort((a, b) => a - b)[0];
        const max_cell_width = display_size.width / longest_row;

        this.#cut_content = this.#content.map(row => {
            return row.map(cell => {
                let {content, click=false, width=false} = cell;

                content = content.map(c => typeof c == 'function' ? c() : c);

                /**
                 * @type {{
                 *  content: string[],
                 *  click?: (() => void)[],
                 *  width?: number,
                 * }}
                 */
                let copy = {content};
                if (click !== false) copy.click = click;
                if (width !== false) copy.width = width;

                if (copy.content.some(t => context.measureText(t).width > max_cell_width)) {
                    copy.content = copy.content.map(text => cut_lines(text, 0, {max_width: max_cell_width, context})).flat();
                }
                return copy;
            });
        });
    }

    /**
     * Calculates the widths of the content table columns
     */
    #table_widths({context=canvas_context}={}) {
        if (!this.#cut_content) this.#cut_content_lines({context});
        if (!this.#cut_content) return;
        // Turn rows into columns of cells
        const columns = array_group_by(this.#cut_content.map(row => {
            return row.map(/** @return {[{content: string[], click?: (() => void)[], width?: number}, number][]} */(c, i) => {
                let width = c.width ?? 1;
                let cols = [];
                for (let j = i; j < i + width; j++) cols.push([c, j]);
                return cols;
            });
        }).flat(2), ([_, i]) => i);

        const widths = [0];
        for (let [i, column] of columns) {
            widths[i] = Math.max(...column.map(([{content, width=1}]) => {
                return Math.max(...content.map(text => (context.measureText(text.replace(regex_modifier, '')).width + 10) / width));
            }));
        }
        return widths;
    }

    /**
     * Calculates the heights of the content table rows
     */
    #table_heights() {
        if (!this.#cut_content) this.#cut_content_lines({context});
        if (!this.#cut_content) return;

        const heights = [0];
        for (let [i, row] of Object.entries(this.#cut_content)) {
            heights[i] = Math.max(...row.map(({content}) => (content.length + .5) * theme('font_size')));
        }
        return heights;
    }

    /**
     * Checks whether the pane contains the point at [X, Y] (absolute in grid)
     *
     * @param {PointLike} point
     */
    contains_point(point) {
        point = to_point(point);
        if (this.#pinned) {
            point.x += display_size.width / 2 - globals.position[0];
            point.y += display_size.height / 2 - globals.position[1];
        }
        const width = this.#table_widths().reduce((s, w) => s + w, 0);
        const height = this.#table_heights().reduce((s, h) => s + h, 0);

        return rect_contains_point(point, this.#x, this.#x + width, this.#y, this.#y + height);
    }

    /**
     * Action to perform on click
     *
     * @param {number} x Absolute x position
     * @param {number} y Absolute y position
     * @param {MouseEvent} event
     */
    click(x, y, event) {
        if (this.#pinned) {
            x += display_size.width / 2 - globals.position[0];
            y += display_size.height / 2 - globals.position[1];
        }
        x -= this.x;
        y -= this.y;

        let x_grid = 0;
        let y_grid = -1;
        let x_checked = 0;
        let y_checked = 0;

        this.#table_heights().forEach(h => {
            if (y_checked >= y) return;

            y_grid++;
            y_checked += h;
        });
        this.#table_widths().forEach(w => {
            if (x_checked >= x) return;

            x_grid++;
            x_checked += w;
        });

        const row = this.#content[y_grid];
        let x_index = 0;
        /** @type {null|{content: (string | (() => string))[]; click?: (() => void)[]; width?: number;}} */
        let cell_selected = null;
        row.forEach(cell => {
            const min = x_index;
            const max = x_index + (cell.width ?? 1);
            if (min < x_grid && max >= x_grid) cell_selected = cell;
            x_index = max;
        });
        if (!cell_selected?.click?.length) return;
        cell_selected.click.forEach(f => f());
    }

    /**
     * Drags the pane
     *
     * @param {number} x Absolute x position
     * @param {number} y Absolute y position
     * @param {number} x_diff
     * @param {number} y_diff
     * @param {MouseEvent} event
     */
    drag(x, y, x_diff, y_diff, event) {
        if (this.#pinned) {
            x += display_size.width / 2 - globals.position[0];
            y += display_size.height / 2 - globals.position[1];
        }
        x -= this.x;
        y -= this.y;

        const space = 20;
        const width = this.#table_widths().reduce((s, w) => s + w, 0);
        if (x < -space || x > width + space) return;

        const heights = this.#table_heights();
        const in_range = y >= -space && y < space + heights[0];

        if (in_range) {
            this.#x += x_diff;
            this.#y += y_diff;
        }
    }

    /**
     * Removes a pane from the display
     */
    remove() {
        if (this.#id in Pane.#panes) delete Pane.#panes[this.#id];
        /** @type {number} */
        const i = Pane.#visible_panes[this.#tab].indexOf?.(this) ?? -1;
        if (!isNaN(i) && i != -1) Pane.#visible_panes[this.#tab].splice?.(i, 1);
        this.#id = null;
    }

    /**
     * Toggles whether the pane is pinned
     *
     * @param {Object} [params]
     * @param {boolean|'auto'} [params.set]
     */
    pin_toggle({set='auto'}={}) {
        if (set == 'auto') set = !this.#pinned;
        if (set != this.#pinned) {
            const x_change = display_size.width / 2 - globals.position[0];
            const y_change = display_size.height / 2 - globals.position[1];
            if (set) {
                this.#x += x_change;
                this.#y += y_change;
            } else {
                this.#x -= x_change;
                this.#y -= y_change;
            }
        }
        this.#pinned = set;
    }

    /**
     * Draws the pane
     *
     * @param {Object} [params]
     * @param {CanvasRenderingContext2D} [params.context]
     */
    draw({context=canvas_context}={}) {
        let {x, y} = this;
        if (!this.#pinned) {
            x += display_size.width / 2 - globals.position[0];
            y += display_size.height / 2 - globals.position[1];
        }
        const widths = this.#table_widths({context});
        const heights = this.#table_heights();
        const width = widths.reduce((s, w) => s + w, 0);
        const height = heights.reduce((s, h) => s + h, 0);

        context.fillStyle = theme('pane_color_fill');
        context.strokeStyle = theme('pane_color_border');
        context.beginPath();
        context.moveTo(x, y);
        context.lineTo(x + width, y);
        context.lineTo(x + width, y + height);
        context.lineTo(x, y + height);
        context.lineTo(x, y);
        context.fill();
        context.stroke();
        context.closePath();

        // Draw cells
        if (!this.#cut_content || this.#has_dynamic_cell) this.#cut_content_lines({context});
        if (!this.#cut_content) return;
        this.#cut_content.forEach((row, ry) => {
            const py = heights.filter((_, i) => i < ry).reduce((s, h) => s + h, 0) + y;
            const height = heights[ry];
            row.forEach((cell, cx) => {
                const px = widths.filter((_, i) => i < cx).reduce((s, w) => s + w, 0) + x;
                const width = widths.filter((_, i) => i >= cx && i < cx + (cell.width ?? 1)).reduce((s, w) => s + w, 0);

                // Draw cell borders
                context.strokeStyle = theme('pane_color_border');
                context.beginPath();
                context.moveTo(px, py);
                context.lineTo(px + width, py);
                context.lineTo(px + width, py + height);
                context.lineTo(px, py + height);
                context.lineTo(px, py);
                context.stroke();
                context.closePath();

                let ty = py;
                cell.content.forEach(t => {
                    canvas_write(t, px+5, ty, {context});
                    ty += theme('font_size');
                });
            });
        });
    }
}
