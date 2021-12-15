// Imports from entity.js must be first,
// as importing won't attempt to load the same module twice.
// This means that entity.js will import tile.js, which will prevent it from loading entity.js
import { Entity, AutonomousEntity } from './entity.js';
import { Room } from './room.js';
import { tile_size } from './display.js';
import { create_items } from './item.js';
import { create_skills } from './skills.js';
import { get_theme_value } from './display.js';
import { canvas_reset, canvas_refresh } from './canvas.js';
import globals from './globals.js';
import './actions.js';

/**
 * TODO LIST
 * =========
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
    create_items();
    create_skills();

    loop_last = Date.now();
    canvas_reset();
    /** @param {number} x @param {number} y @param {CanvasRenderingContext2D} context */
    const draw_player = (x,y,context) => {
        context.textAlign = 'center';
        context.fillStyle = '#f00';
        context.font = `${tile_size[1]}px ${get_theme_value('text_font')}`;
        x += tile_size[0] / 2;
        y += tile_size[1] - 5;

        context.fillText('☺', x, y);
    };
    globals.focused_entity = globals.player = new Entity({x: 0, y: 0, z: 10, content: draw_player, health: 10, speed: 2, equip_slots: [0, 3, 5]});

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
