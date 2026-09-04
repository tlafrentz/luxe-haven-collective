import { describe, expect, it } from "vitest";
import { libraryEmbedJoins } from "./library-query";

const base = { roomIds: [], styleIds: [], retailerIds: [], availability: undefined };

describe("libraryEmbedJoins", () => {
  it("uses no join hints when no filters are active", () => {
    expect(libraryEmbedJoins(base)).toEqual({ roomJoin: "", styleJoin: "", offerJoin: "" });
  });

  it("adds !inner for an active room filter only", () => {
    expect(libraryEmbedJoins({ ...base, roomIds: ["living_room"] })).toEqual({ roomJoin: "!inner", styleJoin: "", offerJoin: "" });
  });

  it("adds !inner for an active style filter only", () => {
    expect(libraryEmbedJoins({ ...base, styleIds: ["modern"] })).toEqual({ roomJoin: "", styleJoin: "!inner", offerJoin: "" });
  });

  it("adds !inner to the offer join for an active retailer filter", () => {
    expect(libraryEmbedJoins({ ...base, retailerIds: ["retailer-1"] })).toEqual({ roomJoin: "", styleJoin: "", offerJoin: "!inner" });
  });

  it("adds !inner to the offer join for a non-archived availability filter", () => {
    expect(libraryEmbedJoins({ ...base, availability: "in_stock" })).toEqual({ roomJoin: "", styleJoin: "", offerJoin: "!inner" });
  });

  it("does not treat the archived pseudo-availability value as an offer filter", () => {
    expect(libraryEmbedJoins({ ...base, availability: "archived" })).toEqual({ roomJoin: "", styleJoin: "", offerJoin: "" });
  });

  it("combines join hints when multiple filters are active", () => {
    expect(libraryEmbedJoins({ roomIds: ["living_room"], styleIds: ["modern"], retailerIds: ["retailer-1"], availability: undefined })).toEqual({
      roomJoin: "!inner",
      styleJoin: "!inner",
      offerJoin: "!inner",
    });
  });
});
