import { rootRouteId } from "@tanstack/react-router";
import { describe, expect, it } from "vitest";

import { router } from "@/router";

describe("App routing", () => {
  it.each(["/", "/dostawa", "/o-nas", "/kontakt"])(
    "matches a page for %s instead of falling back to not found",
    (path) => {
      const matches = router.matchRoutes(path);
      expect(matches.at(-1)?.routeId).not.toBe(rootRouteId);
    },
  );
});
