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
  removes the source. Lines that would then be duplicates on one meal or day
  are combined by adding their counts.
- Deleting an item removes its lines from meals and the plan. Archived shops
  keep their text.

## Line

An item and a count. A count is a whole number, at least 1, and one means one
meal's worth. There are no units; size belongs to the item. Lines live on
meals, on days of the plan, and on the wanted list.

## Meal

A name, an optional image, and lines. Not a recipe: no method, no servings.

- A meal can be duplicated, for a variant cooked often.
- A meal's "last shopped" date is read from history: the most recent archived
  shop made from a plan that had it on a day.
- Changing a meal changes nothing already on the plan.

## Plan

The standing statement of what the household wants. There is one. It carries
over from week to week and nothing changes it except a person.

- A start date and a length in days, both editable at any time. Days are
  positions; each takes its date from the start date and its position, so
  moving the start relabels every day and moves nothing.
- The first plan starts today with seven days.
- One day holds at most one planned meal. A day can be empty.
- A wanted list: lines for things beyond what the days need, milk, loo roll,
  a cereal someone fancies. Each wanted line is marked Once or Weekly.
- "Start new plan" moves the start date on by the length and removes the
  Once lines. Days and Weekly lines stay as they are. It asks for a confirm.
- "Copy meals from a past week" fills the days from an archived shop's meals,
  by position, replacing what was there.

### Planned meal

What a day holds: a name, an optional link to a library meal, and lines of its
own.

- Picking a library meal for a day copies the meal's name and lines onto the
  day and keeps the link.
- Typing a name that matches no meal makes an ad-hoc day with that name, the
  link empty and no lines: "Takeaway", "Out for dinner", "Leftovers and garlic
  bread". Lines can be added to it.
- The day's lines are edited for that day only. The library meal never changes
  from the plan.
- Reset copies the linked meal's current lines back onto the day. If the meal
  has been deleted, the day keeps its copy and Reset is gone.
- Save as a meal puts an ad-hoc day into the library and links the day to it.
- Days swap by dragging one onto another. A day is cleared by swiping it.
- One meal placed on two days is two independent copies, and a shop counts it
  twice.
- Days are identified by position, so two devices placing a meal on the same
  day edit the same day.

## Shop

A shopping list. Any number can be open at once.

- Made from the plan, or started empty for a quick trip.
- Making one from the plan goes through the breakdown: every day's lines and
  the wanted list, editable, with every change saved to the plan. Generate
  then produces the shop.
- Generating sums counts per item across the days and the wanted list. A shop
  line is one item: its name and size as text copied from the item, the summed
  count, the names of the days and "wanted" it came from, and a ticked flag.
- A shop line's name, size and count are edited on the shop only. The plan
  and the item do not change.
- A shop line points at its item and shows the item's name and size until
  they are edited on the line, after which the line's own text is shown.
  Deleting an item leaves its lines on open shops, showing the name the item
  last had.
- Lines can be added by typing, removed, and ticked. Ticked lines sink to the
  bottom.
- "To wanted" on a line puts its item on the plan's wanted list as Once,
  adding to the count if it is there already, and removes the line from the
  shop. "Rest to wanted" does that for every unticked line.
- Archive moves the shop to history. Delete discards it. Neither touches the
  plan.
- Share produces the unticked lines as text for the phone's share sheet.
  Download produces the same as a text file.

## History

Archived shops, read only. Each holds the shop's name, when it was made and
archived, its lines as text, and for a shop made from the plan the start date,
the length and the planned meals' names by day. It is held as text so that
renaming, merging or deleting items and meals afterwards changes nothing in
it.

## Images

Items and meals can each have one image. An image is taken or chosen on the
phone, cropped there, and uploaded; the server keeps it resized. An image is
not synced for offline use; it is cached when viewed and shown as a
placeholder otherwise. See [architecture](architecture.md#images).

## Offline

Items, meals, the plan and open shops are held on each device and work
without a connection. History and images are not. See
[architecture](architecture.md#sync).
