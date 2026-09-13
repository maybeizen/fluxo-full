import { createMemoryHistory, createRouter, RouterProvider } from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AppProviders } from "@/app/providers";
import { routeTree } from "@/routeTree.gen";

async function renderMfa() {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({
      initialEntries: ["/mfa"],
    }),
  });
  await router.load();
  return render(
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>,
  );
}

describe("MFA page", () => {
  it("shows the OTP input", async () => {
    await renderMfa();

    expect(await screen.findByLabelText(/authentication code/i)).toBeInTheDocument();
    expect(document.querySelectorAll("[data-slot='input-otp-slot']")).toHaveLength(6);
  });
});
