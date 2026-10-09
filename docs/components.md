# Components

Every component under `frontend/src/components` and every shared class in
`styles.ts`, with the shadcn component that covers it and the decision.
`shadcn` means it is replaced by that component. `keep` means shadcn has no
equivalent. `keep, no gain` means an equivalent exists and swapping adds
nothing, for the reason given. `done` means it is replaced.

Targets stay at least 44px whatever the component's default size. The shadcn
components take their colours from the tokens in `index.css`, where shadcn's
names (`--color-primary`, `--color-border` and the rest) map onto ours.

## Components

| Component | What it is | shadcn | Decision |
| --- | --- | --- | --- |
| `TypeAhead` | The box for adding a line, with ranked suggestions floating under it | Popover and Command (cmdk) | done |
| `ConfirmDialog` | Asks before an action that cannot be undone | AlertDialog | shadcn |
| `Toast`, `ToastProvider` | One short message near the bottom, with an optional action such as Undo | Sonner | shadcn |
| `Segmented` | The Plan's Meals and Items switch, radios underneath | Tabs | shadcn |
| `SavedField` | A labelled text box saved on blur or Enter | Input and Label | shadcn |
| `BottomSheet` | A sheet from the bottom of the column | Sheet | keep, no gain: already wraps shadcn's Sheet |
| `Counter` | − count +, each a 44px button | none | keep |
| `DoneButton` | Done in an editing screen's footer, which goes back | none | keep |
| `EmptyState`, `WaitingForServer` | A dashed box saying there is nothing yet | Empty | keep, no gain: one line of muted text |
| `ItemFields`, `ItemUsageText` | An item's name, size, Merge into and Delete | none | keep |
| `ItemSheet` | The item editor in a bottom sheet | none | keep |
| `ItemTypeAhead` | The type-ahead over items, with an Undo toast after an add | none | keep |
| `LineList` | Lines with size, count and a swipe to remove | none | keep |
| `Picture` | The server's image, else the placeholder | Avatar | keep, no gain: Avatar shows the fallback while loading |
| `Thumb` | The placeholder: a coloured block with a letter | none | keep |
| `ScreenFooter` | A screen's closing actions above the tabs | none | keep |
| `ScreenHeader` | A screen's title, back link and actions in the shell's header | none | keep |
| `SwipeRow` | A row that slides left to reveal its actions | none | keep |
| `SyncIndicator` | The header's sync state: spinner, count or offline | Badge, Tooltip | keep, no gain: the count is hidden, Tooltip needs hover |
| `TabBar` | The four tabs along the bottom, as router links | none | keep |

## Shared styles and details

| Piece | What it is | shadcn | Decision |
| --- | --- | --- | --- |
| `primaryButton` | A full-width call to action in the accent colour | Button, default variant | shadcn |
| `secondaryButton` | An outlined button beside or under a list, red for a delete | Button, outline variant | shadcn |
| `textInput` | A text box that fills its row | Input | shadcn |
| `sectionLabel` | The small uppercase heading over a list | none | keep |
| `hint` | Small muted text under a control | none | keep |
| `listBox` | The bordered box holding a list's rows | none | keep |
| `columnWidth` | The centred column, up to `--column-max` | none | keep |
| Once / Weekly | The pill on a wanted line that toggles it | Badge | done |
| "close match" | The note on a suggestion a few typing slips away | Badge | done |
| Shop tick box | A shop line's "in the trolley" box | Checkbox | shadcn |
