import axios from "axios";

const contentDispositionFilename = (value) => {
  const header = String(value || "");
  const utf8Match = header.match(/filename\*=UTF-8''([^;]+)/i);

  if (utf8Match) {
    try {
      return decodeURIComponent(utf8Match[1].trim());
    } catch {
      return "";
    }
  }

  const quotedMatch = header.match(/filename="([^"]+)"/i);
  if (quotedMatch) return quotedMatch[1].trim();

  const plainMatch = header.match(/filename=([^;]+)/i);
  return plainMatch ? plainMatch[1].trim() : "";
};

export default async function downloadAuthenticatedFile(
  url,
  fallbackFilename
) {
  const response = await axios.get(url, {
    responseType: "blob",
    withCredentials: true,
  });
  const blob =
    response.data instanceof Blob
      ? response.data
      : new Blob([response.data]);
  const objectURL = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  const responseFilename = contentDispositionFilename(
    response.headers?.["content-disposition"]
  );

  try {
    anchor.href = objectURL;
    anchor.download = responseFilename || fallbackFilename || "download";
    document.body.appendChild(anchor);
    anchor.click();
  } finally {
    anchor.remove();
    window.URL.revokeObjectURL(objectURL);
  }

  return response;
}

export { contentDispositionFilename };
