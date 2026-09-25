import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRoutesStub } from "react-router";
import { describe, expect, it } from "vitest";
import { ThemeToggle } from "./theme-toggle";

const renderThemeToggle = (
  theme: string,
  themeAction: (args: { request: Request }) => unknown = () => null
) => {
  const Stub = createRoutesStub([
    {
      id: "root",
      path: "/",
      loader: () => ({ theme }),
      Component: ThemeToggle,
    },
    { path: "/theme", action: themeAction },
  ]);

  return render(
    <Stub
      initialEntries={["/"]}
      hydrationData={{ loaderData: { root: { theme } } }}
    />
  );
};

describe("ThemeToggle", () => {
  it("labels the trigger with the current theme and marks it in the menu", async () => {
    const user = userEvent.setup();
    renderThemeToggle("dark");

    const trigger = screen.getByRole("button", { name: "ダーク" });
    expect(trigger).toBeInTheDocument();

    await user.click(trigger);

    expect(
      await screen.findByRole("menuitemradio", { name: "ダーク" })
    ).toHaveAttribute("aria-checked", "true");
    expect(
      screen.getByRole("menuitemradio", { name: "ライト" })
    ).toHaveAttribute("aria-checked", "false");
    expect(
      screen.getByRole("menuitemradio", { name: "システム" })
    ).toHaveAttribute("aria-checked", "false");
  });

  it("submits the selected theme via the fetcher when an option is chosen", async () => {
    const user = userEvent.setup();
    let submittedTheme: FormDataEntryValue | null = null;
    renderThemeToggle("system", async ({ request }) => {
      const formData = await request.formData();
      submittedTheme = formData.get("theme");
      return null;
    });

    await user.click(screen.getByRole("button", { name: "システム" }));
    await user.click(
      await screen.findByRole("menuitemradio", { name: "ライト" })
    );

    expect(submittedTheme).toBe("light");
  });
});
