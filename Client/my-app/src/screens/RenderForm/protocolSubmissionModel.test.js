import {
  appendProtocolId,
} from "./protocolSubmissionModel";


describe("protocolSubmissionModel", () => {
  test("appends the active protocol id to multipart form data", () => {
    const append = jest.fn();

    expect(
      appendProtocolId(
        { append },
        { id: 17 }
      )
    ).toBe(true);

    expect(
      append
    ).toHaveBeenCalledWith(
      "protocol_id",
      "17"
    );
  });


  test("does not append an invalid or missing protocol", () => {
    const append = jest.fn();

    expect(
      appendProtocolId(
        { append },
        null
      )
    ).toBe(false);

    expect(
      appendProtocolId(
        { append },
        { id: 0 }
      )
    ).toBe(false);

    expect(
      append
    ).not.toHaveBeenCalled();
  });


  test("fails safely for a non FormData-like target", () => {
    expect(
      appendProtocolId(
        {},
        { id: 4 }
      )
    ).toBe(false);
  });
});
