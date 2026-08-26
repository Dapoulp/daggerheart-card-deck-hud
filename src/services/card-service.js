import { MODULE_ID, subclassRanks } from "../system/constants";
import Card from "../applications/card";

export class CardService {
    static embedTemplates = new Map([
        ['class', 'systems/daggerheart/templates/components/card/subclass.hbs'],
        ['subclass', 'systems/daggerheart/templates/components/card/subclass.hbs'],
        ['default', 'systems/daggerheart/templates/components/card/domain.hbs']
    ]);

    static get cardWith() {
        return parseFloat(
            getComputedStyle(document.documentElement)
                .getPropertyValue("--dh-card-width")
        ) * parseFloat(getComputedStyle(document.documentElement).fontSize);

    }

    static initializeItemTypes() {
        const itemTypes = Item.TYPES
            .filter(type => type !== "base")
            .map(type => ({
                type,
                label: _loc(`TYPES.Item.${type}`),
                active: type !== "loot"
            }))
            .sort((a, b) => a.label.localeCompare(b.label));

        itemTypes.push({
            type: "noaction",
            label: _loc("DHDECKCARD.GENERAL.NoAction"),
            active: false
        });

        return itemTypes;
    }

    static async getCards(actor, { isVault = false, itemTypes = []} = {}) {
        if (!actor) return [];

        const ttRpgSetting = game.settings.get(MODULE_ID, "ttRpgCards");

        const items = ttRpgSetting ? this.#getTTRPGCards(actor, isVault, itemTypes) : this.#getItems(actor, isVault, itemTypes);
        
        if(actor.system.activeBeastform) items.push(...this.#getBeastformCard(actor));
        if(!actor.system.primaryWeapon) items.push(this.#simulateUnarmedCard(actor.system.attack));

        console.log(items)
        // Test toEmbed
        const embedCards = (await Promise.all(items.map(async (item, index) => {
            const card = new Card(item);
            return card?.toEmbed();
            // if(!(item instanceof Item)) return;
            const getEmbed = (await item.system?.toEmbed?.()) ?? await CardService.simulateToEmbed(item);
            const embed = getEmbed instanceof HTMLCollection ? getEmbed[0] : getEmbed;
            if(embed) {
                if(item.sourceUuid === "Compendium.daggerheart.ancestries.Item.ed8BoLR4SHOpeV00") CardService.removePurposefulNote(embed);
                embed.setAttribute('data-item-id', item.uuid);
                embed.setAttribute("data-action", "selectCard");
                if(game.settings.get(MODULE_ID, "hideDescription")) embed.classList.add('description-hidden');
            }
            return embed;
            // return CardService.simulateToEmbed(item);
        })))
        .filter(Boolean)
        /* .flatMap(embed =>
            embed instanceof HTMLCollection ? [...embed] : [embed]
        ) */
        ;

        return embedCards.map((element, index) => {
            element.style = this.#getCardStyle(embedCards.length, index, game.settings.get(MODULE_ID, "frontPosition"));
            return element.outerHTML;
        });

        const cards = items
            .map((item, index) => {
                const originItem = this.#getOriginItem(item);
                
                return {
                    uuid: item.uuid,
                    type: item.type,
                    subtype: originItem?.type ?? item.system.type,
                    name: item.name,
                    subtitle: this.#getSubtitle(item),
                    description: this.#getDescription(item),
                    img: item.img,
                    level: item.system.tier ?? item.system.level,
                    recallCost: item.system.recallCost,
                    domain: item.system.domain ?? originItem?.name.toLowerCase() ?? item.name.toLowerCase(),
                    tags: this.#getTags(item, originItem),
                    hasBanner: this.#hasBanner(item),
                    classes: this.#getClasses(item, originItem).join(' ')
                }
            });
        
        if(!ttRpgSetting) cards.sort((a, b) => b.type.localeCompare(a.type));

        return cards.map((card, index) => ({
            ...card,
            style: this.#getCardStyle(cards.length, index, game.settings.get(MODULE_ID, "frontPosition"))
        }));
    }

    static async simulateToEmbed(item) {
        // const description = await item.system.getEnrichedDescription({ ...options, gmNotes: false, type: 'tooltip' });
        let description = item.system.description ?? '';
        const embedTemplate = item.system?.constructor?.embedTemplate ?? CardService.embedTemplates.get(item.type) ?? CardService.embedTemplates.get('default');

        // Specific type datas
        let extraDatas = {};
        let classe;
        
        switch (item.type) {
            case 'weapon':
                const trait = _loc(`DAGGERHEART.CONFIG.Traits.${item.system.attack.roll.trait}.name`);
                const damage = Roll.replaceFormulaData(item.system.attack.damage.main.value.getFormula(), item.actor.getRollData());
                description += `<div class="equipment-details">
                    <div>
                        <strong>Tier:</strong> ${item.system.tier}
                    </div>
                    <div>
                        <strong>Trait:</strong> ${trait}
                    </div>
                    <div>
                        <strong>Damage:</strong> ${damage}
                    </div>
                    <div>
                        <strong>Burden:</strong> ${_loc(`DAGGERHEART.CONFIG.Burden.${item.system.burden}`)}
                    </div>
                    <div>
                        <strong>Type:</strong> ${item.system.secondary
                            ? _loc("DHDECKCARD.GENERAL.Tags.secondary")
                            : _loc("DHDECKCARD.GENERAL.Tags.primary")}
                    </div>
                    <div>
                        <strong>Range:</strong> ${_loc(`DAGGERHEART.CONFIG.Range.${item.system.attack.range}.name`)}
                    </div>
                </div>`;
                break;
            case 'armor':
                description += `<div class="equipment-details">
                    <div>
                        <strong>Tier:</strong> ${item.system.tier}
                    </div>
                    <div>
                        <b>Base Score:</b> ${item.system.armor.current} / ${item.system.armor.max}
                    </div>
                    <div>
                        <b>Base Thresholds:</b> ${item.system.baseThresholds.major} / ${item.system.baseThresholds.severe}
                    </div>
                </div>`;
                break;
        }
        switch (item.type) {
            case 'class':
                classe = "class";
            case 'subclass':
                const classItem = item.system.linkedClass ? await fromUuid(item.system.linkedClass) : item;
                const domains = CONFIG.DH.DOMAIN.allDomains();
                const classDomains = classItem.system.domains?.slice(0, 2) ?? []; // 2 max for displays
                extraDatas = {
                    classItem,
                    domain1: foundry.utils.mergeObject({ color: 'black' }, domains[classDomains[0]] ?? {}),
                    domain2: foundry.utils.mergeObject({ color: 'black' }, domains[classDomains[1]] ?? domains[classDomains[0]] ?? {})
                };
                break;
            case 'beastform':
                extraDatas = {
                    domain: {color: '#666666'},
                    cardType: { label: `TYPES.Item.${item.type}` }
                };
                classe = 'beastform';
                break;
            default:
                extraDatas = {
                    domain: {color: '#666666'},                         //, label: _loc('DAGGERHEART.GENERAL.Tiers.singular')
                    cardType: { label: `TYPES.Item.${item.type}` }
                };
                item = foundry.utils.mergeObject(item, { system: { level: item.system.tier } });
                classe = 'equipment';
                if(item.effects.size) {
                    description += '<div class="features item-description-outer-container"><div class="item-description-container">';
                    for(const effect of item.effects) {
                        description += `<div class="feature item-description-inner-container"><strong>${effect.name}: </strong>${effect.description}</div>`
                    }
                    description += '</div></div>';
                }
                break;
        }

        // Construct features
        const attachedFeatures = CardService.getItemFeatures(item).map(f => f.uuid);
        if(attachedFeatures.length) {
            const features = item.actor.items.filter(i => attachedFeatures.includes(i.sourceUuid));
            description += '<div class="features item-description-outer-container"><div class="item-description-container">';
            if(item.type === 'beastform' && Object.keys(item.system.advantageOn).length) description += `<div class="feature item-description-inner-container"><b>${_loc('DAGGERHEART.ITEMS.Beastform.FIELDS.advantageOn.label')}:</b> ${Object.values(item.system.advantageOn).map(a => a.value).join(', ')}</div>`;
            description += features.map(f => `<div class="feature item-description-inner-container"><strong>${f.name}:</strong> ${f.system.description}</div>`).join('');
            description += '</div></div>';
        }

        const content = await foundry.applications.handlebars.renderTemplate(embedTemplate, {
            item,
            description,
            ...extraDatas
        });
        
        const container = document.createElement('div');
        container.innerHTML = content;

        const element = container.querySelector("div.dh-card");
        if(classe) element.classList.add(classe);

        return container.children;
    }

    static removePurposefulNote(embed) {
        const purposefulDesc = embed.querySelector('.item-description-inner-container p');
        const purposefulBr = embed.querySelector('.item-description-inner-container p br');
        purposefulDesc?.remove();
        purposefulBr?.remove();
    }

    static getResources(actor, resources) {
        if (!actor) return [];

        return resources.map(resource => ({
            id: resource.id,
            icon: resource.icon,

            label: _loc(
                resource.label
            ),

            value:
                actor.system.resources?.[
                    resource.id
                ]?.value ?? 0,

            max:
                actor.system.resources?.[
                    resource.id
                ]?.max ?? 0
        }));
    }

    static #getItems(actor, isVault, itemTypes) {
        if (isVault) {
            return actor.items.filter(item =>
                item.type === "domainCard" &&
                item.system.inVault === true
            );
        }

        const noActionEnabled = this.#isNoActionEnabled(itemTypes);

        return actor.items.filter(item => {
            const itemType = itemTypes.find(type => type.type === item.type);
            if (!itemType?.active || !item.actor.system.isItemAvailable(item)) return false;

            const hasAction = item.system.actions?.size || noActionEnabled;
            const equippedWeapon = item.type === "weapon" && item.system.equipped;
            const validDomainCard = item.type !== "domainCard" || item.system.inVault === isVault;

            return (equippedWeapon || (hasAction && validDomainCard));
        });
    }

    static #getTTRPGCards(actor, isVault, itemTypes) {
        const isBeastform = actor.system.activeBeastform;

        const primaryClass = actor.system.class.value;
        const primarySubclass = CardService.getSubclassCards(actor.system.class.subclass);
        // const primarySubclass = actor.system.class.subclass;
        const secondaryClass = actor.system.multiclass.value;
        const secondarySubclass = CardService.getSubclassCards(actor.system.multiclass.subclass);
        // const secondarySubclass = actor.system.multiclass.subclass;
        const domainCards = actor.system.domainCards[isVault ? 'vault' : 'loadout'];
        const ancestry = actor.system.ancestry;
        const community = actor.system.community;
        const armor = actor.system.armor;
        const primaryWeapon = isBeastform ? null : actor.system.primaryWeapon;
        const secondaryWeapon = isBeastform ? null : actor.system.secondaryWeapon;

        return (isVault ? domainCards
            : [
            ancestry,
            community,
            primaryClass,
            ...primarySubclass,
            // primarySubclass,
            secondaryClass,
            ...secondarySubclass,
            // secondarySubclass,
            ...domainCards,
            armor,
            primaryWeapon,
            secondaryWeapon
        ]).filter(Boolean);
    }

