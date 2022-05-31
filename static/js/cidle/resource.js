/**
 * @typedef {import('./_storage.js').FillMode} FillMode
 */

import Machine from './machine.js';

//todo? resource description

export class Resource {
    /** @type {{[id: string]: Resource}} */
    static #resources = {};

    /**
     * Returns a resource
     *
     * @param {string} id
     * @param {boolean} [unknown] If true and the resource's storage is hidden, the function will return a default resource
     * @returns {Resource|null}
     */
    static resource(id, unknown = false) {
        if (unknown && Machine.storage_for(id).hidden) {
            return this.#resources['unknown'];
        }
        return this.#resources[id] ?? null;
    }
    /**
     * Gets all resources names
     *
     * @returns {string[]}
     */
    static all_resources() {
        if (this != Resource) return Resource.all_resources();

        return Object.keys(this.#resources);
    }

    /**
     * @param {Object} params
     * @param {string} params.id
     * @param {string} [params.name]
     * @param {string} [params.color]
     * @param {string} [params.border_color]
     * @param {string?} [params.background_color]
     * @param {string?} [params.fill_image] Image serving as a fill override
     * @param {string?} [params.picture] Image shown before the resource name
     * @param {FillMode?} [params.fillmode]
     */
    constructor({
        id, name = null, color = '#000', border_color = '#000',
        background_color = null, fill_image = null, picture = null,
        fillmode = null,
    }) {
        if (fillmode != null && !is_fill_mode(fillmode)) throw new RangeError(`Resource fill mode is not a valid fill mode (${fillmode})`);

        id += '';
        name = name?.toString() ?? '';
        if (fill_image != null) {
            const i = new Image;
            i.src = fill_image;
            fill_image = i;
        }
        if (picture != null) {
            const i = new Image;
            i.src = picture;
            picture = i;
        }

        this.#id = id + '';
        this.#name = name;
        this.#color = color;
        this.#background_color = background_color;
        this.#border_color = border_color;
        this.#fill_image = fill_image;
        this.#picture = picture;
        this.#fillmode = fillmode;

        if (!(id in Resource.#resources)) {
            Resource.#resources[id] = this;
        }
    }

    #id;
    #name;
    #color;
    #border_color;
    #background_color;
    /** @type {null|HTMLImageElement} */
    #fill_image;
    /** @type {null|HTMLImageElement} */
    #picture;
    #fillmode;

    get id() { return this.#id; }
    get name() { return this.#name; }
    get color() { return this.#color; }
    get border_color() { return this.#border_color; }
    get background_color() { return this.#background_color; }
    get fill_image() { return this.#fill_image; }
    get picture() { return this.#picture; }
    get fillmode() { return this.#fillmode; }
}
export default Resource;

export function make_resources() {
    /**
     * @type {{
     *  id: string,
     *  name?: string
     *  color?: string,
     *  border_color?: string,
     *  background_color?: string,
     *  fill_image?: string|null,
     *  fillmode?: FillMode,
     * }[]}
     */
    const resources = [
        {
            id: 'unknown',
            name: gettext('games_cidle_resource_unknown'),
            color: '#000000',
            border_color: '#000000',
        },
        // T0
        {
            id: 'wood',
            name: gettext('games_cidle_resource_wood'),
            color: '#730',
            border_color: '#5E2800',
        },
        {
            id: 'stone',
            name: gettext('games_cidle_resource_stone'),
            color: '#777',
            border_color: '#6A6A6A',
        },
        {
            id: 'fire',
            name: gettext('games_cidle_resource_fire'),
            color: '#F70',
            border_color: '#E66B00',
        },
        {
            id: 'water',
            name: gettext('games_cidle_resource_water'),
            color: '#00F',
            border_color: '#0000E6',
        },
        // T1
        {
            id: 'gem',
            name: gettext('games_cidle_resource_gem'),
            color: '#DA70D6',
            border_color: '#D55CD0',
        },
        {
            id: 'charcoal',
            name: gettext('games_cidle_resource_charcoal'),
            color: '#444444',
            border_color: '#373737',
        },
        {
            id: 'algae',
            name: gettext('games_cidle_resource_algae'),
            color: '#4FA866',
            border_color: '#47975B',
        },
        {
            id: 'lava',
            name: gettext('games_cidle_resource_lava'),
            color: '#FF5D00',
            border_color: '#E65400',
        },
        {
            id: 'smoothness',
            name: gettext('games_cidle_resource_smoothness'),
            color: '#D9D9D9',
            border_color: '#CCCCCC',
        },
        {
            id: 'steam',
            name: gettext('games_cidle_resource_steam'),
            color: '#BCBCBC',
            border_color: '#AFAFAF',
        },
        // T2-Magic
        {
            id: 'magic_crystal',
            name: gettext('games_cidle_resource_magic_crystal'),
            color: '#BF3FFF',
            border_color: '#B726FF',
        },
        {
            id: 'magic',
            name: gettext('games_cidle_resource_magic'),
            color: '#B200FF',
            border_color: '#A000E6',
        },
        {
            id: 'ice',
            name: gettext('games_cidle_resource_ice'),
            color: '#AAAAFF',
            border_color: '#9191FF',
        },
        {
            id: 'pure_elements',
            name: gettext('games_cidle_resource_pure_elements'),
            color: { toString() { return `hsl(${Date.now() / 100 % 360}, 100%, 50%)`; } },
            border_color: { toString() { return `hsl(${Date.now() / 100 % 360}, 75%, 50%)`; } },
        },
        {
            id: 'anti_magic',
            name: gettext('games_cidle_resource_anti_magic'),
            color: '#4DFF00',
            border_color: '#5FFF19',
        },
        // T2-Space
        {
            id: 'asteroid',
            name: gettext('games_cidle_resource_asteroid'),
            color: '#808080',
            border_color: '#737373',
        },
        {
            id: 'planet',
            name: gettext('games_cidle_resource_planet'),
            color: '#A52A2A',
            border_color: '#912525',
        },
        {
            id: 'moon',
            name: gettext('games_cidle_resource_moon'),
            color: '#A0A0A0',
            border_color: '#939393',
        },
        {
            id: 'gas_giant',
            name: gettext('games_cidle_resource_gas_giant'),
            color: '#DBC2A9',
            border_color: '#D3B597',
        },
        {
            id: 'star',
            name: gettext('games_cidle_resource_star'),
            color: '#FFFF00',
            border_color: '#FFFF00',
        },
        // T2-Knowledge
        {
            id: 'book',
            name: gettext('games_cidle_resource_book'),
            color: '#000000',
            border_color: '#FFFFFF',
        },
        {
            id: 'knowledge',
            name: gettext('games_cidle_resource_knowledge'),
            color: '#000000',
            border_color: '#FFFFFF',
        },
        {
            id: 'research',
            name: gettext('games_cidle_resource_research'),
            color: '#0077FF',
            border_color: '#006BE6',
        },
        {
            id: 'rotational_force',
            name: gettext('games_cidle_resource_rotational_force'),
            color: '#545454',
            border_color: '#474747',
        },
        {
            id: 'time',
            name: gettext('games_cidle_resource_time'),
            color: '#FF0000',
            border_color: '#E60000',
        },
        {
            id: 'abstract',
            name: gettext('games_cidle_resource_abstract'),
            color: { toString() { return `hsl(0, 0%, ${Math.abs(100 - Date.now() / 100 % 200)}%)`; } },
            border_color: { toString() { return `hsl(0, 0%, ${100 - Math.abs(100 - Date.now() / 100 % 200)}%)`; } },
        },
        // T2-Energy
        {
            id: 'heat',
            name: gettext('games_cidle_resource_heat'),
            color: '#FFAA00',
            border_color: '#E69900',
        },
        {
            id: 'electricity',
            name: gettext('games_cidle_resource_electricity'),
            color: '#E5E500',
            border_color: '#CCCC00',
        },
        {
            id: 'air',
            name: gettext('games_cidle_resource_air'),
            color: '#E5E5B7',
            border_color: '#DEDEA4',
        },
        {
            id: 'light',
            name: gettext('games_cidle_resource_light'),
            color: '#D9D9D9',
            border_color: '#CCCCCC'
        },
        {
            id: 'darkness',
            name: gettext('games_cidle_resource_darkness'),
            color: '#262626',
            border_color: '#333333',
        },
        // Black Hole
        {
            id: 'nothingness',
            name: gettext('games_cidle_resource_nothingness'),
            color: '#000000',
            border_color: { toString() { return `hsl(${Math.abs(30 - Date.now() / 100 % 60) + 5}, 100%, 50%)`; } },
        },
    ];

    resources.forEach(r => new Resource(r));
}

/**
 * Checks if a string is a fillmode
 *
 * @param {string} mode
 * @returns {mode is FillMode}
 */
function is_fill_mode(mode) {
    return ['circle', 'clockwise', 'counterclockwise', 'transparency', 'image', 'rhombus', 'linear'].includes(mode);
}
