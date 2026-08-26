import {
  buildProtocolConfiguration,
  parseProtocolId,
} from "./protocolOnboardingModel";


describe("protocolOnboardingModel", () => {
  test("parses only positive integer protocol ids", () => {
    expect(
      parseProtocolId(
        "?protocol=17"
      )
    ).toBe(17);

    expect(
      parseProtocolId(
        "?protocol=0"
      )
    ).toBeNull();

    expect(
      parseProtocolId(
        "?protocol=17x"
      )
    ).toBeNull();

    expect(
      parseProtocolId(
        "?starter=lcs"
      )
    ).toBeNull();
  });


  test("builds an editable LCS configuration for an active course", () => {
    expect(
      buildProtocolConfiguration(
        {
          id: 9,
          courseId: 4,
          title: "LCS base",
          objective:
            "Comparar implementaciones",
          instructions:
            "Usa el mismo ZIP base.",
          benchmark: "LCS",
          inputSize: 1000,
          executionProfile: "rapido",
          samples: 10,
          dataType: null,
        },
        [{ id: 4 }]
      )
    ).toEqual({
      id: 9,
      courseId: 4,
      title: "LCS base",
      objective:
        "Comparar implementaciones",
      instructions:
        "Usa el mismo ZIP base.",
      selectedTaskType: "lcs",
      inputSize: 1000,
      executionProfile: "rapido",
      samples: 10,
      dataType: "",
    });
  });


  test("requires CAMM distribution and active course membership", () => {
    const base = {
      id: 3,
      courseId: 8,
      title: "CAMM",
      objective: "Objetivo",
      benchmark: "CAMM",
      inputSize: 5000,
      executionProfile:
        "equilibrado",
      samples: 30,
      dataType: "CAMMR",
    };

    expect(
      buildProtocolConfiguration(
        base,
        [{ id: 8 }]
      )?.dataType
    ).toBe("cammr");

    expect(
      buildProtocolConfiguration(
        {
          ...base,
          dataType: null,
        },
        [{ id: 8 }]
      )
    ).toBeNull();

    expect(
      buildProtocolConfiguration(
        base,
        [{ id: 99 }]
      )
    ).toBeNull();
  });
});