    static #simulateUnarmedCard(action) {
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
                tier: 0
            }
        }
    }

    static #getBeastformCard(actor) {
        const { uuid, id, name, img, description } = actor.system.activeBeastform;
        const features = actor.items.filter(i => actor.system.activeBeastform.system.featureIds.includes(i.id));
        return [{
            id, 
            name: _loc(name),
            img,
            type: 'beastform',
            actor,
            effects: [],
            uuid,
            features,
            system: {
                advantageOn: actor.system.activeBeastform.system.advantageOn
            //     actions: new Collection(features.flatMap(f => [...f.system.actions.entries()]))
            }
        }];

        /* const item = actor.system.activeBeastform;
        console.log(actor.items.filter(i => actor.system.activeBeastform.system.featureIds.includes(i.id)))
        return [item];

        const features = actor.items.filter(i => actor.system.activeBeastform.system.featureIds.includes(i.id)) ?? [];
        return features; */
    }

    static getSubclassCards(item) {
        if(!item) return [];
        const subclassCards = [{ ...item.toObject(), id: item._id, actor: item.actor, featureState: 1, featureList: item.system.foundationFeatures}];
        if(item.system.featureState >= 2) subclassCards.push({ ...item.toObject(), id: item._id, actor: item.actor, featureState: 2, featureList: item.system.specializationFeatures});
        if(item.system.featureState >= 3) subclassCards.push({ ...item.toObject(), id: item._id, actor: item.actor, featureState: 3, featureList: item.system.masteryFeatures});
        return subclassCards;
    }

    static #isNoActionEnabled(itemTypes) {
        return itemTypes.find(
            type => type.type === "noaction"
        )?.active ?? false;
    }

    static #getSubtitle(item) {
        switch (item.type) {
            case "subclass":
                const state = game.settings.get(MODULE_ID, "ttRpgCards") ? `<p><i>${_loc(`DAGGERHEART.GENERAL.Tabs.${subclassRanks[item.featureState - 1]}`)}</i></p>` : '';
                return `${state}<b>SPELLCAST TRAIT:</b> ${_loc(`DAGGERHEART.CONFIG.Traits.${item.system.spellcastingTrait}.name`).toUpperCase()}`;
            default:
                return;
        }
    }

    static #getDescription(item) {
        const ttRpgSetting = game.settings.get(MODULE_ID, "ttRpgCards");
        let description = '';

        if(ttRpgSetting) {
            // const originItem = this.#getOriginItem(item);
            const attachedFeatures = CardService.getItemFeatures(item).map(f => f.uuid);
            const features = item.system.actions?.size ? [...item.system.actions] : item.actor.items.filter(i => attachedFeatures.includes(i.sourceUuid));
            
            description += features.length ? features.reduce((desc, f) => {
                const action = this.getAssociatedUse(item, f.id);
                const hasUse = action instanceof game.system.api.data.actions.actionsTypes.base || action.system?.actions.size;
                // console.log(item, f)
                return desc += `<div class="card-action-use" style="margin-bottom: 0.05rem;"${hasUse ? item.type === 'beastform' ? `data-action="useCard" data-item-id="${f.uuid}"` : `data-action="triggerUse" data-item-id="${item.id}" data-action-id="${f.id}"` : ''}><b>${_loc(f.name)}${hasUse ? '*' : ''}: </b>${f.description ?? f.system.description}</div>`;
                // return desc += `<div class="card-action-use" style="margin-bottom: 0.05rem;"${hasUse ? `data-action="triggerUse" data-item-id="${item.type === 'beastform' ? f.parent.parent.id : item.id}" data-action-id="${f.id}"` : ''}><b>${_loc(item.type === 'beastform' ? f.parent.parent.name : f.name)}${hasUse ? '*' : ''}: </b>${f.description ?? f.system.description}</div>`;
            }, '') : item.system.description;
        } else {
            description += item.system.description;
        }
        if(['armor', 'weapon'].includes(item.type)) {
            description += `<div class="card-action-use" data-action="useCard" data-item-id="${item.uuid}">`;
        }
        switch (item.type) {
            case 'beastform':
                if(Object.keys(item.system.advantageOn).length)
                    description += `<div><b>${_loc('DAGGERHEART.ITEMS.Beastform.FIELDS.advantageOn.label')}:</b> ${Object.values(item.system.advantageOn).map(a => a.value).join(', ')}</div>`
                break;
            case 'weapon':
                const trait = _loc(`DAGGERHEART.CONFIG.Traits.${item.system.attack.roll.trait}.name`);
                const damage = Roll.replaceFormulaData(item.system.attack.damage.main.value.getFormula(), item.actor.getRollData());
                description += `
                    <div>
                        <b>Tier:</b> ${item.system.tier}
                    </div>
                    <div>
                        <b>Trait:</b> ${trait}
                    </div>
                    <div>
                        <b>Damage:</b> ${damage}
                    </div>
                `;
                break;
            case 'armor':
                description += `
                    <div>
                        <b>Base Score:</b> ${item.system.armor.current} / ${item.system.armor.max}
                    </div>
                    <div>
                        <b>Base Thresholds:</b> ${item.system.baseThresholds.major} / ${item.system.baseThresholds.severe}
                    </div>
                `;
                break;
        }
        if(['armor', 'weapon'].includes(item.type)) {
            description += '</div>';
            for(const effect of item.effects) {
                description += `<div><b>${effect.name}</b>: ${effect.description}</div>`
            }
        }

        return description;    
    }

    static #getClasses(item, originItem) {
        const classes = [`card-${item.type}`];
        if(item.system.type) classes.push(`card-${item.system.type}`);
        
        switch (item.type) {
            case 'domainCard':
                classes.push(`card-${item.system.domain}`);
                break;
            case "class":
                classes.push(`card-${item.name.toLowerCase()}`)
                break;
            case 'subclass':
                classes.push(`card-${originItem.name.toLowerCase()}`);
                break;
            case 'feature':
                // console.log(item, originItem);
                break;
            default:
                break;
        }
        if(originItem) classes.push(...this.#getClasses(originItem));
        
        return classes;
    }

    static #getTags(item, originItem = {}) {
        let tags = [];

        switch (item.type) {
            case "domainCard":
                tags = [
                    _loc(`DAGGERHEART.GENERAL.Domain.${item.system.domain}.label`)
                ];
                break;
            case "weapon":
                tags = [
                    _loc(`DAGGERHEART.CONFIG.Burden.${item.system.burden}`),
                    item.system.secondary
                        ? _loc("DHDECKCARD.GENERAL.Tags.secondary")
                        : _loc("DHDECKCARD.GENERAL.Tags.primary"),
                    _loc(`DAGGERHEART.CONFIG.Range.${item.system.attack.range}.name`),
                    ...item.system.attack.damage.main.type.map(type =>  _loc(`DAGGERHEART.CONFIG.DamageType.${type}.name`))
                ];
                break;
            // case 'beastform':
            //     tags = [
            //         _loc('TYPES.ActiveEffect.beastform')
            //     ];
            //     break;
            case "feature":
                tags = [
                    item.system.granter?.type ? _loc(`TYPES.Item.${item.system.granter?.type}`) : null,
                    originItem.name,
                    _loc(`DAGGERHEART.CONFIG.FeatureForm.${item.system.featureForm}`),
                    game.i18n.has(`DAGGERHEART.GENERAL.Tabs.${item.system.identifier}`)
                        ? _loc(`DAGGERHEART.GENERAL.Tabs.${item.system.identifier}`)
                        : null
                ];
                break;
            case "subclass":    
                tags = [_loc('TYPES.Item.subclass')];
                if(!game.settings.get(MODULE_ID, "ttRpgCards")) tags.push(_loc(`DAGGERHEART.GENERAL.Tabs.${subclassRanks[item.system.featureState - 1]}`));
        }

        return [
            ...new Set(tags.filter(Boolean))
        ];
    }

    static #getCardStyle(count, index, frontCardPosition = "last") {
        const cardWidth = CardService.cardWith;
        const spacing = game.settings.get(MODULE_ID, "cardOverlap") ?? 55;
        
        // 1. On fixe la référence sur une main idéale (ex: 10 cartes)
        const referenceCount = 10;
        const maxRotation = 14;
        const referenceCenter = (referenceCount - 1) / 2; // 4.5

        const center = (count - 1) / 2;
        const offset = index - center;

        // 2. On calcule la position basée sur l'écart fixe de la main de référence
        const referenceNormalized = offset / referenceCenter;

        const translateX = offset * spacing - cardWidth / 2;
        
        // 3. La rotation et la courbe utilisent la même référence constante
        const translateY = Math.abs(referenceNormalized) ** 2 * 45;
        const rotate = referenceNormalized * maxRotation;
        
        const baseZ = this.#getCardZIndex(count, index, frontCardPosition);

        return [
            `--translate-x: ${translateX}px`,
            `--translate-y: ${translateY}px`,
            `--rotate: ${rotate}deg`,
            `--base-z: ${baseZ}`
        ].join("; ");
    }

    static #getCardZIndex(count, index, position) {
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

    static #getOriginItem(item) {
        const actor = item.actor;
        if(!actor) return;

        switch (item.type) {
            case 'feature':
                const originItem = actor.items.find(i => {
                    if(i.type !== item.system.granter?.type) return;
                    const originItemFeature = this.getItemFeatures(i);
                    return !!originItemFeature?.find(f => f.uuid === item.sourceUuid);
                });
                // console.log(item.name, item, originItem)
                return originItem?.type === 'subclass' ? this.#getOriginItem(originItem) : originItem;
            default:
                return actor.items.find(i => i !== item && i.sourceUuid === item.system?.linkedClass);
        }
    }

    static #hasBanner(item) {
        return !!(item.system.tier ?? item.system.level ?? ['subclass'].includes(item.type));
    }

    static getItemFeatures(item) {
        switch (item.type) {
            case 'class':
                const hopeFeatures = item.system.hopeFeatures.map(f => ({ _id: f._id, uuid: f.uuid, type: 'hope', originName: item.name}));
                const classFeatures = item.system.classFeatures.map(f => ({ _id: f._id, uuid: f.uuid, type: 'class', originName: item.name}));
                return [...hopeFeatures, ...classFeatures];
            case 'ancestry':
                const primaryFeatures = { _id: item.system.primaryFeature._id, uuid: item.system.primaryFeature.uuid, type: 'primary', originName: item.name};
                const secondaryFeatures = { _id: item.system.secondaryFeature._id, uuid: item.system.secondaryFeature.uuid, type: 'secondary', originName: item.name};
                return [primaryFeatures, secondaryFeatures];
            case 'community':
                return item.system.features.map(f => ({ _id: f._id, uuid: f.uuid, originName: item.name}));
            case 'subclass':
                /* const foundationFeatures = item.system.foundationFeatures.map(f => ({ _id: f._id, uuid: f.uuid, type: 'foundation', originName: item.name}));
                const specializationFeatures = item.featureState >= 2 ? item.system.specializationFeatures.map(f => ({ _id: f._id, uuid: f.uuid, type: 'specialization', originName: item.name})) : [];
                const masteryFeatures = item.featureState >= 3 ? item.system.masteryFeatures.map(f => ({ _id: f._id, uuid: f.uuid, type: 'mastery', originName: item.name})) : []; */
                /* const foundationFeatures = item.system.foundationFeatures.filter(i => item.actor.system.isItemAvailable(item.actor.items.get(i._id)));
                const specializationFeatures = item.system.specializationFeatures.filter(i => item.actor.system.isItemAvailable(item.actor.items.get(i._id)));
                const masteryFeatures = item.system.masteryFeatures.filter(i => item.actor.system.isItemAvailable(item.actor.items.get(i._id)));
                return [...foundationFeatures, ...specializationFeatures, ...masteryFeatures]; */
                return item.featureList;
                // return item.system.itemFeatures.filter(f => item.actor.system.isItemAvailable(item.actor.items.get(f.id)));
            case 'beastform':
                return item.features
            default:
                return [];
        }
    }

    static getAssociatedUse(item, actionId) {
        return item.actor.items.get(actionId) ?? item.system.actions?.get(actionId);
    }
}