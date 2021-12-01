export const globals = {
    /**
     * Current game state
     *
     * @type {'playing'|'inventory'|'pause'|'status'}
     */
    game_state: 'playing',
    /**
     * Current player character
     *
     * Affects player movement, display and more
     *
     * @type {Entity}
     */
    player: null,
    /**
     * Current cursors for different screens, as [x, y]
     *
     * @type {{
     *  inventory: [number, number],
     *  status: [number, number],
     * }}
     */
    cursors: {
        inventory: [0, 0],
        status: [0, 0],
    },
    /**
     * Whether the status shows as much as possible or not
     *
     * @type {boolean}
     */
    debug_status: false,
    /**
     * Whether keybind checking is strict or not
     *
     * If strict, alt+ctrl+key will never trigger alt+key and so on
     *
     * @type {boolean}
     */
    strict_keys: true,
    /**
     * Current theme
     *
     * @type {string}
     */
    current_theme: '',
    /**
    * Cache for checking whether a coordinate can be walked
    *
    * @type {{[k: string]: boolean}}
    */
    can_walked: {},
};
export default globals;
