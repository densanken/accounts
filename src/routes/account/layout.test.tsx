import { render, screen } from "@testing-library/react";
import { createRoutesStub } from "react-router";
import { describe, expect, it } from "vitest";
import AccountLayout from "./layout";

describe("AccountLayout", () => {
  it("renders nav, the theme toggle, and the matched child route when authenticated", () => {
    const Stub = createRoutesStub([
      {
        id: "root",
        path: "/",
        loader: () => ({ theme: "system", authenticated: true }),
        Component: AccountLayout,
        children: [{ index: true, Component: () => <p>child content</p> }],
      },
    ]);

    render(
      <Stub
        initialEntries={["/"]}
        hydrationData={{
          loaderData: { root: { theme: "system", authenticated: true } },
        }}
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

  it("renders a login screen instead of the child route when unauthenticated", () => {
    const Stub = createRoutesStub([
      {
        id: "root",
        path: "/",
        loader: () => ({ authenticated: false }),
        Component: AccountLayout,
        children: [{ index: true, Component: () => <p>child content</p> }],
      },
    ]);

    render(
      <Stub
        initialEntries={["/"]}
        hydrationData={{ loaderData: { root: { authenticated: false } } }}
      />
    );

    expect(
      screen.getByRole("link", { name: "Sign in with CCS ID" })
    ).toHaveAttribute("href", "/auth/login");
    expect(
      screen.queryByRole("link", { name: "プロフィール" })
    ).not.toBeInTheDocument();
    expect(screen.queryByText("child content")).not.toBeInTheDocument();
  });

  it("shows a mapped error banner from the error query param", () => {
    const Stub = createRoutesStub([
      {
        id: "root",
        path: "/",
        loader: () => ({ authenticated: false }),
        Component: AccountLayout,
      },
    ]);

    render(
      <Stub
        initialEntries={["/?error=access_denied"]}
        hydrationData={{ loaderData: { root: { authenticated: false } } }}
      />
    );

    expect(
      screen.getByText("ログインがキャンセルされました")
    ).toBeInTheDocument();
  });

  it("shows a generic error banner for an unrecognized error code", () => {
    const Stub = createRoutesStub([
      {
        id: "root",
        path: "/",
        loader: () => ({ authenticated: false }),
        Component: AccountLayout,
      },
    ]);

    render(
      <Stub
        initialEntries={["/?error=server_error"]}
        hydrationData={{ loaderData: { root: { authenticated: false } } }}
      />
    );

    expect(screen.getByText("ログインに失敗しました")).toBeInTheDocument();
  });
});
