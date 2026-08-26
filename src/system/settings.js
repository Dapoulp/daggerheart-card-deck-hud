import { MODULE_ID } from './constants';
import { DHCardDeck } from '../applications/daggerheart-card-deck-hud';

export function registerSettings() {
    game.settings.register(MODULE_ID, "disableHUD", {
        name: "DHDECKCARD.SETTINGS.DisableHUD.label",
        hint: "DHDECKCARD.SETTINGS.DisableHUD.hint",
        scope: 'client',
        config: true,
        type: Boolean,
        default: false,
        onChange: async (value) => {
            if (value) await DHCardDeck.destroy();
            else await DHCardDeck.create();
        }
    });

    game.settings.register(MODULE_ID, "hideHotbar", {
        name: "DHDECKCARD.SETTINGS.HideHotbar.label",
        hint: "DHDECKCARD.SETTINGS.HideHotbar.hint",
        scope: 'client',
        config: true,
        type: Boolean,
        default: false,
        onChange: (value) => ui.hotbar.element.classList.toggle("hidden", value)
    });

    game.settings.register(MODULE_ID, "ttRpgCards", {
        name: "DHDECKCARD.SETTINGS.TTRpgCards.label",
        hint: "DHDECKCARD.SETTINGS.TTRpgCards.hint",
        scope: 'client',
        config: true,
        type: Boolean,
        default: false,
        onChange: (value) => DHCardDeck.instance?.render()
    });

    game.settings.register(MODULE_ID, "hideDescription", {
        name: "DHDECKCARD.SETTINGS.HideDescription.label",
        hint: "DHDECKCARD.SETTINGS.HideDescription.hint",
        scope: 'client',
        config: true,
        type: Boolean,
        default: false,
        onChange: (value) => DHCardDeck.instance?.render()
    });

    /* game.settings.register(MODULE_ID, "cardWidth", {
        name: "Card Width",
        scope: "client",
        config: true,
        type: Number,
        default: 5,
        range: {
            min: 1,
            max: 10,
            step: 1
        },
        onChange: value => {
            document.documentElement.style.setProperty(
                "--dh-card-width",
                `${value}rem`
            );

            DHCardDeck.instance?.render();
        }
    }); */
    
    game.settings.register(MODULE_ID, 'deckPosition', {
        name: "DHDECKCARD.SETTINGS.DeckPosition.label",
        hint: "DHDECKCARD.SETTINGS.DeckPosition.hint",
        scope: 'client',
        config: true,
        type: String,
        choices: {
            'left': 'DHDECKCARD.SETTINGS.DeckPosition.options.left',
            'center': 'DHDECKCARD.SETTINGS.DeckPosition.options.center',
            'right': 'DHDECKCARD.SETTINGS.DeckPosition.options.right'
        },
        default: 'center',
        onChange: async () => {
            await DHCardDeck.destroy();
            await DHCardDeck.create();
        }
    });
    
    game.settings.register(MODULE_ID, 'deckBorderMargin', {
        name: "DHDECKCARD.SETTINGS.DeckBorderMargin.label",
        hint: "DHDECKCARD.SETTINGS.DeckBorderMargin.hint",
        scope: 'client',
        config: true,
        type: Number,
        range: {
            min: 0,
            max: 500,
            step: 5
        },
        default: 0,
        onChange: () => DHCardDeck.instance?.updateMarginPosition()
    });
    
    game.settings.register(MODULE_ID, 'deckBottomMargin', {
        name: "DHDECKCARD.SETTINGS.DeckBottomMargin.label",
        hint: "DHDECKCARD.SETTINGS.DeckBottomMargin.hint",
        scope: 'client',
        config: true,
        type: Number,
        range: {
            min: -50,
            max: 500,
            step: 5
        },
        default: 0,
        onChange: () => DHCardDeck.instance?.updateMarginPosition()
    });
    
    game.settings.register(MODULE_ID, 'deckStyle', {
        name: "DHDECKCARD.SETTINGS.DeckStyle.label",
        hint: "DHDECKCARD.SETTINGS.DeckStyle.hint",
        scope: 'client',
        config: true,
        type: String,
        choices: {
            'curved': 'DHDECKCARD.SETTINGS.DeckStyle.options.curved',
            'flat': 'DHDECKCARD.SETTINGS.DeckStyle.options.flat'
        },
        default: 'curved',
        onChange: () => DHCardDeck.instance?.render()
    });
    
    game.settings.register(MODULE_ID, 'frontPosition', {
        name: "DHDECKCARD.SETTINGS.FrontPosition.label",
        hint: "DHDECKCARD.SETTINGS.FrontPosition.hint",
        scope: 'client',
        config: true,
        type: String,
        choices: {
            'first': 'DHDECKCARD.SETTINGS.FrontPosition.options.first',
            'middle': 'DHDECKCARD.SETTINGS.FrontPosition.options.middle',
            'last': 'DHDECKCARD.SETTINGS.FrontPosition.options.last'
        },
        default: 'last',
        onChange: () => DHCardDeck.instance?.render()
    });
    
    game.settings.register(MODULE_ID, 'cardOverlap', {
        name: "DHDECKCARD.SETTINGS.CardOverlap.label",
        hint: "DHDECKCARD.SETTINGS.CardOverlap.hint",
        scope: 'client',
        config: true,
        type: Number,
        range: {
            min: 20,
            max: 150,
            step: 5
        },
        default: 55,
        onChange: () => DHCardDeck.instance?.render()
    });

    game.settings.register(MODULE_ID, "playerToken", {
        name: "DHDECKCARD.SETTINGS.PlayerToken.label",
        hint: "DHDECKCARD.SETTINGS.PlayerToken.hint",
        scope: 'client',
        config: true,
        type: Boolean,
        default: false,
        onChange: () => DHCardDeck.instance?.render()
    });
    
    game.settings.register(MODULE_ID, 'styleResource', {
        name: "DHDECKCARD.SETTINGS.StyleResource.label",
        hint: "DHDECKCARD.SETTINGS.StyleResource.hint",
        scope: 'client',
        config: true,
        type: String,
        choices: {
            'label': 'DHDECKCARD.SETTINGS.StyleResource.options.label',
            'icon': 'DHDECKCARD.SETTINGS.StyleResource.options.icon',
            'none': 'DHDECKCARD.SETTINGS.StyleResource.options.none',
        },
        default: 'label',
        onChange: () => DHCardDeck.instance?.render()
    });

    game.settings.register(MODULE_ID, "hideResource", {
        name: "DHDECKCARD.SETTINGS.HideResource.label",
        hint: "DHDECKCARD.SETTINGS.HideResource.hint",
        scope: 'client',
        config: true,
        type: Boolean,
        default: false,
        onChange: (value) => DHCardDeck.instance?.render()
    });
}