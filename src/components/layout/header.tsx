import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Loader2, User, Plus } from "lucide-react";
import { AddPatientDialog } from "@/components/patient/add-patient-dialog";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/use-auth";
import { formatMyKad, cn } from "@/lib/utils";
import { useNavStore } from "@/lib/nav-store";

interface SearchResult {
  id: string;
  nama: string;
  nombor_kad_pengenalan: string | null;
  nombor_pendaftaran_hospital: string | null;
}

export function Header() {
  const { can } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [open, setOpen] = useState(false);
  const [showAddPatient, setShowAddPatient] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const setNavSource = useNavStore((s) => s.setNavSource);

  const canViewPatients = can("view_patients");

  // Debounce 300ms
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const { data: results, isFetching } = useQuery({
    queryKey: ["patient-search", debounced],
    enabled: canViewPatients && debounced.trim().length >= 2 && open,
    queryFn: async () => {
      const term = debounced.trim();
      const orFilter = `nama.ilike.%${term}%,nombor_kad_pengenalan.ilike.%${term}%,nombor_pendaftaran_hospital.ilike.%${term}%`;
      const { data, error } = await supabase
        .from("patients")
        .select("id, nama, nombor_kad_pengenalan, nombor_pendaftaran_hospital")
        .eq("aktif", true)
        .is("merged_into", null)
        .or(orFilter)
        .order("nama", { ascending: true })
        .limit(10);
      if (error) throw error;
      return (data ?? []) as SearchResult[];
    },
    staleTime: 30_000,
  });

  const handleSelect = (id: string) => {
    setOpen(false);
    setQuery("");
    setNavSource("search");
    navigate(`/pesakit/${id}?from=search`);
  };

  const showDropdown =
    open && canViewPatients && debounced.trim().length >= 2;

  return (
    <>
      <style>{`
        @keyframes headerOrbFloat1 {
          0%, 100% { transform: translate(0, 0); }
          50% { transform: translate(15px, 8px); }
        }
        @keyframes headerOrbFloat2 {
          0%, 100% { transform: translate(0, 0); }
          50% { transform: translate(-12px, 10px); }
        }
        @keyframes headerOrbFloat3 {
          0%, 100% { transform: translate(0, 0); }
          50% { transform: translate(8px, -12px); }
        }
        @-webkit-keyframes headerOrbFloat1 {
          0%, 100% { transform: translate(0, 0); }
          50% { transform: translate(15px, 8px); }
        }
        @-webkit-keyframes headerOrbFloat2 {
          0%, 100% { transform: translate(0, 0); }
          50% { transform: translate(-12px, 10px); }
        }
        @-webkit-keyframes headerOrbFloat3 {
          0%, 100% { transform: translate(0, 0); }
          50% { transform: translate(8px, -12px); }
        }
        .header-orb-1 { animation: headerOrbFloat1 12s ease-in-out infinite; -webkit-animation: headerOrbFloat1 12s ease-in-out infinite; }
        .header-orb-2 { animation: headerOrbFloat2 15s ease-in-out infinite; -webkit-animation: headerOrbFloat2 15s ease-in-out infinite; }
        .header-orb-3 { animation: headerOrbFloat3 18s ease-in-out infinite; -webkit-animation: headerOrbFloat3 18s ease-in-out infinite; }
        .header-search-input::-webkit-search-decoration,
        .header-search-input::-webkit-search-cancel-button,
        .header-search-input::-webkit-search-results-button,
        .header-search-input::-webkit-search-results-decoration {
          -webkit-appearance: none;
        }
      `}</style>

      <header
        className="sticky top-0 z-40"
        style={{
          background: "rgba(255,255,255,0.95)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          borderBottom: "1px solid rgba(0,0,0,0.06)",
          boxShadow:
            "0 2px 8px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
          height: 64,
        }}
      >
        {/* Gradient background overlay */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "linear-gradient(90deg, rgba(24,119,242,0.03) 0%, rgba(124,58,237,0.02) 50%, rgba(6,182,212,0.02) 100%)",
          }}
        />

        {/* Orbs - positioned at top of header, partially hidden */}
        <div
          className="absolute inset-0 overflow-hidden pointer-events-none"
          aria-hidden
        >
          <div
            className="header-orb-1 absolute rounded-full"
            style={{
              width: 200,
              height: 200,
              top: -60,
              left: "10%",
              background: "rgba(24,119,242,0.06)",
              filter: "blur(40px)",
            }}
          />
          <div
            className="header-orb-2 absolute rounded-full"
            style={{
              width: 160,
              height: 160,
              top: -30,
              right: "20%",
              background: "rgba(124,58,237,0.05)",
              filter: "blur(40px)",
            }}
          />
          <div
            className="header-orb-3 absolute rounded-full"
            style={{
              width: 120,
              height: 120,
              top: -40,
              left: "50%",
              background: "rgba(6,182,212,0.05)",
              filter: "blur(40px)",
            }}
          />
        </div>

        <div className="relative h-full px-4 md:px-6 flex items-center justify-between gap-3">
          {/* Search bar (centered on desktop, full width on mobile) */}
          {canViewPatients ? (
            <div
              ref={containerRef}
              className="relative flex-1 max-w-[480px] mx-auto"
            >
              <div className="relative">
                <Search
                  className={cn(
                    "absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors",
                    open ? "text-primary" : "text-muted-foreground"
                  )}
                />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setOpen(true);
                  }}
                  onFocus={() => setOpen(true)}
                  placeholder="Cari pesakit..."
                  className="header-search-input w-full h-10 pl-10 pr-10 text-sm rounded-[14px] border border-transparent transition-all outline-none"
                  style={{
                    background: open ? "white" : "rgba(24,119,242,0.04)",
                    borderColor: open
                      ? "rgba(24,119,242,0.3)"
                      : "transparent",
                    boxShadow: open
                      ? "0 0 0 4px rgba(24,119,242,0.1), 0 1px 2px rgba(0,0,0,0.05)"
                      : "none",
                  }}
                />
                {isFetching && (
                  <Loader2 className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-primary animate-spin" />
                )}
              </div>

              {showDropdown && (
                <div
                  className="absolute left-0 right-0 top-full mt-2 bg-white rounded-[14px] border border-blue-100 overflow-hidden z-50"
                  style={{
                    boxShadow:
                      "0 12px 40px rgba(0,0,0,0.12), 0 4px 12px rgba(0,0,0,0.06)",
                    maxHeight: 320,
                    overflowY: "auto",
                  }}
                >
                  {results && results.length > 0 ? (
                    <ul className="py-1">
                      {results.map((p) => (
                        <li key={p.id}>
                          <button
                            type="button"
                            // Use mousedown to fire before blur
                            onMouseDown={(e) => {
                              e.preventDefault();
                              handleSelect(p.id);
                            }}
                            className="w-full text-left px-4 py-2.5 hover:bg-blue-50/60 transition-colors border-b border-blue-50/50 last:border-b-0"
                          >
                            <div className="flex items-center gap-2">
                              <User className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                              <p className="text-[13px] font-semibold text-foreground truncate">
                                {p.nama}
                              </p>
                            </div>
                            {(p.nombor_kad_pengenalan ||
                              p.nombor_pendaftaran_hospital) && (
                              <div className="mt-0.5 ml-5.5 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                                {p.nombor_kad_pengenalan && (
                                  <span>KP: {formatMyKad(p.nombor_kad_pengenalan)}</span>
                                )}
                                {p.nombor_pendaftaran_hospital && (
                                  <span>Hosp: {p.nombor_pendaftaran_hospital}</span>
                                )}
                              </div>
                            )}
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : !isFetching ? (
                    <div className="py-6 text-center space-y-3">
                      <p className="text-sm text-muted-foreground">Tiada pesakit dijumpai.</p>
                      {can("manage_patients") && (
                        <button type="button" onClick={() => { setShowAddPatient(true); setOpen(false); }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors"
                          style={{ background: "linear-gradient(135deg, #1877f2, #0d5bd4)", color: "white", boxShadow: "0 2px 8px rgba(24,119,242,0.25)" }}>
                          <Plus className="w-3 h-3" /> Daftar Pesakit Baharu
                        </button>
                      )}
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1" />
          )}
        </div>
      <AddPatientDialog open={showAddPatient} onOpenChange={setShowAddPatient} />
      </header>
    </>
  );
}
