const BASE_URL = import.meta.env.VITE_BACKEND_URL;

export const saveUser = async (name) => {
  const res = await fetch(`${BASE_URL}/api/users`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name })
  });

  return res.json();
};
