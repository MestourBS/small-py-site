/** @typedef {import('./entity.js').Entity} Entity */

export const globals = {
    /**
     * Current game state
     *
     * @type {'playing'|'inventory'|'pause'|'status'|'skills'|'skill_targeting'|'minimap'|'options_test'}
     */
    game_state: 'playing',
    /**
     * Current player character
     *
     * Affects player movement
     *
     * @type {Entity}
     */
    player: null,
    /**
     * Currently focused entity
     *
     * Affects display
     *
     * Can be an entity or just a location
     *
     * @type {Entity|{x: number, y: number}}
     */
    get focused_entity() {
        switch (this.game_state) {
            case 'inventory':
            case 'minimap':
            case 'pause':
            case 'playing':
            case 'skills':
            case 'status':
            default:
                return this.player;
            case 'skill_targeting':
                return {
                    get x() { return globals.cursors.skill_target[0]; },
                    get y() { return globals.cursors.skill_target[1]; },
                };
        }
    },
    /**
     * Current cursors for different screens, as [x, y]
     */
    cursors: {
        /** @type {[number, number]} [x, y] */
        inventory: [0, 0],
        /** @type {[number]} [y] */
        status: [0],
        /** @type {[number, number]} [x, y] */
        skill_select: [0, 0],
        /** @type {[number, number]} [x, y] */
        skill_target: [0, 0],
        /** @type {[number, number]} [x, y] */
        options: [0, 0],
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
