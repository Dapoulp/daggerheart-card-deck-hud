import { CardService } from "../services/card-service";
import { RESOURCES } from "../data/resources";
import { MODULE_ID } from "../system/constants";

const {
    ApplicationV2,
    HandlebarsApplicationMixin
} = foundry.applications.api;

export class DHCardDeck extends HandlebarsApplicationMixin(ApplicationV2) {
    static instance = null;
    isMenuOpen = false;
    #clickTimer = null;

    static DEFAULT_OPTIONS = {
        id: "dh-card-deck",
        tag: "div",
        classes: [
            "daggerheart",
            "dh-style",
            "dh-card-deck"
        ],
        position: {
            width: "auto",
            height: "auto"
        },
        window: {
            frame: false,
            positioned: false,
            resizable: false
        },
        actions: {
            toggleVault: this.#toggleVault,
            toggleHUD: this.#toggleHUD,
            toggleMenu: this.#toggleMenu,
            toggleItemType: this.#toggleItemType,
            useCard: this.#useCard,
            onIncreaseResource: this.#onIncreaseResource,
            triggerUse: this.#triggerUse,
            selectCard: this.#selectCard,
            sendToVault: this.#sendToVault,
            sendToLoadout: this.#sendToLoadout,
            recall: this.#recall,
            sendToChat: this.#sendToChat,
            editItem: this.#editItem,
            cancelBeastform: this.#cancelBeastform
        }
    };

    static PARTS = {
        hud: {
            root: true,
            template: "modules/daggerheart-card-deck-hud/templates/hud.hbs"
        }
    };

    #actor = null;
    #token = null;
    #isVault = false;
    #isCollapsed = false;
    #isMenuOpen = false;
    #itemTypes;
    // #isBeastform = false;

    constructor(options = {}) {
        super(options);
        this.#itemTypes = CardService.initializeItemTypes();
    }

    static async create() {
        if (this.instance) return this.instance;

        const hud = new this();
        this.instance = hud;

        await hud.render({force: true});

        const token = canvas.tokens?.controlled[0];

        if (token?.actor) hud.setActor(token.actor, token);
    }

    static async destroy() {
        if (!this.instance) return;

        const instance = this.instance;
        this.instance = null;
        instance.element?.remove();
    }

    async _onClose(options) {
        await super._onClose(options);

        DHCardDeck.instance = null;
    }

    get actor() {
        return this.#actor;
    }

    get token() {
        return this.#token;
    }

    /** @override */
    async _insertElement(element, options) {
        const uiBottom = document.querySelector("#ui-bottom");
        const uiRight = document.querySelector("#ui-right-column-1");
        const positionSetting = game.settings.get(MODULE_ID, "deckPosition");

        switch (positionSetting) {
            case 'center':
                if(uiBottom) {
                    uiBottom.prepend(element);
                    return;
                }
                break;    
            case 'right':
                if(uiRight) uiRight.appendChild(element);
                break;       
            default:
                break;
        }

        element.classList.add("alternate-positioning", `position-${positionSetting}`);

        return super._insertElement(element, options);
    }

