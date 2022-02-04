import './actions.js';
import { canvas_refresh } from './canvas.js';
import { save_data as save_inventory, load_data as load_inventory } from './inventory.js';
import MakerMachine, { insert_makers, make_makers, time_speed } from './maker.js';
import { make_resources } from './resource.js';
import StorageMachine, { insert_storages, make_storages } from './storage.js';
import { save_data as save_globals, load_data as load_globals } from './globals.js';
import { save_data as save_machines, load_data as load_machines } from './machine.js';

//todo move production to a single all consuming / producing function

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
        let now = Date.now();
        let diff = (now - last_production) / 1e3;
        last_production = now;
        let multiplier = diff;

        /** @type {MakerMachine[]} */
        const time_machines = [];
        /** @type {MakerMachine[]} */
        const present_machines = [];
        MakerMachine.maker_machines.forEach(m => {
            const target = m.consumes.some(p => p[0] == 'time') ? time_machines : present_machines;
            target.push(m);
        });
        time_machines.filter(m => m.can_produce({multiplier})).forEach(m => m.produce({multiplier}));

        multiplier *= time_speed();

        present_machines.filter(m => m.can_produce({multiplier})).forEach(m => m.produce({multiplier}));
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
    const d = new Date;
    const date = {
        sec: d.getSeconds(),
        min: d.getMinutes(),
        hour: d.getHours(),
        day: d.getDate(),
        month: d.getMonth(),
        year: d.getFullYear(),
    };

    const data = {
        globals: save_globals(),
        inventory: save_inventory(),
        machines: save_machines(),
        date,
    };

    const json = JSON.stringify(data);

    localStorage.setItem('games_cidle', btoa(json));
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
     *  date?: {
     *      sec?: number,
     *      min?: number,
     *      hour?: number,
     *      day?: number,
     *      month?: number,
     *      year?: number,
     *  },
     * }}
     */
    let data;
    try {
        data = JSON.parse(atob(json));
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
    if ('date' in data) {
        const now = new Date;
        now.setMilliseconds(0);
        const {date} = data;
        const save = new Date;
        save.setMilliseconds(0);
        if ('year' in date) save.setFullYear(date.year);
        if ('month' in date) save.setMonth(date.month);
        if ('day' in date) save.setDate(date.day);
        if ('hour' in date) save.setHours(date.hour);
        if ('min' in date) save.setMinutes(date.min);
        if ('sec' in date) save.setSeconds(date.sec);
        let seconds = (now - save) / 1e3;

        if (seconds > 0) {
            const storages = StorageMachine.storages_for('time');
            storages.forEach(m => {
                if (seconds <= 0) return;

                const time = m.resources.time;
                const space = time.max - time.amount;
                const move = Math.min(space, seconds);
                time.amount += move;
                seconds -= move;
            });
        }
    }
}

init();
