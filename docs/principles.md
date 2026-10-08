# Principles

Rules the design has to obey, each taken from something that went wrong with
the tools this replaces: a voice assistant's shopping list, a shared
spreadsheet, and a recipe manager. A feature that breaks one of these is not
worth having.

## One household's way

It is built around how one household plans and shops: a delivery or a big shop
on a fixed day, a run of days to cover, a few things picked up in between. It
will be wrong for people who work differently, and that is accepted.

It must not be tied to that household's accounts or hardware. Anything it
needs, anyone installing it can get.

## Simple over complete

Every feature is weighed against the flow it slows. A smooth path through
planning a week and doing the shop is worth more than any feature that would
be used twice a year. When in doubt, the feature is cut, and goes on the
roadmap rather than into the app.

## Nothing happens on its own

Archiving a list does not change the plan. Making a list does not clear
anything. Moving the plan on to next week is a button, with a confirm. Every
change to the plan or a list is something a person did, so what is on the
screen can be trusted in the shop.

## Intent and copies are separate

The plan says what the household wants. It carries over from week to week and
is edited by hand. A shopping list is a copy taken from it at a moment, then
owned by the people doing the shop: they change it to match what is in the
kitchen, and the plan is untouched. A planned meal is a copy of the library
meal, changed for that day without the library changing. Archived lists are
copies too, kept as text, so renaming an item later never rewrites what was
bought.

The spreadsheet had none of this. Editing the list for the shop destroyed the
plan, and starting next week destroyed the record.

## Nothing is pre-entered

Typing a name is enough to make an item. The type-ahead offers what has been
typed before, and fixing names, merging duplicates and setting a usual size
are done later, when it matters. The recipe manager wanted a recipe before it
would give a list, so it was never used.

## Counts, not measures

A line is a whole number, and one means one meal's worth. Size, where it is
wanted, is a property of the item, "1kg bag", "4 pints", "tin", set once and
shown wherever the item appears. Nothing is ever added up in grams.

## It works in the shop

Signal in a supermarket is poor. The plan, the meals, the items and the open
lists live on the phone, so the list opens and ticks with no connection, and
the changes are sent when there is one. The app says when it is offline and
never silently drops an edit.

## Anyone, anywhere, at once

There are no accounts and no per-person lists. Whoever thinks of something adds
it, from wherever they are, and it shows on every other phone within seconds.
The voice assistant took one voice in one room; the spreadsheet needed both
people at a laptop.

## Touch first

The screens are designed for a phone held in one hand in a shop. Targets are at
least 44px, lines swipe, meals drag with a press and hold. A desktop browser
gets the same screens, wider.

## Data survives mistakes

Everything can be exported as one file and imported into an empty instance to
rebuild it. Deleting or renaming anything never changes history.
