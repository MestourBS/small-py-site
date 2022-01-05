// Imports from canvas.js must be first,
// as importing won't attempt to load the same module twice.
// This means that canvas.js will import tile.js, which will prevent it from loading modules dependant on it
import './canvas.js';
import { Room } from './room.js';
import { tile_size } from './display.js';
import { create_items } from './item.js';
import { create_skills } from './skills.js';
import { get_theme_value } from './display.js';
import { Entity, AutonomousEntity } from './entity.js';
import { canvas_reset, canvas_refresh } from './canvas.js';
import globals from './globals.js';
import './actions.js';
import { Z_LAYERS } from './tile.js';

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
    /**
     * @type {import('./entity.js').EntityCustomDraw}
     */
    function draw_player({x, y, context, mode}) {
        /** @type {[number, number]} */
        let [width, height] = {
            'mini': tile_size.map(n => n / 4),
            'storage': tile_size.map(n => n * 2),
            'world': [...tile_size],
        }[mode];
        context.textAlign = 'center';
        context.fillStyle = '#f00';
        context.font = `${height}px ${get_theme_value('text_font')}`;
        x += width / 2;
        y += height * .75;

        context.fillText('☺', x, y);
    };
    globals.player = new Entity({
        x: 0, y: 0, z: Z_LAYERS.player, content: draw_player,
        health: 10, speed: 2, equip_slots: [0, 3, 5], faction: 'player',
    });

    Room.make_map();

    requestAnimationFrame(refresh_loop);
}
/**
 * Main game display loop
 */
function refresh_loop() {
    canvas_refresh();

    compute_loop();

    requestAnimationFrame(refresh_loop);
}
/**
 * Main game computations loop
 */
function compute_loop() {
    let now = Date.now();
    let time_since_last = now - loop_last;
    loop_last = now;

    if (globals.game_state == 'playing') {
        let diff = time_since_last / 500;
        let move = diff < 1 / 2 ** 0;
        let equip_items = diff < 1 / 2 ** 1;
        let use_items = diff < 1 / 2 ** 2;
        let use_skills = diff < 1 / 2 ** 3;
        let level_skills = diff < 1 / 2 ** 4;
        let unlock_skills = diff < 1 / 2 ** 5;

        /** @type {AutonomousEntity[]} */
        let autonomous_entities = Entity.entities.filter(t => t instanceof AutonomousEntity);
        autonomous_entities.forEach(e => {
            if (move) e.move(null, diff);
            if (equip_items) e.equip_item();
            if (use_items) e.use_item();
            if (use_skills) e.use_skill();
            if (level_skills) e.level_skill();
        });
        if (unlock_skills) Entity.entities.forEach(e => e.unlock_skills());
    }
}

init();
