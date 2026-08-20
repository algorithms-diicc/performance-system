import { useEffect, useState } from "react";
import axios from "axios";
import { serverURL } from "../../../common/Constants.js";
import { friendlyRequestError } from "../../../common/requestErrorModel";
import { useI18n } from "../../../i18n";
import {
  aggregatePollingState,
  indexExecutionRecords,
  normalizeExecutionSnapshot,
} from "./executionPollingModel";

function useExecutionPolling(
  fileList,
  executionRecords,
  intervalMs = 3000
) {
  const { t } = useI18n();
  const [messages, setMessages] = useState([]);
  const [executionFiles, setExecutionFiles] = useState([]);
  const [allDone, setAllDone] = useState(false);
  const [allTerminal, setAllTerminal] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [firstErrorMessage, setFirstErrorMessage] =
    useState("");
  const [requestError, setRequestError] = useState("");
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    if (!Array.isArray(fileList) || fileList.length === 0) {
      setMessages([]);
      setExecutionFiles([]);
      setAllDone(false);
      setAllTerminal(false);
      setHasError(false);
      setFirstErrorMessage("");
      setRequestError("");
      return;
    }

    const recordsByCodename =
      indexExecutionRecords(executionRecords);

    const missingPublicId = fileList.some((codename) => {
      const record = recordsByCodename.get(codename);
      return !record?.publicId;
    });

    if (missingPublicId) {
      setMessages([]);
      setExecutionFiles([]);
      setAllDone(false);
      setAllTerminal(false);
      setHasError(true);
      setFirstErrorMessage(
        t("renderForm.workflow.polling.missingPersistentId")
      );
      setRequestError("");
      return;
    }

    let cancelled = false;
    let timeoutId = null;

    const poll = async () => {
      setRequestError("");

      const requests = fileList.map(async (codename) => {
        const descriptor = recordsByCodename.get(codename);

        try {
          const response = await axios.get(
            `${serverURL}api/executions/${encodeURIComponent(
              descriptor.publicId
            )}`,
            {
              withCredentials: true,
              headers: {
                "Cache-Control": "no-cache",
                Pragma: "no-cache",
              },
            }
          );

          return normalizeExecutionSnapshot(
            response.data?.execution || {},
            descriptor
          );
        } catch (error) {
          return {
            publicId: descriptor.publicId,
            codename,
            originalName:
              descriptor.originalFilename || codename,
            status: "",
            state: "",
            stateVersion: 0,
            terminal: false,
            taskType: "",
            inputSize: null,
            samples: null,
            messages: [],
            resultsReady: false,
            hasError: false,
            errorMessage: "",
            resultAvailable: false,
            resultsUrl: null,
            failure: null,
            unavailable: true,
            requestStatus: error?.response?.status || null,
            requestError: friendlyRequestError(
              error,
              t("renderForm.workflow.polling.unavailable"),
              {
                404: t(
                  "renderForm.workflow.polling.notFound"
                ),
              }
            ),
          };
        }
      });

      const results = await Promise.all(requests);
      if (cancelled) return;

      setExecutionFiles(results);

      setMessages(
        results.map((item) => ({
          publicId: item.publicId,
          codename: item.codename,
          originalName: item.originalName,
          status: item.status,
          state: item.state,
          messages: item.messages,
        }))
      );

      const everySnapshotAvailable =
        results.length === fileList.length &&
        results.every((item) => !item.unavailable);

      if (everySnapshotAvailable) {
        const aggregate = aggregatePollingState(results);

        setAllDone(aggregate.allDone);
        setAllTerminal(aggregate.allTerminal);
        setHasError(aggregate.hasError);
        setFirstErrorMessage(aggregate.firstErrorMessage);

        if (!aggregate.allTerminal && !cancelled) {
          timeoutId = window.setTimeout(poll, intervalMs);
        }
      } else {
        setAllDone(false);
        setAllTerminal(false);
        setHasError(false);
        setFirstErrorMessage("");
        setRequestError(
          results.find((item) => item.unavailable)
            ?.requestError ||
            t("renderForm.workflow.polling.unavailable")
        );
      }
    };

    poll();

    return () => {
      cancelled = true;
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [
    fileList,
    executionRecords,
    intervalMs,
    retryToken,
    t,
  ]);

  const retryPolling = () => {
    setRetryToken((value) => value + 1);
  };

  return {
    messages,
    executionFiles,
    allDone,
    allTerminal,
    hasError,
    firstErrorMessage,
    requestError,
    retryPolling,
  };
}

export default useExecutionPolling;
