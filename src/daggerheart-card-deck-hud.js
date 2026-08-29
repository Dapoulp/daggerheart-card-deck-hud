import { DHCardDeckHUD } from "./applications/daggerheart-card-deck-hud";
import { registerSettings } from "./system/settings";
import { preloadHandlebarsTemplates, } from "./system/handlebars";
import { MODULE_ID } from "./system/constants";

Hooks.once("init", async () => {
    preloadHandlebarsTemplates();
    registerSettings();
});

Hooks.once("ready", async () => {
    // Hide Foundry Macro Hotbar if setting checked
    const hidden = game.settings.get(MODULE_ID, "hideHotbar");
    ui.hotbar?.element?.classList.toggle("hidden", hidden);

    if(!game.settings.get(MODULE_ID, "disableHUD")) await DHCardDeckHUD.create();
});

const debouncedControl = foundry.utils.debounce(async (token, controlled) => {
    const hud = DHCardDeckHUD.instance;
    if (!hud) return;

    const controlledTokens = canvas.tokens?.controlled || [];
    
    if (!controlled || !token?.actor || controlledTokens.length > 1) {
        debouncedUpdate.cancel();
        await hud.clearActor();
        return;
    }

    await hud.setActor(token.actor, token);
}, 100);

const debouncedUpdate = foundry.utils.debounce(async (object) => {
    const actor = object.actor ?? object;
    await refreshHUD(actor);
}, 100);

async function refreshHUD(actor) {
    if (!actor) return;

    const hud = DHCardDeckHUD.instance;
    if (!hud || hud.actor?.id !== actor.id) return;

    await hud.createDeck();
}

Hooks.on("controlToken", debouncedControl);

/* Hooks.on("updateActor", async (actor, changes) => {
    if (changes.system) return;
    // if (!(changes.system || changes.prototypeToken)) return;
    //  || game.settings.get(MODULE_ID, "hideResource")

    const hud = DHCardDeckHUD.instance;

    if (!hud || hud.actor?.id !== actor.id) return;

    await hud.render();
});

Hooks.on("createItem", async item => {
    await refreshHUD(item.actor);
});

Hooks.on("updateItem", async item => {
    await refreshHUD(item.actor);
});

Hooks.on("deleteItem", async item => {
    await refreshHUD(item.actor);
});

Hooks.on("deleteActiveEffect", async effect => {
    await refreshHUD(effect.actor);
}); */


Hooks.on("updateActor", debouncedUpdate);
Hooks.on("createItem", debouncedUpdate);
Hooks.on("updateItem", debouncedUpdate);
Hooks.on("deleteItem", debouncedUpdate);
Hooks.on("deleteActiveEffect", debouncedUpdate);

Hooks.on("renderSettingsConfig", (app, html) => {
    if(!DHCardDeckHUD.instance) return;

    // Deck Border Margin Live Update
    const borderSlider = html.querySelector('range-picker[name="daggerheart-card-deck-hud.deckBorderMargin"]');
    // if (!borderSlider) return;

    borderSlider?.addEventListener("input", event => {
        const deckBorderMargin = Number(event.target.value);
        DHCardDeckHUD.instance?.updateMarginPosition({deckBorderMargin});
        game.settings.set(MODULE_ID, "deckBorderMargin", deckBorderMargin);
    });

    // Deck Bottom Margin Live Update
    const bottomSlider = html.querySelector('range-picker[name="daggerheart-card-deck-hud.deckBottomMargin"]');
    // if (!bottomSlider) return;

    bottomSlider?.addEventListener("input", event => {
        const deckBottomMargin = Number(event.target.value);
        DHCardDeckHUD.instance?.updateMarginPosition({deckBottomMargin});
        game.settings.set(MODULE_ID, "deckBottomMargin", deckBottomMargin);
    });

    // Deck Between Margin Live Update
    const betweenSlider = html.querySelector('range-picker[name="daggerheart-card-deck-hud.deckBetweenMargin"]');
    // if (!bottomSlider) return;

    betweenSlider?.addEventListener("input", event => {
        const deckBetweenMargin = Number(event.target.value);
        DHCardDeckHUD.instance?.updateMarginPosition({deckBetweenMargin});
        game.settings.set(MODULE_ID, "deckBetweenMargin", deckBetweenMargin);
    });

    // Card Overlap Live Update
    const overlapSlider = html.querySelector('range-picker[name="daggerheart-card-deck-hud.cardOverlap"]');
    // if (!overlapSlider) return;

    overlapSlider?.addEventListener("input", event => {
        const value = Number(event.target.value);
        DHCardDeckHUD.instance?.parts.deck?.setAttribute('data-card-overlap', value);
        DHCardDeckHUD.instance?.deck?.updateCardPosition();
        game.settings.set(MODULE_ID, "cardOverlap", value);
    });

    // Card Overlap Live Update
    const widthSlider = html.querySelector('range-picker[name="daggerheart-card-deck-hud.cardWidth"]');
    // if (!widthSlider) return;

    widthSlider?.addEventListener("input", event => {
        const value = Number(event.target.value);
        DHCardDeckHUD.instance?.parts.deck?.setAttribute('data-card-width-coeff', value);
        game.settings.set(MODULE_ID, "cardOverlap", value);
    });

    // Card Gradient Live Update
    const gradientSlider = html.querySelector('range-picker[name="daggerheart-card-deck-hud.cardGradient"]');

    gradientSlider?.addEventListener("input", event => {
        const value = Number(event.target.value);
        DHCardDeckHUD.instance.deck?.applyGradient(value);
        game.settings.set(MODULE_ID, "cardGradient", value);
    });
});