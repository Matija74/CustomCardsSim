// Card-specific On Block resolutions. Block declaration and redirection stay
// in the battle system.
export const onBlockEffectDefinitions = Object.freeze({
    "BL01-013-on-block-minus-power": {
        trigger: "onBlock",
        actions: [{
            action: "decreasePower",
            amount: 1000,
            duration: "turn",
            selection: {
                controller: "opponent",
                area: "characterArea",
                amount: 1,
                upTo: true
            }
        }]
    }
});
