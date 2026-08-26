import { MODULE_ID } from "../system/constants";

const embedTemplates = new Map([
    ['class', 'systems/daggerheart/templates/components/card/subclass.hbs'],
    ['subclass', 'systems/daggerheart/templates/components/card/subclass.hbs'],
    ['default', 'systems/daggerheart/templates/components/card/domain.hbs']
]);

export default class Card {
    constructor(item, index) {
        this.item = item;
        this.index = index;
        this.selected = false;
    }

    get cardWidth() {
        return parseFloat(
            getComputedStyle(document.documentElement)
                .getPropertyValue("--dh-card-width")
        ) * parseFloat(getComputedStyle(document.documentElement).fontSize);
    }

    async toEmbed() {
        let embed = (await this.item.system?.toEmbed?.()) ?? await this.simulateToEmbed();
        if(!embed) return;
        embed = embed instanceof HTMLCollection ? embed[0] : embed;        
        if(this.item.sourceUuid === "Compendium.daggerheart.ancestries.Item.ed8BoLR4SHOpeV00") this.removePurposefulNote(embed);
        embed.setAttribute('data-item-id', this.item.uuid);
        embed.setAttribute("data-action", "selectCard");
        embed.style = this.getCardStyle(embedCards.length, index, game.settings.get(MODULE_ID, "frontPosition"));
        if(game.settings.get(MODULE_ID, "hideDescription")) embed.classList.add('description-hidden');

        return embed;
    }

    removePurposefulNote(embed) {
        const purposefulDesc = embed.querySelector('.item-description-inner-container p');
        const purposefulBr = embed.querySelector('.item-description-inner-container p br');
        purposefulDesc?.remove();
        purposefulBr?.remove();
    }

    async simulateToEmbed() {
        // const description = await item.system.getEnrichedDescription({ ...options, gmNotes: false, type: 'tooltip' });
        let item = this.item;
        let description = item.system.description ?? '';
        const embedTemplate = item.system?.constructor?.embedTemplate ?? embedTemplates.get(item.type) ?? embedTemplates.get('default');

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
        const attachedFeatures = this.getItemFeatures().map(f => f.uuid);
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

    getItemFeatures() {
        const item = this.item;
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

    getCardStyle(count, index, frontCardPosition = "last") {
        const spacing = game.settings.get(MODULE_ID, "cardOverlap") ?? 55;
        
        // 1. On fixe la référence sur une main idéale (ex: 10 cartes)
        const referenceCount = 10;
        const maxRotation = 14;
        const referenceCenter = (referenceCount - 1) / 2; // 4.5

        const center = (count - 1) / 2;
        const offset = index - center;

        // 2. On calcule la position basée sur l'écart fixe de la main de référence
        const referenceNormalized = offset / referenceCenter;

        const translateX = offset * spacing - this.cardWidth / 2;
        
        // 3. La rotation et la courbe utilisent la même référence constante
        const translateY = Math.abs(referenceNormalized) ** 2 * 45;
        const rotate = referenceNormalized * maxRotation;
        
        const baseZ = this.getCardZIndex(count, index, frontCardPosition);

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
}