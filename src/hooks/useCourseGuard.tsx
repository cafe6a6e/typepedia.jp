import { createContext, type ReactNode, useContext, useState } from "react";

interface CourseGuard {
  /** True while a course is in progress (playing). */
  active: boolean;
  setActive: (v: boolean) => void;
}

const CourseGuardContext = createContext<CourseGuard>({
  active: false,
  setActive: () => {},
});

export function CourseGuardProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState(false);
  return (
    <CourseGuardContext.Provider value={{ active, setActive }}>
      {children}
    </CourseGuardContext.Provider>
  );
}

export function useCourseGuard() {
  return useContext(CourseGuardContext);
}
