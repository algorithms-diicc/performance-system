const EXECUTION_QUERY_KEY = "execution";

export function parseExecutionPublicIds(search = "") {
  const params = new URLSearchParams(search);
  const seen = new Set();

  return params
    .getAll(EXECUTION_QUERY_KEY)
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .filter((value) => {
      if (seen.has(value)) return false;
      seen.add(value);
      return true;
    });
}

export function buildExecutionSearch(executions = []) {
  const params = new URLSearchParams();

  if (!Array.isArray(executions)) {
    return "";
  }

  executions.forEach((execution) => {
    const publicId = String(execution?.publicId || "").trim();
    if (publicId) params.append(EXECUTION_QUERY_KEY, publicId);
  });

  const query = params.toString();
  return query ? `?${query}` : "";
}

export function buildRecoveredExecutionState(snapshots = []) {
  if (!Array.isArray(snapshots) || snapshots.length === 0) {
    return null;
  }

  const valid = snapshots.filter(
    (snapshot) => snapshot && snapshot.publicId && snapshot.codename
  );
  if (valid.length === 0) return null;

  const first = valid[0];
  const executions = valid.map((snapshot) => ({
    publicId: snapshot.publicId,
    codename: snapshot.codename,
    originalFilename: snapshot.originalFilename || snapshot.codename,
  }));

  return {
    executionSnapshot: {
      testName: first.submissionTitle || "Ejecución recuperada",
      fileName:
        executions.length === 1
          ? executions[0].originalFilename
          : `${executions.length} archivos`,
      taskTitle: first.benchmark || "-",
      inputSize: first.inputSize,
      inputSizeLabel:
        first.inputSize !== null && first.inputSize !== undefined
          ? String(first.inputSize)
          : "-",
      samples: first.samples,
      samplesLabel:
        first.samples !== null && first.samples !== undefined
          ? `${first.samples} por punto`
          : "-",
      profileLabel: first.executionProfile || "-",
      environmentLabel: first.hardwareProfile || "Entorno registrado",
      dataTypeLabel: "-",
      submissionId: first.submissionId ?? null,
      executions,
      recoveredFromPersistence: true,
    },
    fileList: executions.map((execution) => execution.codename),
    allTerminal: valid.every((snapshot) => snapshot.terminal === true),
    firstSnapshot: first,
  };
}
