const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export default class AdversariesSelectionDialog extends HandlebarsApplicationMixin(ApplicationV2) {
    constructor(actor, event, options = {}) {
        super(options);
        this.#actor = actor;
        this.#event = event;

        this._dragDrop = this._createDragDropHandlers();
    }

    _attachPartListeners(partId, htmlElement, options) {
        super._attachPartListeners(partId, htmlElement, options);

        this._dragDrop.forEach(d => d.bind(htmlElement));
    }

    /* -------------------------------------------- */

    /** @override */
    static DEFAULT_OPTIONS = {
        classes: ['daggerheart', 'dh-style', 'dialog'],
        position: {
            width: 400
        },
        dragDrop: [
            {
                dragSelector: '[data-item-id][draggable="true"], [data-item-id] [draggable="true"]',
                dropSelector: null
            }
        ]
    };

    /* -------------------------------------------- */

    static PARTS = {
        adversaries: {
            template: 'modules/daggerheart-card-deck-hud/templates/adversaries-selection-dialog.hbs'
        }
    };

    #actor;

    get actor() {
        return this.#actor;
    }

    #event;

    get event() {
        return this.#event;
    }

    /* -------------------------------------------- */

    /** @override */
    get title() {
        return game.i18n.localize('DHDECKCARD.DIALOG.selectAdversary');
    }

    _createDragDropHandlers() {
        return this.options.dragDrop.map(d => {
            d.callbacks = {
                dragstart: this._onDragStart.bind(this)
            };
            return new foundry.applications.ux.DragDrop.implementation(d);
        });
    }

    /* -------------------------------------------- */

    /** @inheritDoc */
    async _prepareContext(options) {
        return {
            ...(await super._prepareContext(options)),
            adversaries: this.#actor.system.potentialAdversaries,
            name: this.#actor.name
        };
    }

    static create(actor, event, options) {
        return new Promise(resolve => {
            const dialog = new this(actor, event, options);
            dialog.addEventListener('close', () => resolve(), { once: true });
            dialog.render({ force: true });
        });
    }

    async _onDragStart(event) {
        return game.system.api.applications.sheets.actors.Environment.prototype._onDragStart.call(this, event);
    }
}
