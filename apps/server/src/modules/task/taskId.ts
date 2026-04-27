function pad(value: number, size: number) {
  return String(value).padStart(size, '0');
}

export function createTaskId(now = new Date(), randomValue = Math.floor(Math.random() * 100_000)) {
  const timestamp =
    `${now.getFullYear()}${pad(now.getMonth() + 1, 2)}${pad(now.getDate(), 2)}` +
    `${pad(now.getHours(), 2)}${pad(now.getMinutes(), 2)}${pad(now.getSeconds(), 2)}` +
    `${pad(now.getMilliseconds(), 3)}`;

  return `${timestamp}_${pad(randomValue, 5)}`;
}
