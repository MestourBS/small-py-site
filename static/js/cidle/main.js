/**
 * Inspired by [the first alkahistorian](https://nagshell.github.io/elemental-inception-incremental/)
 */

import './actions.js';
import { canvas_refresh } from './canvas.js';
import { make_resources } from './resource.js';
import { save_data as save_globals, load_data as load_globals } from './globals.js';
import { save_data as save_machines, load_data as load_machines, Machine, time_speed } from './machine.js';

//todo? spells & curses / singularities
//todo? achievements

/** @type {number} */
let last_production;
let save_game = true;
let save_interval = 0;

function init() {
    try {
        localStorage;
        window.addEventListener('beforeunload', save);
        save_interval = setInterval(() => { save(); }, 1e3 * 60);
    } catch { }

    const footer = document.getElementById('footer');
    document.body.removeChild(footer);
    document.body.style.height = '99%';
    make_resources();
    load();
    last_production = Date.now();

    requestAnimationFrame(() => display());
    let produce_interval = setInterval(() => {
        let now = Date.now();
        let diff = (now - last_production) / 1e3;
        last_production = now;
        let multiplier = diff;

        /** @type {Machine[]} */
        const time_machines = [];
        /** @type {Machine[]} */
        const present_machines = [];
        Machine.machines.forEach(m => (m.is_time_machine ? time_machines : present_machines).push(m));

        try {
            time_machines.filter(m => m.can_produce()).forEach(m => m.produce({ multiplier }));

            multiplier *= time_speed();

            present_machines.filter(m => m.can_produce()).forEach(m => m.produce({ multiplier }));
        } catch (e) {
            save_game = false;
            clearInterval(save_interval);
            clearInterval(produce_interval);
            throw e;
        }
    }, 1e3 / 30);
}

function display() {
    try {
        canvas_refresh();
    } catch (e) {
        save_game = false;
        clearInterval(save_interval);
        throw e;
    }

    requestAnimationFrame(() => display());
}

/**
 * Saves the data
 *
 * @param {BeforeUnloadEvent} event
 */
function save(event) {
    if (!save_game) return;

    const d = new Date;
    const date = {
        ms: d.getUTCMilliseconds(),
        sec: d.getUTCSeconds(),
        min: d.getUTCMinutes(),
        hour: d.getUTCHours(),
        day: d.getUTCDate(),
        month: d.getUTCMonth(),
        year: d.getUTCFullYear(),
    };

    const data = {
        globals: save_globals(),
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
     *  machines?: {
     *      id: string,
     *      x?: number,
     *      y?: number,
     *      paused?: boolean,
     *      recipes?: {level?: number, paused?: boolean}[],
     *      resources?: {[res: string]: {amount?: number, best?: number}},
     *      hidden?: boolean,
     *  }[],
     *  date?: {
     *      ms?: number,
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
    if ('machines' in data) {
        load_machines(data.machines);
    }
    if ('date' in data) {
        const now = new Date;
        const { date } = data;
        const save = new Date;
        if ('year' in date) save.setUTCFullYear(date.year);
        if ('month' in date) save.setUTCMonth(date.month);
        if ('day' in date) save.setUTCDate(date.day);
        if ('hour' in date) save.setUTCHours(date.hour);
        if ('min' in date) save.setUTCMinutes(date.min);
        if ('sec' in date) save.setUTCSeconds(date.sec);
        if ('ms' in date) save.setUTCMilliseconds(date.ms);
        let seconds = (now - save) / 1e3;

        if (seconds > 0) {
            const machine = Machine.storage_for('time');

            if (machine) machine.resources.time.amount += seconds;
        }
    }
}

init();
