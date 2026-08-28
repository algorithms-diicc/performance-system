import axios from "axios";

import { serverURL } from "../../common/Constants.js";
import {
  fetchMeasurementPolicies,
} from "./measurementPolicyApi";

jest.mock("axios");

describe("measurementPolicyApi", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("loads the authenticated measurement policy contract", async () => {
    const payload = {
      environment: { mode: "AUTO" },
      total: 12,
      items: [],
    };

    axios.get.mockResolvedValue({
      data: payload,
    });

    await expect(
      fetchMeasurementPolicies()
    ).resolves.toEqual(payload);

    expect(axios.get).toHaveBeenCalledWith(
      `${serverURL}api/measurement/policies`,
      {
        withCredentials: true,
        headers: {
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
        },
      }
    );
  });
});
