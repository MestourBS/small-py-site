import { display_size, context as canvas_context, cut_lines, canvas_write, regex_modifier } from './canvas.js';
import { get_theme_value as theme } from './display.js';
import globals from './globals.js';
import { rect_contains_point, to_point } from './position.js';
import { array_group_by } from './primitives.js';
/**
 * @typedef {import('./canvas.js').GameTab} GameTab
 * @typedef {import('./position.js').PointLike} PointLike
 *
 * @typedef {{content: (string|() => string)[], click?: (() => void)[], width?: number, color?: string, image?: string|HTMLImageElement}} PaneCell
 * @typedef {{content: string[], click?: (() => void)[], width?: number, color?: string, image?: HTMLImageElement}} CachedPaneCell
 */

//todo reduce impact of functions

export class Pane {
    /** @type {{[id: string]: Pane}} */
    static #panes = {};
    /**
     * @type {{[tab: string]: false|Pane[]}}
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
     * @param {PaneCell[][]} [params.content]
     * @param {string|false} [params.title]
     * @param {GameTab} [params.tab]
     * @param {boolean} [params.pinnable] Whether the tab can be (un)pinned afterwards
     */
    constructor({x, y, pinned=false, id, content=[], title=false, tab=globals.game_tab, pinnable=true}) {
        if (isNaN(x)) throw new TypeError(`Pane x must be a number (${x})`);
        if (isNaN(y)) throw new TypeError(`Pane y must be a number (${y})`);
        let has_dyn = false;
        const is_valid_content = Array.isArray(content) && content.every(row => {
            if (!Array.isArray(row)) return false;

            return row.every(cell => {
                if (!('content' in cell) || !Array.isArray(cell.content)) return false;
                if (cell.content.some(t => typeof t == 'function')) has_dyn = true;
                if ('click' in cell && (!Array.isArray(cell.click) || cell.click.some(f => typeof f != 'function'))) return false;
                if ('width' in cell && (isNaN(cell.width) || cell.width <= 0)) return false;
                return true;
            });
        });
        if (!is_valid_content) throw new TypeError(`Pane content must be a valid content table (${content})`);
        id += '';

        const title_bar = [
            {
                content: ['X'],
                click: [() => this.remove()],
            },
        ];
        if (pinnable) {
            title_bar.unshift({
                content: [() => (this.#pinned ? '{italic}' : '') + '📌'],
                click: [() => this.pin_toggle()],
            });
        }
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

        this.#has_dynamic_cell = has_dyn;
        this.#cache.x = x;
        this.#cache.y = y;

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
    /** @type {false|CachedPaneCell[][]} */
    #cut_content = false;
    #tab;
    #cache = {
        x: 0,
        y: 0,
        /** @type {number} */
        widest_row: null,
        width: 0,
        widths: {
            /** @type {number[]} */
            'static': [],
            /** @type {number[]} */
            'dynamic': [],
        },
        height: 0,
        heights: {
            /** @type {number[]} */
            'static': [],
            /** @type {number[]} */
            'dynamic': [],
        },
        /** @type {{content: string[]}[][]} */
        cells: [],
    };

    get x() { return this.#x; }
    set x(x) { if (!isNaN(x)) this.#x = x; }
    get y() { return this.#y; }
    set y(y) { if (!isNaN(y)) this.#y = y; }
    get pinned() { return this.#pinned; }
    get is_visible() {
        let {x, y} = this;

        if (!this.#pinned) {
            x += display_size.width / 2 - globals.position[0];
            y += display_size.height / 2 - globals.position[1];
        }
        const max_x = x + this.table_widths().reduce((s, w) => s + w, 0);
        const max_y = y + this.table_heights().reduce((s, h) => s + h, 0);

        return x < display_size.width && max_x > 0 && y < display_size.height && max_y > 0;
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
                let {content, click=false, width=false, color=null, image=null} = cell;

                content = content.map(c => typeof c == 'function' ? c() : c);
                let max_width = max_cell_width;

                /** @type {PaneCell} */
                let copy = {content, color};
                if (click !== false) copy.click = click;
                if (width !== false) copy.width = width;
                if (typeof image == 'string') {
                    let i = new Image(theme('font_size'), theme('font_size'));
                    i.src = image;
                    image = i;
                }
                if (image instanceof Image) {
                    copy.image = image;
                    max_width -= theme('font_size');
                }

                if (copy.content.some(t => context.measureText(t).width > max_width)) {
                    copy.content = copy.content.map(text => cut_lines(text, 0, {max_width, context})).flat();
                }
                return copy;
            });
        });
    }

    /**
     * Measures the cells' heights and widths, separated between dynamic and static
     */
    #measure_content({context=canvas_context}={}) {
        const cache = this.#cache;
        /**
         * @type {{
         *  heights: {static: number, dynamic: number,}[],
         *  widths: {static: number, dynamic: number,}[],
         *  widest_row: number,
         *  content: {content: string[], width: number, color: string, cols: number[], image?: HTMLImageElement}[][],
         * }}
         */
        const measures = {
            heights: [],
            widths: [],
            content: [],
        };
        const widest_row = measures.widest_row = this.#content.map(row => {
            return row.map(c => c.width ?? 1).reduce((l, w) => l + w, 0);
        }).sort((a, b) => a - b)[0];
        const max_cell_width = display_size.width / widest_row;
        const default_color = theme('pane_color_fill');

        this.#content.forEach((row, ri) => {
            const row_refresh = !(ri in cache.heights.static) || (ri in cache.heights.dynamic && cache.heights.dynamic[ri] > 0);
            const height = measures.heights[ri] ??= {static: cache.heights.static[ri] ?? 0, dynamic: 0};
            const mapped_row = measures.content[ri] ??= [];

            if (row_refresh) {
                let column = 0;
                row.forEach((cell, ci) => {
                    let {content} = cell;
                    const {width=1} = cell;
                    const dynamic = content.some(c => typeof c == 'function');
                    /** @type {'dynamic'|'static'} */
                    const type = dynamic ? 'dynamic' : 'static';
                    /** @type {number[]} */
                    const cols = [];
                    for (let i = 0; i < width; i++) {
                        cols.push(column + i);
                    }
                    column += width;
                    const cell_refresh = row_refresh || !(ri in cache.heights) || dynamic || cols.some(c => !(c in cache.widths[type]));
                    /** @type {{content: string[], width: number, color: string, image?: HTMLImageElement}} */
                    const cached_cell = {
                        width,
                        cols,
                        color: cell.color ?? default_color,
                        content: content.map(c => typeof c == 'function' ? c() : c),
                    };
                    if ('image' in cell) {
                        let {image} = cell;
                        if (image && !(image instanceof Image)) {
                            const i = new Image;
                            i.src = image;
                            cell.image = image = i;
                        }
                        cached_cell.image = image;
                    }

                    if (cell_refresh) {
                        const mapped = cached_cell.content;

                        const saved_widths = cols.map(c => measures.widths[c] ??= {static: 0, dynamic: 0});
                        const text_width = Math.min(max_cell_width, Math.max(...mapped.map(c => context.measureText(c.replaceAll(regex_modifier, '')).width )) / width + 10);
                        const text_height = mapped.map(c => cut_lines(c, {context, max_width: max_cell_width}).length)
                            .reduce((h, c) => h + c, 0);

                        height[type] = Math.max(height[type], text_height);
                        saved_widths.forEach(w => w[type] = Math.max(w[type], text_width));
                    }
                    mapped_row[ci] = cached_cell;
                });
            }
        });

        return measures;
    }

    /**
     * Calculates the widths of the content table columns
     */
    table_widths({context=canvas_context}={}) {
        return this.#measure_content({context}).widths.map(w => Math.max(w.static, w.dynamic));
    }

    /**
     * Calculates the heights of the content table rows
     */
    table_heights() {
        return this.#measure_content().heights.map(h => (Math.max(h.static, h.dynamic) + .5) * theme('font_size'));
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
        const width = this.table_widths().reduce((s, w) => s + w, 0);
        const height = this.table_heights().reduce((s, h) => s + h, 0);

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

        this.table_heights().forEach(h => {
            if (y_checked >= y) return;

            y_grid++;
            y_checked += h;
        });
        this.table_widths().forEach(w => {
            if (x_checked >= x) return;

            x_grid++;
            x_checked += w;
        });

        const row = this.#content[y_grid];
        if (!row) return;
        let x_index = 0;
        /** @type {null|PaneCell} */
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
     * Checks whether the cell containing the point at [X, Y] (absolute in grid) is clickable
     *
     * @param {PointLike} point
     * @returns {boolean}
     */
    is_clickable(point) {
        let {x, y} = to_point(point);
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

        this.table_heights().forEach(h => {
            if (y_checked >= y) return;

            y_grid++;
            y_checked += h;
        });
        this.table_widths().forEach(w => {
            if (x_checked >= x) return;

            x_grid++;
            x_checked += w;
        });

        const row = this.#content[y_grid];
        if (!row) return false;
        let x_index = 0;
        /** @type {null|PaneCell} */
        let cell_selected = null;
        row.forEach(cell => {
            const min = x_index;
            const max = x_index + (cell.width ?? 1);
            if (min < x_grid && max >= x_grid) cell_selected = cell;
            x_index = max;
        });

        return cell_selected && cell_selected.click?.length;
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
        this.#x += x_diff;
        this.#y += y_diff;
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
        const widths = this.table_widths({context});
        const heights = this.table_heights();
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
                const background = cell.color;

                // Draw cell borders
                context.strokeStyle = theme('pane_color_border');
                if (background) context.fillStyle = background;
                context.beginPath();
                context.moveTo(px, py);
                context.lineTo(px + width, py);
                context.lineTo(px + width, py + height);
                context.lineTo(px, py + height);
                context.lineTo(px, py);
                if (background) context.fill();
                context.stroke();
                context.closePath();

                let tx = px;
                let ty = py;
                if (cell.image) {
                    context.drawImage(cell.image, tx, ty, theme('font_size') * 1.25, theme('font_size') * 1.25);
                    tx += theme('font_size');
                }
                tx += 5;

                cell.content.forEach(t => {
                    canvas_write(t, tx, ty, {context});
                    ty += theme('font_size');
                });
            });
        });
    }

    /**
     * Draws the changed parts of the pane
     *
     * @param {Object} [params]
     * @param {CanvasRenderingContext2D} [params.context]
     */
    nw_draw({context=canvas_context}={}) {
        let {x, y} = this;
        const cache = this.#cache;
        const {widths, heights, widest_row, content} = this.#measure_content({context});
        const width = widths.reduce((w, width) => w + Math.max(width.dynamic, width.static), 0);
        const height = heights.reduce((h, height) => h + Math.max(height.dynamic, height.static), 0);
        if (!this.#pinned) {
            x += display_size.width / 2 - globals.position[0];
            y += display_size.height / 2 - globals.position[1];
        }
        const complete_redraw = x != cache.x || y != cache.y ||
            widest_row != cache.widest_row ||
            width != cache.width || height != cache.height;
        const font_size = theme('font_size');

        if (complete_redraw) {
            context.strokeStyle = theme('pane_color_border');
            context.beginPath();
            context.moveTo(x, y);
            context.lineTo(x + width, y);
            context.lineTo(x + width, y + (height + heights.length / 2) * font_size);
            context.lineTo(x, y + (height + heights.length / 2) * font_size);
            context.lineTo(x, y);
            context.stroke();
            context.closePath();
        }

        /** @type {number[]} */
        const rows_redrawn = [];
        const rows_checks = [
            () => complete_redraw,
            () => rows_redrawn.length > 0,
            /** @param {number} i */
            i => {
                const {dynamic: mhd, static: mhs} = heights[i];
                const chd = cache.heights.dynamic[i];
                const chs = cache.heights.static[i];
                return Math.max(mhd, mhs) != Math.max(chd, chs);
            },
        ];
        for (let i = 0; i < heights.length; i++) {
            if (rows_checks.some(c => c(i))) rows_redrawn.push(i);
        }
        /** @type {number[]} */
        const cols_redrawn = [];
        const cols_checks = [
            () => complete_redraw,
            () => cols_redrawn.length > 0,
            /** @param {number} i */
            i => {
                const {dynamic: mwd, static: mws} = widths[i];
                const cwd = cache.widths.dynamic[i];
                const cws = cache.widths.static[i];
                return Math.max(mwd, mws) != Math.max(cwd, cws);
            },
        ];
        for (let i = 0; i < widths.length; i++) {
            if (cols_checks.some(c => c(i))) cols_redrawn.push(i);
        }

        content.forEach((row, ri) => {
            const redraw_row = rows_redrawn.includes(ri);
            const py = y + heights.filter((_, i) => i < ri).reduce((s, h) => s + Math.max(h.dynamic, h.static) + .5, 0) * font_size;
            const height = Math.max(heights[ri].dynamic, heights[ri].static);
            const cache_row = (cache.cells[ri] ??= []);

            row.forEach((cell, ci) => {
                const redraw_cell = redraw_row || cols_redrawn.includes(ci) ||
                    !(cache_row[ci] ??= {}).content ||
                    JSON.stringify(cell.content) != JSON.stringify(cache.cells[ri][ci].content);

                if (!redraw_cell) return;

                const px = x + widths.filter((_, i) => i < ci).reduce((s, w) => s + Math.max(w.dynamic, w.static), 0);
                //const width = Math.max(widths[ci].dynamic, widths[ci].static);
                const width = cell.cols.map(c => Math.max(widths[c].dynamic, widths[c].static))
                    .reduce((s, w) => s + w, 0);
                const background = cell.color;

                context.strokeStyle = theme('pane_color_border');
                context.fillStyle = background;
                context.beginPath();
                context.moveTo(px, py);
                context.lineTo(px + width, py);
                context.lineTo(px + width, py + (height + .5) * font_size);
                context.lineTo(px, py + (height + .5) * font_size);
                context.lineTo(px, py);
                context.fill();
                context.stroke();
                context.closePath();

                let tx = px;
                let ty = py;
                if (cell.image) {
                    context.drawImage(cell.image, tx, ty, theme('font_size') * 1.25, theme('font_size') * 1.25);
                    tx += theme('font_size');
                }
                tx += 5;

                cell.content.forEach(t => {
                    canvas_write(t, tx, ty, {context});
                    ty += theme('font_size');
                });

                (cache_row[ci] ?? {}).content = cell.content;
            });
        });
    }

    /** Clears the pane's cache */
    clear_cache() {
        const cache = this.#cache;
        cache.x = this.x;
        cache.y = this.y;
        cache.cells = [];
        cache.height = 0;
        cache.heights = {static: [], dynamic: []};
        cache.widest_row = 0;
        cache.width = 0;
        cache.widths = {static: [], dynamic: []};
    }
}
