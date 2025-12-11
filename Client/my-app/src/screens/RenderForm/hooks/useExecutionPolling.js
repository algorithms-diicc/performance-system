// src/hooks/useExecutionPolling.js
import { useEffect, useState } from "react";
import axios from "axios";
import { serverURL } from "../../../common/Constants.js"; // ✅ ruta corregida

/**
 * Hook responsable de:
 * - Consultar periódicamente el estado de cada código en fileList
 * - Construir la estructura de mensajes por archivo
 * - Indicar cuándo todos los archivos terminaron (allDone = true)
 *
 * No toca isSubmitting ni check directamente: eso lo maneja el contenedor.
 */
function useExecutionPolling(fileList, intervalMs = 3000) {
  const [messages, setMessages] = useState([]);
  const [allDone, setAllDone] = useState(false);

  useEffect(() => {
    if (!fileList || fileList.length === 0) {
      setMessages([]);
      setAllDone(false);
      return;
    }

    let cancelled = false;

    const poll = () => {
      const requests = fileList.map((code) =>
        axios
          .get(`${serverURL}status/${code}_status.json`, {
            headers: { "Cache-Control": "no-cache" },
          })
          .then((res) => ({
            codename: code,
            originalName:
              res.data.files && res.data.files.length > 0
                ? res.data.files[0].original_filename
                : code,
            messages: res.data.messages || [],
          }))
          .catch(() => null)
      );

      Promise.all(requests).then((results) => {
        if (cancelled) return;

        let allMessages = [];
        let done = true;

        results.forEach((res) => {
          if (res && Array.isArray(res.messages)) {
            allMessages.push({
              codename: res.codename,
              originalName: res.originalName,
              messages: res.messages,
            });

            const isDone = res.messages.some((m) =>
              m.msg.includes("✅ Resultados listos.")
            );
            if (!isDone) done = false;
          }
        });

        if (allMessages.length > 0) {
          setMessages(allMessages);
        }

        // Solo marcamos done cuando hay mensajes y todos llegaron a “Resultados listos”
        setAllDone(allMessages.length > 0 && done);
      });
    };

    // Primera consulta inmediata
    poll();
    const id = setInterval(poll, intervalMs);

    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [fileList, intervalMs]);

  return { messages, allDone };
}

export default useExecutionPolling;
