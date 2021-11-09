if (typeof gettext != 'function') {
    /**
     * @param {string} text Variables are inserted with `%(<name>)s`
     * @param {{[k: string]: string|number}} variables
     * @returns {string}
     */
    function gettext(text, variables) {}
}

//(() => {
    /**
     * Unit types for beautify
     *
     * @type { {[k: string]: {
     *  units: [string][],
     *  name: string,
     * } } }
     */
    const UNITS = {
        'none': {
            units: [],
            name: gettext('game_blockus_unit_none'),
        },
        'SI': {
            units: ['', 'k', 'M', 'G', 'T', 'P', 'E', 'Z', 'Y'],
            name: gettext('game_blockus_unit_si'),
        },
        'numeral': {
            units: ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'S', 'Se', 'O', 'N',
                'D', 'UD', 'DD', 'TD', 'QaD', 'QiD', 'SD', 'SeD', 'OD', 'ND',
                'V', 'UV', 'DV', 'TV', 'QaV', 'QiV', 'SV', 'SeV', 'OV', 'NV'],
                name: gettext('game_blockus_unit_numeral'),
        },
    };
    /**
     * Amount of ticks each second when the game is in the foreground
     */
    const TPS_ACTIVE = 30;
    /**
     * Click effects
     *
     * @type {{
     *  damage: {[k: string]: number},
     *  production: {[k: string]: number}
     * }}
     */
    const CLICKER = {
        production: {
            'points': 1,
        },
        damage: {
            'none': 1,
        },
    };
    /**
     * @type {{[k: string|number]: {
     *  style: {[k: string]: string,},
     * }}}
     */
    const TIERS = {
        1: {
            style: {
                'color': 'red',
            },
        },
    };

    /**
     * Current unit type
     *
     * @type {string}
     */
    let unit = Object.keys(UNITS)[0];
    /**
     * Last time production and damage were called
     *
     * @type {number}
     */
    let last_production;
    /**
     * Interval of the current tooltip
     *
     * @type {number}
     */
    let tooltip_interval;

    class Trait {
        /**
         * Existing traits
         *
         * @type {{[k: string]: Trait}}
         * @readonly
         */
        static TRAITS = {};
        /**
         * Displays the current damage dealt
         */
        static display_damage(reset = false) {
            /** @type {HTMLTableElement} */
            const TABLE = document.getElementById('damage_table');
            if (reset) {
                TABLE.textContent = '';
            }

            let damage = Object.values(Building.BUILDINGS)
                .filter(b => b.amount > 0 && b.damage)
                .reduce((dmg, b) => {
                    let up_mult = Object.values(Upgrade.UPGRADES)
                        .filter(u => u.bought && u.multipliers.buildings && b.id in u.multipliers.buildings)
                        .map(u => u.multipliers.buildings[b.id]+1)
                        .reduce((mult, u_mu) => mult * u_mu, 1);

                    Object.entries(b.damage).forEach(([t, d]) => {
                        if (!(t in dmg)) dmg[t] = 0;
                        dmg[t] += d * up_mult * b.amount;
                    });
                    return dmg;
                }, {});

            Boss.get_current_boss().traits.forEach(t => {
                damage = Trait.TRAITS[t].apply_on_damage(damage);
            });

            Object.entries(damage).forEach(([trait, damage]) => {
                let cell_damage = document.getElementById(`trait_damage_${trait}`);

                if (!cell_damage) {
                    let row = document.createElement('tr');
                    let cell_name = document.createElement('td');
                    cell_damage = document.createElement('td');

                    cell_name.textContent = Trait.TRAITS[trait].name;
                    cell_damage.id = `trait_damage_${trait}`;

                    row.style.color = Trait.TRAITS[trait].color;
                    row.style.backgroundColor = anti_bicolor(Trait.TRAITS[trait].color);

                    row.appendChild(cell_name);
                    row.appendChild(cell_damage);

                    TABLE.appendChild(row);
                }

                cell_damage.textContent = beautify(damage);
            });
        }

        #id;
        #multipliers;

        /**
         * @param {Object} params
         * @param {string} params.id
         * @param {string} params.name
         * @param {string} params.color
         * @param {{[k: string]: number}} params.multipliers
         */
        constructor({id, name, color, multipliers={}}) {
            if (id in Trait.TRAITS) {
                throw new Error(`Trait ${id} already exists`);
            }

            this.#id = id;
            this.name = name;
            this.color = color;
            this.#multipliers = multipliers;

            Trait.TRAITS[id] = this;
        }

        /**
         * Display of the trait
         *
         * @returns {HTMLSpanElement}
         */
        display() {
            let span = document.createElement('span');

            span.innerText = this.name;
            span.style.color = this.color;
            span.style.marginRight = '5px';

            return span;
        }
        /**
         * Applies the element's multipliers on the damage
         *
         * @param {{[k: string]: number}} damages {element: damage}
         * @returns {{[k: string]: number}}
         */
        apply_on_damage(damages) {
            Object.entries(this.#multipliers).filter(([trait, _]) => trait in damages)
                .forEach(([trait, multiplier]) => {
                    let up_mult = Object.values(Upgrade.UPGRADES)
                        .filter(u => u.bought && u.multipliers.traits && res in u.multipliers.traits)
                        .map(u => u.multipliers.traits[trait]+1)
                        .reduce((mult, u_mu) => mult * u_mu, 1);

                    multiplier *= up_mult;

                    if (multiplier) damages[trait] *= multiplier;
                    else delete damages[trait];
                });

            return damages;
        }
    }
    class Boss {
        /**
         * Existing bosses
         *
         * @type {{[k: string]: Boss}}
         * @readonly
         */
        static BOSSES = {};

        /**
         * Current boss
         *
         * @type {string|null}
         * @private
         */
        static #current_boss;

        static get current_boss() { return this.#current_boss };
        static set current_boss(value) {
            if (!(value in this.BOSSES) && value) return;

            this.#current_boss = value;
            this.boss_display();
        }

        /**
         * Displays the current boss
         */
        static boss_display() {
            if (!this.#current_boss) {
                document.getElementById('boss_div').textContent = '';
            } else {
                this.BOSSES[this.#current_boss].#display_create();
            }
        }
        /**
         * Returns the tooltip for the current boss
         */
        static boss_tooltip() {
            if (!(Boss.#current_boss in Boss.BOSSES)) return null;

            let boss = Boss.get_current_boss();
            /** @type {HTMLElement[]} */
            let rows = [];
            let result = document.createElement('div');

            // traits
            traits: {
                let div = document.createElement('div');
                let title_div = document.createElement('div');
                let title_b = document.createElement('b');
                title_b.textContent = gettext('games_idle_bosses_traits');

                title_div.appendChild(title_b);
                div.appendChild(title_div);

                boss.traits.filter(t => t in Trait.TRAITS).map(t => Trait.TRAITS[t].display()).forEach(t => div.appendChild(t));

                rows.push(div);
            }

            // drops
            if (Object.keys(boss.#drops ?? {}).length) {
                let table = document.createElement('table');
                let title_row = document.createElement('tr');
                let title_cell = document.createElement('td');
                let title_b = document.createElement('b');

                title_b.textContent = gettext('games_idle_bosses_drops');
                title_cell.colSpan = 2;

                title_cell.appendChild(title_b);
                title_row.appendChild(title_cell);
                table.appendChild(title_row);

                Object.entries(boss.#drops).forEach(([resource, amount]) => {
                    let row = document.createElement('tr');
                    let resource_cell = document.createElement('td');
                    let amount_cell = document.createElement('td');

                    row.appendChild(resource_cell);
                    row.appendChild(amount_cell);

                    resource_cell.textContent = Resource.RESOURCES[resource].name;

                    if (typeof amount == 'number') {
                        amount_cell.textContent = `${beautify(amount)}: 100%`;
                    } else {
                        let [chance, min, max=min] = amount;

                        amount_cell.textContent = `${beautify(min)}: ${chance * 100}%`;
                        if (max != min) {
                            amount_cell.textContent += `-${beautify(max)}`;
                        }
                    }

                    table.appendChild(row);
                });

                rows.push(table);
            }

            if (!rows.length) return null;

            rows.forEach((e, i) => {
                if (i) result.appendChild(document.createElement('hr'));
                result.appendChild(e);
            });

            return result;
        }
        /**
         * Returns the first boss
         *
         * @returns {string}
         */
        static get_first_boss() {
            return Object.values(this.BOSSES)[0].#id;
        }
        /**
         * Sets the current boss to the next one
         */
        static go_next_boss() {
            let boss = this.BOSSES[this.#current_boss];

            this.#current_boss = boss.#next;
            boss = this.BOSSES[this.#current_boss];
            boss.#health = boss.#max_health;
        }
        /**
         * Gets the current boss
         *
         * @returns {Boss}
         */
        static get_current_boss() {
            if (!this.#current_boss) this.#current_boss = this.get_first_boss();

            return this.BOSSES[this.current_boss];
        }

        #id;
        #health;
        #max_health;
        #next;
        #tier;

        /**
         * @param {Object} params
         * @param {string} params.id
         * @param {string} params.name
         * @param {string[]} params.traits Traits ids
         * @param {number} params.health
         * @param {{[k: string]: number|[number, number, number?]}} params.drops amount|[chance (between 0 - 1),min, max (or min)]
         * @param {string} params.next next boss's id
         * @param {string|number} [params.tier=0]
         */
        constructor({id, name, traits=[], health, drops={}, next, tier=0}) {
            if (id in Boss.BOSSES) {
                throw new Error(`Boss ${id} already exists`);
            }

            if (!traits.length) traits.push('none');

            this.#id = id;
            this.name = name;
            this.traits = traits;
            this.#health = health;
            this.#max_health = health;
            this.#drops = drops;
            this.#next = next;
            this.defeats = 0;
            this.defeated_in_run = false;
            this.#tier = tier;

            Boss.BOSSES[id] = this;
        }

        get health() {
            return Math.max(this.#health, 0);
        }
        set health(value) {
            if (isNaN(value)) value = 0;
            this.#health = Math.max(value, 0);

            if (!this.#health) {
                Boss.go_next_boss();
                this.defeats++;
                this.defeated_in_run = true;

                this.#give_drops();
            }
        }

        /**
         * Displays the boss
         *
         * @returns {HTMLDivElement}
         */
        #display_create() {
            let boss_name = document.getElementById('current_boss_name');
            let progress_div = document.getElementById('current_boss_progress');
            let progress_bar_div = document.getElementById('current_boss_progress_bar');
            let current_boss_div = document.getElementById('current_boss_div');

            if (!current_boss_div) {
                current_boss_div = document.createElement('button');
                boss_name = document.createElement('div');
                progress_bar_div = document.createElement('div');
                progress_div = document.createElement('div');

                current_boss_div.id = 'current_boss_div';
                boss_name.id = 'current_boss_name';
                progress_bar_div.id = 'current_boss_progress_bar';
                progress_div.id = 'current_boss_progress';

                progress_bar_div.classList.add('progress-bar-background');
                progress_bar_div.classList.add('progress-bar');
                progress_div.classList.add('progress-bar');
                current_boss_div.classList.add(`tier-${this.#tier}`);

                current_boss_div.addEventListener('mouseenter', e => {
                    tooltip(Boss.boss_tooltip, [current_boss_div.offsetLeft, current_boss_div.offsetTop + current_boss_div.offsetHeight]);
                    e.preventDefault();
                });
                current_boss_div.addEventListener('mouseleave', e => un_tooltip());
                current_boss_div.addEventListener('click', e => click());

                current_boss_div.appendChild(boss_name);
                current_boss_div.appendChild(progress_bar_div);
                progress_bar_div.appendChild(progress_div);
                document.getElementById('boss_div').appendChild(current_boss_div);
            }

            let src = Flask.url_for('static', {filename: `images/games/idle/boss_${this.#id}.png`});
            current_boss_div.style.backgroundImage = `url(${src})`;
            progress_bar_div.title = `${beautify(this.health)}/${beautify(this.#max_health)}`;
            progress_div.style.width = `${Math.floor(this.health / this.#max_health * 100)}%`;
            boss_name.textContent = this.name;
        }
        /**
         * Damages the boss
         *
         * @param {{[k: string]: number}} damages {element: damage}
         */
        damage(damages) {
            this.traits.forEach(t => {
                damages = Trait.TRAITS[t].apply_on_damage(damages);
            });

            let damage = Object.values(damages).reduce((t, d) => t + d, 0);

            this.health -= damage;
        }
        /**
         * Gives the boss's drops
         */
        #give_drops() {
            Object.entries(this.#drops).forEach(([resource, amount]) => {
                let res = Resource.RESOURCES[resource];
                let up_mult_res = Object.values(Upgrade.UPGRADES)
                    .filter(u => u.bought && u.multipliers.resources && res in u.multipliers.resources)
                    .map(u => u.multipliers.resources[resource]+1)
                    .reduce((mult, u_mu) => mult * u_mu, 1);
                let up_mult_boss = Object.values(Upgrade.UPGRADES)
                    .filter(u => u.bought && u.multipliers.bosses && res in u.multipliers.bosses)
                    .map(u => u.multipliers.bosses[this.#id]+1)
                    .reduce((mult, u_mu) => mult * u_mu, 1);

                if (typeof amount == 'number') {
                    res.amount += amount * up_mult_res * up_mult_boss;
                } else {
                    let [chance, min, max=min] = amount;

                    let give = Math.random() <= chance;
                    if (!give) return;

                    let give_amount = min;
                    if (max > min) {
                        max -= min;
                        max = Math.floor(Math.random() * max * 100) / 100;
                    } else {
                        max = 0;
                    }
                    give_amount += max;
                    res.amount += give_amount * up_mult_res * up_mult_boss;
                }
            });
        }
    }
    class Resource {
        /**
         * Existing resources
         *
         * @type {{[k: string]: Resource}}
         * @readonly
         */
        static RESOURCES = {};
        /**
         * Displays all the resources
         *
         * @param {boolean} reset Reset the contents
         */
        static display_all(reset = false) {
            if (reset) {
                /** @type {HTMLTableElement} */
                const TABLE = document.getElementById('resources_table');
                TABLE.textContent = '';
            }

            Object.values(this.RESOURCES)
                .filter(r => r.unlocked)
                .sort((a, b) => a.#position - b.#position)
                .forEach(r => r.#display());
        }

        #id;
        #position;
        #unlocked;

        /**
         * @param {Object} params
         * @param {string} params.id
         * @param {string} params.name
         * @param {number} [params.amount=0]
         * @param {boolean|'auto'} [params.unlocked='auto']
         * @param {string|number} [params.tier=0]
         * @param {number} [params.position=0]
         */
        constructor({id, name, amount = 0, unlocked = 'auto', tier = 0, position=0}) {
            if (id in Resource.RESOURCES) {
                throw new Error(`Resource ${id} already exists`);
            }

            this.#id = id;
            this.name = name;
            this.amount = amount;
            this.tier = tier;
            this.#position = position;
            this.#unlocked = unlocked;

            Resource.RESOURCES[id] = this;
        }

        /** @type {boolean} */
        get unlocked() {
            if (this.#unlocked == 'auto' && this.amount > 0) {
                this.#unlocked = true;
                Resource.display_all(true);
            }

            return this.#unlocked === true;
        }
        /** @param {boolean|'auto'} value */
        set unlocked(value) {
            if (value == 'auto') this.#unlocked = value;
            else this.#unlocked = !!value;
        }
        get #per_second() {
            return Object.values(Building.BUILDINGS)
                .filter(b => b.unlocked && b.amount > 0 && b.production && this.#id in b.production)
                .map(b => {
                    let up_mult = Object.values(Upgrade.UPGRADES)
                        .filter(u => u.bought && u.multipliers.buildings && b.id in u.multipliers.buildings)
                        .map(u => u.multipliers.buildings[b.id]+1)
                        .reduce((mult, u_mu) => mult * u_mu, 1);

                    return b.production[this.#id] * b.amount * up_mult;
                })
                .reduce((s, b) => s + b, 0);
        }

        /**
         * Displays the resource
         */
        #display() {
            let html_id = `resource_${this.#id}`;
            /** @type {HTMLTableCellElement} */
            let amount_cell = document.getElementById(`${html_id}_amount`);
            let per_second_cell = document.getElementById(`${html_id}_per_second`);
            let per_second = this.#per_second;

            if (!document.getElementById(html_id)) {
                /** @type {HTMLTableElement} */
                const TABLE = document.getElementById('resources_table');
                let row = document.createElement('tr');
                let name_cell = document.createElement('td');
                amount_cell = document.createElement('td');
                per_second_cell = document.createElement('td');

                name_cell.textContent = this.name;

                row.id = html_id;
                amount_cell.id = `${html_id}_amount`;
                per_second_cell.id = `${html_id}_per_second`;

                row.classList.add(`tier-${this.tier}`);

                row.appendChild(name_cell);
                row.appendChild(amount_cell);
                row.appendChild(per_second_cell);
                TABLE.appendChild(row);
            }

            amount_cell.textContent = beautify(this.amount);
            if (per_second != 0) per_second_cell.textContent = `${beautify(per_second)}/s`;
            else per_second_cell.textContent = '';
        }
    }
    class Building {
        /**
         * Existing buildings
         *
         * @type {{[k: string]: Building}}
         * @readonly
         */
        static BUILDINGS = {};
        /**
         * Displays all the buildings
         *
         * @param {boolean} reset Reset the contents
         */
        static display_all(reset = false) {
            if (reset) {
                /** @type {HTMLDivElement} */
                const DIV = document.getElementById('buildings_div');
                DIV.textContent = '';
            }

            Object.values(this.BUILDINGS)
                .filter(b => b.unlocked)
                .sort((a, b) => a.#position - b.#position)
                .forEach(b => b.#display());
        }
        /**
         * Does the production and damage of all the buildings
         *
         * @param {number} [multiplier=1]
         */
        static produce_all(multiplier = 1) {
            if (multiplier <= 0) return;

            /** @type {{[k: string]: number}} */
            let damage = {};

            Object.values(this.BUILDINGS)
                .filter(b => b.amount > 0)
                .forEach(b => {
                    let up_mult = Object.values(Upgrade.UPGRADES)
                        .filter(u => u.bought && u.multipliers.buildings && b.id in u.multipliers.buildings)
                        .map(u => u.multipliers.buildings[b.id]+1)
                        .reduce((mult, u_mu) => mult * u_mu, 1);

                    Object.entries(b.production)
                        .map(([res, amnt]) => [res, amnt * multiplier * b.amount * up_mult])
                        .forEach(([res, amnt]) => {
                            let up_mult = Object.values(Upgrade.UPGRADES)
                                .filter(u => u.bought && u.multipliers.resources && res in u.multipliers.resources)
                                .map(u => u.multipliers.resources[res]+1)
                                .reduce((mult, u_mu) => mult * u_mu, 1);

                            Resource.RESOURCES[res].amount += amnt * up_mult;
                        });
                    Object.entries(b.damage)
                        .map(([trait, amnt]) => [trait, amnt * multiplier * b.amount * up_mult])
                        .forEach(([trait, amnt]) => {
                            if (!(trait in damage)) damage[trait] = 0;
                            damage[trait] += amnt;
                        });
                });

            Boss.get_current_boss().damage(damage);
        }

        #cost_base;
        #cost_multiplier;
        #unlock_conditions;
        #position;
        #unlocked;

        /**
         * @param {Object} params
         * @param {string} params.id
         * @param {string} params.name
         * @param {number} [params.amount=0]
         * @param {{[k: string]: number}} params.cost_base
         * @param {number} params.cost_multiplier
         * @param {{
         *  bosses?: {[k: string]: number},
         *  resources?: {[k: string]: number},
         *  buildings?: {[k: string]: number},
         *  upgrades?: string[],
         * }} [params.unlock_conditions=null] Conditions to unlock
         * @param {{[k: string]: number}|null} [params.damage=null]
         * @param {{[k: string]: number}|null} [params.production=null]
         * @param {string|number} [params.tier=0]
         * @param {number} [params.position=0]
         */
        constructor({id, name, amount=0, cost_base, cost_multiplier, unlock_conditions=null, damage=null, production=null, tier=0, position=0}) {
            if (id in Building.BUILDINGS) {
                throw new Error(`Building ${id} already exists`);
            }

            this.id = id;
            this.name = name;
            this.amount = amount;
            this.#cost_base = cost_base;
            this.#cost_multiplier = cost_multiplier;
            this.damage = damage;
            this.production = production;
            this.#unlock_conditions = unlock_conditions;
            this.tier = tier;
            this.#position = position;
            this.#unlocked = !(unlock_conditions ?? false);

            Building.BUILDINGS[id] = this;
        }

        /** @type {boolean} */
        get unlocked() {
            if (!this.#unlocked) {
                let {bosses={}, resources={}, buildings={}, upgrades=[]} = this.#unlock_conditions;

                let can_unlock = true;
                Object.entries(bosses).forEach(([boss, amount]) => {
                    if (!can_unlock || !(boss in Boss.BOSSES)) return;

                    can_unlock &&= Boss.BOSSES[boss].defeats >= amount;
                });
                Object.entries(resources).forEach(([resource, amount]) => {
                    if (!can_unlock || !(resource in Resource.RESOURCES)) return;

                    can_unlock &&= Resource.RESOURCES[resource].amount >= amount;
                });
                Object.entries(buildings).forEach(([building, amount]) => {
                    if (!can_unlock || !(building in Building.BUILDINGS)) return;

                    can_unlock &&= Building.BUILDINGS[building].amount >= amount;
                });
                upgrades.forEach(upgrade => {
                    if (!can_unlock || !(upgrade in Upgrade.UPGRADES)) return;

                    can_unlock &&= Upgrade.UPGRADES[upgrade].bought;
                });

                this.#unlocked = can_unlock;
                if (can_unlock) Building.display_all(true);
            }

            return this.#unlocked;
        }
        set unlocked(value) {
            this.#unlocked = !!value;
        }
        get #cost() {
            if (!this.#cost_base) return {};

            let multiplier = this.#cost_multiplier ** this.amount;

            return Object.fromEntries(Object.entries(this.#cost_base).map(([resource, amount]) => [resource, amount * multiplier]));
        }
        get #can_afford() {
            return Object.entries(this.#cost)
                .every(([r, a]) => Resource.RESOURCES[r].amount >= a);
        }

        /**
         * Displays the building
         */
        #display() {
            let html_id = `building_${this.id}`;
            let amount_b = document.getElementById(`${html_id}_amount`);
            /** @type {HTMLTableElement} */
            let cost_table = document.getElementById(`${html_id}_cost`);

            if (!document.getElementById(html_id)) {
                /** @type {HTMLDivElement} */
                const DIV = document.getElementById('buildings_div');
                let button = document.createElement('button');
                let title_div = document.createElement('div');
                let title_b = document.createElement('b');
                amount_b = document.createElement('span');
                let target_traits = Object.keys(this.damage ?? {});
                cost_table = document.createElement('table');

                button.id = html_id;
                amount_b.id = `${html_id}_amount`;
                cost_table.id = `${html_id}_cost`;

                button.classList.add('building', `tier-${this.tier}`);
                if (target_traits.length <= 1) {
                    button.style.backgroundColor = Trait.TRAITS[target_traits[0] ?? 'none'].color;
                } else if (target_traits.length > 1) {
                    let colors = target_traits.filter(t => t in Trait.TRAITS).map(t => Trait.TRAITS[t].color).join(', ');
                    button.style.backgroundImage = `linear-gradient(to right, ${colors})`;
                }

                title_b.textContent = `${this.name} `;

                button.addEventListener('mouseenter', e => tooltip(this.#get_tooltip.bind(this), [button.offsetLeft, button.offsetTop + button.offsetHeight]));
                button.addEventListener('mouseleave', e => un_tooltip());
                button.addEventListener('click', e => this.#purchase());

                title_b.appendChild(amount_b);
                title_div.appendChild(title_b);
                button.appendChild(title_div);
                button.appendChild(cost_table);
                DIV.appendChild(button);
            }

            amount_b.textContent = `(${beautify(this.amount, true)})`;
            cost_table.classList[this.#can_afford ? 'remove' : 'add']('cant-afford');
            Object.entries(this.#cost).forEach(([resource, amount]) => {
                let amount_cell = document.getElementById(`${html_id}_cost_${resource}_amount`);
                let res = Resource.RESOURCES[resource];

                if (!amount_cell) {
                    let row = document.createElement('tr');
                    let name_cell = document.createElement('td');
                    amount_cell = document.createElement('td');

                    name_cell.textContent = res.name;
                    amount_cell.id = `${html_id}_cost_${resource}_amount`;

                    row.appendChild(name_cell);
                    row.appendChild(amount_cell);
                    cost_table.appendChild(row);
                }

                amount_cell.textContent = `${beautify(res.amount)} / ${beautify(amount)}`;
            });
        }
        /**
         * @private
         */
        #get_tooltip() {
            let rows = [];
            let cost = this.#cost;
            let up_mult = Object.values(Upgrade.UPGRADES)
                .filter(u => u.bought && u.multipliers.buildings && this.id in u.multipliers.buildings)
                .map(u => u.multipliers.buildings[this.id]+1)
                .reduce((mult, u_mu) => mult * u_mu, 1);

            // Cost
            if (Object.keys(cost).length) {
                let table = document.createElement('table');
                let table_title_row = document.createElement('tr');
                let table_title = document.createElement('td');
                let table_title_b = document.createElement('b');

                table_title.colSpan = 2;
                table_title_b.textContent = gettext('games_idle_buildings_cost');

                table_title.appendChild(table_title_b);
                table_title_row.appendChild(table_title);
                table.appendChild(table_title_row);

                Object.entries(cost).forEach(([resource, amount]) => {
                    if (!amount) return;
                    let row = document.createElement('tr');
                    let name_cell = document.createElement('td');
                    let amount_cell = document.createElement('td');
                    let res = Resource.RESOURCES[resource];

                    name_cell.textContent = res.name;
                    amount_cell.textContent = `${beautify(res.amount)} / ${beautify(amount)}`;

                    row.appendChild(name_cell);
                    row.appendChild(amount_cell);
                    table.appendChild(row);
                });
                table.classList[this.#can_afford ? 'remove' : 'add']('cant-afford');

                rows.push(table);
            }

            // Production
            if (Object.keys(this.production ?? {}).length) {
                let table = document.createElement('table');
                let table_title_row = document.createElement('tr');
                let table_title = document.createElement('td');
                let table_title_b = document.createElement('b');

                table_title.colSpan = 2;
                table_title_b.textContent = gettext('games_idle_buildings_production');

                table_title.appendChild(table_title_b);
                table_title_row.appendChild(table_title);
                table.appendChild(table_title_row);

                Object.entries(this.production).forEach(([resource, amount]) => {
                    if (!amount) return;
                    let row = document.createElement('tr');
                    let name_cell = document.createElement('td');
                    let amount_cell = document.createElement('td');
                    let res = Resource.RESOURCES[resource];

                    name_cell.textContent = res.name;
                    amount_cell.textContent = `${beautify(amount * this.amount * up_mult)} (+${beautify(amount * up_mult)})`;

                    row.appendChild(name_cell);
                    row.appendChild(amount_cell);
                    table.appendChild(row);
                });

                rows.push(table);
            }

            // Damage
            if (Object.keys(this.damage ?? {}).length) {
                let table = document.createElement('table');
                let table_title_row = document.createElement('tr');
                let table_title = document.createElement('td');
                let table_title_b = document.createElement('b');

                table_title.colSpan = 2;
                table_title_b.textContent = gettext('games_idle_buildings_damage');

                table_title.appendChild(table_title_b);
                table_title_row.appendChild(table_title);
                table.appendChild(table_title_row);

                Object.entries(this.damage).forEach(([trait, amount]) => {
                    if (!amount) return;
                    let row = document.createElement('tr');
                    let name_cell = document.createElement('td');
                    let amount_cell = document.createElement('td');
                    let trt = Trait.TRAITS[trait];

                    row.style.color = trt.color;

                    name_cell.textContent = trt.name;
                    amount_cell.textContent = `${beautify(amount * this.amount * up_mult)} (+${beautify(amount * up_mult)})`;

                    row.appendChild(name_cell);
                    row.appendChild(amount_cell);
                    table.appendChild(row);
                });

                rows.push(table);
            }

            if (!rows.length) return null;
            // Put all in one
            let result = document.createElement('div');
            result.appendChild(rows.shift());

            rows.forEach(e => {
                result.appendChild(document.createElement('hr'));
                result.appendChild(e);
            });

            return result;
        }
        /**
         * Purchases one building
         */
        #purchase() {
            if (!this.#can_afford) return;

            Object.entries(this.#cost)
                .forEach(([res, amnt]) => Resource.RESOURCES[res].amount -= amnt);

            this.amount++;
        }
    }
    class Upgrade {
        /**
         * Existing upgrades
         *
         * @type {{[k: string]: Upgrade}}
         * @readonly
         */
        static UPGRADES = {};
        /**
         * Displays all the upgrades
         *
         * @param {boolean} reset Reset the contents
         */
        static display_all(reset = false) {
            if (reset) {
                /** @type {HTMLDivElement} */
                const DIV = document.getElementById('upgrades_div');
                DIV.textContent = '';
            }

            Object.values(this.UPGRADES)
                .filter(u => u.unlocked)
                .sort((a, b) => {
                    if (a.bought != b.bought) {
                        return a.bought - b.bought;
                    } else if (a.can_afford != b.can_afford) {
                        return a.can_afford - b.can_afford;
                    } else {
                        return a.#position - b.#position;
                    }
                }).forEach(u => u.display());
        }
        /**
         * @param {string} id
         * @returns {() => HTMLDivElement}
         * @private
         */
        static _get_tooltip(id) {
            let target = Upgrade.UPGRADES[id];
            return Upgrade.prototype._get_tooltip.bind(target);
        }

        #id;
        #name;
        #cost;
        #unlock_conditions;
        #unlocked;
        #tier;
        #position;

        /**
         * @param {Object} params
         * @param {string} params.id
         * @param {string} params.name
         * @param {{[k: string]: number}} params.cost
         * @param {{
         *  bosses?: {[k: string]: number},
         *  resources?: {[k: string]: number},
         *  buildings?: {[k: string]: number},
         *  upgrades?: string[],
         * }} [params.unlock_conditions=null] Conditions to unlock
         * @param {{
         *  bosses?: {[k: string]: number},
         *  resources?: {[k: string]: number},
         *  buildings?: {[k: string]: number},
         *  traits?: {[k: string]: number},
         * }} [params.multipliers=null] Multipliers to productions for all, and damage for building. 1 is automatically added, so .5 => *1.5
         * @param {string|number} [params.tier=0]
         * @param {number} [params.position=0]
         */
        constructor({id, name, cost, unlock_conditions=null, multipliers=null, tier=0, position=0}) {
            if (id in Upgrade.UPGRADES) {
                throw new Error(`Upgrade ${id} already exists`);
            }

            this.#id = id;
            this.#name = name;
            this.#cost = cost;
            this.#unlock_conditions = unlock_conditions;
            this.multipliers = multipliers;
            this.#unlocked = !(unlock_conditions ?? false);
            this.bought = false;
            this.#tier = tier;
            this.#position = position;

            Upgrade.UPGRADES[id] = this;
        }

        /** @type {boolean} */
        get unlocked() {
            if (!this.#unlocked) {
                let {bosses={}, resources={}, buildings={}, upgrades=[]} = this.#unlock_conditions;

                let can_unlock = true;
                Object.entries(bosses).forEach(([boss, amount]) => {
                    if (!can_unlock || !(boss in Boss.BOSSES)) return;

                    can_unlock &&= Boss.BOSSES[boss].defeats >= amount;
                });
                Object.entries(resources).forEach(([resource, amount]) => {
                    if (!can_unlock || !(resource in Resource.RESOURCES)) return;

                    can_unlock &&= Resource.RESOURCES[resource].amount >= amount;
                });
                Object.entries(buildings).forEach(([building, amount]) => {
                    if (!can_unlock || !(building in Building.BUILDINGS)) return;

                    can_unlock &&= Building.BUILDINGS[building].amount >= amount;
                });
                upgrades.forEach(upgrade => {
                    if (!can_unlock || !(upgrade in Upgrade.UPGRADES)) return;

                    can_unlock &&= Upgrade.UPGRADES[upgrade].bought;
                });

                this.#unlocked = can_unlock;
                if (can_unlock) Upgrade.display_all(true);
            }

            return this.#unlocked;
        }
        set unlocked(value) {
            this.#unlocked = !!value;
        }
        get can_afford() {
            return Object.entries(this.#cost)
                .every(([r, a]) => Resource.RESOURCES[r].amount >= a);
        }

        /**
         * Displays the upgrade
         */
        display() {
            let html_id = `upgrade_${this.#id}`;
            /** @type {HTMLButtonElement} */
            let button = document.getElementById(html_id);
            /** @type {HTMLTableElement|null} */
            let cost_table = document.getElementById(`${html_id}_cost`);

            if (!button) {
                /** @type {HTMLDivElement} */
                const DIV = document.getElementById('upgrades_div');
                button = document.createElement('button');
                let title_div = document.createElement('div');
                let title_b = document.createElement('b');
                cost_table = document.createElement('table');

                button.id = html_id;
                cost_table.id = `${html_id}_cost`;

                button.classList.add(`tier-${this.#tier}`);

                title_b.textContent = `${this.#name} `;

                button.addEventListener('mouseenter', e => {
                    let pos = [button.offsetLeft, button.offsetTop + button.offsetHeight];
                    tooltip(Upgrade._get_tooltip(this.#id), pos);
                });
                button.addEventListener('mouseleave', e => un_tooltip());
                button.addEventListener('click', e => this.purchase());

                title_div.appendChild(title_b);
                button.appendChild(title_div);
                button.appendChild(cost_table);
                DIV.appendChild(button);
            }

            if (this.bought) {
                button.disabled = true;
                if (cost_table) cost_table.parentElement.removeChild(cost_table);
            } else if (cost_table) {
                cost_table.classList[this.can_afford ? 'remove' : 'add']('cant-afford');
                Object.entries(this.#cost).forEach(([resource, amount]) => {
                    let amount_cell = document.getElementById(`${html_id}_cost_${resource}_amount`);
                    let res = Resource.RESOURCES[resource];

                    if (!amount_cell) {
                        let row = document.createElement('tr');
                        let name_cell = document.createElement('td');
                        amount_cell = document.createElement('td');

                        name_cell.textContent = res.name;
                        amount_cell.id = `${html_id}_cost_${resource}_amount`;

                        row.appendChild(name_cell);
                        row.appendChild(amount_cell);
                        cost_table.appendChild(row);
                    }

                    amount_cell.textContent = `${beautify(res.amount)} / ${beautify(amount)}`;
                });
            }
        }
        /**
         * @private
         */
        _get_tooltip() {
            let rows = [];

            // Costs
            if (Object.keys(this.#cost).length) {
                let table = document.createElement('table');
                let table_title_row = document.createElement('tr');
                let table_title = document.createElement('td');
                let table_title_b = document.createElement('b');

                table_title.colSpan = 2;
                table_title_b.textContent = gettext('games_idle_upgradess_cost');

                table_title.appendChild(table_title_b);
                table_title_row.appendChild(table_title);
                table.appendChild(table_title_row);

                Object.entries(this.#cost).forEach(([resource, amount]) => {
                    let row = document.createElement('tr');
                    let name_cell = document.createElement('td');
                    let amount_cell = document.createElement('td');
                    let res = Resource.RESOURCES[resource];

                    name_cell.textContent = res.name;
                    amount_cell.textContent = `${beautify(res.amount)} / ${beautify(amount)}`;

                    row.appendChild(name_cell);
                    row.appendChild(amount_cell);
                    table.appendChild(row);
                });
                table.classList[this.can_afford ? 'remove' : 'add']('cant-afford');

                rows.push(table);
            }

            // Multipliers
            if (Object.keys(this.multipliers).length) {
                let {bosses={}, resources={}, buildings={}} = this.multipliers;
                let table = document.createElement('table');
                let table_title_row = document.createElement('tr');
                let table_title = document.createElement('td');
                let table_title_b = document.createElement('b');

                table_title.colSpan = 2;
                table_title_b.textContent = gettext('games_idle_upgradess_multipliers');

                table_title.appendChild(table_title_b);
                table_title_row.appendChild(table_title);
                table.appendChild(table_title_row);

                Object.entries(bosses).forEach(([boss, amount]) => {
                    let row = document.createElement('tr');
                    let name_cell = document.createElement('td');
                    let amount_cell = document.createElement('td');
                    let bos = Boss.BOSSES[boss];

                    name_cell.textContent = bos.name;
                    amount_cell.textContent = `*${beautify((amount+1)*100)}`;

                    row.appendChild(name_cell);
                    row.appendChild(amount_cell);
                    table.appendChild(row);
                });
                Object.entries(resources).forEach(([resource, amount]) => {
                    let row = document.createElement('tr');
                    let name_cell = document.createElement('td');
                    let amount_cell = document.createElement('td');
                    let res = Resource.RESOURCES[resource];

                    name_cell.textContent = res.name;
                    amount_cell.textContent = `*${beautify((amount+1)*100)}`;

                    row.appendChild(name_cell);
                    row.appendChild(amount_cell);
                    table.appendChild(row);
                });
                Object.entries(buildings).forEach(([building, amount]) => {
                    let row = document.createElement('tr');
                    let name_cell = document.createElement('td');
                    let amount_cell = document.createElement('td');
                    let build = Building.BUILDINGS[building];

                    name_cell.textContent = build.name;
                    amount_cell.textContent = `*${beautify((amount+1)*100)}%`;

                    row.appendChild(name_cell);
                    row.appendChild(amount_cell);
                    table.appendChild(row);
                });

                if (Object.keys(bosses).length || Object.keys(resources).length || Object.keys(buildings).length) {
                    rows.push(table);
                }
            }

            if (!rows.length) return null;
            // Put all in one
            let result = document.createElement('div');
            result.appendChild(rows.shift());

            rows.forEach(e => {
                result.appendChild(document.createElement('hr'));
                result.appendChild(e);
            });

            return result;
        }
        /**
         * Purchases the upgrade
         */
        purchase() {
            if (!this.can_afford) return;

            Object.entries(this.#cost)
                .forEach(([res, amnt]) => Resource.RESOURCES[res].amount -= amnt);

            this.bought = true;
        }
    }
    class Prestige {
        /**
         * @type {{[k: number]: Prestige}}
         */
        static PRESTIGES = {};
        /**
         * Displays all the prestiges
         *
         * @param {boolean} reset Reset the contents
         */
        static display_all(reset = false) {
            if (reset) {
                /** @type {HTMLDivElement} */
                const DIV = document.getElementById('prestige_div');
                DIV.textContent = '';
            }

            Object.values(this.PRESTIGES)
                .filter(p => p.unlocked)
                .sort((a,b) => b.id - a.id)
                .forEach(p => p.display());
        }

        #text;
        /** @type {(this: Prestige) => boolean} */
        #conditions;
        #unlocked;

        /**
         * @param {Object} params
         * @param {number} params.id
         * @param {string} params.text
         * @param {(this: Prestige)=>boolean} params.conditions
         * @param {(this: Prestige)=>void} [params.effect]
         */
        constructor({id, text, conditions, effect=()=>{}}) {
            if (id in Prestige.PRESTIGES) {
                throw new Error(`Prestige layer ${id} already exists`);
            }

            this.id = id;
            this.#text = text;
            this.#conditions = conditions.bind(this);
            /** @type {(this: Prestige) => void} */
            this.effect = effect.bind(this);
            this.#unlocked = this.#conditions();

            Prestige.PRESTIGES[id] = this;
        }

        get unlocked() {
            if (!this.#unlocked) this.#unlocked = this.#conditions();

            return this.#unlocked;
        }
        set unlocked(value) {
            this.#unlocked = !!value;
        }
        /**
         * Displays the prestige
         */
        display() {
            let html_id = `prestige_${this.id}`;

            if (!document.getElementById(html_id)) {
                const DIV = document.getElementById('prestige_div');
                let button = document.createElement('button');

                button.id = html_id;
                button.textContent = this.#text;
                button.classList.add(`tier-${this.id}`);
                button.addEventListener('click', e => this.effect());

                DIV.appendChild(button);
            }
        }
    }

    /**
     * Makes a number look good
     *
     * @param {number} number
     * @param {boolean} trim If true, trailing 0s are removed
     * @param {number} min_short Minimum e/3 at which to shorten
     * @returns {string}
     */
    function beautify(number, trim = false, min_short = 2) {
        if (isNaN(number)) return '0';
        if (!isFinite(number)) (number < 0 ? '-' : '') + '∞';
        let num = String(BigInt(Math.floor(number)));
        let part = String(BigInt(Math.floor((Math.abs(number) * 1e3) % 1e3)));
        let e = 0;
        let end = '';

        if (num.length > 3 * min_short) {
            while (num.length > 3) {
                part = num.slice(-3);
                num = num.slice(0, -3);
                e++;
            }
        }

        if (e >= min_short) {
            end = UNITS[unit].units[e] || `e${e * 3}`;
        }
        if (Number(part) || !trim) {
            while (part.length < 3) {
                part = `0${part}`;
            }
            part = `.${part}`;
            while (part.endsWith('0') && trim) {
                part = part.slice(0, -1);
            }
        } else {
            part = '';
        }

        return `${num}${part}${end}`.trimEnd();
    }
    /**
     * Spawns a tooltip at a specific location
     *
     * @param {string|HTMLElement|() => string|HTMLElement} text
     * @param {[number, number]} position [left, top]
     */
    function tooltip(text, position) {
        if (!text) return;

        let tooltip = document.getElementById('idle_tooltip');
        if (!tooltip) {
            tooltip = document.createElement('div');
            tooltip.style.position = 'absolute';

            tooltip.id = 'idle_tooltip';

            document.body.appendChild(tooltip);
        }
        clearInterval(tooltip_interval);

        tooltip.style.left = `${position[0]}px`;
        tooltip.style.top = `${position[1]}px`;
        tooltip.style.display = 'block';

        if (typeof text != 'function') {
            if (typeof text == 'string') {
                tooltip.innerHTML = text;
            } else {
                tooltip.textContent = '';
                tooltip.appendChild(text);
            }
        } else {
            tooltip_interval = setInterval(() => {
                let content = text();
                if (typeof content == 'string') {
                    tooltip.innerHTML = content;
                } else {
                    tooltip.textContent = '';
                    tooltip.appendChild(content);
                }
            }, 1e3/TPS_ACTIVE);
        }
    }
    /**
     * Hides the tooltip
     */
    function un_tooltip() {
        let tooltip = document.getElementById('idle_tooltip');
        if (!tooltip) return;

        clearInterval(tooltip_interval);
        tooltip.style.display = 'none';
        tooltip.textContent = '';
    }
    /**
     * Does what a click does
     */
    function click() {
        let {damage, production} = CLICKER;

        Boss.get_current_boss().damage(damage);

        Object.entries(production).forEach(([res, amount]) => {
            if (res in Resource.RESOURCES) Resource.RESOURCES[res].amount += amount;
        });
    }
    /**
     * Starts the game
     */
    function init() {
        create_traits();
        create_bosses();
        create_resources();
        create_buildings();
        create_upgrades();
        create_prestiges();
        create_tiers_css();

        last_production = Date.now();

        document.addEventListener('focus', e => has_focus = true);
        document.addEventListener('blur', e => {
            has_focus = false;
            un_tooltip();
        });

        requestAnimationFrame(loop);
    }
    /**
     * Main game loop
     */
    function loop() {
        let now = Date.now();
        Building.produce_all((now - last_production) / 1e3);
        last_production = now;

        Resource.display_all();
        Boss.boss_display();
        Upgrade.display_all();
        Building.display_all();
        Trait.display_damage();
        Prestige.display_all();

        requestAnimationFrame(loop);
    }
    /**
     * Gets the opposite of a color in either black or white
     *
     * @param {string} color
     * @returns {string}
     */
    function anti_bicolor(color) {
        let red = 0;
        let green = 0;
        let blue = 0;
        let result = '#';

        if (color.startsWith('#')) color = color.slice(1);
        if (color.length == 3) {
            red = parseInt(color.substr(0, 1), 16) * 0x11;
            green = parseInt(color.substr(1, 1), 16) * 0x11;
            blue = parseInt(color.substr(2, 1), 16) * 0x11;
        } else {
            red = parseInt(color.substr(0, 2), 16);
            green = parseInt(color.substr(2, 2), 16);
            blue = parseInt(color.substr(4, 2), 16);
        }

        if ((red + green + blue) / 3 > 127) {
            result += '000000';
        } else {
            result += 'ffffff';
        }

        return result;
    }
    /**
     * Creates the CSS for the tiers
     */
    function create_tiers_css() {
        let style = document.createElement('style');

        for (let t in TIERS) {
            let tier = TIERS[t].style;
            let content = Object.entries(tier).map(([prop, val]) => `${prop}: ${val};`).join('\r\n');

            style.innerHTML += `.tier-${t} {\r\n` + content + '\r\n}'
        }

        document.head.appendChild(style);
    }
    /**
     * Creates the traits
     */
    function create_traits() {
        /**
         * @type {{
         *  id: string,
         *  name: string,
         *  color: string,
         *  multipliers?: {[k: string]: number},
         * }[]}
         */
        let traits = [
            // bases
            {
                id: 'none',
                name: gettext('games_idle_trait_none'),
                color: '#fff',
                multipliers: {
                    magic: 1/2,
                },
            },
            {
                id: 'magic',
                name: gettext('games_idle_trait_magic'),
                color: '#f0f',
                multipliers: {
                    none: 1/2,
                },
            },
            {
                id: 'boss',
                name: gettext('games_idle_trait_boss'),
                color: '#ccc',
            },
            // base 4 elements
            {
                id: 'air',
                name: gettext('games_idle_trait_air'),
                color: '#ff7',
                multipliers: {
                    fire: 1/2,
                    earth: 2,
                    sound: 1/3,
                    metal: 3,
                },
            },
            {
                id: 'earth',
                name: gettext('games_idle_trait_earth'),
                color: '#730',
                multipliers: {
                    air: 1/2,
                    metal: 3,
                    electricity: 1/3,
                },
            },
            {
                id: 'fire',
                name: gettext('games_idle_trait_fire'),
                color: '#f70',
                multipliers: {
                    air: 1/2,
                    water: 2,
                    ice: 1/3,
                },
            },
            {
                id: 'water',
                name: gettext('games_idle_trait_water'),
                color: '#00f',
                multipliers: {
                    fire: 1/2,
                    sound: 3,
                    metal: 1/3,
                    electricity: 3,
                    ice: 3,
                },
            },
            // alt 4 elements
            {
                id: 'sound',
                name: gettext('games_idle_trait_sound'),
                color: '#770',
                multipliers: {
                    air: 3,
                    water: 1/3,
                },
            },
            {
                id: 'metal',
                name: gettext('games_idle_trait_metal'),
                color: '#777',
                multipliers: {
                    air: 1/3,
                    earth: 1/3,
                    water: 3,
                    ice: 1/2,
                    electricity: 2,
                },
            },
            {
                id: 'electricity',
                name: gettext('games_idle_trait_electricity'),
                color: '#ff0',
                multipliers: {
                    earth: 3,
                    water: 1/3,
                    metal: 1/2,
                },
            },
            {
                id: 'ice',
                name: gettext('games_idle_trait_ice'),
                color: '#77f',
                multipliers: {
                    fire: 3,
                    water: 1/3,
                    metal: 2,
                },
            },
        ];

        traits.forEach(trait => {
            if (trait.id in Trait.TRAITS) return;

            new Trait(trait);
        });
    }
    /**
     * Creates the bosses
     */
    function create_bosses() {
        /**
         * @type {{
         *  id: string,
         *  name: string,
         *  next: string,
         *  health: number,
         *  traits?: string[],
         *  drops?: {[k: string]: number|[number,number,number?]},
         *  tier?: string|number,
         * }[]}
         */
        let bosses = [
            //#region Tutorial
            {
                id: 'small_dummy',
                name: gettext('games_idle_boss_small_dummy'),
                traits: ['none'],
                health: 1e4, //1e4 * 10 ** 0
                drops: {
                    'knowledge': 1,
                    'points' : 1e4 / 10,
                },
                tier: 'tutorial',
                next: 'medium_dummy',
            },
            {
                id: 'medium_dummy',
                name: gettext('games_idle_boss_medium_dummy'),
                traits: ['none'],
                health: 1e5, //1e4 * 10 ** 1
                drops: {
                    'knowledge': 1,
                    'points' : 1e5 / 10,
                },
                tier: 'tutorial',
                next: 'big_dummy',
            },
            {
                id: 'big_dummy',
                name: gettext('games_idle_boss_big_dummy'),
                traits: ['none'],
                health: 1e6, //1e4 * 10 ** 2
                drops: {
                    'knowledge': 1,
                    'points' : 1e6 / 10,
                },
                tier: 'tutorial',
                next: 'crash_dummy',
            },
            {
                id: 'crash_dummy',
                name: gettext('games_idle_boss_crash_dummy'),
                traits: ['none'],
                health: 1e7, //1e4 * 10 ** 3
                drops: {
                    'knowledge': 1,
                    'points' : 1e7 / 10,
                },
                tier: 'tutorial',
                next: 'boss_dummy',
            },
            {
                id: 'boss_dummy',
                name: gettext('games_idle_boss_boss_dummy'),
                traits: ['none', 'boss'],
                health: 1e8, //1e4 * 10 ** 4
                drops: {
                    'knowledge': 1,
                    'points' : 1e8 / 10,
                    'common_loot': 4 ** 0,
                },
                tier: 'tutorial',
                next: 'clear_slime',
            },
            //#endregion Tutorial
            //#region Slimy Plains
            {
                id: 'clear_slime',
                name: gettext('games_idle_boss_clear_slime'),
                traits: ['magic', 'water'],
                health: 1e10, //1e10 * 11 ** (2 * 0)
                drops: {
                    'knowledge': 2,
                    'magic_powder' : 1e10 / 9 / 2,
                    'droplets' : 1e10 / 9 / 2,
                },
                tier: 'slimy_field',
                next: 'red_slime',
            },
            {
                id: 'red_slime',
                name: gettext('games_idle_boss_red_slime'),
                traits: ['magic', 'water'],
                health: 1.21e12, //1e10 * 11 ** (2 * 1)
                drops: {
                    'knowledge': 2,
                    'magic_powder' : 1.21e12 / 9 / 2,
                    'droplets' : 1.21e12 / 9 / 2,
                },
                tier: 'slimy_field',
                next: 'green_slime',
            },
            {
                id: 'green_slime',
                name: gettext('games_idle_boss_green_slime'),
                traits: ['magic', 'water'],
                health: 1.46e14, //1e10 * 11 ** (2 * 2)
                drops: {
                    'knowledge': 2,
                    'magic_powder' : 1.46e14 / 9 / 2,
                    'droplets' : 1.46e14 / 9 / 2,
                },
                tier: 'slimy_field',
                next: 'blue_slime',
            },
            {
                id: 'blue_slime',
                name: gettext('games_idle_boss_blue_slime'),
                traits: ['magic', 'water'],
                health: 1.77e16, //1e10 * 11 ** (2 * 3)
                drops: {
                    'knowledge': 2,
                    'magic_powder' : 1.77e16 / 9 / 2,
                    'droplets' : 1.77e16 / 9 / 2,
                },
                tier: 'slimy_field',
                next: 'yellow_slime',
            },
            {
                id: 'yellow_slime',
                name: gettext('games_idle_boss_yellow_slime'),
                traits: ['magic', 'water'],
                health: 2.14e18, //1e10 * 11 ** (2 * 4)
                drops: {
                    'knowledge': 2,
                    'magic_powder' : 2.14e18 / 9 / 2,
                    'droplets' : 2.14e18 / 9 / 2,
                },
                tier: 'slimy_field',
                next: 'magenta_slime',
            },
            {
                id: 'magenta_slime',
                name: gettext('games_idle_boss_magenta_slime'),
                traits: ['magic', 'water'],
                health: 2.59e20, //1e10 * 11 ** (2 * 5)
                drops: {
                    'knowledge': 2,
                    'magic_powder' : 2.59e20 / 9 / 2,
                    'droplets' : 2.59e20 / 9 / 2,
                },
                tier: 'slimy_field',
                next: 'cyan_slime',
            },
            {
                id: 'cyan_slime',
                name: gettext('games_idle_boss_cyan_slime'),
                traits: ['magic', 'water'],
                health: 3.13e22, //1e10 * 11 ** (2 * 6)
                drops: {
                    'knowledge': 2,
                    'magic_powder' : 3.13e22 / 9 / 2,
                    'droplets' : 3.13e22 / 9 / 2,
                },
                tier: 'slimy_field',
                next: 'white_slime',
            },
            {
                id: 'white_slime',
                name: gettext('games_idle_boss_white_slime'),
                traits: ['magic', 'water'],
                health: 3.79e24, //1e10 * 11 ** (2 * 7)
                drops: {
                    'knowledge': 2,
                    'magic_powder' : 3.79e24 / 9 / 2,
                    'droplets' : 3.79e24 / 9 / 2,
                },
                tier: 'slimy_field',
                next: 'black_slime',
            },
            {
                id: 'black_slime',
                name: gettext('games_idle_boss_black_slime'),
                traits: ['magic', 'water'],
                health: 4.59e26, //1e10 * 11 ** (2 * 8)
                drops: {
                    'knowledge': 2,
                    'magic_powder' : 4.59e26 / 9 / 2,
                    'droplets' : 4.59e26 / 9 / 2,
                },
                tier: 'slimy_field',
                next: 'giant_slime',
            },
            {
                id: 'giant_slime',
                name: gettext('games_idle_boss_giant_slime'),
                traits: ['magic', 'water'],
                health: 5.55e28, //1e10 * 11 ** (2 * 9)
                drops: {
                    'knowledge': 2,
                    'magic_powder' : 5.55e28 / 9 / 2,
                    'droplets' : 5.55e28 / 9 / 2,
                    'common_loot': 4 ** 1,
                },
                tier: 'slimy_field',
                next: 'infinity',
            },
            //#endregion Slimy Plains
            //todo
            //#region Divine
            {
                id: 'infinity',
                name: gettext('games_idle_boss_infinity'),
                traits: Object.keys(Trait.TRAITS),
                health: 1e308,
                drops: {
                    'infinity_shard': 1,
                },
                tier: 'divine',
                next: 'infinity',
            },
            //#endregion Divine
        ];

        bosses.forEach(boss => {
            if (boss.id in Boss.BOSSES) return;

            new Boss(boss);
        });
    }
    /**
     * Creates the resources
     */
    function create_resources() {
        /**
         * @type {{
         *  id: string,
         *  name: string,
         *  amount?: number,
         *  unlocked?: boolean|'auto',
         *  tier?: string|number
         *  position?: number
         * }[]}
         */
        let resources = [
            //#region T0 Resources
            {
                id: 'knowledge',
                name: gettext('games_idle_resource_knowledge'),
                tier: 0,
            },
            {
                id: 'points',
                name: gettext('games_idle_resource_points'),
                unlocked: true,
                tier: 0,
            },
            {
                id: 'magic_powder',
                name: gettext('games_idle_resource_magic_powder'),
                tier: 0,
            },
            {
                id: 'common_loot',
                name: gettext('games_idle_resource_common_loot'),
                tier: 0,
            },
            {
                id: 'dust',
                name: gettext('games_idle_resource_dust'),
                tier: 0,
            },
            {
                id: 'pebbles',
                name: gettext('games_idle_resource_pebbles'),
                tier: 0,
            },
            {
                id: 'embers',
                name: gettext('games_idle_resource_embers'),
                tier: 0,
            },
            {
                id: 'droplets',
                name: gettext('games_idle_resource_droplets'),
                tier: 0,
            },
            {
                id: 'waves',
                name: gettext('games_idle_resource_waves'),
                tier: 0,
            },
            {
                id: 'scraps',
                name: gettext('games_idle_resource_scraps'),
                tier: 0,
            },
            {
                id: 'sparks',
                name: gettext('games_idle_resource_sparks'),
                tier: 0,
            },
            {
                id: 'snowflakes',
                name: gettext('games_idle_resource_snowflakes'),
                tier: 0,
            },
            //#endregion T0 Resources
            //#region T1 Resources
            {
                id: 'relics',
                name: gettext('games_idle_resource_relics'),
                tier: 1,
            },
            {
                id: 'prestige',
                name: gettext('games_idle_resource_prestige'),
                tier: 1,
            },
            {
                id: 'magic_shards',
                name: gettext('games_idle_resource_magic_shards'),
                tier: 1,
            },
            {
                id: 'uncommon_loot',
                name: gettext('games_idle_resource_uncommon_loot'),
                tier: 1,
            },
            {
                id: 'dust_balls',
                name: gettext('games_idle_resource_dust_balls'),
                tier: 1,
            },
            {
                id: 'rocks',
                name: gettext('games_idle_resource_rocks'),
                tier: 1,
            },
            {
                id: 'flames',
                name: gettext('games_idle_resource_flames'),
                tier: 1,
            },
            {
                id: 'drops',
                name: gettext('games_idle_resource_drops'),
                tier: 1,
            },
            {
                id: 'notes',
                name: gettext('games_idle_resource_notes'),
                tier: 1,
            },
            {
                id: 'nuggets',
                name: gettext('games_idle_resource_nuggets'),
                tier: 1,
            },
            {
                id: 'arcs',
                name: gettext('games_idle_resource_arcs'),
                tier: 1,
            },
            {
                id: 'mush',
                name: gettext('games_idle_resource_mush'),
                tier: 1,
            },
            //#endregion T1 Resources
        ];

        resources.forEach((resource, index) => {
            if (resource.id in Resource.RESOURCES) return;

            resource.position ??= index;

            new Resource(resource);
        });
    }
    /**
     * Creates the buildings
     */
    function create_buildings() {
        /**
         * @type {{
         *  id: string,
         *  name: string,
         *  amount?: number,
         *  cost_base: {[k: string]: number},
         *  cost_multiplier: number,
         *  unlock_conditions: {
         *      bosses?: {[k: string]: number},
         *      resources?: {[k: string]: number},
         *      buildings?: {[k: string]: number},
         *      upgrades?: string[],
         *  },
         *  damage?: {[k: string]: number},
         *  production?: {[k: string]: number},
         *  tier?: string|number
         *  position?: number
         * }[]}
         */
        let buildings = [
            //#region T0 buildings
            //#region points
            {
                id: 'puncher',
                name: gettext('games_idle_building_puncher'),
                cost_base: {
                    points: 10,
                },
                cost_multiplier: 1.15,
                damage: {
                    none: .5,
                },
                production: {
                    points: .5,
                },
                tier: 0,
            },
            {
                id: 'dancer',
                name: gettext('games_idle_building_dancer'),
                cost_base: {
                    points: 123,
                },
                cost_multiplier: 1.15,
                damage: {
                    none: 7.5,
                    sound: .075,
                },
                production: {
                    points: 7.5,
                    waves: .075,
                },
                tier: 0,
                unlock_conditions: {
                    buildings: {
                        puncher: 1,
                    },
                },
            },
            {
                id: 'knight',
                name: gettext('games_idle_building_knight'),
                cost_base: {
                    points: 1_400,
                },
                cost_multiplier: 1.15,
                damage: {
                    none: 100,
                    metal: 1,
                },
                production: {
                    points: 100,
                    scraps: 1,
                },
                tier: 0,
                unlock_conditions: {
                    buildings: {
                        dancer: 1,
                    },
                },
            },
            {
                id: 'king',
                name: gettext('games_idle_building_king'),
                cost_base: {
                    points: 16_000,
                },
                cost_multiplier: 1.15,
                damage: {
                    none: 1_250,
                    air: 12.5,
                },
                production: {
                    points: 1_250,
                    dust: 12.5,
                },
                tier: 0,
                unlock_conditions: {
                    buildings: {
                        knight: 1,
                    },
                },
            },
            //#endregion points

            //#region magic powder
            {
                id: 'apprentice',
                name: gettext('games_idle_building_apprentice'),
                cost_base: {
                    magic_powder: 10,
                },
                cost_multiplier: 1.15,
                damage: {
                    magic: .5,
                },
                production: {
                    magic_powder: .5,
                },
                tier: 0,
                unlock_conditions: {
                    resources: {
                        magic_powder: 1,
                    },
                },
            },
            {
                id: 'magician',
                name: gettext('games_idle_building_magician'),
                cost_base: {
                    magic_powder: 111,
                },
                cost_multiplier: 1.15,
                damage: {
                    magic: 5.55,
                },
                production: {
                    magic_powder: 5.55,
                },
                tier: 0,
                unlock_conditions: {
                    buildings: {
                        apprentice: 1,
                    },
                },
            },
            {
                id: 'wizard',
                name: gettext('games_idle_building_wizard'),
                cost_base: {
                    magic_powder: 1_280,
                },
                cost_multiplier: 1.15,
                damage: {
                    magic: 64,
                },
                production: {
                    magic_powder: 64,
                },
                tier: 0,
                unlock_conditions: {
                    buildings: {
                        magician: 1,
                    },
                },
            },
            {
                id: 'fairy',
                name: gettext('games_idle_building_fairy'),
                cost_base: {
                    magic_powder: 14_440,
                },
                cost_multiplier: 1.15,
                damage: {
                    magic: 777,
                },
                production: {
                    magic_powder: 777,
                },
                tier: 0,
                unlock_conditions: {
                    buildings: {
                        wizard: 1,
                    },
                },
            },
            //#endregion magic powder

            //#region dust
            {
                id: 'fan',
                name: gettext('games_idle_building_fan'),
                cost_base: {
                    dust: 10,
                },
                cost_multiplier: 1.15,
                damage: {
                    air: .5,
                },
                production: {
                    dust: .5,
                },
                tier: 0,
                unlock_conditions: {
                    resources: {
                        dust: 1,
                    },
                },
            },
            {
                id: 'wind',
                name: gettext('games_idle_building_wind'),
                cost_base: {
                    dust: 100,
                },
                cost_multiplier: 1.15,
                damage: {
                    air: 5,
                },
                production: {
                    dust: 5,
                },
                tier: 0,
                unlock_conditions: {
                    buildings: {
                        fan: 1,
                    },
                },
            },
            {
                id: 'bird',
                name: gettext('games_idle_building_bird'),
                cost_base: {
                    dust: 1_000,
                },
                cost_multiplier: 1.15,
                damage: {
                    air: 50,
                },
                production: {
                    dust: 50,
                },
                tier: 0,
                unlock_conditions: {
                    buildings: {
                        wind: 1,
                    },
                },
            },
            {
                id: 'tornado',
                name: gettext('games_idle_building_tornado'),
                cost_base: {
                    dust: 10_000,
                },
                cost_multiplier: 1.15,
                damage: {
                    air: 500,
                },
                production: {
                    dust: 500,
                },
                tier: 0,
                unlock_conditions: {
                    buildings: {
                        bird: 1,
                    },
                },
            },
            //#endregion dust

            //#region pebbles
            {
                id: 'slingshot',
                name: gettext('games_idle_building_slingshot'),
                cost_base: {
                    pebbles: 10,
                },
                cost_multiplier: 1.15,
                damage: {
                    stone: .5,
                },
                production: {
                    pebbles: .5,
                },
                tier: 0,
                unlock_conditions: {
                    resources: {
                        pebbles: 1,
                    },
                },
            },
            //todo
            //#endregion pebbles
            //#endregion T0 buildings
        ];

        buildings.forEach((building, index) => {
            if (building.id in Building.BUILDINGS) return;

            building.position ??= index;

            new Building(building);
        });
    }
    /**
     * Creates the upgrades
     */
    function create_upgrades() {
        /**
         * @type {{
         *  id: string,
         *  name: string,
         *  cost: {[k: string]: number},
         *  unlock_conditions: {
         *      bosses?: {[k: string]: number},
         *      resources?: {[k: string]: number},
         *      buildings?: {[k: string]: number},
         *      upgrades?: string[],
         *  },
         *  multipliers?: {
         *      bosses?: {[k: string]: number},
         *      resources?: {[k: string]: number},
         *      buildings?: {[k: string]: number},
         *      traits?: {[k: string]: number},
         *  },
         *  tier?: string|number,
         *  position?: number,
         * }[]}
         */
        let upgrades = [
            //#region Global upgrades
            //#endregion Global upgrades

            //#region Synergies
            //#region T0 Synergies
            //#region Puncher-Dancer synergies
            {
                id: 'puncher_dancer_01',
                name: gettext('games_idle_upgrade_building_puncher_dancer_01'),
                cost: {
                    points: 200e6, //10 * 123 * 5 * 1.15 ** 75
                },
                unlock_conditions: {
                    buildings: {
                        puncher: 75,
                        dancer: 75,
                    },
                },
                multipliers: {
                    buildings: {
                        get puncher() { return Building.BUILDINGS.dancer.amount * .10; },
                        get dancer() { return Building.BUILDINGS.puncher.amount * .08; },
                    },
                },
                tier: 4,
            },
            {
                id: 'puncher_dancer_02',
                name: gettext('games_idle_upgrade_building_puncher_dancer_02'),
                cost: {
                    points: 15e12, //10 * 123 * 10 * 1.15 ** 150
                },
                unlock_conditions: {
                    buildings: {
                        puncher: 150,
                        dancer: 150,
                    },
                },
                multipliers: {
                    buildings: {
                        get puncher() { return Building.BUILDINGS.dancer.amount * .10 / 2; },
                        get dancer() { return Building.BUILDINGS.puncher.amount * .08 / 2; },
                    },
                },
                tier: 5,
            },
            {
                id: 'puncher_dancer_03',
                name: gettext('games_idle_upgrade_building_puncher_dancer_03'),
                cost: {
                    points: 30e21, //10 * 123 * 15 * 1.15 ** 300
                },
                unlock_conditions: {
                    buildings: {
                        puncher: 300,
                        dancer: 300,
                    },
                },
                multipliers: {
                    buildings: {
                        get puncher() { return Building.BUILDINGS.dancer.amount * .10 / 4; },
                        get dancer() { return Building.BUILDINGS.puncher.amount * .08 / 4; },
                    },
                },
                tier: 7,
            },
            {
                id: 'puncher_dancer_04',
                name: gettext('games_idle_upgrade_building_puncher_dancer_04'),
                cost: {
                    points: 35e30, //10 * 123 * 15 * 1.15 ** 450
                },
                unlock_conditions: {
                    buildings: {
                        puncher: 450,
                        dancer: 450,
                    },
                },
                multipliers: {
                    buildings: {
                        get puncher() { return Building.BUILDINGS.dancer.amount * .10 / 8; },
                        get dancer() { return Building.BUILDINGS.puncher.amount * .08 / 8; },
                    },
                },
                tier: 9,
            },
            //#endregion Puncher-Dancer synergies
            //#region Knight-King synergies
            {
                id: 'knight_king_01',
                name: gettext('games_idle_upgrade_building_knight_king_01'),
                cost: {
                    points: 4e12, //1_400 * 16_000 * 5 * 1.15 ** 75
                },
                unlock_conditions: {
                    buildings: {
                        knight: 75,
                        king: 75,
                    },
                },
                multipliers: {
                    buildings: {
                        get knight() { return Building.BUILDINGS.king.amount * .10; },
                        get king() { return Building.BUILDINGS.knight.amount * .08; },
                    },
                },
                tier: 4,
            },
            {
                id: 'knight_king_02',
                name: gettext('games_idle_upgrade_building_knight_king_02'),
                cost: {
                    points: 285e15, //1_400 * 16_000 * 10 * 1.15 ** 150
                },
                unlock_conditions: {
                    buildings: {
                        knight: 150,
                        king: 150,
                    },
                },
                multipliers: {
                    buildings: {
                        get knight() { return Building.BUILDINGS.king.amount * .10 / 2; },
                        get king() { return Building.BUILDINGS.knight.amount * .08 / 2; },
                    },
                },
                tier: 5,
            },
            {
                id: 'knight_king_03',
                name: gettext('games_idle_upgrade_building_knight_king_03'),
                cost: {
                    points: 555e24, //1_400 * 16_000 * 15 * 1.15 ** 300
                },
                unlock_conditions: {
                    buildings: {
                        knight: 300,
                        king: 300,
                    },
                },
                multipliers: {
                    buildings: {
                        get knight() { return Building.BUILDINGS.king.amount * .10 / 4; },
                        get king() { return Building.BUILDINGS.knight.amount * .08 / 4; },
                    },
                },
                tier: 7,
            },
            {
                id: 'knight_king_04',
                name: gettext('games_idle_upgrade_building_knight_king_04'),
                cost: {
                    points: 693e33, //1_400 * 16_000 * 15 * 1.15 ** 450
                },
                unlock_conditions: {
                    buildings: {
                        knight: 450,
                        king: 450,
                    },
                },
                multipliers: {
                    buildings: {
                        get knight() { return Building.BUILDINGS.king.amount * .10 / 8; },
                        get king() { return Building.BUILDINGS.knight.amount * .08 / 8; },
                    },
                },
                tier: 9,
            },
            //#endregion Knight-King synergies

            //#region Apprentice-Magician synergies
            {
                id: 'apprentice_magician_01',
                name: gettext('games_idle_upgrade_building_apprentice_magician_01'),
                cost: {
                    magic_powder: 198e6, //10 * 111 * 5 * 1.15 ** 75
                },
                unlock_conditions: {
                    buildings: {
                        apprentice: 75,
                        magician: 75,
                    },
                },
                multipliers: {
                    buildings: {
                        get apprentice() { return Building.BUILDINGS.magician.amount * .10; },
                        get magician() { return Building.BUILDINGS.apprentice.amount * .08; },
                    },
                },
                tier: 4,
            },
            {
                id: 'apprentice_magician_02',
                name: gettext('games_idle_upgrade_building_apprentice_magician_02'),
                cost: {
                    magic_powder: 15e12, //10 * 111 * 10 * 1.15 ** 150
                },
                unlock_conditions: {
                    buildings: {
                        apprentice: 150,
                        magician: 150,
                    },
                },
                multipliers: {
                    buildings: {
                        get apprentice() { return Building.BUILDINGS.magician.amount * .10 / 2; },
                        get magician() { return Building.BUILDINGS.apprentice.amount * .08 / 2; },
                    },
                },
                tier: 5,
            },
            {
                id: 'apprentice_magician_03',
                name: gettext('games_idle_upgrade_building_apprentice_magician_03'),
                cost: {
                    magic_powder: 26e21, //10 * 111 * 15 * 1.15 ** 300
                },
                unlock_conditions: {
                    buildings: {
                        apprentice: 300,
                        magician: 300,
                    },
                },
                multipliers: {
                    buildings: {
                        get apprentice() { return Building.BUILDINGS.magician.amount * .10 / 4; },
                        get magician() { return Building.BUILDINGS.apprentice.amount * .08 / 4; },
                    },
                },
                tier: 7,
            },
            {
                id: 'apprentice_magician_04',
                name: gettext('games_idle_upgrade_building_apprentice_magician_04'),
                cost: {
                    magic_powder: 33e30, //10 * 111 * 15 * 1.15 ** 450
                },
                unlock_conditions: {
                    buildings: {
                        apprentice: 450,
                        magician: 450,
                    },
                },
                multipliers: {
                    buildings: {
                        get apprentice() { return Building.BUILDINGS.magician.amount * .10 / 8; },
                        get magician() { return Building.BUILDINGS.apprentice.amount * .08 / 8; },
                    },
                },
                tier: 9,
            },
            //#endregion Apprentice-Magician synergies
            //#region Wizard-Fairy synergies
            {
                id: 'wizard_fairy_01',
                name: gettext('games_idle_upgrade_building_wizard_fairy_01'),
                cost: {
                    magic_powder: 3.2e12, //1_280 * 14_440 * 5 * 1.15 ** 75
                },
                unlock_conditions: {
                    buildings: {
                        wizard: 75,
                        fairy: 75,
                    },
                },
                multipliers: {
                    buildings: {
                        get wizard() { return Building.BUILDINGS.fairy.amount * .10; },
                        get fairy() { return Building.BUILDINGS.wizard.amount * .08; },
                    },
                },
                tier: 4,
            },
            {
                id: 'wizard_fairy_02',
                name: gettext('games_idle_upgrade_building_wizard_fairy_02'),
                cost: {
                    magic_powder: 233e15, //1_280 * 14_440 * 10 * 1.15 ** 150
                },
                unlock_conditions: {
                    buildings: {
                        wizard: 150,
                        fairy: 150,
                    },
                },
                multipliers: {
                    buildings: {
                        get wizard() { return Building.BUILDINGS.fairy.amount * .10 / 2; },
                        get fairy() { return Building.BUILDINGS.wizard.amount * .08 / 2; },
                    },
                },
                tier: 5,
            },
            {
                id: 'wizard_fairy_03',
                name: gettext('games_idle_upgrade_building_wizard_fairy_03'),
                cost: {
                    magic_powder: 512e24, //1_280 * 14_440 * 15 * 1.15 ** 300
                },
                unlock_conditions: {
                    buildings: {
                        wizard: 300,
                        fairy: 300,
                    },
                },
                multipliers: {
                    buildings: {
                        get wizard() { return Building.BUILDINGS.fairy.amount * .10 / 4; },
                        get fairy() { return Building.BUILDINGS.wizard.amount * .08 / 4; },
                    },
                },
                tier: 7,
            },
            {
                id: 'wizard_fairy_04',
                name: gettext('games_idle_upgrade_building_wizard_fairy_04'),
                cost: {
                    magic_powder: 567e33, //1_280 * 14_440 * 15 * 1.15 ** 450
                },
                unlock_conditions: {
                    buildings: {
                        wizard: 450,
                        fairy: 450,
                    },
                },
                multipliers: {
                    buildings: {
                        get wizard() { return Building.BUILDINGS.fairy.amount * .10 / 8; },
                        get fairy() { return Building.BUILDINGS.wizard.amount * .08 / 8; },
                    },
                },
                tier: 9,
            },
            //#endregion Apprentice-Magician synergies

            //#region Fan-Wind synergies
            {
                id: 'fan_wind_01',
                name: gettext('games_idle_upgrade_building_fan_wind_01'),
                cost: {
                    dust: 175e6, //10 * 100 * 5 * 1.15 ** 75
                },
                unlock_conditions: {
                    buildings: {
                        fan: 75,
                        wind: 75,
                    },
                },
                multipliers: {
                    buildings: {
                        get fan() { return Building.BUILDINGS.wind.amount * .10; },
                        get wind() { return Building.BUILDINGS.fan.amount * .08; },
                    },
                },
                tier: 4,
            },
            {
                id: 'fan_wind_02',
                name: gettext('games_idle_upgrade_building_fan_wind_02'),
                cost: {
                    dust: 12e12, //10 * 100 * 10 * 1.15 ** 150
                },
                unlock_conditions: {
                    buildings: {
                        fan: 150,
                        wind: 150,
                    },
                },
                multipliers: {
                    buildings: {
                        get fan() { return Building.BUILDINGS.wind.amount * .10 / 2; },
                        get wind() { return Building.BUILDINGS.fan.amount * .08 / 2; },
                    },
                },
                tier: 5,
            },
            {
                id: 'fan_wind_03',
                name: gettext('games_idle_upgrade_building_fan_wind_03'),
                cost: {
                    dust: 24e21, //10 * 100 * 15 * 1.15 ** 300
                },
                unlock_conditions: {
                    buildings: {
                        fan: 300,
                        wind: 300,
                    },
                },
                multipliers: {
                    buildings: {
                        get fan() { return Building.BUILDINGS.wind.amount * .10 / 4; },
                        get wind() { return Building.BUILDINGS.fan.amount * .08 / 4; },
                    },
                },
                tier: 7,
            },
            {
                id: 'fan_wind_04',
                name: gettext('games_idle_upgrade_building_fan_wind_04'),
                cost: {
                    dust: 30e30, //10 * 100 * 15 * 1.15 ** 450
                },
                unlock_conditions: {
                    buildings: {
                        fan: 450,
                        wind: 450,
                    },
                },
                multipliers: {
                    buildings: {
                        get fan() { return Building.BUILDINGS.wind.amount * .10 / 8; },
                        get wind() { return Building.BUILDINGS.fan.amount * .08 / 8; },
                    },
                },
                tier: 9,
            },
            //#endregion Fan-Wind synergies
            //#region Bird-Tornado synergies
            {
                id: 'bird_tornado_01',
                name: gettext('games_idle_upgrade_building_bird_tornado_01'),
                cost: {
                    dust: 1.75e12, //1_000 * 10_000 * 5 * 1.15 ** 75
                },
                unlock_conditions: {
                    buildings: {
                        bird: 75,
                        tornado: 75,
                    },
                },
                multipliers: {
                    buildings: {
                        get bird() { return Building.BUILDINGS.tornado.amount * .10; },
                        get tornado() { return Building.BUILDINGS.bird.amount * .08; },
                    },
                },
                tier: 4,
            },
            {
                id: 'bird_tornado_02',
                name: gettext('games_idle_upgrade_building_bird_tornado_02'),
                cost: {
                    dust: 120e15, //1_000 * 10_000 * 10 * 1.15 ** 150
                },
                unlock_conditions: {
                    buildings: {
                        bird: 150,
                        tornado: 150,
                    },
                },
                multipliers: {
                    buildings: {
                        get bird() { return Building.BUILDINGS.tornado.amount * .10 / 2; },
                        get tornado() { return Building.BUILDINGS.bird.amount * .08 / 2; },
                    },
                },
                tier: 5,
            },
            {
                id: 'bird_tornado_03',
                name: gettext('games_idle_upgrade_building_bird_tornado_03'),
                cost: {
                    dust: 240e24, //1_000 * 10_000 * 15 * 1.15 ** 300
                },
                unlock_conditions: {
                    buildings: {
                        bird: 300,
                        tornado: 300,
                    },
                },
                multipliers: {
                    buildings: {
                        get bird() { return Building.BUILDINGS.tornado.amount * .10 / 4; },
                        get tornado() { return Building.BUILDINGS.bird.amount * .08 / 4; },
                    },
                },
                tier: 7,
            },
            {
                id: 'bird_tornado_04',
                name: gettext('games_idle_upgrade_building_bird_tornado_04'),
                cost: {
                    dust: 300e33, //1_000 * 10_000 * 15 * 1.15 ** 450
                },
                unlock_conditions: {
                    buildings: {
                        bird: 450,
                        tornado: 450,
                    },
                },
                multipliers: {
                    buildings: {
                        get bird() { return Building.BUILDINGS.tornado.amount * .10 / 8; },
                        get tornado() { return Building.BUILDINGS.bird.amount * .08 / 8; },
                    },
                },
                tier: 9,
            },
            //#endregion Bird-Tornado synergies
            //#endregion T0 Synergies
            //#endregion Synergies

            //#region T0 buildings upgrades
            //#region Puncher upgrades
            {
                id: 'puncher_01',
                name: gettext('games_idle_upgrade_building_puncher_01'),
                cost: {
                    points: 25, //10 * 2 * 1.15 ** 1
                },
                unlock_conditions: {
                    buildings: {
                        puncher: 1,
                    },
                },
                multipliers: {
                    buildings: {
                        puncher: 1/2,
                    },
                },
                tier: 0,
            },
            {
                id: 'puncher_02',
                name: gettext('games_idle_upgrade_building_puncher_02'),
                cost: {
                    points: 125, //10 * 3 * 1.15 ** 10
                },
                unlock_conditions: {
                    buildings: {
                        puncher: 10,
                    },
                },
                multipliers: {
                    buildings: {
                        puncher: 2/2,
                    },
                },
                tier: 1,
            },
            {
                id: 'puncher_03',
                name: gettext('games_idle_upgrade_building_puncher_03'),
                cost: {
                    points: 1_300, //10 * 4 * 1.15 ** 25
                },
                unlock_conditions: {
                    buildings: {
                        puncher: 25,
                    },
                },
                multipliers: {
                    buildings: {
                        puncher: 3/2,
                    },
                },
                tier: 2,
            },
            {
                id: 'puncher_04',
                name: gettext('games_idle_upgrade_building_puncher_04'),
                cost: {
                    points: 55_000, //10 * 5 * 1.15 ** 50
                },
                unlock_conditions: {
                    buildings: {
                        puncher: 50,
                    },
                },
                multipliers: {
                    buildings: {
                        puncher: 4/2,
                    },
                },
                tier: 3,
            },
            {
                id: 'puncher_05',
                name: gettext('games_idle_upgrade_building_puncher_05'),
                cost: {
                    points: 70e6, //10 * 6 * 1.15 ** 100
                },
                unlock_conditions: {
                    buildings: {
                        puncher: 100,
                    },
                },
                multipliers: {
                    buildings: {
                        puncher: 5/2,
                    },
                },
                tier: 4,
            },
            {
                id: 'puncher_06',
                name: gettext('games_idle_upgrade_building_puncher_06'),
                cost: {
                    points: 90e9, //10 * 7 * 1.15 ** 150
                },
                unlock_conditions: {
                    buildings: {
                        puncher: 150,
                    },
                },
                multipliers: {
                    buildings: {
                        puncher: 6/2,
                    },
                },
                tier: 5,
            },
            {
                id: 'puncher_07',
                name: gettext('games_idle_upgrade_building_puncher_07'),
                cost: {
                    points: 111e12, //10 * 8 * 1.15 ** 200
                },
                unlock_conditions: {
                    buildings: {
                        puncher: 200,
                    },
                },
                multipliers: {
                    buildings: {
                        puncher: 7/2,
                    },
                },
                tier: 6,
            },
            {
                id: 'puncher_08',
                name: gettext('games_idle_upgrade_building_puncher_08'),
                cost: {
                    points: 150e18, //10 * 9 * 1.15 ** 300
                },
                unlock_conditions: {
                    buildings: {
                        puncher: 300,
                    },
                },
                multipliers: {
                    buildings: {
                        puncher: 8/2,
                    },
                },
                tier: 7,
            },
            {
                id: 'puncher_09',
                name: gettext('games_idle_upgrade_building_puncher_09'),
                cost: {
                    points: 190e24, //10 * 10 * 1.15 ** 400
                },
                unlock_conditions: {
                    buildings: {
                        puncher: 400,
                    },
                },
                multipliers: {
                    buildings: {
                        puncher: 9/2,
                    },
                },
                tier: 8,
            },
            {
                id: 'puncher_10',
                name: gettext('games_idle_upgrade_building_puncher_10'),
                cost: {
                    points: 250e30, //10 * 11 * 1.15 ** 500
                },
                unlock_conditions: {
                    buildings: {
                        puncher: 500,
                    },
                },
                multipliers: {
                    buildings: {
                        puncher: 10/2,
                    },
                },
                tier: 9,
            },
            //#endregion Puncher upgrades
            //#region Dancer upgrades
            {
                id: 'dancer_01',
                name: gettext('games_idle_upgrade_building_dancer_01'),
                cost: {
                    points: 300, //123 * 2 * 1.15 ** 1
                },
                unlock_conditions: {
                    buildings: {
                        dancer: 1,
                    },
                },
                multipliers: {
                    buildings: {
                        dancer: 1/2,
                    },
                },
                tier: 0,
            },
            {
                id: 'dancer_02',
                name: gettext('games_idle_upgrade_building_dancer_02'),
                cost: {
                    points: 1_500, //123 * 3 * 1.15 ** 10
                },
                unlock_conditions: {
                    buildings: {
                        dancer: 10,
                    },
                },
                multipliers: {
                    buildings: {
                        dancer: 2/2,
                    },
                },
                tier: 1,
            },
            {
                id: 'dancer_03',
                name: gettext('games_idle_upgrade_building_dancer_03'),
                cost: {
                    points: 16_000, //123 * 4 * 1.15 ** 25
                },
                unlock_conditions: {
                    buildings: {
                        dancer: 25,
                    },
                },
                multipliers: {
                    buildings: {
                        dancer: 3/2,
                    },
                },
                tier: 2,
            },
            {
                id: 'dancer_04',
                name: gettext('games_idle_upgrade_building_dancer_04'),
                cost: {
                    points: 666_000, //123 * 5 * 1.15 ** 50
                },
                unlock_conditions: {
                    buildings: {
                        dancer: 50,
                    },
                },
                multipliers: {
                    buildings: {
                        dancer: 4/2,
                    },
                },
                tier: 3,
            },
            {
                id: 'dancer_05',
                name: gettext('games_idle_upgrade_building_dancer_05'),
                cost: {
                    points: 850e6, //123 * 6 * 1.15 ** 100
                },
                unlock_conditions: {
                    buildings: {
                        dancer: 100,
                    },
                },
                multipliers: {
                    buildings: {
                        dancer: 5/2,
                    },
                },
                tier: 4,
            },
            {
                id: 'dancer_06',
                name: gettext('games_idle_upgrade_building_dancer_06'),
                cost: {
                    points: 1e12, //123 * 7 * 1.15 ** 150
                },
                unlock_conditions: {
                    buildings: {
                        dancer: 150,
                    },
                },
                multipliers: {
                    buildings: {
                        dancer: 6/2,
                    },
                },
                tier: 5,
            },
            {
                id: 'dancer_07',
                name: gettext('games_idle_upgrade_building_dancer_07'),
                cost: {
                    points: 1.234e15, //123 * 8 * 1.15 ** 200
                },
                unlock_conditions: {
                    buildings: {
                        dancer: 200,
                    },
                },
                multipliers: {
                    buildings: {
                        dancer: 7/2,
                    },
                },
                tier: 6,
            },
            {
                id: 'dancer_08',
                name: gettext('games_idle_upgrade_building_dancer_08'),
                cost: {
                    points: 1.8e21, //123 * 9 * 1.15 ** 300
                },
                unlock_conditions: {
                    buildings: {
                        dancer: 300,
                    },
                },
                multipliers: {
                    buildings: {
                        dancer: 8/2,
                    },
                },
                tier: 7,
            },
            {
                id: 'dancer_09',
                name: gettext('games_idle_upgrade_building_dancer_09'),
                cost: {
                    points: 2.5e27, //123 * 10 * 1.15 ** 400
                },
                unlock_conditions: {
                    buildings: {
                        dancer: 400,
                    },
                },
                multipliers: {
                    buildings: {
                        dancer: 9/2,
                    },
                },
                tier: 8,
            },
            {
                id: 'dancer_10',
                name: gettext('games_idle_upgrade_building_dancer_10'),
                cost: {
                    points: 3.333e33, //123 * 11 * 1.15 ** 500
                },
                unlock_conditions: {
                    buildings: {
                        dancer: 500,
                    },
                },
                multipliers: {
                    buildings: {
                        dancer: 10/2,
                    },
                },
                tier: 9,
            },
            //#endregion Dancer upgrades
            //#region Knight upgrades
            {
                id: 'knight_01',
                name: gettext('games_idle_upgrade_building_knight_01'),
                cost: {
                    points: 3_300, //1_400 * 2 * 1.15 ** 1
                },
                unlock_conditions: {
                    buildings: {
                        knight: 1,
                    },
                },
                multipliers: {
                    buildings: {
                        knight: 1/2,
                    },
                },
                tier: 0,
            },
            {
                id: 'knight_02',
                name: gettext('games_idle_upgrade_building_knight_02'),
                cost: {
                    points: 17_000, //1_400 * 3 * 1.15 ** 10
                },
                unlock_conditions: {
                    buildings: {
                        knight: 10,
                    },
                },
                multipliers: {
                    buildings: {
                        knight: 2/2,
                    },
                },
                tier: 1,
            },
            {
                id: 'knight_03',
                name: gettext('games_idle_upgrade_building_knight_03'),
                cost: {
                    points: 185_000, //1_400 * 4 * 1.15 ** 25
                },
                unlock_conditions: {
                    buildings: {
                        knight: 25,
                    },
                },
                multipliers: {
                    buildings: {
                        knight: 3/2,
                    },
                },
                tier: 2,
            },
            {
                id: 'knight_04',
                name: gettext('games_idle_upgrade_building_knight_04'),
                cost: {
                    points: 7.5e6, //1_400 * 5 * 1.15 ** 50
                },
                unlock_conditions: {
                    buildings: {
                        knight: 50,
                    },
                },
                multipliers: {
                    buildings: {
                        knight: 4/2,
                    },
                },
                tier: 3,
            },
            {
                id: 'knight_05',
                name: gettext('games_idle_upgrade_building_knight_05'),
                cost: {
                    points: 9.85e9, //1_400 * 6 * 1.15 ** 100
                },
                unlock_conditions: {
                    buildings: {
                        knight: 100,
                    },
                },
                multipliers: {
                    buildings: {
                        knight: 5/2,
                    },
                },
                tier: 4,
            },
            {
                id: 'knight_06',
                name: gettext('games_idle_upgrade_building_knight_06'),
                cost: {
                    points: 12.5e12, //1_400 * 7 * 1.15 ** 150
                },
                unlock_conditions: {
                    buildings: {
                        knight: 150,
                    },
                },
                multipliers: {
                    buildings: {
                        knight: 6/2,
                    },
                },
                tier: 5,
            },
            {
                id: 'knight_07',
                name: gettext('games_idle_upgrade_building_knight_07'),
                cost: {
                    points: 15e15, //1_400 * 8 * 1.15 ** 200
                },
                unlock_conditions: {
                    buildings: {
                        knight: 200,
                    },
                },
                multipliers: {
                    buildings: {
                        knight: 7/2,
                    },
                },
                tier: 6,
            },
            {
                id: 'knight_08',
                name: gettext('games_idle_upgrade_building_knight_08'),
                cost: {
                    points: 20.5e21, //1_400 * 9 * 1.15 ** 300
                },
                unlock_conditions: {
                    buildings: {
                        knight: 300,
                    },
                },
                multipliers: {
                    buildings: {
                        knight: 8/2,
                    },
                },
                tier: 7,
            },
            {
                id: 'knight_09',
                name: gettext('games_idle_upgrade_building_knight_09'),
                cost: {
                    points: 25.6e27, //1_400 * 10 * 1.15 ** 400
                },
                unlock_conditions: {
                    buildings: {
                        knight: 400,
                    },
                },
                multipliers: {
                    buildings: {
                        knight: 9/2,
                    },
                },
                tier: 8,
            },
            {
                id: 'knight_10',
                name: gettext('games_idle_upgrade_building_knight_10'),
                cost: {
                    points: 33.3e33, //1_400 * 11 * 1.15 ** 500
                },
                unlock_conditions: {
                    buildings: {
                        knight: 500,
                    },
                },
                multipliers: {
                    buildings: {
                        knight: 10/2,
                    },
                },
                tier: 9,
            },
            //#endregion Knight upgrades
            //#region King upgrades
            {
                id: 'king_01',
                name: gettext('games_idle_upgrade_building_king_01'),
                cost: {
                    points: 36_800, //16_000 * 2 * 1.15 ** 1
                },
                unlock_conditions: {
                    buildings: {
                        king: 1,
                    },
                },
                multipliers: {
                    buildings: {
                        king: 1/2,
                    },
                },
                tier: 0,
            },
            {
                id: 'king_02',
                name: gettext('games_idle_upgrade_building_king_02'),
                cost: {
                    points: 195_000, //16_000 * 3 * 1.15 ** 10
                },
                unlock_conditions: {
                    buildings: {
                        king: 10,
                    },
                },
                multipliers: {
                    buildings: {
                        king: 2/2,
                    },
                },
                tier: 1,
            },
            {
                id: 'king_03',
                name: gettext('games_idle_upgrade_building_king_03'),
                cost: {
                    points: 2.1e6, //16_000 * 4 * 1.15 ** 25
                },
                unlock_conditions: {
                    buildings: {
                        king: 25,
                    },
                },
                multipliers: {
                    buildings: {
                        king: 3/2,
                    },
                },
                tier: 2,
            },
            {
                id: 'king_04',
                name: gettext('games_idle_upgrade_building_king_04'),
                cost: {
                    points: 87.6e6, //16_000 * 5 * 1.15 ** 50
                },
                unlock_conditions: {
                    buildings: {
                        king: 50,
                    },
                },
                multipliers: {
                    buildings: {
                        king: 4/2,
                    },
                },
                tier: 3,
            },
            {
                id: 'king_05',
                name: gettext('games_idle_upgrade_building_king_05'),
                cost: {
                    points: 111e9, //16_000 * 6 * 1.15 ** 100
                },
                unlock_conditions: {
                    buildings: {
                        king: 100,
                    },
                },
                multipliers: {
                    buildings: {
                        king: 5/2,
                    },
                },
                tier: 4,
            },
            {
                id: 'king_06',
                name: gettext('games_idle_upgrade_building_king_06'),
                cost: {
                    points: 140e12, //16_000 * 7 * 1.15 ** 150
                },
                unlock_conditions: {
                    buildings: {
                        king: 150,
                    },
                },
                multipliers: {
                    buildings: {
                        king: 6/2,
                    },
                },
                tier: 5,
            },
            {
                id: 'king_07',
                name: gettext('games_idle_upgrade_building_king_07'),
                cost: {
                    points: 175e15, //16_000 * 8 * 1.15 ** 200
                },
                unlock_conditions: {
                    buildings: {
                        king: 200,
                    },
                },
                multipliers: {
                    buildings: {
                        king: 7/2,
                    },
                },
                tier: 6,
            },
            {
                id: 'king_08',
                name: gettext('games_idle_upgrade_building_king_08'),
                cost: {
                    points: 231e21, //16_000 * 9 * 1.15 ** 300
                },
                unlock_conditions: {
                    buildings: {
                        king: 300,
                    },
                },
                multipliers: {
                    buildings: {
                        king: 8/2,
                    },
                },
                tier: 7,
            },
            {
                id: 'king_09',
                name: gettext('games_idle_upgrade_building_king_09'),
                cost: {
                    points: 300e27, //16_000 * 10 * 1.15 ** 400
                },
                unlock_conditions: {
                    buildings: {
                        king: 400,
                    },
                },
                multipliers: {
                    buildings: {
                        king: 9/2,
                    },
                },
                tier: 8,
            },
            {
                id: 'king_10',
                name: gettext('games_idle_upgrade_building_king_10'),
                cost: {
                    points: 393e33, //16_000 * 11 * 1.15 ** 500
                },
                unlock_conditions: {
                    buildings: {
                        king: 500,
                    },
                },
                multipliers: {
                    buildings: {
                        king: 10/2,
                    },
                },
                tier: 9,
            },
            //#endregion King upgrades

            //#region Apprentice upgrades
            {
                id: 'apprentice_01',
                name: gettext('games_idle_upgrade_building_apprentice_01'),
                cost: {
                    magic_powder: 25, //10 * 2 * 1.15 ** 1
                },
                unlock_conditions: {
                    buildings: {
                        apprentice: 1,
                    },
                },
                multipliers: {
                    buildings: {
                        apprentice: 1/2,
                    },
                },
                tier: 0,
            },
            {
                id: 'apprentice_02',
                name: gettext('games_idle_upgrade_building_apprentice_02'),
                cost: {
                    magic_powder: 125, //10 * 3 * 1.15 ** 10
                },
                unlock_conditions: {
                    buildings: {
                        apprentice: 10,
                    },
                },
                multipliers: {
                    buildings: {
                        apprentice: 2/2,
                    },
                },
                tier: 1,
            },
            {
                id: 'apprentice_03',
                name: gettext('games_idle_upgrade_building_apprentice_03'),
                cost: {
                    magic_powder: 1_300, //10 * 4 * 1.15 ** 25
                },
                unlock_conditions: {
                    buildings: {
                        apprentice: 25,
                    },
                },
                multipliers: {
                    buildings: {
                        apprentice: 3/2,
                    },
                },
                tier: 2,
            },
            {
                id: 'apprentice_04',
                name: gettext('games_idle_upgrade_building_apprentice_04'),
                cost: {
                    magic_powder: 55_000, //10 * 5 * 1.15 ** 50
                },
                unlock_conditions: {
                    buildings: {
                        apprentice: 50,
                    },
                },
                multipliers: {
                    buildings: {
                        apprentice: 4/2,
                    },
                },
                tier: 3,
            },
            {
                id: 'apprentice_05',
                name: gettext('games_idle_upgrade_building_apprentice_05'),
                cost: {
                    magic_powder: 70e6, //10 * 6 * 1.15 ** 100
                },
                unlock_conditions: {
                    buildings: {
                        apprentice: 100,
                    },
                },
                multipliers: {
                    buildings: {
                        apprentice: 5/2,
                    },
                },
                tier: 4,
            },
            {
                id: 'apprentice_06',
                name: gettext('games_idle_upgrade_building_apprentice_06'),
                cost: {
                    magic_powder: 90e9, //10 * 7 * 1.15 ** 150
                },
                unlock_conditions: {
                    buildings: {
                        apprentice: 150,
                    },
                },
                multipliers: {
                    buildings: {
                        apprentice: 6/2,
                    },
                },
                tier: 5,
            },
            {
                id: 'apprentice_07',
                name: gettext('games_idle_upgrade_building_apprentice_07'),
                cost: {
                    magic_powder: 111e12, //10 * 8 * 1.15 ** 200
                },
                unlock_conditions: {
                    buildings: {
                        apprentice: 200,
                    },
                },
                multipliers: {
                    buildings: {
                        apprentice: 7/2,
                    },
                },
                tier: 6,
            },
            {
                id: 'apprentice_08',
                name: gettext('games_idle_upgrade_building_apprentice_08'),
                cost: {
                    magic_powder: 150e18, //10 * 9 * 1.15 ** 300
                },
                unlock_conditions: {
                    buildings: {
                        apprentice: 300,
                    },
                },
                multipliers: {
                    buildings: {
                        apprentice: 8/2,
                    },
                },
                tier: 7,
            },
            {
                id: 'apprentice_09',
                name: gettext('games_idle_upgrade_building_apprentice_09'),
                cost: {
                    magic_powder: 190e24, //10 * 10 * 1.15 ** 400
                },
                unlock_conditions: {
                    buildings: {
                        apprentice: 400,
                    },
                },
                multipliers: {
                    buildings: {
                        apprentice: 9/2,
                    },
                },
                tier: 8,
            },
            {
                id: 'apprentice_10',
                name: gettext('games_idle_upgrade_building_apprentice_10'),
                cost: {
                    magic_powder: 250e30, //10 * 11 * 1.15 ** 500
                },
                unlock_conditions: {
                    buildings: {
                        apprentice: 500,
                    },
                },
                multipliers: {
                    buildings: {
                        apprentice: 10/2,
                    },
                },
                tier: 9,
            },
            //#endregion Apprentice upgrades
            //#region Magician upgrades
            {
                id: 'magician_01',
                name: gettext('games_idle_upgrade_building_magician_01'),
                cost: {
                    magic_powder: 255, //111 * 2 * 1.15 ** 1
                },
                unlock_conditions: {
                    buildings: {
                        magician: 1,
                    },
                },
                multipliers: {
                    buildings: {
                        magician: 1/2,
                    },
                },
                tier: 0,
            },
            {
                id: 'magician_02',
                name: gettext('games_idle_upgrade_building_magician_02'),
                cost: {
                    magic_powder: 1_345, //111 * 3 * 1.15 ** 10
                },
                unlock_conditions: {
                    buildings: {
                        magician: 10,
                    },
                },
                multipliers: {
                    buildings: {
                        magician: 2/2,
                    },
                },
                tier: 1,
            },
            {
                id: 'magician_03',
                name: gettext('games_idle_upgrade_building_magician_03'),
                cost: {
                    magic_powder: 14_500, //111 * 4 * 1.15 ** 25
                },
                unlock_conditions: {
                    buildings: {
                        magician: 25,
                    },
                },
                multipliers: {
                    buildings: {
                        magician: 3/2,
                    },
                },
                tier: 2,
            },
            {
                id: 'magician_04',
                name: gettext('games_idle_upgrade_building_magician_04'),
                cost: {
                    magic_powder: 600_000, //111 * 5 * 1.15 ** 50
                },
                unlock_conditions: {
                    buildings: {
                        magician: 50,
                    },
                },
                multipliers: {
                    buildings: {
                        magician: 4/2,
                    },
                },
                tier: 3,
            },
            {
                id: 'magician_05',
                name: gettext('games_idle_upgrade_building_magician_05'),
                cost: {
                    magic_powder: 789e6, //111 * 6 * 1.15 ** 100
                },
                unlock_conditions: {
                    buildings: {
                        magician: 100,
                    },
                },
                multipliers: {
                    buildings: {
                        magician: 5/2,
                    },
                },
                tier: 4,
            },
            {
                id: 'magician_06',
                name: gettext('games_idle_upgrade_building_magician_06'),
                cost: {
                    magic_powder: 987e9, //111 * 7 * 1.15 ** 150
                },
                unlock_conditions: {
                    buildings: {
                        magician: 150,
                    },
                },
                multipliers: {
                    buildings: {
                        magician: 6/2,
                    },
                },
                tier: 5,
            },
            {
                id: 'magician_07',
                name: gettext('games_idle_upgrade_building_magician_07'),
                cost: {
                    magic_powder: 1.23e15, //111 * 8 * 1.15 ** 200
                },
                unlock_conditions: {
                    buildings: {
                        magician: 200,
                    },
                },
                multipliers: {
                    buildings: {
                        magician: 7/2,
                    },
                },
                tier: 6,
            },
            {
                id: 'magician_08',
                name: gettext('games_idle_upgrade_building_magician_08'),
                cost: {
                    magic_powder: 1.5e21, //111 * 9 * 1.15 ** 300
                },
                unlock_conditions: {
                    buildings: {
                        magician: 300,
                    },
                },
                multipliers: {
                    buildings: {
                        magician: 8/2,
                    },
                },
                tier: 7,
            },
            {
                id: 'magician_09',
                name: gettext('games_idle_upgrade_building_magician_09'),
                cost: {
                    magic_powder: 2.11e27, //111 * 10 * 1.15 ** 400
                },
                unlock_conditions: {
                    buildings: {
                        magician: 400,
                    },
                },
                multipliers: {
                    buildings: {
                        magician: 9/2,
                    },
                },
                tier: 8,
            },
            {
                id: 'magician_10',
                name: gettext('games_idle_upgrade_building_magician_10'),
                cost: {
                    magic_powder: 2.75e33, //111 * 11 * 1.15 ** 500
                },
                unlock_conditions: {
                    buildings: {
                        magician: 500,
                    },
                },
                multipliers: {
                    buildings: {
                        magician: 10/2,
                    },
                },
                tier: 9,
            },
            //#endregion Magician upgrades
            //#region Wizard upgrades
            {
                id: 'wizard_01',
                name: gettext('games_idle_upgrade_building_wizard_01'),
                cost: {
                    magic_powder: 3_200, //1_280 * 2 * 1.15 ** 1
                },
                unlock_conditions: {
                    buildings: {
                        wizard: 1,
                    },
                },
                multipliers: {
                    buildings: {
                        wizard: 1/2,
                    },
                },
                tier: 0,
            },
            {
                id: 'wizard_02',
                name: gettext('games_idle_upgrade_building_wizard_02'),
                cost: {
                    magic_powder: 16_000, //1_280 * 3 * 1.15 ** 10
                },
                unlock_conditions: {
                    buildings: {
                        wizard: 10,
                    },
                },
                multipliers: {
                    buildings: {
                        wizard: 2/2,
                    },
                },
                tier: 1,
            },
            {
                id: 'wizard_03',
                name: gettext('games_idle_upgrade_building_wizard_03'),
                cost: {
                    magic_powder: 128_000, //1_280 * 4 * 1.15 ** 25
                },
                unlock_conditions: {
                    buildings: {
                        wizard: 25,
                    },
                },
                multipliers: {
                    buildings: {
                        wizard: 3/2,
                    },
                },
                tier: 2,
            },
            {
                id: 'wizard_04',
                name: gettext('games_idle_upgrade_building_wizard_04'),
                cost: {
                    magic_powder: 6.4e6, //1_280 * 5 * 1.15 ** 50
                },
                unlock_conditions: {
                    buildings: {
                        wizard: 50,
                    },
                },
                multipliers: {
                    buildings: {
                        wizard: 4/2,
                    },
                },
                tier: 3,
            },
            {
                id: 'wizard_05',
                name: gettext('games_idle_upgrade_building_wizard_05'),
                cost: {
                    magic_powder: 8e9, //1_280 * 6 * 1.15 ** 100
                },
                unlock_conditions: {
                    buildings: {
                        wizard: 100,
                    },
                },
                multipliers: {
                    buildings: {
                        wizard: 5/2,
                    },
                },
                tier: 4,
            },
            {
                id: 'wizard_06',
                name: gettext('games_idle_upgrade_building_wizard_06'),
                cost: {
                    magic_powder: 12.8e12, //1_280 * 7 * 1.15 ** 150
                },
                unlock_conditions: {
                    buildings: {
                        wizard: 150,
                    },
                },
                multipliers: {
                    buildings: {
                        wizard: 6/2,
                    },
                },
                tier: 5,
            },
            {
                id: 'wizard_07',
                name: gettext('games_idle_upgrade_building_wizard_07'),
                cost: {
                    magic_powder: 16e15, //1_280 * 8 * 1.15 ** 200
                },
                unlock_conditions: {
                    buildings: {
                        wizard: 200,
                    },
                },
                multipliers: {
                    buildings: {
                        wizard: 7/2,
                    },
                },
                tier: 6,
            },
            {
                id: 'wizard_08',
                name: gettext('games_idle_upgrade_building_wizard_08'),
                cost: {
                    magic_powder: 16e21, //1_280 * 9 * 1.15 ** 300
                },
                unlock_conditions: {
                    buildings: {
                        wizard: 300,
                    },
                },
                multipliers: {
                    buildings: {
                        wizard: 8/2,
                    },
                },
                tier: 7,
            },
            {
                id: 'wizard_09',
                name: gettext('games_idle_upgrade_building_wizard_09'),
                cost: {
                    magic_powder: 25.8e27, //1_280 * 10 * 1.15 ** 400
                },
                unlock_conditions: {
                    buildings: {
                        wizard: 400,
                    },
                },
                multipliers: {
                    buildings: {
                        wizard: 9/2,
                    },
                },
                tier: 8,
            },
            {
                id: 'wizard_10',
                name: gettext('games_idle_upgrade_building_wizard_10'),
                cost: {
                    magic_powder: 32e33, //1_280 * 11 * 1.15 ** 500
                },
                unlock_conditions: {
                    buildings: {
                        wizard: 500,
                    },
                },
                multipliers: {
                    buildings: {
                        wizard: 10/2,
                    },
                },
                tier: 9,
            },
            //#endregion Wizard upgrades
            //#region Fairy upgrades
            {
                id: 'fairy_01',
                name: gettext('games_idle_upgrade_building_fairy_01'),
                cost: {
                    magic_powder: 33_333, //14_440 * 2 * 1.15 ** 1
                },
                unlock_conditions: {
                    buildings: {
                        fairy: 1,
                    },
                },
                multipliers: {
                    buildings: {
                        fairy: 1/2,
                    },
                },
                tier: 0,
            },
            {
                id: 'fairy_02',
                name: gettext('games_idle_upgrade_building_fairy_02'),
                cost: {
                    magic_powder: 175_000, //14_440 * 3 * 1.15 ** 10
                },
                unlock_conditions: {
                    buildings: {
                        fairy: 10,
                    },
                },
                multipliers: {
                    buildings: {
                        fairy: 2/2,
                    },
                },
                tier: 1,
            },
            {
                id: 'fairy_03',
                name: gettext('games_idle_upgrade_building_fairy_03'),
                cost: {
                    magic_powder: 1.4e6, //14_440 * 4 * 1.15 ** 25
                },
                unlock_conditions: {
                    buildings: {
                        fairy: 25,
                    },
                },
                multipliers: {
                    buildings: {
                        fairy: 3/2,
                    },
                },
                tier: 2,
            },
            {
                id: 'fairy_04',
                name: gettext('games_idle_upgrade_building_fairy_04'),
                cost: {
                    magic_powder: 77e6, //14_440 * 5 * 1.15 ** 50
                },
                unlock_conditions: {
                    buildings: {
                        fairy: 50,
                    },
                },
                multipliers: {
                    buildings: {
                        fairy: 4/2,
                    },
                },
                tier: 3,
            },
            {
                id: 'fairy_05',
                name: gettext('games_idle_upgrade_building_fairy_05'),
                cost: {
                    magic_powder: 98e9, //14_440 * 6 * 1.15 ** 100
                },
                unlock_conditions: {
                    buildings: {
                        fairy: 100,
                    },
                },
                multipliers: {
                    buildings: {
                        fairy: 5/2,
                    },
                },
                tier: 4,
            },
            {
                id: 'fairy_06',
                name: gettext('games_idle_upgrade_building_fairy_06'),
                cost: {
                    magic_powder: 126e12, //14_440 * 7 * 1.15 ** 150
                },
                unlock_conditions: {
                    buildings: {
                        fairy: 150,
                    },
                },
                multipliers: {
                    buildings: {
                        fairy: 6/2,
                    },
                },
                tier: 5,
            },
            {
                id: 'fairy_07',
                name: gettext('games_idle_upgrade_building_fairy_07'),
                cost: {
                    magic_powder: 161e15, //14_440 * 8 * 1.15 ** 200
                },
                unlock_conditions: {
                    buildings: {
                        fairy: 200,
                    },
                },
                multipliers: {
                    buildings: {
                        fairy: 7/2,
                    },
                },
                tier: 6,
            },
            {
                id: 'fairy_08',
                name: gettext('games_idle_upgrade_building_fairy_08'),
                cost: {
                    magic_powder: 210e21, //14_440 * 9 * 1.15 ** 300
                },
                unlock_conditions: {
                    buildings: {
                        fairy: 300,
                    },
                },
                multipliers: {
                    buildings: {
                        fairy: 8/2,
                    },
                },
                tier: 7,
            },
            {
                id: 'fairy_09',
                name: gettext('games_idle_upgrade_building_fairy_09'),
                cost: {
                    magic_powder: 273e27, //14_440 * 10 * 1.15 ** 400
                },
                unlock_conditions: {
                    buildings: {
                        fairy: 400,
                    },
                },
                multipliers: {
                    buildings: {
                        fairy: 9/2,
                    },
                },
                tier: 8,
            },
            {
                id: 'fairy_10',
                name: gettext('games_idle_upgrade_building_fairy_10'),
                cost: {
                    magic_powder: 350e33, //14_440 * 11 * 1.15 ** 500
                },
                unlock_conditions: {
                    buildings: {
                        fairy: 500,
                    },
                },
                multipliers: {
                    buildings: {
                        fairy: 10/2,
                    },
                },
                tier: 9,
            },
            //#endregion Fairy upgrades

            //#region Fan upgrades
            {
                id: 'fan_01',
                name: gettext('games_idle_upgrade_building_fan_01'),
                cost: {
                    dust: 25, //10 * 2 * 1.15 ** 1
                },
                unlock_conditions: {
                    buildings: {
                        fan: 1,
                    },
                },
                multipliers: {
                    buildings: {
                        fan: 1/2,
                    },
                },
                tier: 0,
            },
            {
                id: 'fan_02',
                name: gettext('games_idle_upgrade_building_fan_02'),
                cost: {
                    dust: 125, //10 * 3 * 1.15 ** 10
                },
                unlock_conditions: {
                    buildings: {
                        fan: 10,
                    },
                },
                multipliers: {
                    buildings: {
                        fan: 2/2,
                    },
                },
                tier: 1,
            },
            {
                id: 'fan_03',
                name: gettext('games_idle_upgrade_building_fan_03'),
                cost: {
                    dust: 1_300, //10 * 4 * 1.15 ** 25
                },
                unlock_conditions: {
                    buildings: {
                        fan: 25,
                    },
                },
                multipliers: {
                    buildings: {
                        fan: 3/2,
                    },
                },
                tier: 2,
            },
            {
                id: 'fan_04',
                name: gettext('games_idle_upgrade_building_fan_04'),
                cost: {
                    dust: 55_000, //10 * 5 * 1.15 ** 50
                },
                unlock_conditions: {
                    buildings: {
                        fan: 50,
                    },
                },
                multipliers: {
                    buildings: {
                        fan: 4/2,
                    },
                },
                tier: 3,
            },
            {
                id: 'fan_05',
                name: gettext('games_idle_upgrade_building_fan_05'),
                cost: {
                    dust: 70e6, //10 * 6 * 1.15 ** 100
                },
                unlock_conditions: {
                    buildings: {
                        fan: 100,
                    },
                },
                multipliers: {
                    buildings: {
                        fan: 5/2,
                    },
                },
                tier: 4,
            },
            {
                id: 'fan_06',
                name: gettext('games_idle_upgrade_building_fan_06'),
                cost: {
                    dust: 90e9, //10 * 7 * 1.15 ** 150
                },
                unlock_conditions: {
                    buildings: {
                        fan: 150,
                    },
                },
                multipliers: {
                    buildings: {
                        fan: 6/2,
                    },
                },
                tier: 5,
            },
            {
                id: 'fan_07',
                name: gettext('games_idle_upgrade_building_fan_07'),
                cost: {
                    dust: 111e12, //10 * 8 * 1.15 ** 200
                },
                unlock_conditions: {
                    buildings: {
                        fan: 200,
                    },
                },
                multipliers: {
                    buildings: {
                        fan: 7/2,
                    },
                },
                tier: 6,
            },
            {
                id: 'fan_08',
                name: gettext('games_idle_upgrade_building_fan_08'),
                cost: {
                    dust: 150e18, //10 * 9 * 1.15 ** 300
                },
                unlock_conditions: {
                    buildings: {
                        fan: 300,
                    },
                },
                multipliers: {
                    buildings: {
                        fan: 8/2,
                    },
                },
                tier: 7,
            },
            {
                id: 'fan_09',
                name: gettext('games_idle_upgrade_building_fan_09'),
                cost: {
                    dust: 190e24, //10 * 10 * 1.15 ** 400
                },
                unlock_conditions: {
                    buildings: {
                        fan: 400,
                    },
                },
                multipliers: {
                    buildings: {
                        fan: 9/2,
                    },
                },
                tier: 8,
            },
            {
                id: 'fan_10',
                name: gettext('games_idle_upgrade_building_fan_10'),
                cost: {
                    dust: 250e30, //10 * 11 * 1.15 ** 500
                },
                unlock_conditions: {
                    buildings: {
                        fan: 500,
                    },
                },
                multipliers: {
                    buildings: {
                        fan: 10/2,
                    },
                },
                tier: 9,
            },
            //#endregion Fan upgrades
            //#region Wind upgrades
            {
                id: 'wind_01',
                name: gettext('games_idle_upgrade_building_wind_01'),
                cost: {
                    dust: 250, //100 * 2 * 1.15 ** 1
                },
                unlock_conditions: {
                    buildings: {
                        wind: 1,
                    },
                },
                multipliers: {
                    buildings: {
                        wind: 1/2,
                    },
                },
                tier: 0,
            },
            {
                id: 'wind_02',
                name: gettext('games_idle_upgrade_building_wind_02'),
                cost: {
                    dust: 1_250, //100 * 3 * 1.15 ** 10
                },
                unlock_conditions: {
                    buildings: {
                        wind: 10,
                    },
                },
                multipliers: {
                    buildings: {
                        wind: 2/2,
                    },
                },
                tier: 1,
            },
            {
                id: 'wind_03',
                name: gettext('games_idle_upgrade_building_wind_03'),
                cost: {
                    dust: 13_000, //100 * 4 * 1.15 ** 25
                },
                unlock_conditions: {
                    buildings: {
                        wind: 25,
                    },
                },
                multipliers: {
                    buildings: {
                        wind: 3/2,
                    },
                },
                tier: 2,
            },
            {
                id: 'wind_04',
                name: gettext('games_idle_upgrade_building_wind_04'),
                cost: {
                    dust: 550_000, //100 * 5 * 1.15 ** 50
                },
                unlock_conditions: {
                    buildings: {
                        wind: 50,
                    },
                },
                multipliers: {
                    buildings: {
                        wind: 4/2,
                    },
                },
                tier: 3,
            },
            {
                id: 'wind_05',
                name: gettext('games_idle_upgrade_building_wind_05'),
                cost: {
                    dust: 700e6, //100 * 6 * 1.15 ** 100
                },
                unlock_conditions: {
                    buildings: {
                        wind: 100,
                    },
                },
                multipliers: {
                    buildings: {
                        wind: 5/2,
                    },
                },
                tier: 4,
            },
            {
                id: 'wind_06',
                name: gettext('games_idle_upgrade_building_wind_06'),
                cost: {
                    dust: 900e9, //100 * 7 * 1.15 ** 150
                },
                unlock_conditions: {
                    buildings: {
                        wind: 150,
                    },
                },
                multipliers: {
                    buildings: {
                        wind: 6/2,
                    },
                },
                tier: 5,
            },
            {
                id: 'wind_07',
                name: gettext('games_idle_upgrade_building_wind_07'),
                cost: {
                    dust: 1.11e15, //100 * 8 * 1.15 ** 200
                },
                unlock_conditions: {
                    buildings: {
                        wind: 200,
                    },
                },
                multipliers: {
                    buildings: {
                        wind: 7/2,
                    },
                },
                tier: 6,
            },
            {
                id: 'wind_08',
                name: gettext('games_idle_upgrade_building_wind_08'),
                cost: {
                    dust: 1.5e21, //100 * 9 * 1.15 ** 300
                },
                unlock_conditions: {
                    buildings: {
                        wind: 300,
                    },
                },
                multipliers: {
                    buildings: {
                        wind: 8/2,
                    },
                },
                tier: 7,
            },
            {
                id: 'wind_09',
                name: gettext('games_idle_upgrade_building_wind_09'),
                cost: {
                    dust: 1.9e27, //100 * 10 * 1.15 ** 400
                },
                unlock_conditions: {
                    buildings: {
                        wind: 400,
                    },
                },
                multipliers: {
                    buildings: {
                        wind: 9/2,
                    },
                },
                tier: 8,
            },
            {
                id: 'wind_10',
                name: gettext('games_idle_upgrade_building_wind_10'),
                cost: {
                    dust: 2.5e33, //100 * 11 * 1.15 ** 500
                },
                unlock_conditions: {
                    buildings: {
                        wind: 500,
                    },
                },
                multipliers: {
                    buildings: {
                        wind: 10/2,
                    },
                },
                tier: 9,
            },
            //#endregion Wind upgrades
            //#region Bird upgrades
            {
                id: 'bird_01',
                name: gettext('games_idle_upgrade_building_bird_01'),
                cost: {
                    dust: 2_500, //1_000 * 2 * 1.15 ** 1
                },
                unlock_conditions: {
                    buildings: {
                        bird: 1,
                    },
                },
                multipliers: {
                    buildings: {
                        bird: 1/2,
                    },
                },
                tier: 0,
            },
            {
                id: 'bird_02',
                name: gettext('games_idle_upgrade_building_bird_02'),
                cost: {
                    dust: 12_500, //1_000 * 3 * 1.15 ** 10
                },
                unlock_conditions: {
                    buildings: {
                        bird: 10,
                    },
                },
                multipliers: {
                    buildings: {
                        bird: 2/2,
                    },
                },
                tier: 1,
            },
            {
                id: 'bird_03',
                name: gettext('games_idle_upgrade_building_bird_03'),
                cost: {
                    dust: 130_000, //1_000 * 4 * 1.15 ** 25
                },
                unlock_conditions: {
                    buildings: {
                        bird: 25,
                    },
                },
                multipliers: {
                    buildings: {
                        bird: 3/2,
                    },
                },
                tier: 2,
            },
            {
                id: 'bird_04',
                name: gettext('games_idle_upgrade_building_bird_04'),
                cost: {
                    dust: 5.5e6, //1_000 * 5 * 1.15 ** 50
                },
                unlock_conditions: {
                    buildings: {
                        bird: 50,
                    },
                },
                multipliers: {
                    buildings: {
                        bird: 4/2,
                    },
                },
                tier: 3,
            },
            {
                id: 'bird_05',
                name: gettext('games_idle_upgrade_building_bird_05'),
                cost: {
                    dust: 7e9, //1_000 * 6 * 1.15 ** 100
                },
                unlock_conditions: {
                    buildings: {
                        bird: 100,
                    },
                },
                multipliers: {
                    buildings: {
                        bird: 5/2,
                    },
                },
                tier: 4,
            },
            {
                id: 'bird_06',
                name: gettext('games_idle_upgrade_building_bird_06'),
                cost: {
                    dust: 9e12, //1_000 * 7 * 1.15 ** 150
                },
                unlock_conditions: {
                    buildings: {
                        bird: 150,
                    },
                },
                multipliers: {
                    buildings: {
                        bird: 6/2,
                    },
                },
                tier: 5,
            },
            {
                id: 'bird_07',
                name: gettext('games_idle_upgrade_building_bird_07'),
                cost: {
                    dust: 11.11e15, //1_000 * 8 * 1.15 ** 200
                },
                unlock_conditions: {
                    buildings: {
                        bird: 200,
                    },
                },
                multipliers: {
                    buildings: {
                        bird: 7/2,
                    },
                },
                tier: 6,
            },
            {
                id: 'bird_08',
                name: gettext('games_idle_upgrade_building_bird_08'),
                cost: {
                    dust: 15e21, //1_000 * 9 * 1.15 ** 300
                },
                unlock_conditions: {
                    buildings: {
                        bird: 300,
                    },
                },
                multipliers: {
                    buildings: {
                        bird: 8/2,
                    },
                },
                tier: 7,
            },
            {
                id: 'bird_09',
                name: gettext('games_idle_upgrade_building_bird_09'),
                cost: {
                    dust: 19e27, //1_000 * 10 * 1.15 ** 400
                },
                unlock_conditions: {
                    buildings: {
                        bird: 400,
                    },
                },
                multipliers: {
                    buildings: {
                        bird: 9/2,
                    },
                },
                tier: 8,
            },
            {
                id: 'bird_10',
                name: gettext('games_idle_upgrade_building_bird_10'),
                cost: {
                    dust: 25e33, //1_000 * 11 * 1.15 ** 500
                },
                unlock_conditions: {
                    buildings: {
                        bird: 500,
                    },
                },
                multipliers: {
                    buildings: {
                        bird: 10/2,
                    },
                },
                tier: 9,
            },
            //#endregion Bird upgrades
            //#region Tornado upgrades
            {
                id: 'tornado_01',
                name: gettext('games_idle_upgrade_building_tornado_01'),
                cost: {
                    dust: 25_000, //10_000 * 2 * 1.15 ** 1
                },
                unlock_conditions: {
                    buildings: {
                        tornado: 1,
                    },
                },
                multipliers: {
                    buildings: {
                        tornado: 1/2,
                    },
                },
                tier: 0,
            },
            {
                id: 'tornado_02',
                name: gettext('games_idle_upgrade_building_tornado_02'),
                cost: {
                    dust: 125_000, //10_000 * 3 * 1.15 ** 10
                },
                unlock_conditions: {
                    buildings: {
                        tornado: 10,
                    },
                },
                multipliers: {
                    buildings: {
                        tornado: 2/2,
                    },
                },
                tier: 1,
            },
            {
                id: 'tornado_03',
                name: gettext('games_idle_upgrade_building_tornado_03'),
                cost: {
                    dust: 1.3e6, //10_000 * 4 * 1.15 ** 25
                },
                unlock_conditions: {
                    buildings: {
                        tornado: 25,
                    },
                },
                multipliers: {
                    buildings: {
                        tornado: 3/2,
                    },
                },
                tier: 2,
            },
            {
                id: 'tornado_04',
                name: gettext('games_idle_upgrade_building_tornado_04'),
                cost: {
                    dust: 55e6, //10_000 * 5 * 1.15 ** 50
                },
                unlock_conditions: {
                    buildings: {
                        tornado: 50,
                    },
                },
                multipliers: {
                    buildings: {
                        tornado: 4/2,
                    },
                },
                tier: 3,
            },
            {
                id: 'tornado_05',
                name: gettext('games_idle_upgrade_building_tornado_05'),
                cost: {
                    dust: 70e9, //10_000 * 6 * 1.15 ** 100
                },
                unlock_conditions: {
                    buildings: {
                        tornado: 100,
                    },
                },
                multipliers: {
                    buildings: {
                        tornado: 5/2,
                    },
                },
                tier: 4,
            },
            {
                id: 'tornado_06',
                name: gettext('games_idle_upgrade_building_tornado_06'),
                cost: {
                    dust: 90e12, //10_000 * 7 * 1.15 ** 150
                },
                unlock_conditions: {
                    buildings: {
                        tornado: 150,
                    },
                },
                multipliers: {
                    buildings: {
                        tornado: 6/2,
                    },
                },
                tier: 5,
            },
            {
                id: 'tornado_07',
                name: gettext('games_idle_upgrade_building_tornado_07'),
                cost: {
                    dust: 111.11e15, //10_000 * 8 * 1.15 ** 200
                },
                unlock_conditions: {
                    buildings: {
                        tornado: 200,
                    },
                },
                multipliers: {
                    buildings: {
                        tornado: 7/2,
                    },
                },
                tier: 6,
            },
            {
                id: 'tornado_08',
                name: gettext('games_idle_upgrade_building_tornado_08'),
                cost: {
                    dust: 150e21, //10_000 * 9 * 1.15 ** 300
                },
                unlock_conditions: {
                    buildings: {
                        tornado: 300,
                    },
                },
                multipliers: {
                    buildings: {
                        tornado: 8/2,
                    },
                },
                tier: 7,
            },
            {
                id: 'tornado_09',
                name: gettext('games_idle_upgrade_building_tornado_09'),
                cost: {
                    dust: 190e27, //10_000 * 10 * 1.15 ** 400
                },
                unlock_conditions: {
                    buildings: {
                        tornado: 400,
                    },
                },
                multipliers: {
                    buildings: {
                        tornado: 9/2,
                    },
                },
                tier: 8,
            },
            {
                id: 'tornado_10',
                name: gettext('games_idle_upgrade_building_tornado_10'),
                cost: {
                    dust: 250e33, //10_000 * 11 * 1.15 ** 500
                },
                unlock_conditions: {
                    buildings: {
                        tornado: 500,
                    },
                },
                multipliers: {
                    buildings: {
                        tornado: 10/2,
                    },
                },
                tier: 9,
            },
            //#endregion Tornado upgrades

            //#endregion T0 buildings upgrades
        ];

        upgrades.forEach((upgrade, index) => {
            if (upgrade.id in Upgrade.UPGRADES) return;

            upgrade.position ??= index;

            new Upgrade(upgrade);
        });
    }
    /**
     * Creates the prestiges
     */
    function create_prestiges() {
        /**
         * @type {{
         *  id: number,
         *  text: string,
         *  conditions: (this: Prestige)=>boolean,
         *  effect?: (this: Prestige)=>void,
         * }[]}
         */
        let prestiges = [
            {
                id: 0,
                text: gettext('games_idle_prestige_0'),
                conditions() { return true; },
                effect() {
                    if (!confirm(gettext('games_idle_prestige_0_confirm'))) return;

                    Object.values(Boss.BOSSES).forEach(b => b.defeated_in_run = false);
                    Boss.current_boss = Boss.get_first_boss();

                    Object.values(Resource.RESOURCES)
                        .filter(r => r.tier == 0)
                        .forEach(r => r.amount = 0);
                    Object.values(Building.BUILDINGS)
                        .filter(b => b.tier == 0)
                        .forEach(b => b.amount = 0);
                },
            },
            {
                id: 1,
                text: gettext('games_idle_prestige_1'),
                conditions() { return Boss.BOSSES.boss_dummy.defeated_in_run; },
                effect() {
                    if (!confirm(gettext('games_idle_prestige_1_confirm'))) return;

                    let i = this.id - 1;
                    while (!(i in Prestige.PRESTIGES) && i >= 0) i--;

                    /** @param {string} id */
                    let res = id => Resource.RESOURCES[id];
                    let hour = Math.abs(12 - new Date().getHours());

                    res('relics').amount += res('knowledge').amount / 10;
                    res('prestige').amount += Math.floor((res('points').amount / 10) ** .5);
                    res('magic_shards').amount += res('magic_powder').amount / (2 ** .5);
                    res('dust_balls').amount += (res('dust').amount * 6 / Math.PI) ** (1/3);
                    res('rocks').amount += res('pebbles').amount / (Math.random() * 10);
                    res('flames').amount += res('embers').amount / (hour + 1);
                    res('drops').amount += res('droplets').amount / (13 - hour);
                    res('notes').amount += res('wave').amount / Math.E;
                    res('nuggets').amount += res('scraps').amount * (Math.random() * (Math.log1p(res('flames').amount) + .1));
                    res('arcs').amount += res('sparks').amount ** .75;
                    res('mush').amount += Math.hypot(res('snowflakes').amount, res('drops').amount) ** .5;
                    res('uncommon_loot').amount += Math.ceil(res('common_loot').amount ** .25);

                    if (i >= 0) {
                        Prestige.PRESTIGES[i].effect();
                    }
                },
            },
        ];

        prestiges.forEach(prestige => {
            if (prestige.id in Prestige.PRESTIGES) return;

            new Prestige(prestige);
        });
    }

    init();
//})();