    async _onFirstRender(context, options) {
        await super._onFirstRender(context, options);        

        ["click", "contextmenu"].forEach(eventType => {
            document.addEventListener(eventType, event => {
               DHCardDeck._unselectCard(event);
                if (!this.isMenuOpen || event.target.closest(".dh-cd-control-settings-menu") || event.target.closest(".dh-cd-control-toggle")) return;
                this._toggleMenu(event);
            });
        });

        // this.element.addEventListener("contextmenu", this.#onContextMenu);
        this.element.addEventListener('dblclick', this.#onDblClick);
    }

    async _onRender(context, options) {
        await super._onRender(context, options);

        this.updateMarginPosition();

        // this.element.querySelectorAll('.card').forEach((card, i) => {
        this.element.querySelectorAll('.dh-card').forEach((card, i) => {
            card.addEventListener('contextmenu', DHCardDeck.#selectCard);
            card.addEventListener("transitionend", event => {
                if (event.propertyName !== "transform") return;

                if (card.classList.contains("selected")) {
                    card.classList.add("show-actions");
                }
            });
        });

        const deckBounds = this.getDeckBounds();
        if(!deckBounds) return;

        this.element.style.width = `${deckBounds.width}px`;
        this.element.querySelector('.dh-cd-cards').style.height = `${deckBounds.height}px`;

        const settingsButton = this.element.querySelector("[data-action='toggleMenu']");
        if (!settingsButton) return;
        settingsButton.addEventListener("contextmenu", this._toggleMenu.bind(this));
    }

    getDeckBounds() {
        // const cards = [...this.element.querySelectorAll(".dh-cd-cards .card")];
        const cards = [...this.element.querySelectorAll(".dh-cd-cards .dh-card")];

        if (!cards.length) return;

        const rects = cards.map(card => card.getBoundingClientRect());

        const left = Math.min(...rects.map(rect => rect.left));
        const right = Math.max(...rects.map(rect => rect.right));
        const top = Math.min(...rects.map(rect => rect.top));
        const bottom = Math.max(...rects.map(rect => rect.bottom));

        return {
            width: right - left,
            height: bottom - top,
            left,
            right,
            top,
            bottom
        };
    }

    updateMarginPosition() {
        if(!this.element) return;
        this.element.style.setProperty("--borderMargin", `${game.settings.get(MODULE_ID, "deckBorderMargin")}px`);
        this.element.style.setProperty("--bottomMargin", `${game.settings.get(MODULE_ID, "deckBottomMargin")}px`);
    }

    async setActor(actor, token = null) {
        this.#actor = actor;
        this.#token = token;
        this.#isVault = false;
        // this.#isBeastform = 

        await this.render();
    }

    async clearActor() {
        this.#actor = null;
        this.#token = null;

        await this.render();
    }

    async _prepareContext(options) {
        const context = await super._prepareContext(options);
        if(!this.#actor) return context;

        context.actor = this.#actor;
        context.token = this.#token;
        context.visible = Boolean(this.#actor);
        context.collapsed = this.#isCollapsed;
        context.isVault = this.#isVault;
        context.menuOpen = this.isMenuOpen;
        context.resources = CardService.getResources(this.#actor, RESOURCES);
        context.cards = await CardService.getCards(
            this.#actor,
            {
                isVault: this.#isVault,
                itemTypes: this.#itemTypes
            }
        );
        context.itemTypes = this.#itemTypes;
        // context.isFlat = game.settings.get(MODULE_ID, "deckStyle") === 'flat';
        context.isResourceHidden = game.settings.get(MODULE_ID, "hideResource");
        context.styleResource = game.settings.get(MODULE_ID, "styleResource");
        context.hasVaultCards = this.#actor.system.domainCards.vault.length > 0;
        // context.isBeastform = !!CardService.isBeastform(this.#actor);

        // context.isTTRPGmode = game.settings.get(MODULE_ID, "ttRpgCards");

        context.classes = {
            isFlat: { class: 'flat', active: game.settings.get(MODULE_ID, "deckStyle") === 'flat' },
            isTTRPGmode: { class: 'ttrpg-mode', active: game.settings.get(MODULE_ID, "ttRpgCards") },
            isBeastform: { class: 'beastform', active: !!this.#actor.system.activeBeastform }
        }

        const currentHP = this.#actor.system.resources.hitPoints.value;
        const currentMax = this.#actor.system.resources.hitPoints.max;
        context.token = {
            picture: game.settings.get(MODULE_ID, "playerToken") ? this.#token.document.texture.src : this.#actor.img,
            hp: {
                value: currentHP,
                max: currentMax,
                perc: currentMax > 0 ? Math.floor(((currentMax- currentHP)/currentMax)*100) : 0
            }
        }

        return context;
    }

    static async #toggleVault() {
        this.#isVault = !this.#isVault;

        await this.render();
    }

    static async #toggleHUD() {
        this.#isCollapsed = !this.#isCollapsed;

        const cards = this.element.querySelector(".dh-cd-cards");
        const marginSetting = game.settings.get(MODULE_ID, "deckBottomMargin");
        let offset = marginSetting;

        if (!cards) return;

        if(this.#isCollapsed) {
            const rect = cards.getBoundingClientRect();
            offset = `calc(${window.innerHeight - rect.top}px + 1rem + ${marginSetting}px)`;
        }

        cards.style.setProperty("--dh-cd-hide-offset", offset);

        this.element.classList.toggle("is-hidden", this.#isCollapsed);
    }

    static async #toggleMenu(event) {
        this._toggleMenu(event);
    }

    async _toggleMenu(event) {
        event.preventDefault();
        event.stopPropagation();
        this.isMenuOpen = !this.isMenuOpen;
        await this.render();
    }

    static async #toggleItemType(event, target) {
        const type = target.dataset.type;
        const itemType = this.#itemTypes.find(
            item => item.type === type
        );

        if (!itemType) return;

        itemType.active = !itemType.active;

        await this.render();
    }

    static async #useCard(event, target) {
        if(game.settings.get(MODULE_ID, "ttRpgCards") && !target.closest('.card')?.classList.contains('selected')) return DHCardDeck.#selectCard(event);
        const uuid = target.dataset.itemId;
        const item = await fromUuid(uuid) ?? (uuid === this.actor.system.attack?.id ? this.actor.system.attack : null);

        if (!item) return;

        if (item.system?.actionsList || item === this.actor.system.attack) {
            DHCardDeck._unselectCard(event, true);
            return await item.use(event);
        }
        // If no actions attached, check for features and simulate item with actions
        const attachedFeatures = CardService.getItemFeatures(item).map(f => f.uuid);
        const features = this.actor.items.filter(i => attachedFeatures.includes(i.sourceUuid));
        const actions = features.flatMap(f => [...f.system.actions.values()]);
        const fakeItem = CardService.constructItem(item, actions);
        // console.log(features, actions);
        // game.system.api.applications.dialogs.ActionSelectionDialog.create(fakeItem, event);
        let count = 0;
        const hasMultipleFeaturesWithActions = features.some(feature => {
            if (feature.system.actions.size > 0) count++;
            return count > 1;
        });
        if(features?.length) {
            if(hasMultipleFeaturesWithActions) {
                // Feature Selection Dialog
            } else features.find(f => f.system.actions.size).use(event);
        }
    }

    #onContextMenu = async (event) => {
        const resource = event.target.closest("[data-resource-id]");

        if (!resource || !this.element.contains(resource)) return;

        event.preventDefault();

        await this._updateResource(resource.dataset.resourceId, -1);
    };

