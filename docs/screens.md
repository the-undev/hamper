# Screens

Four tabs on a bottom bar, and the screens reached from them.
[prototype.html](prototype.html) is a clickable sketch of all of them on sample
data; open it in a browser, on a phone as well as a desktop.

## Plan

Opens here. The header holds the start date, which opens the phone's date
picker, and − N days +, on both views. A segmented control at the top
switches between the two views, and a swipe does the same. The views slide,
and during a swipe they follow the finger. The view last used is remembered.

**Meals.** A read-only line says when the plan starts and ends: "Starts Mon
1 Jun, ends Sun 7 Jun", with dates in the browser's locale. Below it, one
slot per day:

- An empty day shows "Pick a meal". Tapping it opens the picker: a type-ahead
  over the library, and for a name matching nothing, "Use as it is" for an
  ad-hoc day.
- A filled day shows the meal's picture, its name and its lines in one line
  underneath. Tapping the name opens the day. A ≡ handle on the right drags
  the meal onto another day to swap. Swiping left reveals Clear.
- "Start new plan from <date>", a row under the last day, which asks for a
  confirm.

Until the first sync brings the plan, the plan's screens say they are waiting
for the server.

**Day.** The date, the planned meal's name, editable for this day, and a
line saying which library meal it came from and whether it has been changed
for this day, or that it is not a library meal. Reset to the meal, or Save as a meal for an ad-hoc day,
and Clear day. Then the type-ahead and the day's lines, each with + and − and
a swipe to remove.

**Items.** The type-ahead at the top, then the wanted list: each line with its
usual size under the name, a Once / Weekly toggle, + and −, and a swipe to
remove.

## Shop

With no list open: "Make from plan" and "Start empty". With lists open: a row
at the top to switch between them and a + to start another, then the chosen
list.

**Breakdown.** Reached by "Make from plan". Every day with its lines, then the
wanted list, all editable with the same controls as the Day and Items screens,
and every edit saved to the plan. "Generate the list" at the bottom, Cancel at
the top. The list is named after the plan's start date, "Shop Mon 1 Jun"; an
empty one is "Quick shop" and today's date.

**List.** A line of status (name, how many meals it came from, how many of
the lines are in the trolley: "Shop Mon 1 Jun, from 5 meals. 3 of 12 in the
trolley."), the type-ahead to add a line, then the unticked lines and under
them the ticked ones. Each line: a 44px tick box, the name, the size and
sources in small text, and the count with − and +. Tapping the name opens the
line editor: name, size, count, "Out of stock" (to wanted), Remove, Done.
Swiping left reveals To wanted and Remove. Under the list: Share, Download;
Rest to wanted, Archive, Delete.

Share opens the share sheet with the unticked lines as text; on a desktop it
copies the text instead. Download saves the same as a text file. Archive
needs the server, so it is disabled while offline.

## Meals

A search and add bar, then the library as a grid of cards with pictures. A
name matching nothing offers "Add as a new meal".

**Meal.** The picture, Change photo (take or choose, crop square, upload) and,
when there is a picture, Remove photo; both are disabled while offline. Then
the name, when it was last shopped for, "Add to <next empty day>" or
"On the plan", then the type-ahead and the meal's lines with + and − and
swipe to remove. Duplicate and Delete. When it was last shopped for comes
from history, so it is left out while offline.

## More

A menu: Items, History, Export, Import, and the sync status with the time of
the last sync. Import says "Imported", or the reason the server refused the
file.

**Items.** A search, then every item with its usual size. Tapping one opens
the editor: the picture with Change photo and Remove photo as on the Meal
screen, name, usual size, Merge into another item (a type-ahead over the
rest), Delete.

**History.** Archived shops by date, each with its meals and a count of lines.
Tapping one opens it read only. "Copy these meals to the plan" on each.
History needs the server, and says so while offline.

## Everywhere

- A bar under the header, shown only when offline or with changes not yet
  sent: "Offline. Changes are kept on this phone." or "3 changes to send".
  The count is of rows waiting to be sent, and offline is shown when both
  apply.
- Every edit is saved as it is made. Editing screens end with Done, which
  goes back.
- Targets are at least 44px. Lines swipe left to reveal actions. Drag is a
  press and hold on the handle on a phone, a plain drag with a mouse, with the
  day under the finger highlighted.
- The type-ahead is the same control wherever a line is added: type, then
  pick an existing item or take the row that creates one. Matches come first,
  the best at the top, and the create row comes last; when nothing matches it
  is the only row. Enter takes the first row. The meal picker's "Use as it
  is" row follows the same order.
- A picture with no image, or one that cannot load, offline for example, is
  a coloured block with the name's first letter.
- On a desktop the same screens render in a centred column; nothing is
  desktop-only.
