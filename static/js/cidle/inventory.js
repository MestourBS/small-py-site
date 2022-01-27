/**
 * Current inventory
 *
 * @type {{
 *  machines: string[],
 * }}
 */
const inventory = {
    machines: [],
};
/**
 * Crafting recipes to make new things
 *
 * @type {{
 *  machines: {[machine_id: string]: {
 *      crafted: number,
 *      resources: [string, number][]|(crafted: number) => [string, number][]|false,
 *  }},
 * }}
 */
const recipes = {
    machines: {},
};
