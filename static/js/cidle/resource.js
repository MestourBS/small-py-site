//todo? resource description

export class Resource {
    /** @type {{[id: string]: Resource}} */
    static #resources = {};

    /**
     * Returns a resource
     *
     * @param {string} id
     * @returns {Resource|null}
     */
    static resource(id) {
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
     */
    constructor({
        id, name=null, color='#000', border_color='#000',
        background_color=null, fill_image=null, picture=null,
    }) {
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

    get id() { return this.#id; }
    get name() { return this.#name; }
    get color() { return this.#color; }
    get border_color() { return this.#border_color; }
    get background_color() { return this.#background_color; }
    get fill_image() { return this.#fill_image; }
    get picture() { return this.#picture; }
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
     * }[]}
     */
    const resources = [
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
            id: 'brick',
            name: gettext('games_cidle_resource_brick'),
            color: '#555',
            border_color: '#484848',
        },
        {
            id: 'gravel',
            name: gettext('games_cidle_resource_gravel'),
            color: '#999',
            border_color: '#8C8C8C',
        },
        {
            id: 'water',
            name: gettext('games_cidle_resource_water'),
            color: '#00F',
            border_color: '#0000E6',
        },
        {
            id: 'ore',
            name: gettext('games_cidle_resource_ore'),
            color: '#9ABCDE',
            border_color: '#87AFD8',
            fill_image: '/static/images/games/cidle/ore.png',
        },
        {
            id: 'sand',
            name: gettext('games_cidle_resource_sand'),
            color: '#EDC9AF',
            border_color: '#E8BB9A',
        },
        {
            id: 'copper',
            name: gettext('games_cidle_resource_copper'),
            color: '#B87333',
            border_color: '#A4672D',
        },
        // Time resources
        {
            id: 'time',
            name: gettext('games_cidle_resource_time'),
            color: '#F00',
            border_color: '#E60000',
        },
        // Space resources
        {
            id: 'space',
            name: gettext('games_cidle_resource_space'),
            color: '#000',
            border_color: '#0C0C0C',
            fill_image: '/static/images/games/cidle/space.png',
        },
    ];

    resources.forEach(r => new Resource(r));
}
