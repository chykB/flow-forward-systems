export function getLocalDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function getFutureLocalDateKey(
  date: Date,
  days: number,
) {
  const futureDate = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate() + days,
  );

  return getLocalDateKey(futureDate);
}