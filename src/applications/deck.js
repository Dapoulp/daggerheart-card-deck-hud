import { MODULE_ID } from "../system/constants";
import DHCard from "./card";

export default class DHDeck {
    isVault = false;

    constructor(actor, parent) {
        this.actor = actor;
        this.parent = parent;
        this.cards = new Map();
        this.itemTypes = this._getItemTypes();
    }

    get cardWith() {
        return parseFloat(
            getComputedStyle(document.documentElement)
                .getPropertyValue("--dh-card-width")
        ) * parseFloat(getComputedStyle(document.documentElement).fontSize);

    }

    get size() {
        return this.cards.length;
    }

    get classes() {
        const classes = [];
        if(game.settings.get(MODULE_ID, "deckStyle") === 'flat') classes.push('flat');
        if(!!this.actor.system.activeBeastform) classes.push('beastform');
        if(game.settings.get(MODULE_ID, "hideDescription")) classes.push('description-hidden');
        if(game.settings.get(MODULE_ID, "invertGradient")) classes.push('invert-gradient');
        if(game.settings.get(MODULE_ID, "autoHide")) classes.push('auto-hide');
        return classes;
    }

    get element() {
        return this.parent.parts.deck;
    }

    get activeTypes() {
        return this.itemTypes.reduce((types, type) => {
            if(type.active) types.push(type.type);
            return types;
        }, []);
    }

    get itemTypesSetting() {
        return this.actor.type === 'character' ? 'itemTypes' : 'itemTypesNPC';
    }

    static async create(actor, parent) {
        const deck = new this(actor, parent);
        await deck.createCards();

        return deck;
    }

    async createCards() {
        const items = this.getItems();
        const entries = await Promise.all(
            items.map(async (item, index) => {
                const card = await DHCard.create(item, index);
                card.element.style = this.getCardStyle(items.length, card.index, game.settings.get(MODULE_ID, "frontPosition"));
                return [ card.id, card ];
            })
        );
        this.cards = new Map(entries);
    }

    getItems() {
        const items = [];
        
        if(this.actor.type === 'character') {
            if(this.isVault) return this.actor.system.domainCards.vault;

            const isBeastform = this.actor.system.activeBeastform;

            const primaryClass = this.actor.system.class.value;
            const primarySubclass = this.getSubclassCards(this.actor.system.class.subclass);
            const secondaryClass = this.actor.system.multiclass.value;
            const secondarySubclass = this.getSubclassCards(this.actor.system.multiclass.subclass);
            const domainCards = this.actor.system.domainCards.loadout;
            const ancestry = this.actor.system.ancestry;
            const community = this.actor.system.community;
            const armor = this.actor.system.armor;
            const beastform = isBeastform ? this.getBeastformCard() : [];
            const primaryWeapon = isBeastform || !this.actor.system.primaryWeapon ? this.simulateUnarmedCard() : this.actor.system.primaryWeapon;
            const secondaryWeapon = isBeastform ? null : this.actor.system.secondaryWeapon;
            const consumable = this.actor.items.filter(item => item.type === 'consumable');
            const loot = this.actor.items.filter(item => item.type === 'loot');

            items.push(...[
                ...loot,
                ...consumable,
                ancestry,
                community,
                primaryClass,
                ...primarySubclass,
                secondaryClass,
                ...secondarySubclass,
                ...domainCards,
                armor,
                ...beastform,
                primaryWeapon,
                secondaryWeapon
            ]);
        } else {
            items.push(...this.actor.items);
            if(this.actor.system.attack) items.push(this.simulateUnarmedCard());
        }

        const order = new Map(this.itemTypes.map((itemType, index) => [itemType.type, index]));

        return items
            .filter(item => Boolean(item) && this.activeTypes.includes(item.type))
            .sort((a, b) => {
                const aIndex = order.get(a.type) ?? Infinity;
                const bIndex = order.get(b.type) ?? Infinity;

                return aIndex - bIndex;
            });
    }

    getSubclassCards(item) {
        if(!item) return [];
        const subclassCards = [{ ...item.toObject(), id: item._id, actor: item.actor, featureState: 1, featureList: item.system.foundationFeatures}];
        if(item.system.featureState >= 2) subclassCards.push({ ...item.toObject(), id: item._id, actor: item.actor, featureState: 2, featureList: item.system.specializationFeatures});
        if(item.system.featureState >= 3) subclassCards.push({ ...item.toObject(), id: item._id, actor: item.actor, featureState: 3, featureList: item.system.masteryFeatures});
        return subclassCards;
    }

    simulateUnarmedCard() {
        const action = this.actor.system.attack;
        const { id, name, img, description } = action;
        
        return {
            id, 
            name: _loc(name),
            img,
            type: 'weapon',
            actor: action.actor,
            effects: [],
            uuid: action.id,
            system: {
                attack: action,
                description,
                burden: "oneHanded",
                tier: 0,
                constructor: {
                    DEFAULT_ICON: `modules/${MODULE_ID}/assets/icons/${this.actor.system.activeBeastform ? 'paw-solid-full.svg' : 'hand-fist-solid-full.svg'}`
                }
            }
        }
    }

