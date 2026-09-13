import type { PublicUser } from "@fluxo/types";
import type { ResolvedSession } from "./auth/session.js";
import type { UserRecord } from "./auth/stores/types.js";

export interface AppBindings {
  Variables: {
    session: ResolvedSession;
    user: PublicUser;
    account: UserRecord;
  };
}
