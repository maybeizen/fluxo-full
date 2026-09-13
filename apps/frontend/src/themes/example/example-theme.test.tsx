import { createMemoryHistory, createRouter, RouterProvider } from "@tanstack/react-router";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { AppProviders } from "@/app/providers";
import { routeTree } from "@/routeTree.gen";

async function renderLanding(themeId?: string) {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({
      initialEntries: ["/"],
    }),
  });
  await router.load();
  return render(
    <AppProviders themeId={themeId}>
      <RouterProvider router={router} />
    </AppProviders>,
  );
}

afterEach(() => {
  cleanup();
});

describe("example theme", () => {
  it("shows the navbar override and translation override", async () => {
    await renderLanding("example");

    await waitFor(() => {
      expect(document.querySelector("[data-theme='example']")).toBeInTheDocument();
    });
    expect(screen.getByText("Example theme badge")).toBeInTheDocument();
    expect(screen.queryByText("FX-01 / Control plane")).not.toBeInTheDocument();
  });

  it("keeps default theme copy and UI unchanged", async () => {
    await renderLanding("default");

    expect(document.querySelector("[data-theme='example']")).not.toBeInTheDocument();
    expect(screen.getByText("FX-01 / Control plane")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "The billing panel for game-server hosts.",
      }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Example theme badge")).not.toBeInTheDocument();
  });
});
