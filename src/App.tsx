import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { CourseGuardProvider } from "@/hooks/useCourseGuard";
import { MemoPage } from "@/pages/MemoPage";
import { SettingsPage } from "@/pages/SettingsPage";
import { StartPage } from "@/pages/StartPage";
import "./index.css";

export function App() {
  return (
    <CourseGuardProvider>
      <HashRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Navigate to="/start" replace />} />
            <Route path="/start" element={<StartPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/memo" element={<MemoPage />} />
            <Route path="*" element={<Navigate to="/start" replace />} />
          </Route>
        </Routes>
      </HashRouter>
    </CourseGuardProvider>
  );
}

export default App;
