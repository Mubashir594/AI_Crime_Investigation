export const getApiBaseCandidates = () => {
  const envBase = import.meta?.env?.VITE_API_BASE;
  const saved = window.localStorage.getItem("api_base");
  const host = window.location.hostname || "localhost";
  const preferred = `http://${host}:8000`;
  const fallback = ["http://localhost:8000", "http://127.0.0.1:8000"];

  return [envBase, saved, preferred, ...fallback].filter(
    (value, index, arr) => value && arr.indexOf(value) === index
  );
};

export const getApiBase = () => getApiBaseCandidates()[0];
