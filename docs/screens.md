# Screens

Four tabs on a bottom bar, and the screens reached from them.
[prototype.html](prototype.html) is a clickable sketch of all of them on sample
data; open it in a browser, on a phone as well as a desktop.

## Plan

Opens here. The header holds the start date, which opens the phone's date
picker, and − N days +, on both views. Two tabs at the top, Meals and Extras,
switch between the two views, and a swipe does the same. The views slide, and
during a swipe they follow the finger. The view last used is remembered.

**Meals.** A read-only line says when the plan starts and ends: "Starts Mon
1 Jun, ends Sun 7 Jun", with dates in the browser's locale. Below it, one
card per day. Its header is the date, with "2 meals" when it holds more than
one.

- Each planned meal is a row: its picture, its name and its lines in one line
  underneath. Tapping a row opens the planned meal. A hold anywhere on a row
  lifts it, and it drags within its day or to another day; see Everywhere.
  Swiping left reveals Remove, which takes that meal off the day.
- "Add a meal" ends every card, and is all an empty day shows. It opens a
  screen titled "Add a meal to <date>". The box sits at the top, focused,
  and under it the library as a list: each meal with its picture, its name
  and its lines. Typing filters the library and adds a row under "Or a meal
  of its own", "Use “Takeaway” as it is", for an ad-hoc meal; a
  name that is a meal's, ignoring case and spaces at the ends, has no such
  row. Enter picks the meal of exactly that name, and otherwise uses the name
  as it is. The meal goes at the end of the day. Picking a library meal goes
  back to the Plan; an ad-hoc meal opens in its place.
- "Start new plan from <date>", a row under the last day, which asks for a
  confirm.

Until the first sync brings the plan, the plan's screens say they are waiting
for the server.

**Planned meal.** Headed with the day's date. The planned meal's name,
editable for this day, and a line saying which library meal it came from and
whether it has been changed for this day, or that it is not a library meal.
Reset to the meal, or Save as a meal for an ad-hoc one. Then the type-ahead
and the planned meal's lines, each with + and − and a swipe to remove. The
footer holds Remove from day and Done.

**Extras.** Headed "Extras, beyond what the meals need". The type-ahead at
the top, then the extras list: each line with its usual size under the name, a
Once / Weekly toggle, + and −, and a swipe to remove.

## Shop

The open lists as cards, newest first. Each card holds the list's name, how
many of its lines are got ("3 of 12 got"), the day it was made, and a bar
showing the same progress. Tapping a card opens the list. Under the cards,
"Make from plan" and "Start empty". With no list open, a note says so above
the two.

**Breakdown.** Reached by "Make from plan". Every day with its lines, then the
extras list, all editable with the same controls as the Planned meal screen and the
Extras view, and every edit saved to the plan. "Generate the list" at the
bottom, Cancel at the top. The list is named after the plan's start date, "Shop Mon 1 Jun"; an
empty one is "Quick shop" and today's date.

**List.** The header's "‹ Lists" goes back to the cards. A line of status
(name, how many meals it came from, how many of the lines are in the trolley:
"Shop Mon 1 Jun, from 5 meals. 3 of 12 in the trolley."), the type-ahead to
add a line, then the unticked lines and under them the ticked ones. Each line: a 44px tick box, the name, the size and
sources in small text, and the count with − and +. Tapping the name opens the
line editor: name, size, count, "To extras", Remove, Done.
Swiping left reveals To extras and Remove. Under the list: Share, Download;
Rest to extras, Archive, Delete.

Share opens the share sheet with the unticked lines as text; on a desktop it
copies the text instead. Download saves the same as a text file. Archive
needs the server, so it is disabled while offline.

A tick that leaves no unticked line shows a toast, "Everything got. Archive
the list?", for eight seconds. Its Archive archives at once, with no confirm,
and goes back to the cards. While offline the toast says "Everything got" and
has no action.

## Meals

A search and add bar, then the library as a grid of cards with pictures. A
name matching nothing offers "Add as a new meal".

