export const getLastJsonObjectFromString = (str: string) => {
  str = str.replace(/[^}]*$/, "");

  while (str) {
    str = str.replace(/[^{]*/, "");

    try {
      return JSON.parse(str);
    } catch (err) {
      // move past the potentially leading `{` so the regexp in the loop can try to match for the next `{`
      str = str.slice(1);
    }
  }
  return null;
};
