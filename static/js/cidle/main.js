import { save_data as save_inventory, load_data as load_inventory } from './inventory.js';
import { canvas_refresh } from './canvas.js';
import MakerMachine, { insert_makers, make_makers } from './maker.js';
import { make_resources } from './resource.js';
import { insert_storages, make_storages } from './storage.js';
import './actions.js';
import { save_data as save_globals, load_data as load_globals } from './globals.js';
import { save_data as save_machines, load_data as load_machines } from './machine.js';

/** @type {number} */
let last_production;

function init() {
    try {
        localStorage;
        window.addEventListener('beforeunload', save);
        setInterval(() => {save();}, 1e3 * 60);
    } catch { }

    const footer = document.getElementById('footer');
    document.body.removeChild(footer);
    document.body.style.height = '99%';
    make_resources();
    make_storages();
    make_makers();
    load();
    insert_storages();
    insert_makers();
    last_production = Date.now();

    requestAnimationFrame(() => display());
    setInterval(() => {
        //todo bank unspent time
        /*
        if (!document.hasFocus()) {
            return;
        }
        */

        let now = Date.now();
        let diff = (now - last_production) / 1e3;
        last_production = now;

        MakerMachine.maker_machines.filter(m => m.can_produce({multiplier: diff})).forEach(m => m.produce({multiplier: diff}));
    }, 1e3 / 30);
}

function display() {
    canvas_refresh();

    requestAnimationFrame(() => display());
}

/**
 * Saves the data
 *
 * @param {BeforeUnloadEvent} event
 */
function save(event) {
    const data = {
        globals: save_globals(),
        inventory: save_inventory(),
        machines: save_machines(),
    };

    const json = JSON.stringify(data);

    localStorage.setItem('games_cidle', json);
}
/**
 * Loads the data
 */
function load() {
    const json = localStorage.getItem('games_cidle');
    if (!json) return;

    /**
     * @type {{
     *  globals?: {
     *      pos?: [number, number],
     *      theme?: string,
     *      strict?: boolean,
     *      tab?: string,
     *  },
     *  inventory?: {
     *      inv: {
     *          machines: {[id: string]: number},
     *      },
     *      rec: {
     *          machines: {[id: string]: {crafted: number, unlocked?: boolean}}
     *      },
     *  },
     *  machines?: {id: string, ...parts}[],
     * }}
     */
    let data;
    try {
        data = JSON.parse(json);
    } catch {
        console.error('Saved data is corrupted, deleting');
        localStorage.removeItem('games_cidle');
        return;
    }

    if ('globals' in data) {
        load_globals(data.globals);
    }
    if ('inventory' in data) {
        load_inventory(data.inventory);
    }
    if ('machines' in data) {
        load_machines(data.machines);
    }
}

init();
