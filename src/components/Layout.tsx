import { NavLink, Outlet } from "react-router-dom";

const tabs = [
  { to: "/start", label: "Start" },
  { to: "/settings", label: "Settings" },
];

export function Layout() {
  return (
    <div className="flex min-h-screen">
      <nav className="w-56 shrink-0 border-r border-white/10 p-4 flex flex-col gap-2">
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
    </div>
  );
}
