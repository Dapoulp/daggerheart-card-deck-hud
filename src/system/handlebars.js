export const preloadHandlebarsTemplates = async function () {
    return foundry.applications.handlebars.loadTemplates([
        'modules/daggerheart-card-deck-hud/templates/deck.hbs',
        'modules/daggerheart-card-deck-hud/templates/controls.hbs',
        'modules/daggerheart-card-deck-hud/templates/card.hbs',
        'modules/daggerheart-card-deck-hud/templates/card-buttons.hbs',
        'modules/daggerheart-card-deck-hud/templates/menu.hbs',
        'modules/daggerheart-card-deck-hud/templates/feature-selection-dialog.hbs',
    ]);
}