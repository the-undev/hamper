# Roadmap

Work identified and not done, and decisions still open. Each has its own
heading so a document can link to it.

## Open decisions

### Published port

Chosen when the container is added, from what is free on the server.

### Export schedule

The host's backup covers `/data`. Whether to also take an export on a
schedule, and where to put it, is undecided.

### Testing sync from a phone

The dev and live-test instances are on the developer's machine. A phone needs
to reach one over the LAN, or through a dev tunnel, to exercise offline and
install before a release.

## Planned

### Run as the host's user

The image sets no user, so the process runs as root and every file under
`/data` is root-owned. Passing `--user` fixes that on a plain Docker host but
breaks Unraid's Tailscale integration: Unraid swaps the entrypoint for a hook
that must run as root, installs tailscale into the container, starts
`tailscaled`, applies Serve, then execs the image's own entrypoint still as
root. Under `--user` the hook prints "No root privileges" and starts the app
without Tailscale. The way round it, used by the linuxserver and binhex
images, is for the image to drop privileges itself after the hook has run.

- An entrypoint script replaces `ENTRYPOINT ["dotnet", "Hamper.Api.dll"]`.
  The dotnet command moves to `CMD`, so the script execs `"$@"` and the hook
  still finds both.
- `PUID` and `PGID` unset: exec the command as the current user, so the
  `docker run` line in [deployment](deployment.md) behaves as it does today.
- Both set: `chown -R "$PUID:$PGID" /data`, then
  `exec setpriv --reuid="$PUID" --regid="$PGID" --clear-groups -- "$@"`.
  `setpriv` ships in the aspnet image's util-linux, so nothing is added to
  the image, and the uid needs no entry in `/etc/passwd`. `exec` keeps dotnet
  as PID 1 so stop signals reach it.
- Export `HOME` to a directory that user can write before the exec, and check
  the first log lines after start for any warning about the home directory
  or data protection keys.
- A CI job builds the image, runs it with `PUID` and `PGID` set and a temp
  directory on `/data`, and asserts that `/health` answers ok, that the
  process in the container runs as that uid, and that `hamper.db` is owned by
  that uid and gid. That is the test for this change.
- [deployment](deployment.md): the "What the host provides" line about the
  user, the Unraid steps, and both templates in `unraid/`, which gain `PUID`
  and `PGID` as variables defaulting to `99` and `100`, Unraid's
  `nobody:users`.
- This goes out in a release, so the stable container can take the variables
  from day one.

### Quieter query logging

EF Core logs every SQL command at Information, which is most of the container
log in production. Set `Microsoft.EntityFrameworkCore.Database.Command` to
`Warning` in the production settings and leave Development as it is.

## Parked

### Swap an item on a line

Replacing one item with another on a meal, a day or the breakdown is done by
adding the new item and removing the old. A single swap action is parked.

### Tidy unused items

More → Items could list the items used on no meal, day or list, each with
Merge and Delete, for the mistakes nobody fixed at the time. Today each is
found by hand.

### Sweep orphaned images

When an item or meal is deleted through sync, its image files stay under
`/data/images`. Nothing removes them yet.

### Presets

Named sets of meals ("Week A", "Week B") and of items, applied to the plan in
one action. Copying meals from a past week in history covers most of it. Add
if the library of past weeks is not enough.

### Reconcile an open list after the plan changes

When the plan is edited after a list was made from it, offer to bring the
list up to date without losing the edits made on the list. Today the answer
is to delete the list and generate again.

### Notes on a line

Free text on a shop line, or a size override on a plan line, for "small bag
this time". Today the shop line's size is edited instead.

### HTTPS on the home network

A reverse proxy on the host with a certificate for a local name would give
every device on the local network the full app without a VPN. It is a host
change, not an app change; only the address moves.

### Who changed what

A proxy that knows who is connecting can pass the name in a request header
(Tailscale Serve does, for example). Recording it against changes would give
"added by" with no login. Decided against for now.

### Permissions

None exist. If they are ever wanted, the proxy identity above is the
starting point.

### Recipes

Method, servings, timings. Out of scope by design; see
[principles](principles.md). Revisit only if the household asks.

### Voice

The voice assistant's list is what "add beans" goes to today. A way to add to
the wanted list by voice would close that gap. No route known yet.
