import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { useAuth, roleHome } from "@/context/AuthContext";
import FullScreenLoader from "@/components/FullScreenLoader";

// REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
export default function AuthCallback() {
  const { setUser } = useAuth();
  const navigate = useNavigate();
  const processed = useRef(false);

  useEffect(() => {
    if (processed.current) return;
    processed.current = true;

    const match = window.location.hash.match(/session_id=([^&]+)/);
    const sessionId = match ? decodeURIComponent(match[1]) : null;

    (async () => {
      if (!sessionId) {
        navigate("/login", { replace: true });
        return;
      }
      try {
        const { data } = await api.post("/auth/google/session", { session_id: sessionId });
        window.history.replaceState(null, "", window.location.pathname);
        setUser(data);
        const intended = localStorage.getItem("intended_role");
        if (intended === "tutor") {
          localStorage.removeItem("intended_role");
          if (data.role !== "tutor") {
            try { const r = await api.post("/auth/become-tutor"); setUser(r.data); } catch { /* ignore */ }
          }
          navigate("/onboarding/tutor", { replace: true });
          return;
        }
        if (data.status && data.status !== "approved" && data.role !== "admin") navigate("/pending", { replace: true });
        else navigate(roleHome(data.role), { replace: true });
      } catch {
        navigate("/login", { replace: true });
      }
    })();
  }, [navigate, setUser]);

  return <FullScreenLoader label="Memproses login Google..." />;
}
