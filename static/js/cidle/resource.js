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
     * @param {Object} params
     * @param {string} params.id
     * @param {string} [params.name]
     * @param {string} [params.color]
     * @param {string?} [params.image]
     */
    constructor({id, name=null, color='#000', image=null}) {
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
        this.#image = image;

        if (!(id in Resource.#resources)) {
            Resource.#resources[id] = this;
        }
    }

    #id;
    #name;
    #color;
    /** @type {null|HTMLImageElement} */
    #image;

    get id() { return this.#id; }
    get name() { return this.#name; }
    get color() { return this.#color; }
    get image() { return this.#image; }
}
export default Resource;

export function make_resources() {
    /**
     * @type {{
     *  id: string,
     *  name?: string
     *  color?: string,
     *  image?: string|null,
     * }[]}
     */
    const resources = [
        {
            id: 'wood',
            name: 'wood',
            color: '#730',
        },
        {
            id: 'fire',
            name: 'fire',
            color: '#f70',
        },
    ];

    resources.forEach(r => new Resource(r));
}
