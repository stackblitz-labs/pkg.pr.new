const commitLength = 7;

/*
 * "09efd0553374ff7d3e62b79378e3184f5eb57571" => "09efd05"
 */
export function abbreviateCommitHash(fullHash: string) {
  return fullHash.substring(0, commitLength);
}
