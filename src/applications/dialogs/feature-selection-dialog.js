const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export default class FeatureSelectionDialog extends HandlebarsApplicationMixin(ApplicationV2) {
    constructor(item, event, options = {}) {
        super(options);
        this.#item = item;
        this.#event = event;
    }

    /* -------------------------------------------- */

    /** @override */
    static DEFAULT_OPTIONS = {
        classes: ['daggerheart', 'dh-style', 'dialog'],
        actions: {
            onChooseFeature: FeatureSelectionDialog.#onChooseFeature
        },
        position: {
            width: 400
        }
    };

    /* -------------------------------------------- */

    static PARTS = {
        actions: {
            template: 'modules/daggerheart-card-deck-hud/templates/feature-selection-dialog.hbs'
        }
    };

    #item;

    get item() {
        return this.#item;
    }

    #event;

    get event() {
        return this.#event;
    }

    #feature;

    get feature() {
        return this.#feature ?? null;
    }

    /* -------------------------------------------- */

    /** @override */
    get title() {
        return game.i18n.localize('DHDECKCARD.DIALOG.selectFeature');
    }

    /* -------------------------------------------- */

    /** @inheritDoc */
    async _prepareContext(options) {
        return {
            ...(await super._prepareContext(options)),
            features: this.#item.features.map(feature => ({
                id: feature.id,
                name: feature.name,
                img: feature.img,
                uuid: feature.uuid
            })),
            name: this.#item.item.name
        };
    }

    /**     
     * @this FeatureSelectionDialog
     * @type {import("@client/applications/_types.mjs").ApplicationClickAction}
     */
    static async #onChooseFeature(event, button) {
        const { featureId } = button.dataset;
        this.#feature = this.item.features.find(a => a._id === featureId);
        Object.defineProperty(this.#event, 'shiftKey', {
            get() {
                return event.shiftKey;
            }
        });
        this.close();
    }

    static create(item, event, options) {
        return new Promise(resolve => {
            const dialog = new this(item, event, options);
            dialog.addEventListener('close', () => resolve(dialog.feature), { once: true });
            dialog.render({ force: true });
        });
    }
}
