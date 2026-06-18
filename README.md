# Custom Cards Simulator

A browser-based deck builder and practice simulator for custom cards inspired by
the One Piece Card Game rule structure. Build a deck, choose leaders, test card
interactions, and run self-play games without installing a full game client.

## Patch Notes

Patch Note 1.15<br>
[UPDATE]: README patch notes now preserve visible line breaks for every tag.<br>
[FIX]: README patch note tags no longer collapse into a single paragraph on Markdown renderers.<br>
[Dev Note]: /

Patch Note 1.14<br>
[UPDATE]: Count Saint-Germain cards have been removed from the card pool.<br>
[UPDATE]: Ashura, Vlad, Red Baron, Jack Wisp, Vakappa, Reiko Kashima, and the DD02 event cards have been removed from card data.<br>
[FIX]: Singleplayer and multiplayer no longer try to resolve Saint-Germain leader actions after the deck's removal.<br>
[Dev Note]: /

Patch Note 1.13<br>
[UPDATE]: Subaru checkpoints now save and restore which player's turn was active when the checkpoint was set.<br>
[UPDATE]: Subaru checkpoints now restore the saved turn number and phase state together with the saved turn owner.<br>
[FIX]: Subaru resets no longer force the game to continue under the wrong turn owner after returning to a checkpoint.<br>
[FIX]: Imu leader temporary +1000 power effects that expire on the opponent's turn now end when that opponent's turn ends instead of lasting one extra turn.<br>
[Dev Note]: /

Patch Note 1.12<br>
[UPDATE]: GP Okarun preset deck no longer shows the creator name in its title.<br>
[UPDATE]: RB Guts preset deck no longer shows the creator name in its title.<br>
[UPDATE]: R Eggman preset deck no longer shows the creator name in its title.<br>
[UPDATE]: RY Ichigo preset deck no longer shows the creator name in its title.<br>
[UPDATE]: U Taglavnovic preset deck no longer shows the creator name in its title.<br>
[FIX]: Deck selection pages now load the renamed preset titles from the latest deck data file.<br>
[Dev Note]: /

Patch Note 1.11<br>
[UPDATE]: RB Nerona Imu is now available as a preset deck.<br>
[ADDITION]: Added the RB Nerona Imu preset deck to deck selection.<br>
[Dev Note]: /

Patch Note 1.10<br>
[UPDATE]: Imu decks now use a 40-card deck limit in the deck editor.<br>
[UPDATE]: Imu decks now use a 40-card deck limit when starting a game.<br>
[FIX]: Imported or loaded Imu decks that go over 40 cards are now rejected instead of being accepted.<br>
[Dev Note]: /

Patch Note 1.09<br>
[UPDATE]: Subaru leader's When Attacking effect now uses the same Life-card popup style as Roswaal's Life selection.<br>
[FIX]: Subaru leader's When Attacking effect now only shows Life cards other than the current top card.<br>
[FIX]: Subaru leader's When Attacking effect now moves the selected Life card to the top without flipping it.<br>
[Dev Note]: /

Patch Note 1.08<br>
[UPDATE]: Roswaal now flips a Life card before starting its search effect.<br>
[UPDATE]: Subaru Life-card selection now opens in a dedicated Life view overlay.<br>
[FIX]: Reset Order during search now clears the selected return order instead of restoring the default order.<br>
[FIX]: Subaru Life-card selection now shows card backs for face-down Life cards and images for face-up Life cards.<br>
[FIX]: Subaru Life-card selection now flips the clicked Life card directly from the Life view overlay.<br>
[Dev Note]: /

Patch Note 1.07<br>
[UPDATE]: Subaru search cards now follow the intended in-game selection flow.<br>
[UPDATE]: Subaru Life-flip cards now follow the intended in-game selection flow.<br>
[FIX]: Roswaal search ordering now starts left-to-right by default.<br>
[FIX]: Reset Order now restores the default left-to-right search order.<br>
[FIX]: Subaru Life flips can now choose any Life card instead of only the top or bottom card.<br>
[FIX]: Subaru Life flips can now turn the chosen Life card face-up or face-down.<br>
[ADDITION]: Added multi-card search selection support for Roswaal.<br>
[Dev Note]: /

Patch Note 1.06<br>
[UPDATE]: Subaru checkpoint stage now properly flips the top Life card for each player.<br>
[FIX]: Checkpoint activation now turns an already face-up top Life card face-down instead of leaving it unchanged.<br>
[ADDITION]: Added proper face-state toggle behavior to the checkpoint stage Life flip.<br>
[Dev Note]: /

Patch Note 1.05<br>
[UPDATE]: Subaru preset deck now includes the newest Subaru support cards.<br>
[FIX]: Subaru preset deck no longer uses the old One Piece staple filler cards.<br>
[ADDITION]: Added Roswaal L. Mathers and Rem as new Subaru cards with their in-game effects.<br>
[Dev Note]: /

Patch Note 1.04<br>
[UPDATE]: Image references now follow the current asset folder names.<br>
[FIX]: Broken favicon, logo, card-back, DON!!, and One Piece card image paths were corrected.<br>
[ADDITION]: Added support for the renamed `a-misc` and `a-op-staples` image folders in live app references.<br>
[Dev Note]: Image path cleanup after folder renames.

Patch Note 1.03<br>
[UPDATE]: Nerona Imu deck cards now use their in-game effects instead of being data-only.<br>
[FIX]: Nerona Imu card interactions now resolve properly in both singleplayer and multiplayer.<br>
[ADDITION]: Added functionality for Nerona Imu characters, events, protection effects, attack effects, and counter interactions.<br>
[Dev Note]: Nerona Imu functionality update.

Patch Note 1.02<br>
[UPDATE]: Subaru is now available as a preset deck option.<br>
[FIX]: Main logo and page icon paths now point to the correct image folder.<br>
[ADDITION]: Added the Subaru preset deck to deck selection and preset deck browsing.<br>
[Dev Note]: Keep patch notes synced with visible changes.

Patch Note 1.01<br>
[UPDATE]: Subaru deck cards are now available in the game.<br>
[FIX]: Subaru deck card data now appears correctly for players in the card pool.<br>
[ADDITION]: Added the Subaru deck as part of the current custom card selection.<br>
[Dev Note]: Subaru deck update only.

Patch Note 1.00<br>
[UPDATE]: Patch notes have been reset and now use the new standard format.<br>
[FIX]: Old patch note entries and mixed formatting have been removed from this page.<br>
[ADDITION]: Future notes will always be written in the Update, Fix, Addition order.<br>
[Dev Note]: Write only user-facing changes. Skip internal-only changes.
