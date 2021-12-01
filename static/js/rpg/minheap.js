/**
 * Serves as a priority heap
 *
 * **If using non-primary values, the old values must be obtained separately**
 *
 * @see https://esstudio.site/2018/10/31/implementing-binary-heaps-with-javascript.html
 * @see https://medium.com/@polyismstudio/a-pathfinding-in-javascript-1963759cf26
 *
 * @template T
 */
export class MinHeap {
    /** @type {(value: T) => number} */
    #selector;

    /** @param {(value: T) => number} selector */
    constructor(selector) {
        /** @type {T[]} */
        this.items = [];
        this.#selector = selector;
    }

    seek() { return this.items[0]; }

    /** @param {T} item */
    push(item) {
        let i = this.items.length;
        let root = Math.floor((i + 1) / 2 - 1);
        this.items.push(item);

        while (i > 0 && this.#selector(this.items[root]) > this.#selector(this.items[i])) {
            [this.items[i], this.items[root]] = [this.items[root], this.items[i]];
            i = root;
            root = Math.floor((i + 1) / 2 - 1);
        }
    }

    pop() {
        if (this.items.length <= 1) return this.items.pop();
        const ret = this.items[0];
        this.items[0] = this.items.pop();
        let i = 0;
        let branch = (i + 1) * 2;

        while(true) {
            let lowest = this.#selector(this.items[branch]) < this.#selector(this.items[branch - 1]) ? branch : branch - 1;
            if (this.#selector(this.items[i]) > this.#selector(this.items[lowest])) {
                [this.items[i], this.items[lowest]] = [this.items[lowest], this.items[i]];
                i = lowest;
                branch = (i + 1) * 2;
            } else break;
        }
        return ret;
    }

    /** @param {T} item */
    delete(item) {
        let i = this.items.indexOf(item);
        this.items[i] = this.items.pop();
        let branch = (i + 1) * 2;

        while(true) {
            let lowest = this.#selector(this.items[branch]) < this.#selector(this.items[branch - 1]) ? branch : branch - 1;
            if (this.#selector(this.items[i]) > this.#selector(this.items[lowest])) {
                [this.items[i], this.items[lowest]] = [this.items[lowest], this.items[i]];
                i = lowest;
                branch = (i + 1) * 2;
            } else break;
        }
    }

    /** @param {T[]} arr */
    heapify(arr) {
        arr.forEach(this.push);
    }
}
