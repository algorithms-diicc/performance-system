import axios from "axios";

import { serverURL } from "../../common/Constants.js";
import {
  fetchMeasurementNodes,
  fetchMeasurementPolicies,
} from "./measurementPolicyApi";

jest.mock("axios");

describe("measurementPolicyApi", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("AUTO loads policies without a client-selected node", async () => {
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

    expect(
      axios.get
    ).toHaveBeenCalledWith(
      `${serverURL}api/measurement/policies`,
      expect.objectContaining({
        withCredentials: true,
      })
    );
  });

  test("PINNED policy request uses only the encoded public nodeKey", async () => {
    axios.get.mockResolvedValue({
      data: {
        environment: { mode: "PINNED" },
        items: [],
      },
    });

    await fetchMeasurementPolicies(
      "node with/slash"
    );

    const [url, options] =
      axios.get.mock.calls[0];

    expect(url).toContain(
      "api/measurement/policies"
    );
    expect(url).toContain(
      "nodeKey=node%20with%2Fslash"
    );
    expect(url).not.toContain(
      "measurement_node_id"
    );
    expect(options).toMatchObject({
      withCredentials: true,
    });
  });

  test("node discovery uses the sanitized authenticated endpoint", async () => {
    const payload = {
      defaultMode: "AUTO",
      items: [],
      total: 0,
    };

    axios.get.mockResolvedValue({
      data: payload,
    });

    await expect(
      fetchMeasurementNodes()
    ).resolves.toEqual(payload);

    expect(
      axios.get
    ).toHaveBeenCalledWith(
      `${serverURL}api/measurement/nodes`,
      expect.objectContaining({
        withCredentials: true,
      })
    );
  });
});