**Meal.** The picture, Change photo (take or choose, crop square, upload) and,
when there is a picture, Remove photo; both are disabled while offline. Then
the name, when it was last shopped for, and "Add to a day", which opens a
sheet listing the plan's days, each with how many meals it holds, and adds
the meal at the end of the day tapped. Beside it, "On 2 days" once days of
the plan hold the meal. Then the type-ahead and the meal's lines with + and −
and swipe to remove. Duplicate and Delete. When it was last shopped for comes
from history, so it is left out while offline.

## More

A menu: Items, History, Export, Import, and the sync status with the time of
the last sync. Import says "Imported", or the reason the server refused the
file.

**Items.** A search, then every item with its usual size. Tapping one opens
the editor: the picture with Change photo and Remove photo as on the Meal
screen, then the same fields as the item sheet (see Everywhere), which save as
they are edited, with Done or the merge offer in the footer.

**History.** Archived shops by date, each with its meals and a count of lines.
Tapping one opens it read only. "Copy these meals to the plan" on each.
History needs the server, and says so while offline.

## Everywhere

- A sync slot at the right end of the header, 36 by 44px, after the screen's
  own actions. It is always there, so nothing moves when the state changes.
  Its state is its accessible name and tooltip. Synced shows nothing.
  Sending shows a small spinner, "Syncing". Waiting shows a badge with the
  count of rows not yet sent, "3 changes to send". Offline shows a crossed
  cloud, "Offline. Changes are kept on this phone.", and wins over the
  others.
- When a new version is ready, a toast says "Update ready" with Reload, once
  per update.
- Every edit is saved as it is made, except in the line editor, which saves
  on Done. Planned meal, Meal and the item
  editor have a footer that stays above the tabs, holding Done, which goes
  back, and on a Planned meal, Remove from day.
- Tapping a line's name on a meal, a planned meal or the extras list opens its item in
  a sheet: the name and usual size, each saved as it is edited; where it is used, "Used on
  2 meals, 1 day, 1 list", with the extras list counted as a list; Merge into
  another item (a type-ahead over the rest); and Delete item, which asks
  first. When the typed name is another item's, ignoring case and spaces at
  the ends, the name is not saved, a line says an item with that name exists,
  and Done becomes "Merge into Banana", which merges at once. A shop
  line's name opens the line editor instead.
- A sheet stays above the phone's keyboard and is never taller than the part
  of the screen left visible; when the keyboard comes up, the sheet scrolls
  within itself to bring the focused field to its top.
- Targets are at least 44px. Lines swipe left to reveal actions; on a
  desktop, keyboard focus reaches them too. A planned meal drags after a
  250ms hold anywhere on its row on a phone, and a finger that moves sideways
  first swipes instead; a mouse drags it after 8px. The rows stay put, the
  dragged meal follows the pointer, the day it would land on is outlined and
  a line shows where: between two meals, by which half of a row the pointer
  is over, or at the end of a day over its "Add a meal" row or empty space.
  With the keyboard, a row's Move button lifts it, the arrow keys move it
  through the days and Space drops it.
- The type-ahead is the same control wherever a line is added: type, then
  pick an existing item or take the row that creates one. The suggestions
  float over the content under the box, about five rows high, and scroll; a
  tap outside closes them. Matches come first,
  the best at the top, and the create row comes last; when nothing matches it
  is the only row. Close matches, names within two typing slips of the text
  (one for four letters or fewer), come after the others and say "close
  match": "bananna" offers Banana. Enter takes what was typed: a name that equals it,
  ignoring case and spaces at the ends, picks that item, and otherwise the
  create row runs. The arrow keys highlight a suggestion, wrapping at the
  ends, and Enter then takes it. Escape closes the suggestions first, with
  their highlight, and clears the text second. Tab leaves without taking
  anything. Merge into has no create row, so Enter there takes only an exact
  name or the highlighted row.
- After an add, a toast says "Added Milk" with Undo for five seconds, which
  takes the line back off, or back to its count, and removes an item the add
  made when nothing else uses it.
- A picture with no image, or one that cannot load, offline for example, is
  a coloured block with the name's first letter.
- The same screens render in a centred column up to 760px wide, so a tablet
  or desktop gets the same layout at a comfortable width; nothing is
  desktop-only. The surface colour fills the display around the column.
