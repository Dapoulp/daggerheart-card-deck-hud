export const preloadHandlebarsTemplates = async function () {
    return foundry.applications.handlebars.loadTemplates([
        'modules/daggerheart-card-deck-hud/templates/card.hbs',
        'modules/daggerheart-card-deck-hud/templates/hud.hbs',
        'modules/daggerheart-card-deck-hud/templates/menu.hbs',
        'modules/daggerheart-card-deck-hud/templates/resource.hbs',
        'modules/daggerheart-card-deck-hud/templates/player.hbs',
    ]);
}