import { MODULE_ID } from "../system/constants";
import DHDeck from "./deck";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class DHCardDeckHUD extends HandlebarsApplicationMixin(ApplicationV2) {
    static instance = null;
    deck = null;
    #dragData = null;
    #isCollapsed = false;

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
            sendToVault: this.#sendToVault,
            sendToLoadout: this.#sendToLoadout,
            recall: this.#recall,
            sendToChat: this.#sendToChat,
            editItem: this.#editItem,
            cancelBeastform: this.#cancelBeastform
        }
    };

    static PARTS = {
        deck: {
            template: "modules/daggerheart-card-deck-hud/templates/deck.hbs"
        },
        controls: {
            template: "modules/daggerheart-card-deck-hud/templates/controls.hbs"
        }
    };

    #actor = null;
    #token = null;

    constructor(options = {}) {
        super(options);
    }

    static async create() {
        if (this.instance) return this.instance;

        const hud = new this();
        this.instance = hud;

        await hud.render({force: true});
        hud.element.setAttribute("hidden", "");

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

        DHCardDeckHUD.instance = null;
    }

    get actor() {
        return this.#actor;
    }

    get token() {
        return this.#token;
    }

    get isCharacter() {
        return !!this.actor.type === 'character';
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
            case "custom":
                const position = game.settings.get(MODULE_ID, "deckCustomPosition");
                element.style.left = `${position.left ?? 0}px`;
                element.style.top = `${position.top ?? 0}px`;
                break;
        }

        element.classList.add("alternate-positioning", `position-${positionSetting}`);

        return super._insertElement(element, options);
    }

    async _onFirstRender(context, options) {
        await super._onFirstRender(context, options);        

        ["click", "contextmenu"].forEach(eventType => {
            document.addEventListener(eventType, event => {
               if(this.deck?.cards) this._selectCard();
               if(!this.parts.controls.hasAttribute('data-menu-open') || event.target.closest('.dh-cd-control-settings-menu')) return;
               this._toggleMenu(event);
            });
        });
    }

    async _onRender(context, options) {
        await super._onRender(context, options);
        if(!this.#actor) return;

        if (options.parts?.includes("deck")) {
            this.parts.deck.replaceChildren(...this.deck.cards.values().map(card => card.element));
            this.deck._setDeckSize();

            for (const card of this.deck.cards.values()) {
                card.element.addEventListener("contextmenu", event => {
                    event.preventDefault();
                    event.stopPropagation();
                    this._selectCard(card);
                    if(this.parts.controls.hasAttribute('data-menu-open')) this._toggleMenu(event);
                });
                
                card.element.addEventListener("transitionend", event => {
                    if (event.propertyName !== "transform") return;
                    if (card.selected) card.element.classList.add("show-actions");
                });
            }
            this.deck.applyGradient(game.settings.get(MODULE_ID, "cardGradient"));
            this.parts.deck.style.setProperty("--hover-y-value", `${game.settings.get(MODULE_ID, "hoverY") * -1}rem`);
        }

        this.updateMarginPosition();

        if (options.parts?.includes("controls")) {
            const menu = this.parts.controls.querySelector(".dh-cd-control-settings-menu");

            let dragged = null;

            menu.addEventListener("dragstart", event => {
                dragged = event.target.closest("label");
            });

            menu.addEventListener("dragover", event => {
                event.preventDefault();

                const target = event.target.closest("label");

                if (!target || target === dragged) return;

                const rect = target.getBoundingClientRect();
                const after = event.clientY > rect.top + rect.height / 2;

                menu.insertBefore(
                    dragged,
                    after ? target.nextSibling : target
                );
            });

            menu.addEventListener("dragend", async () => {
                dragged = null;

                await this._saveItemTypes();
                await this.deck.createCards();
                await this.render({ parts: ['deck'] });
            });

            const settingsButton = this.element.querySelector("[data-action='toggleMenu']");
            if (settingsButton) settingsButton.addEventListener("contextmenu", this._toggleMenu.bind(this));

            const moveButton = this.element.querySelector(".dh-cd-control-move");
            if (moveButton) moveButton.addEventListener("pointerdown", this.#onDragStart);
        }

        // Test Animation Cards Reveal
        /* deckElement.replaceChildren();

        for (const card of this.deck.cards) {
            deckElement.append(card.element);

            await new Promise(resolve => setTimeout(resolve, 20));
        } */
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

    updateMarginPosition(deckBorderMargin, deckBottomMargin) {
        if(!this.element) return;
        deckBorderMargin ??= game.settings.get(MODULE_ID, "deckBorderMargin");
        deckBottomMargin ??= game.settings.get(MODULE_ID, "deckBottomMargin");
        this.element.style.setProperty("--borderMargin", `${deckBorderMargin}px`);
        this.element.style.setProperty("--bottomMargin", `${deckBottomMargin}px`);
    }

    async setActor(actor, token = null) {
        this.#actor = actor;
        this.#token = token;

        this.element.removeAttribute("hidden");
        
        await this.createDeck();
    }

    async clearActor() {
        this.#actor = null;
        this.#token = null;
        this.deck = null;

        this.element.setAttribute("hidden", "");
        this.element.replaceChildren();
    }

    async createDeck() {
        this.deck = await DHDeck.create(this.#actor, this);
        await this.render({ parts: ["deck", "controls"] });
    }

    // async _prepareContext(options) {
    //     const context = await super._prepareContext(options);
    //     if(!this.#actor) return context;
    //     return context;
    // }

    /* -------------------------------------------- */

    /** @override */
    async _preparePartContext(partId, context, options) {
        context = await super._preparePartContext(partId, context, options);
        if(!this.#actor) return context;
        switch (partId) {
            case "deck": return this._prepareDeckContext(context, options);
            case "controls": return this._prepareControlsContext(context, options);
        }
        return context;
    }

    async _prepareDeckContext(partId, context, options) {
        context = await super._preparePartContext(partId, context, options);
        if(!this.#actor) return context;
        context.classes = this.deck.classes;
        context.cardCount = this.deck.cards.size;
        context.cardOverlap = game.settings.get(MODULE_ID, "cardOverlap") ?? 55;
        context.cardWidthCoeff = game.settings.get(MODULE_ID, "cardWidth") ?? 5;
        return context;
    }

    _prepareControlsContext(context, options) {
        context.itemTypes = this.deck.itemTypes;
        context.isFreePositioning = game.settings.get(MODULE_ID, "deckPosition") === 'custom';
        context.isCharacter = this.isCharacter;
        if(this.isCharacter) {
            context.isVault = this.deck.isVault;
            context.hasVaultCards = this.#actor.system.domainCards.vault.length > 0;
        }
        return context;
    }

    static async #toggleVault() {
        this.deck.isVault = !this.deck.isVault;
        await this.deck.createCards();
        await this.render({ parts: ["deck", "controls"] });
    }

    static async #toggleHUD() {
        this.#isCollapsed = !this.#isCollapsed;

        const deck = this.parts.deck;
        const marginSetting = game.settings.get(MODULE_ID, "deckBottomMargin");
        let offset = marginSetting;

        if (!deck) return;

        if(this.#isCollapsed) {
            const rect = deck.getBoundingClientRect();
            offset = `calc(${window.innerHeight - rect.top}px + 1rem + ${marginSetting}px)`;
        }

        deck.style.setProperty("--dh-cd-hide-offset", offset);

        this.element.classList.toggle("is-hidden", this.#isCollapsed);
    }

    static async #toggleMenu(event) {
        this._toggleMenu(event);
    }

    async _toggleMenu(event) {
        event.preventDefault();
        event.stopPropagation();
        this.parts.controls.toggleAttribute("data-menu-open");
    }

    static async #toggleItemType(event, target) {
        const type = target.dataset.type;
        const itemType = this.deck.itemTypes.find(item => item.type === type);

        if (!itemType) return;

        itemType.active = !itemType.active;

        this._saveItemTypes();
        await this.deck.createCards();
        await this.render({ parts: ['deck'] });
    }

    async _saveItemTypes() {
        const itemTypes = [
            ...this.parts.controls.querySelectorAll(
                ".dh-cd-control-settings-menu label"
            )
        ].map(label => ({
            type: label.dataset.type,
            active: label.querySelector('input[type="checkbox"]').checked
        }));

        this.deck.itemTypes = itemTypes;

        await game.settings.set(
            "daggerheart-card-deck-hud",
            "itemTypes",
            itemTypes
        );
    }

    static #useCard(event, target) {
        const { cardId } = target.closest('[data-card-id').dataset;
        const card = this.deck.cards.get(cardId);

        if(!card.isLocked && (!game.settings.get(MODULE_ID, "directAction") || card.selected)) return card.use(event);
        this._selectCard(card);
    }

    _selectCard(card) {
        if(card) card.toggleSelected();
        for (const otherCard of this.deck.cards.values()) {
            if (otherCard !== card && otherCard.selected) otherCard.selected = false;
        }
    }

    static _unselectCard(event, force = false) {
        // const selectedCard = DHCardDeckHUD.instance.element.querySelector(".card.selected");
        const selectedCard = DHCardDeckHUD.instance.element.querySelector(".dh-card.selected");
        if ((selectedCard && !selectedCard.contains(event.target)) || force) {
            // DHCardDeckHUD.instance.element.querySelectorAll('.card.selected')
            DHCardDeckHUD.instance.element.querySelectorAll('.dh-card.selected')
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

    #onDragStart = event => {
        event.preventDefault();

        this.element.setAttribute('data-dragging', '');
        const rect = this.element.getBoundingClientRect();

        this.#dragData = {
            startX: event.clientX,
            startY: event.clientY,
            left: rect.left,
            top: rect.top
        };

        document.addEventListener("pointermove", this.#onDragMove);
        document.addEventListener("pointerup", this.#onDragEnd, { once: true });
    }

    #onDragMove = event => {
        if (!this.#dragData) return;

        const {
            startX,
            startY,
            left,
            top
        } = this.#dragData;

        const dx = event.clientX - startX;
        const dy = event.clientY - startY;

        const width = this.element.offsetWidth;
        const height = this.element.offsetHeight;

        const newLeft = Math.min(
            Math.max(0, left + dx),
            window.innerWidth - width
        );

        const newTop = Math.min(
            Math.max(0, top + dy),
            window.innerHeight - height
        );

        this.element.style.left = `${newLeft}px`;
        this.element.style.top = `${newTop}px`;
    }

    #onDragEnd = async event => {
        this.element.removeAttribute('data-dragging');
        document.removeEventListener("pointermove", this.#onDragMove);

        if (!this.#dragData) return;

        const rect = this.element.getBoundingClientRect();

        await game.settings.set(MODULE_ID, "deckCustomPosition", {
            left: rect.left,
            top: rect.top
        });

        this.#dragData = null;
    }
}