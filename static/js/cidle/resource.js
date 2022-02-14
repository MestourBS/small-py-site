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
     * @param {string?} [params.image]
     */
    constructor({id, name=null, color='#000', border_color='#000', background_color=null, image=null}) {
        id += '';
        name = name?.toString() ?? '';
        if (image != null) {
            const i = new Image;
            i.src = image;
            image = i;
        }

        this.#id = id + '';
        this.#name = name;
        this.#color = color;
        this.#background_color = background_color;
        this.#border_color = border_color;
        this.#image = image;

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
    #image;

    get id() { return this.#id; }
    get name() { return this.#name; }
    get color() { return this.#color; }
    get border_color() { return this.#border_color; }
    get background_color() { return this.#background_color; }
    get image() { return this.#image; }
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
     *  image?: string|null,
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
            id: 'copper',
            name: gettext('games_cidle_resource_copper'),
            color: '#B87333',
            border_color: '#A4672D',
        },
        {
            id: 'sand',
            name: gettext('games_cidle_resource_sand'),
            color: '#EDC9AF',
            border_color: '#E8BB9A',
        },
        {
            id: 'glass',
            name: gettext('games_cidle_resource_glass'),
            color: '#FFF',
            border_color: '#F2F2F2',
            background_color: '#CCC',
        },
        {
            id: 'gold',
            name: gettext('games_cidle_resource_gold'),
            color: '#FFD700',
            border_color: '#E6C200',
        },
        {
            id: 'tin',
            name: gettext('games_cidle_resource_tin'),
            color: '#99D',
            border_color: '#8686D7',
        },
        {
            id: 'bronze',
            name: gettext('games_cidle_resource_bronze'),
            color: '#CD7F32',
            border_color: '#B9722D',
        },
        {
            id: 'aquamarine',
            name: gettext('games_cidle_resource_aquamarine'),
            color: '#7FFFD4',
            border_color: '#66FFCB',
            background_color: '#44CCA9',
        },
        {
            id: 'blazing_aquamarine',
            name: gettext('games_cidle_resource_blazing_aquamarine'),
            color: '#BEBB6A',
            border_color: '#B6B358',
        },
        {
            id: 'magic',
            name: gettext('games_cidle_resource_magic'),
            color: '#70F',
            border_color: '#6B00E6',
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
            image: '/static/images/games/cidle/space.png',
        },
    ];

    resources.forEach(r => new Resource(r));
}