    getBeastformCard() {
        const { uuid, id, name, img, description } = this.actor.system.activeBeastform;
        const features = this.actor.items.filter(i => this.actor.system.activeBeastform.system.featureIds.includes(i.id));
        return [{
            id, 
            name: _loc(name),
            img,
            type: 'beastform',
            actor: this.actor,
            effects: [],
            uuid,
            features,
            system: {
                advantageOn: this.actor.system.activeBeastform.system.advantageOn
            }
        }];
    }

    updateCardPosition() {
        this.cards.forEach((card) => card.element.style = this.getCardStyle(this.cards.size, card.index, game.settings.get(MODULE_ID, "frontPosition")));
    }

    getCardStyle(count, index, frontCardPosition = "last") {
        const spacing = this.element.dataset.cardOverlap || game.settings.get(MODULE_ID, "cardOverlap") || 55;

        const maxRotation = 14;
        const maxCurve = 45;

        const center = (count - 1) / 2;
        const offset = index - center;

        // -1 à +1 whatever deck size is
        const normalized = count > 1
            ? offset / center
            : 0;
        
        // Horizontal positioning
        const translateX =
            offset * spacing - this.cardWith / 2;

        // Vertical curve
        const translateY =
            Math.abs(normalized) ** 2 * maxCurve;

        // Rotation
        const rotate =
            normalized * maxRotation;

        const baseZ =
            this.getCardZIndex(
                count,
                index,
                frontCardPosition
            );

        return [
            `--translate-x: ${translateX}px`,
            `--translate-y: ${translateY}px`,
            `--rotate: ${rotate}deg`,
            `--base-z: ${baseZ}`
        ].join("; ");
    }

    getCardZIndex(count, index, position) {
        switch (position) {
            case "first":
                return count - index;
            case "middle": {
                const middle = Math.floor((count - 1) / 2);
                return count - Math.abs(index - middle);
            }
            case "last":
            default:
                return index + 1;
        }
    }

    _getItemTypes() {
        const typesSetting = game.settings.get("daggerheart-card-deck-hud", this.itemTypesSetting);
        const defaultOrder = typesSetting.length ? typesSetting : this._getItemTypesDefaultOrder().map(type => ({ type, label: _loc(this._getTypeLabel(type)), active: !['loot', 'consumable'].includes(type) })).sort((a, b) => a.label.localeCompare(b.label));
        const typesMap = new Map(defaultOrder.map(item => [item.type, item]));

        const itemTypes = this._getItemTypesDefaultOrder()
            .map(type => ({
                type,
                label: _loc(this._getTypeLabel(type)),
                active: typesMap.get(type)?.active ?? type !== "loot"
            }));

        itemTypes.sort((a, b) => {
            const aIndex = defaultOrder.findIndex(item => item.type === a.type);
            const bIndex = defaultOrder.findIndex(item => item.type === b.type);

            return (aIndex === -1 ? Infinity : aIndex)
                - (bIndex === -1 ? Infinity : bIndex);
        });

        return itemTypes;
    }

    _getItemTypesDefaultOrder() {
        if(this.actor.type !== 'character') return ['feature', 'potentialAdversaries', 'weapon'];
        const knownTypes = ['ancestry', 'community', 'class', 'subclass', 'domainCard', 'beastform', 'consumable', 'loot', 'armor', 'weapon'];
        knownTypes.push(...Item.TYPES.filter(type => !knownTypes.includes(type) && !["base", "feature"].includes(type)));
        return knownTypes;
    }

    _getTypeLabel(type) {
        if(type === 'potentialAdversaries') return 'DAGGERHEART.GENERAL.Tabs.potentialAdversaries';
        return `TYPES.Item.${type}`;
    }

    _setDeckSize() {
        const cards = [...this.element.querySelectorAll(".dh-card")];
        if (cards.length) {
            const bounds = cards.reduce((bounds, card) => {
                const rect = card.getBoundingClientRect();

                bounds.left = Math.min(bounds.left, rect.left);
                bounds.top = Math.min(bounds.top, rect.top);
                bounds.right = Math.max(bounds.right, rect.right);
                bounds.bottom = Math.max(bounds.bottom, rect.bottom);

                return bounds;
            }, {
                left: Infinity,
                top: Infinity,
                right: -Infinity,
                bottom: -Infinity
            });

            this.element.style.width = `${bounds.right - bounds.left}px`;
            this.element.style.height = `${bounds.bottom - bounds.top}px`;
        }
    }

    applyGradient(value) {
        if (!this.element) return;

        if (value === 0) {
            this.element.style.removeProperty("--card-gradient");
            this.element.classList.add("no-gradient");
            return;
        }

        this.element.classList.remove("no-gradient");
        this.element.style.setProperty("--card-gradient", `${100 - value}%`);
    }
}