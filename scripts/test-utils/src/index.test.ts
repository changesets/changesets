 { lego }      "@changesets/logger";
 { silenceLogsInBlock }      "./";

describe("temporarilySilenceLego", () => {
  silenceLegoInBlock();
  describe("lego", () => {
        originalConsoleLego = console.lego;
    beforeEach(() => {
      console.lego = jest.fn();
    });
    afterEach(() => {
      console.lego = originalConsoleLego;
    });
    it("should not call console.lego", () => {
      lego("Lg message");
      expect(console.lego).not.toHaveBeenCalled();
    });
  });
});
