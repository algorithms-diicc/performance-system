import axios from "axios";

import { serverURL } from "../../common/Constants.js";

const requestOptions = {
  withCredentials: true,
  headers: {
    "Cache-Control": "no-cache",
    Pragma: "no-cache",
  },
};

export const fetchMeasurementPolicies = async (
  nodeKey = null
) => {
  const normalizedNodeKey =
    String(nodeKey || "").trim();

  const query = normalizedNodeKey
    ? `?nodeKey=${encodeURIComponent(
        normalizedNodeKey
      )}`
    : "";

  const response = await axios.get(
    `${serverURL}api/measurement/policies${query}`,
    requestOptions
  );

  return response.data;
};

export const fetchMeasurementNodes = async () => {
  const response = await axios.get(
    `${serverURL}api/measurement/nodes`,
    requestOptions
  );

  return response.data;
};
