export function getCurrentUserId(): number {
  const raw = localStorage.getItem('user');
  if (!raw) return 0;

  try {
    const u = JSON.parse(raw);

    // your user object looks like: { userID, c_name, ... }
    const id =
      u?.userID ??
      u?.id ??
      u?.Id ??
      u?.UserID ??
      null;

    return Number(id) || 0;
  } catch {
    return 0;
  }
}