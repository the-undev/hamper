# Domain

The things hamper represents and the rules between them. Five kinds of thing,
one of which is a copy of the others.

## Item

A thing you buy. A name, an optional usual size as free text ("1kg bag",
"4 pints", "tin"), and an optional image.

- An item comes into being by typing a name anywhere a line is added. Nothing
  is pre-entered.
- Renaming an item changes it everywhere it is referenced: meals, the plan,
  open shops still pointing at it. Archived shops hold text and do not change.
- Merging an item into another repoints every reference at the target and
  removes the source. Lines that would then be duplicates on one meal, one
  planned meal or the extras list are combined by adding their counts. Lines on open shops
  are repointed and not combined.
- Deleting an item removes its lines from meals and the plan. Archived shops
  keep their text.

## Line

An item and a count. A count is a whole number, at least 1, and one means one
meal's worth. There are no units; size belongs to the item. Lines live on
meals, on planned meals, and on the extras list. + and − change the stored
count by one inside one write, so a fast double tap never loses one.

## Meal

A name, an optional image, and lines. Not a recipe: no method, no servings.

- A meal can be duplicated, for a variant cooked often. The copy is named
  after the meal with " (copy)" added.
- A meal's "last shopped" date is read from history: the most recent archived
  shop made from a plan that had it on a day.
- Changing a meal changes nothing already on the plan.
- Deleting a meal removes it and its lines. Planned meals copied from it keep
  their name, lines and link, so Reset can tell the meal is gone.

## Plan

The standing statement of what the household wants. There is one. It carries
over from week to week and nothing changes it except a person.

- A start date and a length in days, both editable at any time. Days are
  positions; each takes its date from the start date and its position, so
  moving the start relabels every day and moves nothing. A day at a position
  beyond the length is kept but hidden, and shows again when the length grows.
- The first plan starts today with seven days.
- A day holds an ordered list of planned meals: none, one or several. Meals
  have no type such as breakfast or dinner, only their order in the day.
- An extras list: lines for things beyond what the days need, milk, loo roll,
  a cereal someone fancies. Each extras line is marked Once or Weekly. The
  extras list is `wantedLines` in the code and on the wire.
- "Start new plan" moves the start date on by the length and removes the
  Once lines. Planned meals and Weekly lines stay as they are. It asks for a
  confirm.
- Clearing a day removes all its planned meals.
- "Copy meals from a past week" fills each day's list from an archived shop's
  meals, by position and in their order, replacing what was there. A planned
  meal whose library meal still exists is placed from that meal; one whose
  meal has been deleted, or had none, becomes an ad-hoc planned meal with the
  archived name. Positions beyond the length are filled too. Days the archived
  shop does not mention are cleared.

### Planned meal

A meal on a day: a name, an optional link to a library meal, lines of its own,
the day it is on, and its place in that day's order.

- Placing a library meal on a day copies the meal's name and lines into a new
  planned meal at the end of that day's list and keeps the link.
- Typing a name that matches no meal places an ad-hoc planned meal with that
  name, the link empty and no lines, at the end of the day's list:
  "Takeaway", "Out for dinner", "Leftovers and garlic bread". Lines can be
  added to it.
- A planned meal's lines are edited for it only. The library meal never
  changes from the plan.
- A planned meal's name can be edited, for it only.
- Reset copies the linked meal's current lines back onto the planned meal. If
  the meal has been deleted, the planned meal keeps its copy and Reset is
  gone.
- Save as a meal puts an ad-hoc planned meal into the library and links the
  planned meal to it.
- A planned meal moves within its day or to another day, between the meals
  already there. The meals of both days keep their order with no gaps.
- Removing a planned meal removes its lines, and the meals after it on that
  day move up.
- One meal placed twice is two independent copies, and a shop counts it
  twice.
- Two devices placing a meal on one day at once both keep theirs. Two planned
  meals with the same place in a day are ordered by id.

## Shop

A shopping list. Any number can be open at once.

- Made from the plan, or started empty for a quick trip.
- Making one from the plan goes through the breakdown: every planned meal's
  lines and the extras list, editable, with every change saved to the plan.
  Generate then produces the shop.
- Generating sums counts per item across every planned meal on the days
  within the length and the extras list. A shop line is one item: a link to
  the item, the summed count, the names of the planned meals it came from by
  day and in their order, then "extras", and a ticked flag.
- A shop line's name, size and count are edited on the shop only. The plan
  and the item do not change.
- A shop line points at its item and shows the item's name and size until
  they are edited on the line, after which the line's own text is shown.
  Deleting an item leaves its lines on open shops, showing the name the item
  last had.
- Lines can be added by typing, removed, and ticked. Ticked lines sink to the
  bottom.
- "To extras" on a line puts its item on the plan's extras list as Once with
  the line's count, adding the count to an extras line already there (which
  keeps its Once or Weekly mark), and removes the line from the shop. "Rest
  to extras" does that for every unticked line. An item deleted since the
  shop was made comes back.
- Archive moves the shop to history. Delete discards it. Neither touches the
  plan.
- Share produces the unticked lines as text for the phone's share sheet.
  Download produces the same as a text file.

## History

Archived shops, read only. Each holds the shop's name, when it was made and
archived, its lines as text, and for a shop made from the plan the start date,
the length and each day's planned meals' names in their order. It is held as
text so that renaming, merging or deleting items and meals afterwards changes
nothing in it.

Each planned meal's library meal id is kept with its name, so "last shopped"
is found by id after a rename.

## Images

Items and meals can each have one image. An image is taken or chosen on the
phone, cropped there, and uploaded; the server keeps it resized. An image is
not synced for offline use; it is cached when viewed and shown as a
placeholder otherwise. See [architecture](architecture.md#images).

## Offline

Items, meals, the plan and open shops are held on each device and work
without a connection. History and images are not. See
[architecture](architecture.md#sync).
