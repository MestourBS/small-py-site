// Imports from entity.js must be first,
// as importing won't attempt to load the same module twice.
// This means that entity.js will import tile.js, which will prevent it from loading entity.js
import { Entity, AutonomousEntity } from './entity.js';
import { Room } from './room.js';
import { context } from './canvas.js';
import { keydown } from './keybinds.js';
import { create_items } from './item.js';
import { get_theme_value } from './display.js';
import { tile_size, display_size } from './display.js';
import { canvas_reset, canvas_refresh } from './canvas.js';
import globals from './globals.js';

/**
 * TODO LIST
 * =========
 *
 * ?Custom right-click menu, depends where clicked
 *
 * *options
 *  - needs the ability to show/read input equivalents
 *      - needs the ability to remember inputs between frames
 *
 * *configurable keybinds
 *  - needs the ability to show/read input equivalents
 *      - needs the ability to remember inputs between frames
 *
 * *custom theme
 *  - needs the ability to show/read input equivalents
 *      - needs the ability to remember inputs between frames
 *
 * @see .\room.js
 * @see .\entity.js
 */

/**
 * Last time the loop was called
 *
 * @type {number}
 */
let loop_last;

/**
 * Starts the game
 */
function init() {
    let almost_paused = !document.hasFocus();
    if (almost_paused) globals.game_state = 'pause';
    document.addEventListener('keydown', keydown);
    document.addEventListener('blur', () => {
        if (globals.game_state == 'playing') {
            almost_paused = true;
            globals.game_state = 'pause';
        }
    });
    document.addEventListener('focus', () => {
        if (almost_paused) {
            almost_paused = false;
            globals.game_state = 'playing';
        }
    });
    create_items();

    loop_last = Date.now();
    canvas_reset();
    globals.player = new Entity({x: 0, y: 0, z: 10, content: function(x, y) {
        context.textAlign = 'center';
        context.fillStyle = '#f00';
        context.font = `${tile_size[1]}px ${get_theme_value('text_font')}`;
        let x_start = (x - (globals.player.x - display_size[0] / 2) + .5) * tile_size[0];
        let y_start = (y - (globals.player.y - display_size[1] / 2) + .8) * tile_size[1];

        context.fillText('☺', x_start, y_start);
    }, health: 10, speed: 2, equip_slots: [0, 3, 5]});

    Room.make_map();

    requestAnimationFrame(loop);
}
/**
 * Main game loop
 */
function loop() {
    let now = Date.now();
    let diff = now - loop_last;
    loop_last = now;

    canvas_refresh();

    if (globals.game_state == 'playing') {
        /** @type {AutonomousEntity[]} */
        Entity.entities.filter(t => t instanceof AutonomousEntity).forEach(t => t.move(null, diff / 500));
    }

    requestAnimationFrame(loop);
}

init();
