import { useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { ConfirmModal } from "@/components/ConfirmModal";
import { useCourseGuard } from "@/hooks/useCourseGuard";

const tabs = [
  { to: "/start", label: "Start" },
  { to: "/settings", label: "Settings" },
  { to: "/memo", label: "Memo" },
  { to: "/about", label: "About" },
];

export function Layout() {
  const { active, setActive } = useCourseGuard();
  const location = useLocation();
  const navigate = useNavigate();
  // Target path pending confirmation when navigating away mid-course.
  const [pending, setPending] = useState<string | null>(null);

  return (
    <div className="flex min-h-screen">
      {/*
        Pinned to the viewport so the tabs stay reachable however far the page
        scrolls — the result screen runs well past one screen. `h-screen` is
        what makes it stick: a stretched flex item is as tall as the content,
        and an element that tall has nothing left to scroll against.
      */}
      <nav className="sticky top-0 h-screen w-56 shrink-0 overflow-y-auto border-r border-white/10 p-4 flex flex-col gap-2">
        <div className="mb-4 px-2">
          <h1 className="text-lg font-bold">Typepedia</h1>
          <p className="text-[11px] text-white/40">
            タイピングしながら知識が増える
          </p>
        </div>
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            onClick={(e) => {
              // While a course is running, confirm before leaving the screen.
              if (active && tab.to !== location.pathname) {
                e.preventDefault();
                setPending(tab.to);
              }
            }}
            className={({ isActive }) =>
              `px-3 py-2 rounded-md transition-colors ${
                isActive
                  ? "bg-white/15 font-semibold"
                  : "hover:bg-white/5 text-white/70"
              }`
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </nav>
      <main className="flex-1 min-w-0">
        <Outlet />
      </main>

      {pending && (
        <ConfirmModal
          title="コースを終了しますか？"
          message="プレイ中です。移動するとこのコースは終了します。"
          confirmLabel="終了"
          onCancel={() => setPending(null)}
          onConfirm={() => {
            const to = pending;
            setPending(null);
            setActive(false);
            navigate(to);
          }}
        />
      )}
    </div>
  );
}
