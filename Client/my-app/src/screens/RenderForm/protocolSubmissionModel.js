export function appendProtocolId(
  formData,
  protocol
) {
  if (
    !formData ||
    typeof formData.append !== "function"
  ) {
    return false;
  }

  const protocolId =
    Number(protocol?.id);

  if (
    !Number.isSafeInteger(protocolId) ||
    protocolId <= 0
  ) {
    return false;
  }

  formData.append(
    "protocol_id",
    String(protocolId)
  );

  return true;
}
