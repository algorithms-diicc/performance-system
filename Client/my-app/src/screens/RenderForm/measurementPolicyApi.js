import axios from "axios";

import { serverURL } from "../../common/Constants.js";

export const fetchMeasurementPolicies = async () => {
  const response = await axios.get(
    `${serverURL}api/measurement/policies`,
    {
      withCredentials: true,
      headers: {
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
      },
    }
  );

  return response.data;
};
