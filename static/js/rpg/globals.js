/** @typedef {import('./entity.js').Entity} Entity */

export const globals = {
    /**
     * Current game state
     *
     * @type {'playing'|'inventory'|'pause'|'status'|'skills'|'skill_targeting'|'minimap'}
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
     *
     * @type {{
     *  inventory: [number, number],
     *  status: [number, number],
     *  skill_select: [number, number],
     *  skill_target: [number, number],
     * }}
     */
    cursors: {
        inventory: [0, 0],
        status: [0, 0],
        skill_select: [0, 0],
        skill_target: [0, 0],
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
