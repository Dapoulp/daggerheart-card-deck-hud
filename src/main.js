import { DHCardDeck } from "./applications/daggerheart-card-deck-hud";
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

    if(!game.settings.get(MODULE_ID, "disableHUD")) await DHCardDeck.create();
});


const debouncedUpdate = foundry.utils.debounce(async (object) => {
    const actor = object.actor ?? object;
    await refreshHUD(actor);
}, 100);

async function refreshHUD(actor) {
    if (!actor) return;

    const hud = DHCardDeck.instance;
    if (!hud || hud.actor?.id !== actor.id) return;

    await hud.render();
}

Hooks.on("controlToken", async (token, controlled) => {
    const hud = DHCardDeck.instance;
    if (!hud) return;

    const controlledTokens = canvas.tokens?.controlled || [];

    if (!controlled || !token?.actor || controlledTokens.length > 1) {
        debouncedUpdate.cancel();
        await hud.clearActor();
        return;
    }

    await hud.setActor(token.actor, token);
});

/* Hooks.on("updateActor", async (actor, changes) => {
    if (changes.system) return;
    // if (!(changes.system || changes.prototypeToken)) return;
    //  || game.settings.get(MODULE_ID, "hideResource")

    const hud = DHCardDeck.instance;

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