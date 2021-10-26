(() => {
    if (typeof gettext != 'function') {
        /**
         * @param {string} string
         * @returns {string}
         */
        function gettext(string) {}
    }

    /**
     * Unit types for beautify
     *
     * @type { {[key: string]: {
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
     * Amount of ticks each second when the game is in the background
     */
    const TPS_BACK = 1;
    /**
     * Click effects
     *
     * @type {{
     *  damage: {[key: string]: number},
     *  production: {[key: string]: number}
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
     * Current unit type
     *
     * @type {string}
     */
    let unit = Object.keys(UNITS)[0];
    /**
     * Whether the buildings need to be refreshed
     */
    let refresh_buildings = true;
    /**
     * Whether the damage need to be refreshed
     */
    let refresh_damage = true;
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
    /**
     * Whether the game is focused or in the background
     */
    let has_focus = true;

    class Trait {
        /**
         * Existing traits
         *
         * @type {{[key: string]: Trait}}
         * @readonly
         */
        static TRAITS = {};
        /**
         * Displays the current damage dealt
         */
        static display_damage() {
            /** @type {HTMLTableElement} */
            const TABLE = document.getElementById('damage_table');
            TABLE.textContent = '';

            let damage = Object.values(Building.BUILDINGS)
                .filter(b => b.amount > 0 && b.damage)
                .map(b => b.damage)
                .reduce((dmg, bdmg) => {
                    Object.entries(bdmg).forEach(([t, d]) => {
                        if (!(t in dmg)) dmg[t] = 0;
                        dmg[t] += d;
                    });
                    return dmg;
                }, {});

            Boss.get_current_boss().traits.forEach(t => {
                damage = Trait.TRAITS[t].apply_on_damage(damage);
            });

            Object.entries(damage).forEach(([trait, damage]) => {
                let row = document.createElement('tr');
                let cell_name = document.createElement('td');
                let cell_damage = document.createElement('td');

                cell_name.textContent = Trait.TRAITS[trait].name;
                cell_damage.textContent = beautify(damage);

                row.style.color = Trait.TRAITS[trait].color;
                row.style.backgroundColor = anti_bicolor(Trait.TRAITS[trait].color);

                row.appendChild(cell_name);
                row.appendChild(cell_damage);

                TABLE.appendChild(row);
            });
        }

        /**
         * @param {Object} params
         * @param {string} params.id
         * @param {string} params.name
         * @param {string} params.color
         * @param {{[key: string]: number}} params.multipliers
         */
        constructor({id, name, color, multipliers={}}) {
            if (id in Trait.TRAITS) {
                throw new Error(`Trait ${id} already exists`);
            }

            this.id = id;
            this.name = name;
            this.color = color;
            this.multipliers = multipliers;

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
         * @param {{[key: string]: number}} damages {element: damage}
         * @returns {{[key: string]: number}}
         */
        apply_on_damage(damages) {
            Object.entries(this.multipliers).filter(([trait, _]) => trait in damages)
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
         * @type {{[key: string]: Boss}}
         * @readonly
         */
        static BOSSES = {};

        /**
         * Current boss
         *
         * @type {string|null}
         * @private
         */
        static _current_boss;

        static get current_boss() { return this._current_boss };
        static set current_boss(value) {
            if (!(value in this.BOSSES) && value) return;

            this._current_boss = value;
            this.boss_display();
        }

        /**
         * Displays the current boss
         */
        static boss_display() {
            if (!this._current_boss) {
                document.getElementById('boss_div').textContent = '';
            } else {
                this.BOSSES[this._current_boss].display_create();
            }
        }
        /**
         * Returns the tooltip for the current boss
         */
        static boss_tooltip() {
            if (!(Boss._current_boss in Boss.BOSSES)) return null;

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
            if (Object.keys(boss.drops ?? {}).length) {
                let table = document.createElement('table');
                let title_row = document.createElement('tr');
                let title_cell = document.createElement('td');
                let title_b = document.createElement('b');

                title_b.textContent = gettext('games_idle_bosses_drops');
                title_cell.colSpan = 2;

                title_cell.appendChild(title_b);
                title_row.appendChild(title_cell);
                table.appendChild(title_row);

                Object.entries(boss.drops).forEach(([resource, amount]) => {
                    let row = document.createElement('tr');
                    let resource_cell = document.createElement('td');
                    let amount_cell = document.createElement('td');

                    row.appendChild(resource_cell);
                    row.appendChild(amount_cell);

                    resource_cell.textContent = Resource.RESOURCES[resource].name;

                    if (typeof amount == 'number') {
                        amount_cell.textContent = `100%: ${beautify(amount)}`;
                    } else {
                        let [chance, min, max=min] = amount;

                        amount_cell.textContent = `${chance * 100}%: ${beautify(min)}`;
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
            return Object.values(this.BOSSES)[0].id;
        }
        /**
         * Sets the current boss to the next one
         */
        static go_next_boss() {
            let boss = this.BOSSES[this._current_boss];

            this._current_boss = boss.next;
            boss = this.BOSSES[this._current_boss];
            boss._health = boss.max_health;

            refresh_damage = true;
        }
        /**
         * Gets the current boss
         *
         * @returns {Boss}
         */
        static get_current_boss() {
            if (!this._current_boss) this._current_boss = this.get_first_boss();

            return this.BOSSES[this.current_boss];
        }

        /**
         * @param {Object} params
         * @param {string} params.id
         * @param {string} params.name
         * @param {string[]} params.traits Traits ids
         * @param {number} params.health
         * @param {{[key: string]: number|[number, number, number?]}} params.drops amount|[chance (between 0 - 1),min, max (or min)]
         * @param {string} params.next next boss's id
         */
        constructor({id, name, traits=[], health, drops={}, next}) {
            if (id in Boss.BOSSES) {
                throw new Error(`Boss ${id} already exists`);
            }

            if (!traits.length) traits.push('none');

            this.id = id;
            this.name = name;
            this.traits = traits;
            this._health = health;
            this.max_health = health;
            this.drops = drops;
            this.next = next;
            this.defeats = 0;

            Boss.BOSSES[id] = this;
        }

        get health() {
            return Math.max(this._health, 0);
        }
        set health(value) {
            if (isNaN(value)) value = 0;
            this._health = Math.max(value, 0);

            if (!this._health) {
                Boss.go_next_boss();
                this.defeats++;

                this.give_drops();
            }
        }

        /**
         * Displays the boss
         *
         * @returns {HTMLDivElement}
         */
        display_create() {
            /** @type {HTMLImageElement} */
            let image = document.getElementById('current_boss_image');
            let progress_div = document.getElementById('current_boss_progress');
            let progress_bar_div = document.getElementById('current_boss_progress_bar');
            let current_boss_div = document.getElementById('current_boss_div');

            if (!current_boss_div) {
                current_boss_div = document.createElement('button');
                let image_div = document.createElement('div');
                image = document.createElement('img');
                progress_bar_div = document.createElement('div');
                progress_div = document.createElement('div');

                current_boss_div.id = 'current_boss_div';
                image.id = 'current_boss_image';
                progress_bar_div.id = 'current_boss_progress_bar';
                progress_div.id = 'current_boss_progress';

                progress_bar_div.classList.add('progress-bar-background');
                progress_bar_div.classList.add('progress-bar');
                progress_div.classList.add('progress-bar');

                image.height = 190;
                image.width = 190;

                current_boss_div.addEventListener('mouseenter', e => {
                    tooltip(Boss.boss_tooltip, [current_boss_div.offsetLeft, current_boss_div.offsetTop + current_boss_div.offsetHeight]);
                    e.preventDefault();
                });
                current_boss_div.addEventListener('mouseleave', e => un_tooltip());
                current_boss_div.addEventListener('click', e => click());

                current_boss_div.appendChild(image_div);
                current_boss_div.appendChild(progress_bar_div);
                image_div.appendChild(image);
                progress_bar_div.appendChild(progress_div);
                document.getElementById('boss_div').appendChild(current_boss_div);
            }

            image.src = Flask.url_for('static', {filename: `images/games/idle/boss_${this.id}.png`});
            progress_div.style.width = `${Math.floor(this.health / this.max_health * 100)}%`;
            progress_bar_div.title = `${beautify(this.health)}/${beautify(this.max_health)}`;
        }
        /**
         * Damages the boss
         *
         * @param {{[key: string]: number}} damages {element: damage}
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
        give_drops() {
            Object.entries(this.drops).forEach(([resource, amount]) => {
                let res = Resource.RESOURCES[resource];
                let up_mult_res = Object.values(Upgrade.UPGRADES)
                    .filter(u => u.bought && u.multipliers.resources && res in u.multipliers.resources)
                    .map(u => u.multipliers.resources[resource]+1)
                    .reduce((mult, u_mu) => mult * u_mu, 1);
                let up_mult_boss = Object.values(Upgrade.UPGRADES)
                    .filter(u => u.bought && u.multipliers.bosses && res in u.multipliers.bosses)
                    .map(u => u.multipliers.bosses[this.id]+1)
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
         * @type {{[key: string]: Resource}}
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
                .sort((a, b) => a.id > b.id)
                .forEach(r => r.display());
        }

        /**
         * @param {Object} params
         * @param {string} params.id
         * @param {string} params.name
         * @param {number} [params.amount=0]
         * @param {number} [params.prestige_layer='auto']
         * @param {boolean|'auto'} [params.unlocked=0]
         */
        constructor({id, name, amount = 0, unlocked = 'auto', prestige_layer = 0}) {
            if (id in Resource.RESOURCES) {
                throw new Error(`Resource ${id} already exists`);
            }

            this.id = id;
            this.name = name;
            this.amount = amount;
            this._unlocked = unlocked;
            this.prestige_layer = prestige_layer;

            Resource.RESOURCES[id] = this;
        }

        /** @type {boolean} */
        get unlocked() {
            if (this._unlocked == 'auto' && this.amount > 0) {
                this._unlocked = true;
                Resource.display_all(true);
            }

            return this._unlocked;
        }
        /** @param {boolean|'auto'} value */
        set unlocked(value) {
            if (value == 'auto') this._unlocked = value;
            else this._unlocked = !!value;
        }
        get per_second() {
            return Object.values(Building.BUILDINGS)
                .filter(b => b.unlocked && b.amount > 0 && b.production && this.id in b.production)
                .map(b => b.production[this.id])
                .reduce((s, b) => s + b, 0);
        }

        /**
         * Displays the resource
         */
        display() {
            let html_id = `resource_${this.id}`;
            /** @type {HTMLTableCellElement} */
            let amount_cell = document.getElementById(`${html_id}_amount`);
            let per_second_cell = document.getElementById(`${html_id}_per_second`);
            let per_second = this.per_second;

            if (!document.getElementById(html_id)) {
                /** @type {HTMLTableElement} */
                let table = document.getElementById('resources_table');
                let row = document.createElement('tr');
                let name_cell = document.createElement('td');
                amount_cell = document.createElement('td');
                per_second_cell = document.createElement('td');

                name_cell.textContent = this.name;

                row.id = html_id;
                amount_cell.id = `${html_id}_amount`;
                per_second_cell.id = `${html_id}_per_second`;

                row.appendChild(name_cell);
                row.appendChild(amount_cell);
                row.appendChild(per_second_cell);
                table.appendChild(row);
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
         * @type {{[key: string]: Building}}
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
                .sort((a, b) => a.id > b.id)
                .forEach(b => b.display());
        }
        /**
         * Does the production and damage of all the buildings
         *
         * @param {number} [multiplier=1]
         */
        static produce_all(multiplier = 1) {
            if (multiplier <= 0) return;

            /** @type {{[key: string]: number}} */
            let damage = {};

            Object.values(this.BUILDINGS)
                .filter(b => b.amount > 0)
                .forEach(b => {
                    let up_mult = Object.values(Upgrade.UPGRADES)
                        .filter(u => u.bought && u.multipliers.buildings && b.id in u.multipliers.buildings)
                        .map(u => u.multipliers.buildings[this.id]+1)
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

        /**
         * @param {Object} params
         * @param {string} params.id
         * @param {string} params.name
         * @param {number} [params.amount=0]
         * @param {{[key: string]: number}} params.cost_base
         * @param {number} params.cost_multiplier
         * @param {{
         *  bosses?: {[key: string]: number},
         *  resources?: {[key: string]: number},
         *  buildings?: {[key: string]: number},
         *  upgrades?: string[],
         * }} [params.unlock_conditions=null] Conditions to unlock
         * @param {number} [params.prestige_layer=0]
         * @param {{[key: string]: number}|null} [params.damage=null]
         * @param {{[key: string]: number}|null} [params.production=null]
         */
        constructor({id, name, amount=0, cost_base, cost_multiplier, unlock_conditions=null, prestige_layer=0, damage=null, production=null}) {
            if (id in Building.BUILDINGS) {
                throw new Error(`Building ${id} already exists`);
            }

            this.id = id;
            this.name = name;
            this.amount = amount;
            this.cost_base = cost_base;
            this.cost_multiplier = cost_multiplier;
            this.prestige_layer = prestige_layer;
            this.damage = damage;
            this.production = production;
            this.unlock_conditions = unlock_conditions;
            this._unlocked = !(unlock_conditions ?? false);

            Building.BUILDINGS[id] = this;
        }

        /** @type {boolean} */
        get unlocked() {
            if (!this._unlocked) {
                let {bosses={}, resources={}, buildings={}, upgrades=[]} = this.unlock_conditions;

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

                this._unlocked = can_unlock;
                if (can_unlock) Building.display_all(true);
            }

            return this._unlocked;
        }
        set unlocked(value) {
            this._unlocked = !!value;
        }
        get cost() {
            if (!this.cost_base) return {};

            let multiplier = this.cost_multiplier ** this.amount;

            return Object.fromEntries(Object.entries(this.cost_base).map(([resource, amount]) => [resource, amount * multiplier]));
        }
        get can_afford() {
            return Object.entries(this.cost)
                .every(([r, a]) => Resource.RESOURCES[r].amount >= a);
        }

        /**
         * Displays the building
         */
        display() {
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

                button.classList.add('building');
                if (target_traits.length <= 1) {
                    button.style.backgroundColor = Trait.TRAITS[target_traits[0] ?? 'none'].color;
                } else if (target_traits.length > 1) {
                    let colors = target_traits.filter(t => t in Trait.TRAITS).map(t => Trait.TRAITS[t].color).join(', ');
                    button.style.backgroundImage = `linear-gradient(to right, ${colors})`;
                }

                title_b.textContent = `${this.name} `;

                button.addEventListener('mouseenter', e => tooltip(this._get_tooltip.bind(this), [button.offsetLeft, button.offsetTop + button.offsetHeight]));
                button.addEventListener('mouseleave', e => un_tooltip());
                button.addEventListener('click', e => this.purchase());

                title_b.appendChild(amount_b);
                title_div.appendChild(title_b);
                button.appendChild(title_div);
                button.appendChild(cost_table);
                DIV.appendChild(button);
            }

            amount_b.textContent = beautify(this.amount);
            cost_table.classList[this.can_afford ? 'remove' : 'add']('cant-afford');
            cost_table.textContent = '';
            Object.entries(this.cost).forEach(([resource, amount]) => {
                let row = document.createElement('tr');
                let name_cell = document.createElement('td');
                let amount_cell = document.createElement('td');
                let res = Resource.RESOURCES[resource];

                name_cell.textContent = res.name;
                amount_cell.textContent = `${beautify(res.amount)} / ${beautify(amount)}`;

                row.appendChild(name_cell);
                row.appendChild(amount_cell);
                cost_table.appendChild(row);
            });
        }
        /**
         * @private
         */
        _get_tooltip() {
            let rows = [];
            let cost = this.cost;

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
                    let row = document.createElement('tr');
                    let name_cell = document.createElement('td');
                    let amount_cell = document.createElement('td');
                    let res = Resource.RESOURCES[resource];

                    name_cell.textContent = res.name;
                    amount_cell.textContent = `${beautify(amount * this.amount)} (+${beautify(amount)})`;

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
                    let row = document.createElement('tr');
                    let name_cell = document.createElement('td');
                    let amount_cell = document.createElement('td');
                    let trt = Trait.TRAITS[trait];

                    row.style.color = trt.color;
                    row.style.backgroundColor = anti_bicolor(trt.color);

                    name_cell.textContent = trt.name;
                    amount_cell.textContent = `${beautify(amount * this.amount)} (+${beautify(amount)})`;

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
        purchase() {
            if (!this.can_afford) return;

            Object.entries(this.cost)
                .forEach(([res, amnt]) => Resource.RESOURCES[res].amount -= amnt);

            this.amount++;

            refresh_buildings = true;
        }
    }
    class Upgrade {
        /**
         * Existing upgrades
         *
         * @type {{[key: string]: Upgrade}}
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
                        return a.id > b.id;
                    }
                }).forEach(u => u.display());
        }

        /**
         * @param {Object} params
         * @param {string} params.id
         * @param {string} params.name
         * @param {{[key: string]: number}} params.cost
         * @param {{
         *  bosses?: {[key: string]: number},
         *  resources?: {[key: string]: number},
         *  buildings?: {[key: string]: number},
         *  upgrades?: string[],
         * }} [params.unlock_conditions=null] Conditions to unlock
         * @param {{
         *  bosses?: {[key: string]: number},
         *  resources?: {[key: string]: number},
         *  buildings?: {[key: string]: number},
         *  traits?: {[key: string]: number},
         * }} [params.multipliers=null] Multipliers to productions for all, and damage for building. 1 is automatically added, so .5 => *1.5
         */
        constructor({id, name, cost, unlock_conditions=null, multipliers=null}) {
            if (id in Upgrade.UPGRADES) {
                throw new Error(`Upgrade ${id} already exists`);
            }

            this.id = id;
            this.name = name;
            this.cost = cost;
            this.unlock_conditions = unlock_conditions;
            this.multipliers = multipliers;
            this._unlocked = !(unlock_conditions ?? false);
            this.bought = false;

            Upgrade.UPGRADES[id] = this;
        }

        /** @type {boolean} */
        get unlocked() {
            if (!this._unlocked) {
                let {bosses={}, resources={}, buildings={}, upgrades=[]} = this.unlock_conditions;

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

                this._unlocked = can_unlock;
                if (can_unlock) Upgrade.display_all(true);
            }

            return this._unlocked;
        }
        set unlocked(value) {
            this._unlocked = !!value;
        }
        get can_afford() {
            return Object.entries(this.cost)
                .every(([r, a]) => Resource.RESOURCES[r].amount >= a);
        }

        /**
         * Displays the upgrade
         */
        display() {
            let html_id = `upgrade_${this.id}`;
            /** @type {HTMLButtonElement} */
            let button = document.getElementById(html_id);
            /** @type {HTMLTableElement|null} */
            let cost_table = document.getElementById(`${html_id}_cost`);

            if (!button) {
                /** @type {HTMLDivElement} */
                const DIV = document.createElement('upgrades_div');
                button = document.createElement('button');
                let title_div = document.createElement('div');
                let title_b = document.createElement('b');
                cost_table = document.createElement('table');

                button.id = html_id;
                cost_table.id = `${html_id}_cost`;

                title_b.textContent = `${this.name} `;

                button.addEventListener('mouseenter', e => tooltip(this._get_tooltip));
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
                cost_table.textContent = '';
                Object.entries(this.cost).forEach(([resource, amount]) => {
                    let row = document.createElement('tr');
                    let name_cell = document.createElement('td');
                    let amount_cell = document.createElement('td');
                    let res = Resource.RESOURCES[resource];

                    name_cell.textContent = res.name;
                    amount_cell.textContent = `${beautify(res.amount)} / ${beautify(amount)}`;

                    row.appendChild(name_cell);
                    row.appendChild(amount_cell);
                    cost_table.appendChild(row);
                });
            }
        }
        /**
         * @private
         */
        _get_tooltip() {
            let rows = [];

            // Costs
            if (Object.keys(this.cost).length) {
                let table = document.createElement('table');
                let table_title_row = document.createElement('tr');
                let table_title = document.createElement('td');
                let table_title_b = document.createElement('b');

                table_title.colSpan = 2;
                table_title_b.textContent = gettext('games_idle_upgradess_cost');

                table_title.appendChild(table_title_b);
                table_title_row.appendChild(table_title);
                table.appendChild(table_title_row);

                Object.entries(this.cost).forEach(([resource, amount]) => {
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
                    amount_cell.textContent = `*${beautify((amount+1)*100)}`;

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

            Object.entries(this.cost)
                .forEach(([res, amnt]) => Resource.RESOURCES[res].amount -= amnt);

            this.bought = true;

            refresh_buildings = true;
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
    function beautify(number, trim = true, min_short = 2) {
        if (isNaN(number)) return '0';
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

        Resource.display_all();
        Boss.boss_display();

        last_production = Date.now();

        document.addEventListener('focus', e => has_focus = true);
        document.addEventListener('blur', e => has_focus = false);

        setTimeout(() => loop(), 1e3/TPS_ACTIVE);
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

        if (refresh_buildings) {
            Building.display_all();

            refresh_buildings = false;
            refresh_damage = true;
        }
        if (refresh_damage) {
            Trait.display_damage();

            refresh_damage = false;
        }

        let tps = has_focus ? TPS_ACTIVE : TPS_BACK;

        setTimeout(() => loop(), 1e3/tps);
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
     * Creates the traits
     */
    function create_traits() {
        /**
         * @type {{
         *  id: string,
         *  name: string,
         *  color: string,
         *  multipliers?: {[key: string]: number},
         * }[]}
         */
        let traits = [
            {
                id: 'none',
                name: gettext('games_idle_trait_none'),
                color: '#fff',
            },
            {
                id: 'plant',
                name: gettext('games_idle_trait_plant'),
                color: '#0f0',
                multipliers: {
                    'fire': 2,
                    'water': .1
                },
            },
            {
                id: 'fire',
                name: gettext('games_idle_trait_fire'),
                color: '#f70',
                multipliers: {
                    'plant': .1,
                    'water': 2
                },
            },
            {
                id: 'water',
                name: gettext('games_idle_trait_water'),
                color: '#00f',
                multipliers: {
                    'plant': 2,
                    'fire': .1
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
         *  drops?: {[key: string]: number|[number,number,number?]},
         * }[]}
         */
        let bosses = [
            {
                id: 'scarecrow',
                name: gettext('games_idle_boss_scarecrow'),
                traits: ['plant'],
                health: 10_000,
                next: 'small_rat',
            },
            {
                id: 'small_rat',
                name: gettext('games_idle_boss_small_rat'),
                traits: ['none'],
                health: 1_000_000,
                next: 'infinity',
            },
            {
                id: 'infinity',
                name: gettext('games_idle_boss_infinity'),
                traits: ['none', 'fire', 'water', 'plant'],
                health: Number.MAX_VALUE,
                next: 'infinity',
            },
        ];

        bosses.forEach(boss => {
            if (boss.id in Boss.BOSSES) return;

            new Boss(boss);
        })
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
         *  prestige_layer?: number,
         *  unlocked?: boolean|'auto',
         * }[]}
         */
        let resources = [
            {
                id: 'points',
                name: gettext('games_idle_resource_points'),
                unlocked: true,
            },
        ];

        resources.forEach(resource => {
            if (resource.id in Resource.RESOURCES) return;

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
         *  cost_base: {[key: string]: number},
         *  cost_multiplier: number,
         *  unlock_conditions: {
         *      bosses?: {[key: string]: number},
         *      resources?: {[key: string]: number},
         *      buildings?: {[key: string]: number},
         *      upgrades?: string[],
         *  },
         *  prestige_layer?: number,
         *  damage?: {[key: string]: number},
         *  production?: {[key: string]: number},
         * }[]}
         */
        let buildings = [
            {
                id: 'puncher',
                name: gettext('games_idle_building_puncher'),
                cost_base: {
                    points: 10,
                },
                cost_multiplier: 1.15,
                damage: {
                    none: .1,
                },
                production: {
                    points: .1,
                },
            },
        ];

        buildings.forEach(building => {
            if (building.id in Building.BUILDINGS) return;

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
         *  cost: {[key: string]: number},
         *  unlock_conditions: {
         *      bosses?: {[key: string]: number},
         *      resources?: {[key: string]: number},
         *      buildings?: {[key: string]: number},
         *      upgrades?: string[],
         *  },
         *  multipliers?: {
         *      bosses?: {[key: string]: number},
         *      resources?: {[key: string]: number},
         *      buildings?: {[key: string]: number},
         *      traits?: {[key: string]: number},
         *  }
         * }[]}
         */
        let upgrades = [
            {
                id: 'upgrade_building_puncher_01',
                name: gettext('games_idle_upgrade_building_puncher_01'),
                cost: {
                    points: 10 * (1.15 * 2) ** 01
                },
                multipliers: {
                    buildings: {
                        puncher: 1/2,
                    },
                },
                unlock_conditions: {
                    buildings: {
                        puncher: 1,
                    },
                },
            },
            {
                id: 'upgrade_building_puncher_02',
                name: gettext('games_idle_upgrade_building_puncher_02'),
                cost: {
                    points: 10 * (1.15 * 3) ** 02
                },
                multipliers: {
                    buildings: {
                        puncher: 2/2,
                    },
                },
                unlock_conditions: {
                    buildings: {
                        puncher: 10,
                    },
                },
            },
            {
                id: 'upgrade_building_puncher_03',
                name: gettext('games_idle_upgrade_building_puncher_03'),
                cost: {
                    points: 10 * (1.15 * 4) ** 03
                },
                multipliers: {
                    buildings: {
                        puncher: 2/2,
                    },
                },
                unlock_conditions: {
                    buildings: {
                        puncher: 25,
                    },
                },
            },
            {
                id: 'upgrade_building_puncher_04',
                name: gettext('games_idle_upgrade_building_puncher_04'),
                cost: {
                    points: 10 * (1.15 * 5) ** 04
                },
                multipliers: {
                    buildings: {
                        puncher: 4/2,
                    },
                },
                unlock_conditions: {
                    buildings: {
                        puncher: 50,
                    },
                },
            },
            {
                id: 'upgrade_building_puncher_05',
                name: gettext('games_idle_upgrade_building_puncher_05'),
                cost: {
                    points: 10 * (1.15 * 6) ** 05
                },
                multipliers: {
                    buildings: {
                        puncher: 5/2,
                    },
                },
                unlock_conditions: {
                    buildings: {
                        puncher: 100,
                    },
                },
            },
            {
                id: 'upgrade_building_puncher_06',
                name: gettext('games_idle_upgrade_building_puncher_06'),
                cost: {
                    points: 10 * (1.15 * 7) ** 06
                },
                multipliers: {
                    buildings: {
                        puncher: 6/2,
                    },
                },
                unlock_conditions: {
                    buildings: {
                        puncher: 150,
                    },
                },
            },
            {
                id: 'upgrade_building_puncher_07',
                name: gettext('games_idle_upgrade_building_puncher_07'),
                cost: {
                    points: 10 * (1.15 * 8) ** 07
                },
                multipliers: {
                    buildings: {
                        puncher: 7/2,
                    },
                },
                unlock_conditions: {
                    buildings: {
                        puncher: 200,
                    },
                },
            },
            {
                id: 'upgrade_building_puncher_08',
                name: gettext('games_idle_upgrade_building_puncher_08'),
                cost: {
                    points: 10 * (1.15 * 9) ** 08
                },
                multipliers: {
                    buildings: {
                        puncher: 8/2,
                    },
                },
                unlock_conditions: {
                    buildings: {
                        puncher: 300,
                    },
                },
            },
            {
                id: 'upgrade_building_puncher_09',
                name: gettext('games_idle_upgrade_building_puncher_09'),
                cost: {
                    points: 10 * (1.15 * 10) ** 09
                },
                multipliers: {
                    buildings: {
                        puncher: 9/2,
                    },
                },
                unlock_conditions: {
                    buildings: {
                        puncher: 400,
                    },
                },
            },
            {
                id: 'upgrade_building_puncher_10',
                name: gettext('games_idle_upgrade_building_puncher_10'),
                cost: {
                    points: 10 * (1.15 * 11) ** 10
                },
                multipliers: {
                    buildings: {
                        puncher: 10/2,
                    },
                },
                unlock_conditions: {
                    buildings: {
                        puncher: 500,
                    },
                },
            },
        ];

        upgrades.forEach(upgrade => {
            if (upgrade.id in Upgrade.UPGRADES) return;

            new Upgrade(upgrade);
        });
    }

    init();
})();
