import { describe, expect, it } from "vitest";

import { EntityWithProps } from "./entity-with-props";
import { Identifier } from "./identifier";

type ExampleProps = Readonly<{
  name: string;
  nested: Readonly<{
    value: number;
  }>;
  occurredAt: Date;
}>;

class ExampleEntity extends EntityWithProps<ExampleProps> {
  private constructor(
    id: Identifier,
    props: ExampleProps,
  ) {
    super(id, props);
  }

  public static create(
    id: Identifier,
    props: ExampleProps,
  ): ExampleEntity {
    return new ExampleEntity(id, props);
  }

  public get name(): string {
    return this.props.name;
  }

  public get nestedValue(): number {
    return this.props.nested.value;
  }

  public get occurredAt(): Date {
    return new Date(this.props.occurredAt);
  }
}

describe("EntityWithProps", () => {
  it("preserves entity identity", () => {
    const id = Identifier.create("entity-001");

    const first = ExampleEntity.create(id, {
      name: "First",
      nested: { value: 1 },
      occurredAt: new Date("2026-07-19T12:00:00.000Z"),
    });

    const second = ExampleEntity.create(id, {
      name: "Second",
      nested: { value: 2 },
      occurredAt: new Date("2026-07-20T12:00:00.000Z"),
    });

    expect(first.equals(second)).toBe(true);
  });

  it("copies and freezes owned state", () => {
    const occurredAt = new Date(
      "2026-07-19T12:00:00.000Z",
    );
    const nested = { value: 1 };

    const entity = ExampleEntity.create(
      Identifier.create("entity-001"),
      {
        name: "Example",
        nested,
        occurredAt,
      },
    );

    nested.value = 99;
    occurredAt.setUTCFullYear(2030);

    expect(Object.isFrozen(entity)).toBe(true);
    expect(entity.nestedValue).toBe(1);
    expect(entity.occurredAt.toISOString()).toBe(
      "2026-07-19T12:00:00.000Z",
    );
  });
});
