import { useCallback, useRef, useState } from "react";
import { type PublicUser } from "@/lib/auth";
import { needsStepUp, StepUpCancelledError } from "./step-up/errors";

export function useStepUp(user: PublicUser) {
  const [open, setOpen] = useState(false);
  const resolverRef = useRef<{
    resolve: (challengeId: string) => void;
    reject: (error: Error) => void;
  } | null>(null);

  const closePending = useCallback((error?: Error) => {
    const pending = resolverRef.current;
    resolverRef.current = null;
    setOpen(false);
    if (!pending) {
      return;
    }
    if (error) {
      pending.reject(error);
      return;
    }
    pending.reject(new StepUpCancelledError());
  }, []);

  const requestChallenge = useCallback((): Promise<string | undefined> => {
    if (!needsStepUp(user)) {
      return Promise.resolve(undefined);
    }
    setOpen(true);
    return new Promise((resolve, reject) => {
      resolverRef.current = { resolve, reject };
    });
  }, [user]);

  const complete = useCallback((challengeId: string) => {
    const pending = resolverRef.current;
    resolverRef.current = null;
    setOpen(false);
    pending?.resolve(challengeId);
  }, []);

  return {
    open,
    requestChallenge,
    complete,
    cancel: () => closePending(),
    setOpen: (next: boolean) => {
      if (next) {
        setOpen(true);
        return;
      }
      closePending();
    },
  };
}
