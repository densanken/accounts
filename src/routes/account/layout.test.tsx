import { render, screen } from "@testing-library/react";
import { createRoutesStub } from "react-router";
import { describe, expect, it } from "vitest";
import AccountLayout from "./layout";

describe("AccountLayout", () => {
  it("renders nav, the theme toggle, and the matched child route", () => {
    const Stub = createRoutesStub([
      {
        id: "root",
        path: "/",
        loader: () => ({ theme: "system" }),
        Component: AccountLayout,
        children: [{ index: true, Component: () => <p>child content</p> }],
      },
    ]);

    render(
      <Stub
        initialEntries={["/"]}
        hydrationData={{ loaderData: { root: { theme: "system" } } }}
      />
    );

    expect(
      screen.getByRole("link", { name: "プロフィール" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "外部アカウント連携" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "ログアウト" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "システム" })
    ).toBeInTheDocument();
    expect(screen.getByText("child content")).toBeInTheDocument();
  });
});
