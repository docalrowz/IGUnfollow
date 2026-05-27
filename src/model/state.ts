import { UserNode } from "./user";
import { ScanningTab } from "./scanning-tab";
import { ScanningFilter } from "./scanning-filter";
import { UnfollowLogEntry } from "./unfollow-log-entry";
import { UnfollowFilter } from "./unfollow-filter";
import { InstagramError } from "../core/error-types";

type ScanningState = {
  readonly status: 'scanning';
  readonly page: number;
  readonly currentTab: ScanningTab;
  readonly searchTerm: string;
  readonly percentage: number;
  readonly results: readonly UserNode[];
  readonly whitelistedResults: readonly UserNode[];
  readonly selectedResults: readonly UserNode[];
  readonly filter: ScanningFilter;
};

type UnfollowingState = {
  readonly status: 'unfollowing';
  readonly searchTerm: string;
  readonly percentage: number;
  readonly selectedResults: readonly UserNode[];
  readonly unfollowLog: readonly UnfollowLogEntry[];
  readonly filter: UnfollowFilter;
};

export type ErrorState = {
  readonly status: 'error';
  readonly error: InstagramError;
  readonly recoverable: boolean;
  readonly previousStatus: 'scanning' | 'unfollowing';
};

//TODO THIS TYPE OF MULTIPLE STATE NEEDS TO BE SEPARETED IN DIFFERENT FILES ASAP (Global state,unfollowing state, scanning state etc...)
export type State =
  | { readonly status: 'initial' }
  | ScanningState
  | UnfollowingState
  | ErrorState;

/**
 * Classifies an InstagramError as recoverable (user can retry) or not
 * (must reset to initial / handle out-of-band).
 */
export function isErrorRecoverable(error: InstagramError): boolean {
  switch (error.kind) {
    case 'rate_limit':
    case 'network':
    case 'csrf_expired':
      return true;
    case 'checkpoint':
    case 'unknown':
      return false;
  }
}
