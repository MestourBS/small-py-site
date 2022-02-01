/**
 * @typedef {import('./canvas.js').GameTab} GameTab
 */

export const globals = {
    /**
     * Player focus position as [x, y]
     *
     * @type {[number, number]}
     */
    position: [0, 0],
    /**
     * Current selected theme
     *
     * @type {string}
     */
    current_theme: 'light',
    /**
     * Whether the document is focused or not
     *
     * @type {boolean}
     */
    focused: document.hasFocus(),
    /**
     * Whether key checking is strict or not
     *
     * @type {boolean}
     */
    strict_keys: true,
    /**
     * Currently selected tab
     *
     * @type {GameTab}
     */
    game_tab: 'world',
    /**
     * Objects being placed on the next click
     *
     * @type {{[k: string]: (x: number, y: number, event: MouseEvent) => boolean}}
     */
    adding: {},
};
export default globals;
