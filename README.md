# Custom Cards Simulator

A browser-based deck builder and practice simulator for custom cards inspired by
the One Piece Card Game rule structure. Build a deck, choose leaders, test card
interactions, and run self-play games without installing a full game client.

## Patch Notes

Patch Note 1.09

[UPDATE]: Subaru leader's When Attacking effect now uses the same Life-card popup style as Roswaal's Life selection.
[FIX]: Subaru leader's When Attacking effect now only shows Life cards other than the current top card.
[FIX]: Subaru leader's When Attacking effect now moves the selected Life card to the top without flipping it.

[Dev Note]: /

Patch Note 1.08

[UPDATE]: Roswaal now flips a Life card before starting its search effect.
[UPDATE]: Subaru Life-card selection now opens in a dedicated Life view overlay.
[FIX]: Reset Order during search now clears the selected return order instead of restoring the default order.
[FIX]: Subaru Life-card selection now shows card backs for face-down Life cards and images for face-up Life cards.
[FIX]: Subaru Life-card selection now flips the clicked Life card directly from the Life view overlay.

[Dev Note]: /

Patch Note 1.07

[UPDATE]: Subaru search cards now follow the intended in-game selection flow.
[UPDATE]: Subaru Life-flip cards now follow the intended in-game selection flow.
[FIX]: Roswaal search ordering now starts left-to-right by default.
[FIX]: Reset Order now restores the default left-to-right search order.
[FIX]: Subaru Life flips can now choose any Life card instead of only the top or bottom card.
[FIX]: Subaru Life flips can now turn the chosen Life card face-up or face-down.
[ADDITION]: Added multi-card search selection support for Roswaal.

[Dev Note]: /

Patch Note 1.06

[UPDATE]: Subaru checkpoint stage now properly flips the top Life card for each player.
[FIX]: Checkpoint activation now turns an already face-up top Life card face-down instead of leaving it unchanged.
[ADDITION]: Added proper face-state toggle behavior to the checkpoint stage Life flip.

[Dev Note]: /

Patch Note 1.05

[UPDATE]: Subaru preset deck now includes the newest Subaru support cards.
[FIX]: Subaru preset deck no longer uses the old One Piece staple filler cards.
[ADDITION]: Added Roswaal L. Mathers and Rem as new Subaru cards with their in-game effects.

[Dev Note]: /

Patch Note 1.04

[UPDATE]: Image references now follow the current asset folder names.
[FIX]: Broken favicon, logo, card-back, DON!!, and One Piece card image paths were corrected.
[ADDITION]: Added support for the renamed `a-misc` and `a-op-staples` image folders in live app references.

[Dev Note]: Image path cleanup after folder renames.

Patch Note 1.03

[UPDATE]: Nerona Imu deck cards now use their in-game effects instead of being data-only.
[FIX]: Nerona Imu card interactions now resolve properly in both singleplayer and multiplayer.
[ADDITION]: Added functionality for Nerona Imu characters, events, protection effects, attack effects, and counter interactions.

[Dev Note]: Nerona Imu functionality update.

Patch Note 1.02

[UPDATE]: Subaru is now available as a preset deck option.
[FIX]: Main logo and page icon paths now point to the correct image folder.
[ADDITION]: Added the Subaru preset deck to deck selection and preset deck browsing.

[Dev Note]: Keep patch notes synced with visible changes.

Patch Note 1.01

[UPDATE]: Subaru deck cards are now available in the game.
[FIX]: Subaru deck card data now appears correctly for players in the card pool.
[ADDITION]: Added the Subaru deck as part of the current custom card selection.

[Dev Note]: Subaru deck update only.

Patch Note 1.00

[UPDATE]: Patch notes have been reset and now use the new standard format.
[FIX]: Old patch note entries and mixed formatting have been removed from this page.
[ADDITION]: Future notes will always be written in the Update, Fix, Addition order.

[Dev Note]: Write only user-facing changes. Skip internal-only changes.
