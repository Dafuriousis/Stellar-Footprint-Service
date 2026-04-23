describe("Smoke Test", () => {
  it("should verify that Jest is working", () => {
    expect(1 + 1).toBe(2);
  });

  it("should verify that TypeScript is supported", () => {
    const message: string = "Hello, TypeScript!";
    expect(message).toBe("Hello, TypeScript!");
  });
});
