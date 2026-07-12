/**
 * Test preload: register happy-dom globals (window/document/localStorage/
 * KeyboardEvent/…) so React components and the game's window keydown listener
 * can be exercised under `bun test`, and clean up rendered trees after each test.
 *
 * happy-dom must be registered BEFORE @testing-library/dom is imported: its
 * `screen` binds to `document.body` at module-eval time, so the global document
 * has to exist first. Hence the dynamic import after register().
 */
import { afterEach } from "bun:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";

GlobalRegistrator.register();

const { cleanup } = await import("@testing-library/react");

afterEach(() => {
  cleanup();
});
