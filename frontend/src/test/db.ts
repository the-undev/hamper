import { HamperDb } from "@/store/db";
import { newId } from "@/store/ids";

/** A store with a name of its own, so tests never share data. */
export function freshDb(): HamperDb {
  return new HamperDb(`hamper-test-${newId()}`);
}
