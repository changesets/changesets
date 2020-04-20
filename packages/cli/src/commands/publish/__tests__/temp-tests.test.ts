import * as npmUtils from "../npm-utils";

describe("I just want some brief tests", () => {
  it("should things", async () => {
    let stuff = await npmUtils.distTag("emoji-uid", "1.0.3", "doom", {
      isRequired: Promise.resolve(true),
      token: "192236"
    });

    console.log(stuff);

    expect(true).toEqual(true);
  });
});
