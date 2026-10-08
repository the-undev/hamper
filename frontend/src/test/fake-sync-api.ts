import type { TableRowLists } from "@/store/types";
import type {
  PullResponse,
  PushChange,
  PushResponse,
  SyncApi,
} from "@/sync/api";

/** Every table key with no rows. */
export function noRows(): TableRowLists {
  return {
    items: [],
    meals: [],
    mealLines: [],
    plan: [],
    days: [],
    dayLines: [],
    wantedLines: [],
    shops: [],
    shopLines: [],
  };
}

/** A sync API that records every call and answers through handlers a test can replace. */
export interface FakeSyncApi extends SyncApi {
  /** The batches pushed, in order. */
  pushes: PushChange[][];
  /** The cursors pulled from, in order. */
  pulls: number[];
  onPush: (changes: PushChange[]) => Promise<PushResponse>;
  onPull: (since: number) => Promise<PullResponse>;
}

/** A fake that applies every pushed change and pulls nothing new, until a test replaces its handlers. */
export function fakeSyncApi(): FakeSyncApi {
  const fake: FakeSyncApi = {
    pushes: [],
    pulls: [],
    onPush: async (changes) => ({
      revision: 0,
      applied: changes.map((change) => change.id),
      rows: noRows(),
    }),
    onPull: async (since) => ({ ...noRows(), revision: since }),
    push: (changes) => {
      fake.pushes.push(changes);
      return fake.onPush(changes);
    },
    pull: (since) => {
      fake.pulls.push(since);
      return fake.onPull(since);
    },
  };
  return fake;
}
