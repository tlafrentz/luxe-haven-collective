import { describe, expect, it } from "vitest";

import { Entity } from "./entity";
import { Identifier } from "./identifier";

class User extends Entity<Identifier<string>> {
  public constructor(id: string) {
    super(Identifier.create(id));
  }
}

class Property extends Entity<Identifier<string>> {
  public constructor(id: string) {
    super(Identifier.create(id));
  }
}

describe("Entity", () => {
  it("is equal to itself", () => {
    const user = new User("user-1");

    expect(user.equals(user)).toBe(true);
  });

  it("compares equal entities of the same type by identifier", () => {
    expect(new User("user-1").equals(new User("user-1"))).toBe(true);
  });

  it("returns false when identifiers differ", () => {
    expect(new User("user-1").equals(new User("user-2"))).toBe(false);
  });

  it("returns false for another entity type with the same identifier", () => {
    expect(
      new User("shared-id").equals(new Property("shared-id")),
    ).toBe(false);
  });

  it("returns false for non-entities", () => {
    expect(new User("user-1").equals({ id: "user-1" })).toBe(false);
    expect(new User("user-1").equals(null)).toBe(false);
    expect(new User("user-1").equals(undefined)).toBe(false);
  });
});