    static async #onIncreaseResource(event, target) {
        // clearTimeout(this.#clickTimer);
        const { resourceId } = target.closest("[data-resource-id]")?.dataset ?? {};
        if(!resourceId) return;

        // this.#clickTimer = setTimeout(async () => {
            // this.#clickTimer = null;
            await this._updateResource(resourceId, 1);
        // }, 300);
    }

    async _updateResource(resourceId, value) {
        switch (resourceId) {
            case "armor":
                await this.actor.system.updateArmorValue({ value: value });
                break;        
            default:
                const newValue = Math.clamp(this.actor.system.resources[resourceId].value + value, 0, this.actor.system.resources[resourceId].max) ;
                await this.actor.update({ [`system.resources.${resourceId}.value`]: newValue });
                break;
        }
    }

    #onDblClick = (event) => {
        // clearTimeout(this.#clickTimer);
        // this.#clickTimer = null;
        const imgContainer = event.target.closest(".dh-cd-player");

        if (!imgContainer || !this.element.contains(imgContainer)) return;

        event.preventDefault();

        this.#actor.sheet.render({ force: true, focus: true });
    }

    static #triggerUse(event, target) {
        event.preventDefault();
        event.stopPropagation();
        if(game.settings.get(MODULE_ID, "ttRpgCards") && !target.closest('.card')?.classList.contains('selected')) return DHCardDeck.#selectCard(event);
        const { itemId, actionId } = target.closest('[data-action]').dataset;
        const item = this.#actor.items.get(itemId);
        const action = CardService.getAssociatedUse(item, actionId);
        DHCardDeck._unselectCard(event, true);
        if(!action) return;
        return action.use(event);
    }

    static #selectCard(event) {
        event.preventDefault();

        // const card = event.target.closest('.card');
        const card = event.target.closest('.dh-card');
        
        if (card.classList.contains('selected')) {
            card.classList.remove('show-actions');
            card.classList.remove('selected');
            return;
        }

        // document.querySelectorAll('.card.selected')
        document.querySelectorAll('.dh-card.selected')
            .forEach(c => {
                c.classList.remove('show-actions');
                c.classList.remove('selected');
            });

        card.classList.add('selected');
    }

    static _unselectCard(event, force = false) {
        // const selectedCard = DHCardDeck.instance.element.querySelector(".card.selected");
        const selectedCard = DHCardDeck.instance.element.querySelector(".dh-card.selected");
        if ((selectedCard && !selectedCard.contains(event.target)) || force) {
            // DHCardDeck.instance.element.querySelectorAll('.card.selected')
            DHCardDeck.instance.element.querySelectorAll('.dh-card.selected')
                .forEach(c => {
                    c.classList.remove('show-actions');
                    c.classList.remove('selected');
                });
        }
    }

    static async #sendToVault(event, target) {
        const { itemId } = target.closest('[data-item-id').dataset;
        const item = fromUuidSync(itemId);
        if(!item) return;
        await item.update({ 'system.inVault': true });
        this.render();
    }

    static async #sendToLoadout(event, target) {
        const { itemId } = target.closest('[data-item-id').dataset;
        const item = fromUuidSync(itemId);
        if(!item) return;
        // await item.update({ 'system.inVault': false });
        const actorLoadout = item.actor.system.loadoutSlot;
        if (actorLoadout.available) return item.update({ 'system.inVault': false });
        ui.notifications.warn(game.i18n.localize('DAGGERHEART.UI.Notifications.loadoutMaxReached'));
        this.render();
    }

    static #sendToChat(event, target) {
        const { itemId } = target.closest('[data-item-id').dataset;
        const item = fromUuidSync(itemId);
        if(!item) return;
        item.toChat(item.uuid);
    }

    static #editItem(event, target) {
        const card = target.closest('[data-item-id');
        const { itemId } = card.dataset;
        const item = fromUuidSync(itemId);
        if(!item) return;
        item.sheet.render({ force: true });
        card.classList.remove('show-actions');
        card.classList.remove('selected');
    }

    static #recall(event, target) {
        const card = target.closest('[data-item-id');
        const { itemId } = card.dataset;
        const item = fromUuidSync(itemId);
        if(!item) return;
    }

    static #cancelBeastform(event, target) {
        const card = target.closest('[data-item-id');
        const { itemId } = card.dataset;
        const item = fromUuidSync(itemId);
        if(!item) return;
        item.delete();
    }
}