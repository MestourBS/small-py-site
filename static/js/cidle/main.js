import './inventory.js';
import { canvas_refresh } from './canvas.js';
import MakerMachine, { make_makers } from './maker.js';
import { make_resources } from './resource.js';
import { make_storages } from './storage.js';
import './actions.js';

/** @type {number} */
let last_production;

function init() {
    const footer = document.getElementById('footer');
    document.body.removeChild(footer);
    document.body.style.height = '99%';
    make_resources();
    make_storages();
    make_makers();
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

init();
