import { UserNode } from '../model/user';

export async function copyListToClipboard(nonFollowersList: readonly UserNode[]): Promise<void> {
  const sortedList = [...nonFollowersList].sort((a, b) => (a.username > b.username ? 1 : -1));
  const output = sortedList.map(u => u.username).join('\n');
  await navigator.clipboard.writeText(output);
}

export function exportToJSON(users: readonly UserNode[]) {
  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(users, null, 2));
  const downloadAnchorNode = document.createElement('a');
  downloadAnchorNode.setAttribute('href', dataStr);
  downloadAnchorNode.setAttribute('download', 'instagram_unfollowers.json');
  document.body.appendChild(downloadAnchorNode);
  downloadAnchorNode.click();
  downloadAnchorNode.remove();
}

export function exportToCSV(users: readonly UserNode[]) {
  const headers = ['id', 'username', 'full_name', 'is_verified', 'is_private', 'profile_pic_url'];
  const rows = users.map(user => [
    user.id,
    user.username,
    `"${user.full_name.replace(/"/g, '""')}"`,
    user.is_verified,
    user.is_private,
    user.profile_pic_url,
  ]);

  const csvContent = 'data:text/csv;charset=utf-8,'
    + headers.join(',') + '\n'
    + rows.map(e => e.join(',')).join('\n');

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', 'instagram_unfollowers.csv');
  document.body.appendChild(link);
  link.click();
  link.remove();
}

/**
 * When writing a switch-case with a finite number of cases, use this function in the
 * `default` clause of switch-case statements for exhaustive checking. This will make
 * TS complain until ALL cases are handled. For example, if we have a switch-case
 * in-which we evaluate every possible status of a component's state, if we add this
 * to the default clause and then add a new status to the state type, TS will complain
 * and force us to handle it as well, thus avoiding forgetting it.
 */
export function assertUnreachable(_value: never): never {
  throw new Error('Statement should be unreachable');
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}

export function getCookie(name: string): string | null {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length !== 2) {
    return null;
  }
  return parts.pop()!.split(';').shift()!;
}

